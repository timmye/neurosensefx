# Mobile Support (MVP)

## Context

**Stack:** Svelte (SPA, no SSR), Vite, interact.js (drag/resize), KLineChart 9.8 (candlestick charts). Vanilla JS event handling — no touch libraries, no Hammer.js, no gesture handlers.

**Workspace architecture:** Desktop free-form canvas. Displays (tickers, charts, FX baskets) are `position: absolute` divs with pixel `top`/`left` coordinates, contained in two nested `position: fixed; inset: 0; overflow: hidden` wrappers:

```
<main>                          ← App.svelte — position: fixed, overflow: hidden
  <div class="workspace-container">  ← Workspace.css — position: fixed, overflow: hidden
    <div class="workspace">          ← position: relative, height: 100%
      <FloatingDisplay>              ← position: absolute, left/top via inline style
      <ChartDisplay>                 ← position: absolute, left/top via inline style
      <PriceTicker>                  ← position: absolute, left/top via inline style
```

**interact.js** manages drag/resize on all display types via `src/lib/interactSetup.js`. KLineChart handles its own internal canvas events. Price markers use raw `mousedown`/`mousemove`/`mouseup` listeners in `src/lib/priceMarkerInteraction.js`.

**Target:** iOS Safari (primary), Android Chrome (secondary). Desktop must remain unchanged.

**Key files:**
- `src/lib/interactSetup.js` — interact.js config (mobile change: skip interact.js entirely on touch)
- `index.html` — viewport meta
- `src/App.svelte` — `<main>` wrapper styles
- `src/components/Workspace.css` — `.workspace-container` and `.workspace` styles
- `src/components/FloatingDisplay.svelte` — display container (position: absolute, user-select: none)
- `src/components/ChartDisplay.svelte` — chart window (position: absolute, user-select: none)
- `src/components/displays/DisplayHeader.svelte` — header with hover-only show/hide

## Goal

Allow mobile users to view the workspace: pinch-zoom for overview/detail, tap to select tickers. No drag/resize or chart touch interactions on mobile.

## Current State

**Working on iOS Safari:**
- Pinch-zoom (via `minimum-scale=0.25` in viewport meta)
- Tap to select ticker (switches chart)
- Displays not draggable/resizable on touch

**Not working:**
- Scroll (finger drag to pan) — see root cause below

## Changes (committed)

### `src/lib/interactSetup.js` — Skip interact.js entirely on touch

- Added `isTouchDevice` flag: `'ontouchstart' in window || navigator.maxTouchPoints > 0`
- On touch: returns `null` immediately **before calling `interact(element)`**
- This is critical — `interact(element)` registers global `touchstart`/`touchmove`/`touchend` listeners on `document` with `{ passive: false }` on iOS. Even with `.draggable()` skipped, those global listeners call `preventDefault()` on `touchmove`, blocking all native scroll.
- All callers already use optional chaining (`interactable?.unset()`) in `onDestroy`, so `null` return is safe.
- Affects all display types: FloatingDisplay, ChartDisplay, PriceTicker, FxBasketDisplay

### `index.html` — Viewport minimum-scale

- `minimum-scale=0.25` allows pinch-zoom out to 25%
- Desktop unaffected (initial-scale=1, no dynamic detection needed)

## Root Cause Analysis

**Two blockers prevent native scroll on iOS Safari:**

1. **interact.js global touch listeners (FIXED):** `interact(element)` calls `scope.addDocument()` which registers `touchstart`/`touchmove`/`touchend` on `document` with `{ passive: false }` on iOS. The `checkAndPreventDefault` function then calls `preventDefault()` on all `touchmove` events. This blocks native scroll globally, not just on the interacted element. Fix: don't call `interact(element)` on touch devices.

2. **No scrollable container (NOT FIXED):** The CSS chain `html -> body -> main -> .workspace-container` all have `overflow: hidden`. There is no scrollable element in the DOM tree. Even without interact.js blocking touch events, there's nothing for iOS Safari to scroll. Displays are `position: absolute` with pixel coordinates — they don't participate in document flow and don't create natural scroll height.

   Previous attempts to add `overflow: auto` on containers failed because:
   - Absolute-positioned children don't expand parent height
   - Changing `position: fixed` to `position: relative` broke the viewport zoom that was working
   - See "Failed Approaches" below for details

## Failed Approaches (reverted)

These all broke zoom or scroll on iOS Safari. Do NOT re-attempt without research.

| Approach | Why it failed |
|----------|---------------|
| `overflow: auto` on `<main>` via `@media (pointer: coarse)` | No effect — `.workspace-container` (nested, also `position: fixed; overflow: hidden`) still blocks scroll |
| `overflow: auto` + `min-height: 200vh` on `.workspace-container` | Created empty scrollable space but displays are `position: absolute` — they don't participate in content flow, so scrolling shows blank space |
| `touch-action: pan-x pan-y pinch-zoom` on `.workspace-container` | No effect on iOS Safari gesture routing |
| `user-select: auto !important` on all children | Broke scroll — touch-drag on text-selectable content starts text selection instead of scrolling |
| Dynamic viewport meta via `<head>` JS (`initial-scale=0.25` for touch only) | Broke pinch-zoom entirely — iOS didn't respect the dynamic change, routed all pinch to tab switching |
| `position: relative` on `<main>` and `.workspace-container` for touch | Broke zoom AND scroll — removed the fixed viewport that Safari was using for zoom |

## Possible Paths Forward

1. **CSS `transform: scale()` with JS pinch handler** — Apply `transform: scale() + transform-origin: 0 0` to `.workspace`, driven by a custom pinch-zoom JS handler (e.g., Hammer.js). Keeps absolute positioning, doesn't fight with Safari's gesture router because we'd capture touch events ourselves. Requires: pinch-zoom library, touch coordinate translation, scroll/pan logic.

2. **Mobile-only flow layout** — On touch devices, switch displays from `position: absolute` to a flow/grid layout. Major refactor — every display's position/size logic would need a mobile variant.

3. **Accept current state** — Zoom + tap works. Users zoom out for overview, zoom in on the area they want. No scroll, but zoom provides similar navigation. Simplest option.

## Other Known Issues

### DisplayHeader auto-hide is hover-only
Header (close/refresh buttons) shows on `mouseenter`. No hover on mobile, so headers stay hidden. Users can tap to select but can't close/refresh individual displays.

### Context menu is right-click only
No mobile equivalent. Acceptable for MVP.

### KLineChart touch behavior
KLineChart registers `touchmove` on `<html>` with `{ passive: false }` and both `treatVertDragAsPageScroll` / `treatHorzDragAsPageScroll` return `false`. It doesn't call `preventDefault` on single-touch move (commented out), but the `{ passive: false }` registration causes iOS to wait for the handler. May need configuration if scroll issues persist after interact.js fix.
