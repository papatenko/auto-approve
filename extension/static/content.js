/*
 * Auto Approve — content script.
 * Runs in every frame, but stays dormant until the background script marks
 * this tab as watched. While watched (and the extension is enabled), it scans
 * the DOM on the configured interval and clicks buttons whose text matches
 * the configured keywords, reporting each click to the background script.
 */
(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  const DEFAULTS = {
    enabled: true,
    intervalSec: 5,
    keywords: ['accept', 'approve', 'yes', 'allow', 'confirm', 'ok', 'okay', 'continue'],
    containsMatch: false,
  };

  const SELECTOR = 'button, [role="button"], input[type="button"], input[type="submit"], a';
  const MAX_CLICKS_PER_SCAN = 50; // safety valve against pathological pages
  const ELEMENT_COOLDOWN_MS = 20000;
  const TEXT_COOLDOWN_MS = 10000;
  const SCAN_NODE_BUDGET = 15000;

  let settings = { ...DEFAULTS };
  let watched = false;
  let timer = null;

  const elementCooldown = new WeakMap();
  const textCooldown = new Map();

  function normalize(text) {
    return (text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/[.!…]+$/, '');
  }

  function textOf(el) {
    if (el instanceof HTMLInputElement) return normalize(el.value);
    return normalize(el.innerText || el.textContent) || normalize(el.getAttribute('aria-label'));
  }

  function isDisabled(el) {
    return el.disabled === true || el.getAttribute('aria-disabled') === 'true';
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && parseFloat(style.opacity) > 0.1;
  }

  function matchesKeywords(text) {
    if (!text) return false;
    if (settings.containsMatch) {
      // In contains mode, long labels ("I accept the terms and conditions of…")
      // are too ambiguous to click safely.
      if (text.length > 60) return false;
      return settings.keywords.some((k) => k && text.includes(k));
    }
    return settings.keywords.includes(text);
  }

  // Yields clickable candidates in the document plus any open shadow roots,
  // bounded by a node budget so huge pages don't get an unbounded walk.
  function* candidates(root, budget) {
    for (const el of root.querySelectorAll(SELECTOR)) {
      if (budget.n-- <= 0) return;
      yield el;
    }
    for (const el of root.querySelectorAll('*')) {
      if (budget.n-- <= 0) return;
      if (el.shadowRoot) yield* candidates(el.shadowRoot, budget);
    }
  }

  function fireClick(el) {
    const opts = { bubbles: true, cancelable: true, composed: true, view: window };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
    } catch (e) {
      /* some pages lock down event constructors; el.click() below still runs */
    }
    el.click();
  }

  function scan() {
    if (!watched || !settings.enabled) return;
    const scanStart = Date.now();
    let clicks = 0;
    const budget = { n: SCAN_NODE_BUDGET };

    // Collect every match first, then click them all in one pass, so a page
    // with many pending Approve/Accept buttons is cleared in a single sweep
    // even if clicking one mutates the DOM around the others.
    const targets = [];
    for (const el of candidates(document, budget)) {
      if (targets.length >= MAX_CLICKS_PER_SCAN) break;
      if (isDisabled(el)) continue;
      const text = textOf(el);
      if (!matchesKeywords(text)) continue;
      if (!isVisible(el)) continue;
      if (scanStart - (elementCooldown.get(el) || 0) < ELEMENT_COOLDOWN_MS) continue;
      // The text cooldown only blocks matches from *previous* scans (it guards
      // against re-rendered copies of an already-clicked button). Multiple
      // distinct buttons with the same label in this scan all get clicked.
      const lastText = textCooldown.get(text) || 0;
      if (lastText !== scanStart && scanStart - lastText < TEXT_COOLDOWN_MS) continue;

      targets.push({ el, text });
      elementCooldown.set(el, scanStart);
      textCooldown.set(text, scanStart);
    }

    const clickedTexts = [];
    for (const { el, text } of targets) {
      if (!el.isConnected) continue; // removed by an earlier click this sweep
      fireClick(el);
      clicks++;
      clickedTexts.push(text);
    }

    if (clickedTexts.length > 0) {
      try {
        // One message per sweep: the whole batch becomes a single log entry
        // with a single screenshot, and avoids racing writes in the background.
        api.runtime.sendMessage({ type: 'clicked', texts: clickedTexts, href: location.href });
      } catch (e) {
        /* extension context can go away during navigation; nothing to do */
      }
    }
    return clicks;
  }

  function syncTimer() {
    const shouldRun = watched && settings.enabled;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (shouldRun) {
      const ms = Math.max(2, Number(settings.intervalSec) || DEFAULTS.intervalSec) * 1000;
      timer = setInterval(scan, ms);
      scan();
    }
  }

  function applySettings(stored) {
    settings = { ...DEFAULTS, ...(stored || {}) };
    settings.keywords = (settings.keywords || [])
      .map((k) => normalize(k))
      .filter(Boolean);
    syncTimer();
  }

  api.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'state') {
      watched = !!msg.watched;
      if (msg.settings) applySettings(msg.settings);
      else syncTimer();
    }
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      applySettings(changes.settings.newValue);
    }
  });

  // Ask the background script whether this tab is watched. Retry briefly in
  // case the event page / service worker is still starting up.
  function hello(attempt = 0) {
    let p;
    try {
      p = api.runtime.sendMessage({ type: 'hello' });
    } catch (e) {
      p = Promise.reject(e);
    }
    Promise.resolve(p)
      .then((res) => {
        if (!res) throw new Error('no response');
        watched = !!res.watched;
        applySettings(res.settings);
      })
      .catch(() => {
        if (attempt < 3) setTimeout(() => hello(attempt + 1), 500 * (attempt + 1));
      });
  }

  hello();

  // Restored from the back/forward cache: re-sync state.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) hello();
  });
})();
