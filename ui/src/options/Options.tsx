import { useCallback, useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

import { AccentPicker, ModeSelect } from '@/components/appearance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, DEFAULTS, getSettings, saveSettings, type LogEntry, type Settings } from '@/lib/ext';
import { applyAppearance, type Mode } from '@/lib/theme';

export function Options() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [keywordsText, setKeywordsText] = useState('');
  const [intervalDraft, setIntervalDraft] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [savedFlash, setSavedFlash] = useState(false);
  const [zoomed, setZoomed] = useState<number | null>(null);

  const loadSettings = useCallback(async () => {
    const s = await getSettings();
    applyAppearance(s.theme, s.accent);
    setSettings(s);
    setKeywordsText(s.keywords.join('\n'));
    setIntervalDraft(String(s.intervalSec));
  }, []);

  const loadLog = useCallback(async () => {
    const { clickLog = [], stats = { clicks: 0 } } = await api.storage.local.get(['clickLog', 'stats']);
    setLog(clickLog as LogEntry[]);
    setTotalClicks((stats as { clicks?: number }).clicks || 0);
  }, []);

  useEffect(() => {
    loadSettings();
    loadLog();
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') return;
      if (changes.clickLog || changes.stats) loadLog();
      if (changes.settings) {
        const next = (changes.settings.newValue || {}) as Partial<Settings>;
        applyAppearance(next.theme, next.accent);
      }
    };
    api.storage.onChanged.addListener(onChanged);
    return () => api.storage.onChanged.removeListener(onChanged);
  }, [loadSettings, loadLog]);

  if (!settings) return null;

  const patch = async (p: Partial<Settings>) => {
    const next = { ...settings, ...p };
    setSettings(next);
    await saveSettings(next);
  };

  const setIntervalValue = (value: string | number) => {
    const parsed = Number(value);
    const intervalSec = Number.isFinite(parsed)
      ? Math.min(60, Math.max(2, parsed))
      : settings.intervalSec;
    setIntervalDraft(String(intervalSec));
    setSettings({ ...settings, intervalSec });
  };

  const save = async () => {
    let keywords = keywordsText
      .split('\n')
      .map((k) => k.replace(/\s+/g, ' ').trim().toLowerCase())
      .filter(Boolean);
    if (keywords.length === 0) keywords = [...DEFAULTS.keywords];
    const intervalSec = Math.min(60, Math.max(2, Number(intervalDraft) || DEFAULTS.intervalSec));
    await patch({ keywords, intervalSec });
    setKeywordsText(keywords.join('\n'));
    setIntervalDraft(String(intervalSec));
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const clearLog = async () => {
    await api.storage.local.set({ clickLog: [], stats: { clicks: 0 } });
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
      <header className="flex items-center gap-3">
        <img src="./icons/icon48.png" alt="" className="size-8" />
        <h1 className="text-2xl font-semibold tracking-tight">Auto Approve</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Button keywords</CardTitle>
          <CardDescription>
            One per line. A button is clicked when its visible label matches one of these words (case-insensitive).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Textarea
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            spellCheck={false}
            className="max-w-xs font-mono"
            rows={9}
          />

          <div className="flex items-start gap-3">
            <Switch
              id="contains"
              checked={settings.containsMatch}
              onCheckedChange={(v) => patch({ containsMatch: v })}
            />
            <Label htmlFor="contains" className="block font-normal leading-snug">
              Also match buttons that merely <em>contain</em> a keyword (e.g. “Accept all”). Broader, but riskier.
            </Label>
          </div>

          <div className="flex items-start gap-3">
            <Switch id="shots" checked={settings.captureShots} onCheckedChange={(v) => patch({ captureShots: v })} />
            <Label htmlFor="shots" className="block font-normal leading-snug">
              Capture a screenshot of the visible tab on every click (audit log below).
            </Label>
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor="interval" className="font-normal">
              Scan interval
            </Label>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Decrease scan interval"
              className="size-8"
              onClick={() => setIntervalValue(settings.intervalSec - 1)}
            >
              <Minus className="size-3.5" />
            </Button>
            <Input
              id="interval"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="h-8 w-10 px-2 text-center"
              value={intervalDraft}
              onChange={(e) => setIntervalDraft(e.target.value.replace(/\D/g, ''))}
              onBlur={(e) => setIntervalValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setIntervalValue((e.target as HTMLInputElement).value)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Increase scan interval"
              className="size-8"
              onClick={() => setIntervalValue(settings.intervalSec + 1)}
            >
              <Plus className="size-3.5" />
            </Button>
            <span className="text-muted-foreground text-sm">seconds</span>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save}>Save settings</Button>
            {savedFlash && <span className="text-sm font-medium text-primary">Saved ✓</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Light/dark mode and the action color used across the extension.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Label className="font-normal">Mode</Label>
            <ModeSelect
              size="default"
              value={settings.theme}
              onChange={(theme: Mode) => {
                applyAppearance(theme, settings.accent);
                patch({ theme });
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className="font-normal">Action color</Label>
            <AccentPicker
              value={settings.accent}
              onChange={(accent) => {
                applyAppearance(settings.theme, accent);
                patch({ accent });
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Click log{' '}
            <span className="text-muted-foreground text-sm font-normal">
              ({totalClicks} total clicks, {log.length} logged)
            </span>
          </CardTitle>
          <CardDescription>
            Newest first. Screenshots are kept for the most recent clicks only and never leave your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Button variant="outline" onClick={clearLog}>
              Clear log
            </Button>
          </div>

          {log.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">No clicks recorded yet.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {log.map((entry, i) => {
                const texts = Array.isArray(entry.texts) ? entry.texts : [entry.text ?? ''];
                return (
                  <div key={`${entry.ts}-${i}`} className="flex gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {texts.map((t) => `“${t}”`).join(', ')}
                        {texts.length > 1 && (
                          <span className="text-muted-foreground font-normal"> ({texts.length} buttons)</span>
                        )}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {new Date(entry.ts).toLocaleString()}
                      </div>
                      <div className="text-muted-foreground truncate text-xs" title={entry.url}>
                        {entry.title ? `${entry.title} — ${entry.url}` : entry.url}
                      </div>
                    </div>
                    {entry.shot && (
                      <img
                        src={entry.shot}
                        alt="Screenshot at time of click"
                        onClick={() => setZoomed(zoomed === i ? null : i)}
                        className={
                          zoomed === i
                            ? 'w-full max-w-xl cursor-zoom-out rounded-md border'
                            : 'w-44 shrink-0 cursor-zoom-in self-start rounded-md border'
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
