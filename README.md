# Meet Split for Broadcast

> Chrome extension that turns a single Google Meet session into **two clean, isolated video feeds** — camera and screenshare — ready to be captured as ISO sources by vMix, OBS, Wirecast or any broadcast switcher.

<p align="center">
  <img src="extension/icons/icon-128.png" alt="Meet Split for Broadcast" width="96" height="96">
</p>

<p align="center">
  <strong>One Chrome instance. One Meet session. Two clean ISO feeds. Zero NDI gateways.</strong>
</p>

<p align="center">
  <a href="https://github.com/lucasftas/chrome-extension-meet-clean-streaming/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/lucasftas/chrome-extension-meet-clean-streaming"></a>
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-blue">
  <img alt="Vanilla JS" src="https://img.shields.io/badge/dependencies-zero-brightgreen">
  <img alt="Build" src="https://img.shields.io/badge/build-none-brightgreen">
</p>

---

## The problem

Using Google Meet as a remote-guest source for live broadcast has been historically painful:

- **Meet UI bleeds into the broadcast** — names, controls, mic icons, raised-hand notifications appear on top of the video at the worst possible moment.
- **No ISO outputs** — Meet sends one composed mosaic, not separate sources, so your switcher can't treat camera and slides as independent inputs.
- **Tab throttling** — Chrome pauses background tabs, so your vMix capture freezes the moment you click anywhere else.
- **Layout instability** — Meet's algorithm reshuffles tiles based on who's talking. The tile you wanted in HD just got demoted to thumbnail.

The classic workaround uses **two Chrome instances** with isolated profiles, each rendering one feed. That doubles bandwidth, requires two Google accounts, and shows up as two participants in the call — awkward for the guest, expensive for everyone.

NDI gateways solve it cleanly but cost real money.

## What this does

```
        ─── BEFORE ───                          ─── AFTER ───

┌────────────────────────────┐         ┌─────────────┬──────────────┐
│ 🟢 Meet · 14 participants  │         │             │              │
│ ┌────────┐  ┌────────┐     │         │             │              │
│ │ Mosaic │  │ Tiles  │     │         │   CAMERA    │    SLIDES    │
│ │ shifts │  │ swap   │     │  ───►   │  fullscreen │  fullscreen  │
│ │ on its │  │ size   │     │         │  HD source  │  HD source   │
│ │  own   │  │ live   │     │         │             │              │
│ └────────┘  └────────┘     │         │             │              │
│ [🎤] [📹] [✋] [⏺] [☎]     │         │             │              │
└────────────────────────────┘         └─────────────┴──────────────┘
   Captured as 1 messy input              vMix Crop = 2 ISO inputs
```

A Chrome extension that DOM-injects a clean overlay on top of your existing Meet session. Pick the camera tile and the screenshare tile with a click (or right-click → context menu), choose a layout mode, and the page renders **two clean videos in a single Chrome window** — no UI, no overlays, no flicker. Your broadcast software captures the window and uses Crop to get two ISO inputs.

**One Meet connection. One Google account. One Chrome window. Two ISO feeds ready for production.**

---

## Features

