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
};

const $ = (id) => document.getElementById(id);

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme; // auto: follow the OS
  }
}

async function getSettings() {
  const { settings } = await api.storage.local.get('settings');
  return { ...DEFAULTS, ...(settings || {}) };
}

async function loadSettings() {
  const s = await getSettings();
  applyTheme(s.theme);
  $('keywords').value = s.keywords.join('\n');
  $('contains').checked = s.containsMatch;
  $('shots').checked = s.captureShots;
  $('interval').value = s.intervalSec;
}

$('save').addEventListener('click', async () => {
  const s = await getSettings();
  s.keywords = $('keywords')
    .value.split('\n')
    .map((k) => k.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter(Boolean);
  if (s.keywords.length === 0) s.keywords = [...DEFAULTS.keywords];
  s.containsMatch = $('contains').checked;
  s.captureShots = $('shots').checked;
  s.intervalSec = Math.min(60, Math.max(2, Number($('interval').value) || DEFAULTS.intervalSec));
  await api.storage.local.set({ settings: s });
  await loadSettings();
  $('saved').textContent = 'Saved ✓';
  setTimeout(() => ($('saved').textContent = ''), 2000);
});

$('clear').addEventListener('click', async () => {
  await api.storage.local.set({ clickLog: [], stats: { clicks: 0 } });
  await renderLog();
});

async function renderLog() {
  const { clickLog = [], stats = { clicks: 0 } } = await api.storage.local.get(['clickLog', 'stats']);
  $('count').textContent = `(${stats.clicks || 0} total clicks, ${clickLog.length} logged)`;
  const log = $('log');
  log.textContent = '';

  if (clickLog.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No clicks recorded yet.';
    log.appendChild(p);
    return;
  }

  for (const entry of clickLog) {
    const div = document.createElement('div');
    div.className = 'entry';

    const meta = document.createElement('div');
    meta.className = 'meta';

    const texts = Array.isArray(entry.texts) ? entry.texts : [entry.text];
    const text = document.createElement('div');
    text.className = 'btn-text';
    text.textContent =
      texts.map((t) => `“${t}”`).join(', ') + (texts.length > 1 ? ` (${texts.length} buttons)` : '');

    const when = document.createElement('div');
    when.className = 'when';
    when.textContent = new Date(entry.ts).toLocaleString();

    const url = document.createElement('div');
    url.className = 'url';
    url.textContent = entry.title ? `${entry.title} — ${entry.url}` : entry.url;
    url.title = entry.url;

    meta.append(text, when, url);
    div.appendChild(meta);

    if (entry.shot) {
      const img = document.createElement('img');
      img.src = entry.shot;
      img.alt = 'Screenshot at time of click';
      img.addEventListener('click', () => img.classList.toggle('zoomed'));
      div.appendChild(img);
    }

    log.appendChild(div);
  }
}

api.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.clickLog || changes.stats)) renderLog();
  if (area === 'local' && changes.settings) {
    applyTheme((changes.settings.newValue || {}).theme);
  }
});

loadSettings();
renderLog();
