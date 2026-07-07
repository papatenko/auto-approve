import { useCallback, useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { api, send, type Settings } from '@/lib/ext';
import { applyAppearance } from '@/lib/theme';

interface PopupState {
  settings: Settings;
  clicks: number;
  groupsSupported: boolean;
  hostAccess: boolean;
  tabId: number | null;
  tabWatchable: boolean;
  manuallyWatched: boolean;
  inGroup: boolean;
  watched: boolean;
}

export function Popup() {
  const [state, setState] = useState<PopupState | null>(null);
  const [intervalDraft, setIntervalDraft] = useState('');

  const refresh = useCallback(async () => {
    const next = await send<PopupState>({ type: 'popup:getState' });
    applyAppearance(next.settings.theme, next.settings.accent);
    setIntervalDraft(String(next.settings.intervalSec));
    setState(next);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!state) return <div className="w-[300px] p-4" />;

  const { settings } = state;

  const setEnabled = async (enabled: boolean) => {
    await send({ type: 'popup:setEnabled', enabled });
    refresh();
  };

  const setInterval = async (value: string | number) => {
    const parsed = Number(value);
    const intervalSec = Number.isFinite(parsed)
      ? Math.min(60, Math.max(2, parsed))
      : settings.intervalSec;
    setIntervalDraft(String(intervalSec));
    await send({ type: 'popup:setInterval', intervalSec });
    refresh();
  };

  const setWatch = async (watch: boolean) => {
    if (state.tabId === null) return;
    await send({ type: 'popup:watchTab', tabId: state.tabId, watch });
    refresh();
  };

  const setGroup = async (join: boolean) => {
    if (state.tabId === null) return;
    await send({ type: 'popup:groupTab', tabId: state.tabId, join });
    refresh();
  };

  const grant = async () => {
    try {
      await api.permissions.request({ origins: ['<all_urls>'] });
    } catch {
      /* user dismissed */
    }
    refresh();
  };

  const status = !settings.enabled
    ? 'Paused — nothing will be clicked.'
    : state.watched
      ? `Watching this tab — scanning every ${settings.intervalSec}s.`
      : !state.tabWatchable
        ? 'This page can’t be watched (browser page).'
        : 'This tab is not being watched.';

  return (
    <div className="w-[300px] p-4 text-sm">
      <header className="mb-3 flex items-center gap-2">
        <img src="./icons/icon32.png" alt="" className="size-5" />
        <h1 className="flex-1 text-[15px] font-semibold">Auto Approve</h1>
        <Badge title="Total buttons clicked">{state.clicks}</Badge>
      </header>

      {!state.hostAccess && (
        <div className="border-destructive/40 bg-destructive/10 mb-3 rounded-md border p-2.5 text-xs">
          This extension needs access to websites to work.
          <Button variant="outline" size="sm" className="mt-2 w-full" onClick={grant}>
            Grant site access
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between py-1.5">
          <Label htmlFor="enabled">Extension enabled</Label>
          <Switch id="enabled" checked={settings.enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="flex items-center justify-between py-1.5">
          <Label htmlFor="interval">Scan every</Label>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Decrease scan interval"
              className="size-8"
              onClick={() => setInterval(settings.intervalSec - 1)}
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
              onBlur={(e) => setInterval(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setInterval((e.target as HTMLInputElement).value)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Increase scan interval"
              className="size-8"
              onClick={() => setInterval(settings.intervalSec + 1)}
            >
              <Plus className="size-3.5" />
            </Button>
            <span className="text-muted-foreground">s</span>
          </div>
        </div>
      </div>

      <Separator className="my-2" />

      <div className="flex flex-col gap-1" data-disabled={!state.tabWatchable}>
        <div className="flex items-center justify-between py-1.5">
          <Label htmlFor="watch" className={!state.tabWatchable ? 'opacity-50' : ''}>
            Watch this tab
          </Label>
          <Switch id="watch" disabled={!state.tabWatchable} checked={state.manuallyWatched} onCheckedChange={setWatch} />
        </div>

        {state.groupsSupported && (
          <>
            <div className="flex items-center justify-between py-1.5">
              <Label htmlFor="group" className={!state.tabWatchable ? 'opacity-50' : ''}>
                In “Auto-Approve” tab group
              </Label>
              <Switch id="group" disabled={!state.tabWatchable} checked={state.inGroup} onCheckedChange={setGroup} />
            </div>
            <p className="text-muted-foreground text-xs">
              Any tab moved into the “Auto-Approve” group is watched automatically.
            </p>
          </>
        )}
      </div>

      <p className={`mt-2 min-h-4 text-xs ${state.watched && settings.enabled ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
        {status}
      </p>

      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        onClick={() => api.runtime.openOptionsPage()}
      >
        Keywords, log &amp; screenshots →
      </Button>
    </div>
  );
}
