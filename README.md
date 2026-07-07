# Auto Approve

A Chrome + Firefox extension that watches the tabs you choose and automatically
clicks **Accept / Approve / Yes / Allow / Confirm / OK / Continue** style
buttons on an interval (default every 5 seconds), until you turn it off. Every
sweep clicks **all** matching buttons on the page at once — not one at a time —
and records a click log with a **screenshot** of the tab as an audit trail.

Nothing ever leaves your browser: the log and screenshots are stored locally
in extension storage.

The popup and options pages are built with **React + [shadcn/ui](https://ui.shadcn.com)**
(Tailwind CSS v4) in a bubbly, GNOME/Material-You-inspired layout: rounded
section cards floating on a muted background. An Auto / Light / Dark theme
toggle is available in both the popup and options page (Auto follows your OS);
the action color is shadcn's green theme.

## Features

- **Interval scanner** — every 2–60 s (default 5 s, adjustable in the popup),
  each watched tab is scanned for clickable elements (buttons, `role="button"`,
  submit inputs, links — including inside open shadow DOM and iframes).
- **Clicks everything that matches in one sweep**, with cooldowns so the same
  button isn't hammered repeatedly across sweeps.
- **Custom keywords** — edit the list on the options page (one word per line,
  exact label match by default; an opt-in "contains" mode also matches labels
  like "Accept all").
- **Two ways to watch a tab**:
  - toggle **"Watch this tab"** in the toolbar popup, or
  - put tabs in the **"Auto-Approve" tab group** (created via the popup) —
    every tab in the group is watched automatically. Tab groups work in Chrome
    and Firefox 139+; on older Firefox the group row is hidden and per-tab
    watching still works.
- **Screenshot audit log** — each sweep that clicked something adds a log entry
  (which buttons, page, time) plus a JPEG screenshot of the visible tab.
  Browse, zoom, and clear it from the options page.
- **Light & dark mode** — Auto / Light / Dark toggle in the popup and options
  page; Auto follows your OS.
- **Badge** shows how many tabs are currently being watched, or `off` when the
  extension is paused.

## Build

Requires Node 18+.

```sh
./build.sh
```

This installs UI dependencies on first run, builds the React UI with Vite,
then assembles `dist/chrome/` and `dist/firefox/` (built UI + background &
content scripts + browser-specific manifest) and zips each. Icons are
pre-generated; regenerate them with `python3 tools/make_icons.py`.

## Install

### Chrome / Edge / Brave

1. Run `./build.sh`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select `dist/chrome/`.

### Firefox

1. Run `./build.sh`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and pick `dist/firefox/manifest.json`
   (or install `dist/auto-approve-firefox.zip` as an unsigned add-on in
   Developer Edition/Nightly via `xpinstall.signatures.required = false`).
4. **Important (Firefox MV3):** host permissions are opt-in. Open
   `about:addons` → Auto Approve → **Permissions** and enable
   *Access your data for all websites*, or click **Grant site access** in the
   popup when prompted. Without this the content script cannot run.

## Use

1. Click the toolbar icon.
2. Flip **Watch this tab** on the tab you want automated (or add it to the
   Auto-Approve tab group).
3. Leave it running. The badge counts watched tabs; the popup shows total
   clicks; the options page has the full log with screenshots.
4. Flip **Extension enabled** off (or unwatch the tab) to stop.

## Safety notes

- The extension only acts on tabs you explicitly watch — never on every tab.
- Exact-label matching is the default; short, unambiguous labels only.
  Long labels ("I accept the terms and conditions…") are ignored even in
  contains mode.
- Screenshots can only be captured for the tab that is currently visible;
  clicks in background watched tabs are still logged, just without an image.
- Be deliberate about which pages you watch: anything with a matching button
  label (cookie banners, purchase confirmations) will get clicked.

## Repository layout

```
extension/
  static/              # non-UI extension code, shared by both browsers
    background.js      # watched-tab state, tab group, click log, screenshots
    content.js         # interval scanner + clicker (runs in every frame)
    icons/
  manifest.chrome.json   # MV3, service worker background
  manifest.firefox.json  # MV3, event-page background + gecko id
ui/                    # popup + options pages: React + shadcn/ui + Tailwind v4
  src/components/ui/   # shadcn components (button, switch, select, card, …)
  src/popup/           # toolbar popup
  src/options/         # settings + click log page
  src/globals.css      # shadcn zinc theme tokens + green action color
build.sh               # builds UI, assembles dist/chrome, dist/firefox + zips
tools/make_icons.py    # regenerates icons (stdlib-only Python)
```
