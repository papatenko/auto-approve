import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ACCENTS, type Mode } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function ModeSelect({
  value,
  onChange,
  size = 'sm',
}: {
  value: Mode;
  onChange: (mode: Mode) => void;
  size?: 'sm' | 'default';
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Mode)}>
      <SelectTrigger size={size} aria-label="Color mode">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="auto">Auto</SelectItem>
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function AccentPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (accent: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} role="radiogroup" aria-label="Action color">
      {ACCENTS.map((a) => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={value === a.id}
          title={a.label}
          onClick={() => onChange(a.id)}
          className={cn(
            'size-5 cursor-pointer rounded-full border border-black/10 transition-transform hover:scale-110 dark:border-white/20',
            value === a.id && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
          )}
          style={{ backgroundColor: a.swatch }}
        />
      ))}
    </div>
  );
}
