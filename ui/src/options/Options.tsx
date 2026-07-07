import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, DEFAULTS, getSettings, saveSettings, type LogEntry, type Settings } from '@/lib/ext';

/* Bubble look: big radius, no border/shadow, floating on the muted canvas. */
const BUBBLE = 'rounded-3xl border-0 shadow-none';

export function Options() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [keywordsText, setKeywordsText] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [savedFlash, setSavedFlash] = useState(false);
  const [zoomed, setZoomed] = useState<number | null>(null);

  const loadSettings = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);
    setKeywordsText(s.keywords.join('\n'));
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

  const save = async () => {
    let keywords = keywordsText
      .split('\n')
      .map((k) => k.replace(/\s+/g, ' ').trim().toLowerCase())
      .filter(Boolean);
    if (keywords.length === 0) keywords = [...DEFAULTS.keywords];
    const intervalSec = Math.min(60, Math.max(2, Number(settings.intervalSec) || DEFAULTS.intervalSec));
    await patch({ keywords, intervalSec });
    setKeywordsText(keywords.join('\n'));
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const clearLog = async () => {
    await api.storage.local.set({ clickLog: [], stats: { clicks: 0 } });
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-8">
      <header className="flex items-center gap-3 px-2">
        <img src="./icons/icon48.png" alt="" className="size-8" />
        <h1 className="text-2xl font-semibold tracking-tight">Auto Approve</h1>
      </header>

      <Card className={BUBBLE}>
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
            className="max-w-xs rounded-2xl font-mono"
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
            <Input
              id="interval"
              type="number"
              min={2}
              max={60}
              className="w-20 rounded-full"
              value={settings.intervalSec}
              onChange={(e) => setSettings({ ...settings, intervalSec: Number(e.target.value) })}
            />
            <span className="text-muted-foreground text-sm">seconds</span>
          </div>

          <div className="flex items-center gap-3">
            <Button className="rounded-full" onClick={save}>
              Save settings
            </Button>
            {savedFlash && <span className="text-sm font-medium text-primary">Saved ✓</span>}
          </div>
        </CardContent>
      </Card>

      <Card className={BUBBLE}>
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
            <Button variant="outline" className="rounded-full" onClick={clearLog}>
              Clear log
            </Button>
          </div>

          {log.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">No clicks recorded yet.</p>
          ) : (
            <div className="divide-border/60 flex flex-col divide-y">
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
                            ? 'w-full max-w-xl cursor-zoom-out rounded-2xl'
                            : 'w-44 shrink-0 cursor-zoom-in self-start rounded-2xl'
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
