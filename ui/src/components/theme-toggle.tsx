import { type Mode } from '@/lib/theme';
import { cn } from '@/lib/utils';

const MODES: { id: Mode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

/* Pill segmented control for Auto / Light / Dark, matching the bubble UI. */
export function ThemeToggle({ value, onChange }: { value: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className="bg-muted inline-flex rounded-full p-0.5" role="radiogroup" aria-label="Color mode">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={value === m.id}
          onClick={() => onChange(m.id)}
          className={cn(
            'cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors',
            value === m.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
