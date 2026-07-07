/*
 * Auto Approve — background script (MV3 service worker in Chrome, event page
 * in Firefox). Owns the "which tabs are watched" state, the tab group, the
 * click log, and screenshot capture.
 *
 * A tab is watched if it was toggled on manually from the popup, or if it is
 * a member of the "Auto-Approve" tab group (where the browser supports tab
 * groups). Watched state lives in storage.session so it survives service
 * worker restarts but resets with the browser.
 */
const api = typeof browser !== 'undefined' ? browser : chrome;

const DEFAULTS = {
  enabled: true,
  intervalSec: 5,
  keywords: ['accept', 'approve', 'yes', 'allow', 'confirm', 'ok', 'okay', 'continue'],
  containsMatch: false,
  captureShots: true,
  maxLogEntries: 100,
  maxScreenshots: 30,
  theme: 'auto',
  accent: 'green',
};

// Badge colors matching the shadcn accent themes selectable in the UI.
const ACCENT_BADGE_COLORS = {
  zinc: '#52525b',
  red: '#dc2626',
  rose: '#e11d48',
  orange: '#ea580c',
  green: '#16a34a',
  blue: '#2563eb',
  yellow: '#ca8a04',
  violet: '#7c3aed',
};

const TAB_GROUP_TITLE = 'Auto-Approve';
const NO_GROUP = -1;

const groupsSupported = !!(api.tabGroups && api.tabs.group);

// In-memory fallback for browsers without storage.session.
const memorySession = new Map();

async function sessionGet(key, fallback) {
  try {
    const obj = await api.storage.session.get(key);
    return obj[key] !== undefined ? obj[key] : fallback;
  } catch (e) {
    return memorySession.has(key) ? memorySession.get(key) : fallback;
  }
}

async function sessionSet(key, value) {
  try {
    await api.storage.session.set({ [key]: value });
  } catch (e) {
    memorySession.set(key, value);
  }
}

async function getSettings() {
  const { settings } = await api.storage.local.get('settings');
  return { ...DEFAULTS, ...(settings || {}) };
}

async function getManualTabs() {
  return sessionGet('manualTabs', []);
}

async function setManualTabs(ids) {
  await sessionSet('manualTabs', ids);
}

async function getGroupId() {
  return sessionGet('groupId', null);
}

async function isTabWatched(tab) {
  if (!tab || tab.id === undefined) return false;
  const manual = await getManualTabs();
  if (manual.includes(tab.id)) return true;
  const groupId = await getGroupId();
  return groupId !== null && tab.groupId === groupId;
}

async function pushStateToTab(tab) {
  if (!tab || tab.id === undefined) return;
  const [watched, settings] = await Promise.all([isTabWatched(tab), getSettings()]);
  try {
    await api.tabs.sendMessage(tab.id, { type: 'state', watched, settings });
  } catch (e) {
    /* tab has no content script (chrome:// pages, not yet loaded, …) */
  }
  updateBadge();
}

async function watchedTabCount() {
  const manual = await getManualTabs();
  const ids = new Set(manual);
  const groupId = await getGroupId();
  if (groupId !== null) {
    try {
      const tabs = await api.tabs.query({});
      for (const t of tabs) if (t.groupId === groupId) ids.add(t.id);
    } catch (e) {
      /* ignore */
    }
  }
  return ids.size;
}

async function updateBadge() {
  try {
    const settings = await getSettings();
    if (!settings.enabled) {
      await api.action.setBadgeText({ text: 'off' });
      await api.action.setBadgeBackgroundColor({ color: '#6b7280' });
      return;
    }
    const count = await watchedTabCount();
    await api.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    await api.action.setBadgeBackgroundColor({
      color: ACCENT_BADGE_COLORS[settings.accent] || ACCENT_BADGE_COLORS.green,
    });
  } catch (e) {
    /* action API can be unavailable in rare contexts */
  }
}

// ---------------------------------------------------------------------------
// Tab group handling

async function ensureGroupFor(tabId) {
  if (!groupsSupported) return null;
  let groupId = await getGroupId();
  if (groupId !== null) {
    try {
      await api.tabGroups.get(groupId);
    } catch (e) {
      groupId = null; // group was closed
    }
  }
  if (groupId === null) {
    groupId = await api.tabs.group({ tabIds: [tabId] });
    try {
      await api.tabGroups.update(groupId, { title: TAB_GROUP_TITLE, color: 'green' });
    } catch (e) {
      /* cosmetic only */
    }
  } else {
    await api.tabs.group({ tabIds: [tabId], groupId });
  }
  await sessionSet('groupId', groupId);
  return groupId;
}

async function removeFromGroup(tabId) {
  if (!groupsSupported) return;
  try {
    await api.tabs.ungroup(tabId);
  } catch (e) {
    /* already ungrouped */
  }
}

// ---------------------------------------------------------------------------
// Click log + screenshots

let lastCaptureAt = 0;

async function captureIfVisible(tab, settings) {
  if (!settings.captureShots || !tab || !tab.active) return null;
  // captureVisibleTab is rate-limited by the browser; stay under the quota.
  const now = Date.now();
  if (now - lastCaptureAt < 1200) return null;
  lastCaptureAt = now;
  try {
    return await api.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 55 });
  } catch (e) {
    return null;
  }
}