- **🎬 Four layout modes** — `Off` (Meet normal), `Split 50/50` (cam + slides side by side), `Solo CAM` (camera fullscreen), `Solo SLIDES` (presentation fullscreen). Switch on the fly without breaking your vMix preview.
- **🖱️ Two ways to mark tiles** — click button in popup → click tile in Meet, OR right-click directly on the tile → "Mark as CAM/SLIDES" in the native context menu (works even in Meet's popup window without URL bar).
- **🪟 Native popup support** — when you use Meet's "Open in new window" feature for the screenshare, the extension auto-detects the popup and cleans its UI too. Each window becomes a separate vMix Window Capture without needing Crop.
- **🔁 Auto-recovery from screenshare resets** — when the guest stops and restarts screenshare (each session generates a new device ID in Meet), the extension automatically rebinds the SLIDES slot. No operator intervention.
- **🛡️ Robust against Meet's quirks** — handles cam off/on cycles where Meet leaves "ghost" video elements in the DOM, layout changes, refresh, leaving and rejoining the same room. Detailed in [TECHNICAL_NOTES.md](TECHNICAL_NOTES.md).
- **⚡ Anti-throttle hardening** — overrides Page Visibility API and rAF loop to keep the renderer alive even when the Chrome window is occluded by your switcher software. Documented Chrome flags for the strongest production setup.
- **📺 Bottom-anchored content** — video content sticks to the bottom of the viewport, regardless of bookmark bar or fullscreen toggle. External tools that crop in absolute pixel coordinates always find the video in the same place.
- **🎯 HD Simulcast hint** — forces Meet's simulcast to send the higher-resolution track even when the original tile is small.
- **⚠️ Live status warnings** — popup shows orange warnings when the split is active but a tile disappeared from the DOM (e.g., Meet's "Spotlight" layout culled it).

Zero dependencies, zero build step, no servers. Vanilla JavaScript with Manifest V3.

---

## Quick start

### 1. Install the extension

```bash
git clone https://github.com/lucasftas/chrome-extension-meet-clean-streaming.git
```

Or download the latest ZIP from [Releases](https://github.com/lucasftas/chrome-extension-meet-clean-streaming/releases).

In Chrome:
1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder

### 2. Launch Chrome with hardening flags (recommended for production)

Without these flags, Chrome pauses rendering when the window loses focus (covered by another app), and your vMix capture freezes:

```
chrome.exe --disable-renderer-backgrounding --disable-background-timer-throttling --disable-backgrounding-occluded-windows
```

The cleanest way is creating a Windows shortcut with the flags appended to the Target field. **Close all running Chrome instances first** — Chrome reuses processes and ignores flags when adding a window to an existing instance.

Verify the flags are active by opening `chrome://version/` and checking the **Command Line** field.

### 3. Use it

1. Open a Google Meet room in the flagged Chrome.
2. Click the extension icon → popup opens.
3. **Mark CAM** → click the camera tile in Meet.
4. **Mark SLIDES** → click the screenshare tile.
5. Pick a mode: **Split**, **Solo CAM** or **Solo SLIDES**.
6. The Meet window now renders the chosen layout cleanly.

In your broadcast software:
1. Add a **Window Capture** of the Chrome window.
2. Use **Crop** to get each half as a separate input (Split mode), or use the window as-is (Solo modes).
3. Recommended Window Capture method in vMix: **WindowsGraphicsCapture** (not GDI — fails with Chrome's GPU-accelerated rendering).

---

## Layout modes

| Mode | What you see | When to use |
|------|--------------|-------------|
| `Off` | Meet renders normally | Pre-show, debug, navigating outside the call |
| `Split 50/50` | Camera left half, slides right half | Standard interview / presentation |
| `Solo CAM` | Camera fullscreen | Pre-show with talent, intervals, before slides go live |
| `Solo SLIDES` | Slides fullscreen | Slide-only segments, when the speaker stays off-camera |

Switch modes anytime through the popup or right-click context menu. Clones stay in the DOM during transitions to avoid flicker on the broadcast preview.

---

## Production tips

### Chrome setup
- **Always launch from the flagged shortcut** — verify in `chrome://version/` that the three flags are active. Test by opening `horacerta.com`, covering Chrome with another window for 30s, then bringing it back. The clock should still be at the right time. If it's frozen, flags didn't apply (probably another Chrome process is still running).
- **Don't minimize the Chrome window during a live broadcast.** Windows treats minimize as "not visible" at the OS level — no flag overrides that. With the broadcast switcher in fullscreen on top of Chrome, the Chrome window is *occluded*, not minimized — that's the case the flags handle.

### Capture in vMix
- **Add Input → Desktop → Window Capture**, select the Chrome window.
- **Window Capture Method = `WindowsGraphicsCapture`**. Default and GDI fail with hardware-accelerated content. DWM is OK but less reliable. WGC is the modern API and supports GPU-rendered video correctly.
- For Split mode: create two inputs from the same window with **Crop Right = 50%** (CAM) and **Crop Left = 50%** (SLIDES).

### Layout in Meet
- Use **Auto**, **Mosaic**, or **Side-by-side**. **Avoid "Spotlight"** — Meet's spotlight layout culls non-spotlighted tiles from the DOM, and your CAM may disappear from the split. If you must use Spotlight, **pin the camera that's marked as CAM** in the extension.
- The popup shows orange warnings when split is active but a tile is missing from the DOM — this is your signal that the Meet layout is incompatible.

### Resolution
- Ask the guest to set **Settings → Video → Send resolution: HD (720p)** in Meet. Without that, the ceiling is whatever they upload.
- For HD on the received camera: use Spotlight/Pin in Meet **on the tile that's marked as CAM** in the extension. Simulcast picks up and sends the high-resolution track.

### Between rooms
- Click **Clear selections** in the popup before joining a new room. Participant IDs persist in `chrome.storage.local` and become stale across different Meet sessions.

---

## Architecture in 2 minutes

The extension's heart is a single technical insight: instead of trying to promote Meet's existing `<video>` elements to fullscreen (which fails because Meet's React tree creates stacking contexts that trap `position: fixed`), the extension **clones via `srcObject`**:

```javascript
const clone = document.createElement('video');
clone.autoplay = true;
clone.playsInline = true;
clone.muted = true;
clone.srcObject = original.srcObject;  // shared MediaStream — no extra bandwidth
document.body.appendChild(clone);       // direct child of <body>, no stacking context
```

Two MediaStream clones in `document.body`, positioned with `position: fixed` at z-index `2147483647`. They're outside Meet's DOM tree, so no ancestor's `transform` or `will-change` can trap them.

The original `<video>` elements stay in their place (Meet's UI continues working), but pushed off-screen at 1920×1080 to nudge the simulcast to send HD tracks. An overlay `::before` covers Meet's UI behind the clones.

Persistence uses `data-participant-id` attributes that survive Meet's React re-renders. A `MutationObserver` plus `loadedmetadata`/`emptied` listeners cover both DOM-level changes and pure JS property changes (`srcObject` mutations don't fire mutations).

Full deep-dive in [TECHNICAL_NOTES.md](TECHNICAL_NOTES.md), and the iteration story in [JOURNEY.md](JOURNEY.md).

---

## Roadmap

- [ ] Customizable layouts (PIP, 30/70, multi-camera)
- [ ] Audio extraction from Meet
- [ ] Auto-detection of cam vs slides (heuristic + manual override)
- [ ] Multi-camera support (multiple guests)
- [ ] Global keyboard shortcuts
- [ ] Edge / Firefox / Chrome Web Store

Issues and PRs welcome. The DOM heuristics in [TECHNICAL_NOTES.md](TECHNICAL_NOTES.md) section 4 may need updating as Google Meet evolves — community contributions help track that.

---

## Project structure

```
chrome-extension-meet-clean-streaming/
├── extension/                # The actual extension (load unpacked here)
│   ├── manifest.json         # Manifest V3
│   ├── content.js            # Main logic (~600 lines)
│   ├── background.js         # Service worker (context menus)
│   ├── popup.html / .js      # UI
│   ├── style.css             # msb-* classes for layout & cleanup
│   └── icons/                # 16/48/128 PNG (procedurally generated)
├── scripts/
│   ├── build-zip.ps1         # Bundles extension/ into a versioned ZIP
│   └── build-icons.ps1       # Regenerates icons from procedural design
├── README.md                 # This file
├── CHANGELOG.md              # Version history (Keep a Changelog)
├── IMPLEMENTATIONS.md        # Per-version implementation notes
├── TECHNICAL_NOTES.md        # Deep architectural notes
├── JOURNEY.md                # Narrative of the development journey
└── CLAUDE.md                 # Instructions for Claude Code contributors
```

Building the ZIP for distribution: `.\scripts\build-zip.ps1`. Icons can be regenerated with `.\scripts\build-icons.ps1` (PowerShell + System.Drawing, no external dependencies).

---

## Contributing

PRs welcome. The project intentionally has zero runtime dependencies and no build step — keep it that way unless there's a strong reason. Read `TECHNICAL_NOTES.md` and `JOURNEY.md` first to understand decisions that look strange in isolation (clone via `srcObject`, bottom-anchored, ghost video filter, popup state suppression via storage flag).

Areas where heuristics may break with Meet updates and need community help:
- Minified CSS classes (`iPFm3e`, `Gv1mTb-PVLJEc`, `oZRSLe`)
- `match_about_blank` behavior with Document Picture-in-Picture
- Heuristic filters in the SLIDES auto-redetect

Use the popup's **Inspecionar DOM** (Debug section) to capture a fresh DOM snapshot when filing an issue — paste the JSON in the issue body.

---

## Acknowledgments

Built in a single afternoon of iteration between an experienced broadcast operator and Claude Code (Anthropic's coding agent). Seven public releases, nine internal versions, and a stacking-context bug that almost derailed everything are all documented in [JOURNEY.md](JOURNEY.md).

Inspirations:
- [vMix Desktop Capture documentation](https://www.vmix.com/help26/DesktopCapture.html)
- [Chrome Extensions Manifest V3 docs](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Page Visibility API workarounds](https://developer.chrome.com/blog/background_tabs/)

---

## License

TBD — license to be added before public Chrome Web Store submission. For now, code is shared on GitHub for review and contribution. Reach out via Issues if you want to use it commercially.

---

<p align="center">
  <em>If this saved you the cost of a second computer or an NDI gateway, consider giving it a ⭐ — it helps other operators find it.</em>
</p>
