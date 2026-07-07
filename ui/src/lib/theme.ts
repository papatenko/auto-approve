export type Mode = 'auto' | 'light' | 'dark';

/* shadcn/ui's default theme colors, used here as switchable action colors.
 * `swatch` is only for the picker dots. "zinc" is the shadcn default. */
export const ACCENTS = [
  { id: 'zinc', label: 'Zinc', swatch: '#52525b' },
  { id: 'red', label: 'Red', swatch: '#dc2626' },
  { id: 'rose', label: 'Rose', swatch: '#e11d48' },
  { id: 'orange', label: 'Orange', swatch: '#ea580c' },
  { id: 'green', label: 'Green', swatch: '#16a34a' },
  { id: 'blue', label: 'Blue', swatch: '#2563eb' },
  { id: 'yellow', label: 'Yellow', swatch: '#ca8a04' },
  { id: 'violet', label: 'Violet', swatch: '#7c3aed' },
] as const;

const media = window.matchMedia('(prefers-color-scheme: dark)');
let currentMode: Mode = 'auto';

function applyDarkClass() {
  const dark = currentMode === 'dark' || (currentMode === 'auto' && media.matches);
  document.documentElement.classList.toggle('dark', dark);
}

media.addEventListener('change', applyDarkClass);

export function applyAppearance(mode: Mode | undefined, accent: string | undefined) {
  currentMode = mode === 'light' || mode === 'dark' ? mode : 'auto';
  applyDarkClass();
  const root = document.documentElement;
  if (accent && accent !== 'zinc') root.dataset.accent = accent;
  else delete root.dataset.accent; // zinc = shadcn default tokens
}
