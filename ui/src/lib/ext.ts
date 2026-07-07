/* Thin wrapper over the WebExtension API, working in Chrome and Firefox. */

declare const browser: typeof chrome | undefined;

export const api: typeof chrome = typeof browser !== 'undefined' ? browser : chrome;

export interface Settings {
  enabled: boolean;
  intervalSec: number;
  keywords: string[];
  containsMatch: boolean;
  captureShots: boolean;
  maxLogEntries: number;
  maxScreenshots: number;
  theme: 'auto' | 'light' | 'dark';
}

export const DEFAULTS: Settings = {
  enabled: true,
  intervalSec: 5,
  keywords: ['accept', 'approve', 'yes', 'allow', 'confirm', 'ok', 'okay', 'continue'],
  containsMatch: false,
  captureShots: true,
  maxLogEntries: 100,
  maxScreenshots: 30,
  theme: 'auto',
};

export interface LogEntry {
  ts: number;
  texts?: string[];
  text?: string;
  url: string;
  title: string;
  shot: string | null;
}

export function send<T = unknown>(msg: unknown): Promise<T> {
  return api.runtime.sendMessage(msg) as Promise<T>;
}

export async function getSettings(): Promise<Settings> {
  const { settings } = await api.storage.local.get('settings');
  return { ...DEFAULTS, ...((settings as Partial<Settings>) || {}) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await api.storage.local.set({ settings });
}
