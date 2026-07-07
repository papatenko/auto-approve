import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { api, send, type Settings } from '@/lib/ext';

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

/* A rounded section "bubble", GNOME/Material style: rows inside, hairline
 * dividers between them, gaps all around the outside. */
function Bubble({ children }: { children: ReactNode }) {
  return <section className="divide-border/60 bg-card divide-y rounded-3xl px-4 py-1">{children}</section>;
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex min-h-12 items-center justify-between gap-3 py-2">{children}</div>;
}

export function Popup() {
  const [state, setState] = useState<PopupState | null>(null);

  const refresh = useCallback(async () => {
    setState(await send<PopupState>({ type: 'popup:getState' }));
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

  const setInterval = async (value: string) => {
    await send({ type: 'popup:setInterval', intervalSec: Number(value) });
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
    <div className="flex w-[300px] flex-col gap-3 p-3 text-sm">
      <header className="flex items-center gap-2 px-2 pt-1">
        <img src="./icons/icon32.png" alt="" className="size-5" />
        <h1 className="flex-1 text-[15px] font-semibold">Auto Approve</h1>
        <Badge className="rounded-full" title="Total buttons clicked">
          {state.clicks}
        </Badge>
      </header>

      {!state.hostAccess && (
        <section className="border-destructive/40 bg-destructive/10 rounded-3xl border p-3.5 text-xs">
          This extension needs access to websites to work.
          <Button variant="outline" size="sm" className="mt-2 w-full rounded-full" onClick={grant}>
            Grant site access
          </Button>
        </section>
      )}

      <Bubble>
        <Row>
          <Label htmlFor="enabled">Extension enabled</Label>
          <Switch id="enabled" checked={settings.enabled} onCheckedChange={setEnabled} />
        </Row>
        <Row>
          <Label htmlFor="interval">Scan every</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="interval"
              type="number"
              min={2}
              max={60}
              className="h-8 w-16 rounded-full text-right"
              defaultValue={settings.intervalSec}
              onBlur={(e) => setInterval(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setInterval((e.target as HTMLInputElement).value)}
            />
            <span className="text-muted-foreground">s</span>
          </div>
        </Row>
      </Bubble>

      <Bubble>
        <Row>
          <Label htmlFor="watch" className={!state.tabWatchable ? 'opacity-50' : ''}>
            Watch this tab
          </Label>
          <Switch id="watch" disabled={!state.tabWatchable} checked={state.manuallyWatched} onCheckedChange={setWatch} />
        </Row>
        {state.groupsSupported && (
          <>
            <Row>
              <Label htmlFor="group" className={!state.tabWatchable ? 'opacity-50' : ''}>
                In “Auto-Approve” tab group
              </Label>
              <Switch id="group" disabled={!state.tabWatchable} checked={state.inGroup} onCheckedChange={setGroup} />
            </Row>
            <p className="text-muted-foreground py-2.5 text-xs">
              Any tab moved into the “Auto-Approve” group is watched automatically.
            </p>
          </>
        )}
      </Bubble>

      <section className="bg-card rounded-3xl px-4 py-3">
        <p className={`text-xs ${state.watched && settings.enabled ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
          {status}
        </p>
      </section>

      <footer className="px-2 pb-1">
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => api.runtime.openOptionsPage()}>
          Keywords, log &amp; screenshots →
        </Button>
      </footer>
    </div>
  );
}
