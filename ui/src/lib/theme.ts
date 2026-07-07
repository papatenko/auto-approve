/* Fixed green action color (shadcn's green theme); light/dark follows the OS. */
export function initTheme() {
  const root = document.documentElement;
  root.dataset.accent = 'green';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => root.classList.toggle('dark', media.matches);
  media.addEventListener('change', apply);
  apply();
}