async function recordClick(msg, sender) {
  const settings = await getSettings();
  const tab = sender.tab;
  const shot = tab ? await captureIfVisible(tab, settings) : null;

  const texts = (Array.isArray(msg.texts) ? msg.texts : [msg.text])
    .map((t) => String(t || '').slice(0, 120))
    .filter(Boolean);
  if (texts.length === 0) return;

  const { clickLog = [], stats = { clicks: 0 } } = await api.storage.local.get(['clickLog', 'stats']);

  clickLog.unshift({
    ts: Date.now(),
    texts,
    url: String(msg.href || (tab && tab.url) || '').slice(0, 500),
    title: tab ? String(tab.title || '').slice(0, 200) : '',
    shot,
  });

  while (clickLog.length > settings.maxLogEntries) clickLog.pop();
  let shots = 0;
  for (const entry of clickLog) {
    if (entry.shot && ++shots > settings.maxScreenshots) entry.shot = null;
  }

  stats.clicks = (stats.clicks || 0) + texts.length;
  await api.storage.local.set({ clickLog, stats });
}

// Log writes are read-modify-write on storage; serialize them so concurrent
// sweeps (multiple frames or tabs) can't drop each other's entries.
let recordQueue = Promise.resolve();
function enqueueRecordClick(msg, sender) {
  recordQueue = recordQueue
    .catch(() => {})
    .then(() => recordClick(msg, sender));
  return recordQueue;
}

// ---------------------------------------------------------------------------
// Messages

async function handleMessage(msg, sender) {
  switch (msg && msg.type) {
    case 'hello': {
      const watched = await isTabWatched(sender.tab);
      return { watched, settings: await getSettings() };
    }

    case 'clicked': {
      await enqueueRecordClick(msg, sender);
      return { ok: true };
    }

    case 'popup:getState': {
      const settings = await getSettings();
      const { stats = { clicks: 0 } } = await api.storage.local.get('stats');
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      const groupId = await getGroupId();
      const manual = await getManualTabs();
      let hostAccess = true;
      try {
        hostAccess = await api.permissions.contains({ origins: ['<all_urls>'] });
      } catch (e) {
        /* assume granted where the API is unavailable */
      }
      return {
        settings,
        clicks: stats.clicks || 0,
        groupsSupported,
        hostAccess,
        tabId: tab ? tab.id : null,
        tabWatchable: !!(tab && tab.url && /^(https?|file):/.test(tab.url)),
        manuallyWatched: !!(tab && manual.includes(tab.id)),
        inGroup: !!(tab && groupId !== null && tab.groupId === groupId),
        watched: tab ? await isTabWatched(tab) : false,
      };
    }

    case 'popup:setEnabled': {
      const settings = await getSettings();
      settings.enabled = !!msg.enabled;
      await api.storage.local.set({ settings });
      await updateBadge();
      return { ok: true };
    }

    case 'popup:setInterval': {
      const settings = await getSettings();
      const sec = Math.min(60, Math.max(2, Number(msg.intervalSec) || DEFAULTS.intervalSec));
      settings.intervalSec = sec;
      await api.storage.local.set({ settings });
      return { ok: true, intervalSec: sec };
    }

    case 'popup:setTheme': {
      const settings = await getSettings();
      settings.theme = ['light', 'dark'].includes(msg.theme) ? msg.theme : 'auto';
      await api.storage.local.set({ settings });
      return { ok: true };
    }

    case 'popup:setAccent': {
      const settings = await getSettings();
      settings.accent = Object.prototype.hasOwnProperty.call(ACCENT_BADGE_COLORS, msg.accent)
        ? msg.accent
        : DEFAULTS.accent;
      await api.storage.local.set({ settings });
      await updateBadge();
      return { ok: true };
    }

    case 'popup:watchTab': {
      const manual = await getManualTabs();
      const idx = manual.indexOf(msg.tabId);
      if (msg.watch && idx === -1) manual.push(msg.tabId);
      if (!msg.watch && idx !== -1) manual.splice(idx, 1);
      await setManualTabs(manual);
      try {
        const tab = await api.tabs.get(msg.tabId);
        await pushStateToTab(tab);
      } catch (e) {
        /* tab gone */
      }
      return { ok: true };
    }

    case 'popup:groupTab': {
      if (msg.join) await ensureGroupFor(msg.tabId);
      else await removeFromGroup(msg.tabId);
      try {
        const tab = await api.tabs.get(msg.tabId);
        await pushStateToTab(tab);
      } catch (e) {
        /* tab gone */
      }
      return { ok: true };
    }

    default:
      return undefined;
  }
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse, (err) => {
    console.error('Auto Accept: message failed', err);
    sendResponse({ ok: false, error: String(err) });
  });
  return true; // async response
});

// ---------------------------------------------------------------------------
// Tab lifecycle

api.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Group membership changes arrive here (Chrome 88+/Firefox 139+); a push on
  // load completion is a harmless re-sync alongside the content script's hello.
  if ('groupId' in changeInfo) await pushStateToTab(tab);
  else if (changeInfo.status === 'complete') await updateBadge();
});

api.tabs.onRemoved.addListener(async (tabId) => {
  const manual = await getManualTabs();
  const idx = manual.indexOf(tabId);
  if (idx !== -1) {
    manual.splice(idx, 1);
    await setManualTabs(manual);
  }
  await updateBadge();
});

if (groupsSupported && api.tabGroups.onRemoved) {
  api.tabGroups.onRemoved.addListener(async (group) => {
    const groupId = await getGroupId();
    if (group.id === groupId) await sessionSet('groupId', null);
    await updateBadge();
  });
}

api.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) updateBadge();
});

updateBadge();
