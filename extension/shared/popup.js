const api = typeof browser !== 'undefined' ? browser : chrome;

const $ = (id) => document.getElementById(id);

let state = null;

function send(msg) {
  return api.runtime.sendMessage(msg);
}

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme; // auto: follow the OS
  }
}

function render() {
  if (!state) return;
  applyTheme(state.settings.theme);
  $('theme').value = state.settings.theme || 'auto';
  $('clicks').textContent = String(state.clicks);
  $('enabled').checked = !!state.settings.enabled;
  $('interval').value = state.settings.intervalSec;
  $('watch').checked = state.manuallyWatched;
  $('group').checked = state.inGroup;

  $('watch-row').classList.toggle('disabled', !state.tabWatchable);
  $('group-row').classList.toggle('disabled', !state.tabWatchable);

  if (!state.groupsSupported) {
    $('group-row').classList.add('hidden');
    $('group-hint').classList.add('hidden');
  }

  $('perm-warning').classList.toggle('hidden', state.hostAccess);

  const status = $('status');
  if (!state.settings.enabled) {
    status.textContent = 'Paused — nothing will be clicked.';
    status.classList.remove('active');
  } else if (state.watched) {
    status.textContent = `Watching this tab — scanning every ${state.settings.intervalSec}s.`;
    status.classList.add('active');
  } else if (!state.tabWatchable) {
    status.textContent = 'This page can’t be watched (browser page).';
    status.classList.remove('active');
  } else {
    status.textContent = 'This tab is not being watched.';
    status.classList.remove('active');
  }
}

async function refresh() {
  state = await send({ type: 'popup:getState' });
  render();
}

$('enabled').addEventListener('change', async (e) => {
  await send({ type: 'popup:setEnabled', enabled: e.target.checked });
  await refresh();
});

$('interval').addEventListener('change', async (e) => {
  await send({ type: 'popup:setInterval', intervalSec: Number(e.target.value) });
  await refresh();
});

$('watch').addEventListener('change', async (e) => {
  if (!state || state.tabId === null) return;
  await send({ type: 'popup:watchTab', tabId: state.tabId, watch: e.target.checked });
  await refresh();
});

$('group').addEventListener('change', async (e) => {
  if (!state || state.tabId === null) return;
  await send({ type: 'popup:groupTab', tabId: state.tabId, join: e.target.checked });
  await refresh();
});

$('grant').addEventListener('click', async () => {
  try {
    await api.permissions.request({ origins: ['<all_urls>'] });
  } catch (e) {
    /* user dismissed */
  }
  await refresh();
});

$('theme').addEventListener('change', async (e) => {
  applyTheme(e.target.value);
  await send({ type: 'popup:setTheme', theme: e.target.value });
});

$('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  api.runtime.openOptionsPage();
});

refresh();
