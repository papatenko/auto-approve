export type Mode = 'auto' | 'light' | 'dark';

/* Fixed green action color (shadcn's green theme); light/dark follows the
 * chosen mode, falling back to the OS preference in 'auto'. */
const media = window.matchMedia('(prefers-color-scheme: dark)');
let currentMode: Mode = 'auto';

function applyDark() {
  const dark = currentMode === 'dark' || (currentMode === 'auto' && media.matches);
  document.documentElement.classList.toggle('dark', dark);
}

media.addEventListener('change', applyDark);

export function initTheme() {
  document.documentElement.dataset.accent = 'green';
  applyDark();
}

export function applyMode(mode: Mode) {
  currentMode = mode === 'light' || mode === 'dark' ? mode : 'auto';
  applyDark();
}
