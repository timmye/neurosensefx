# KLineChart Rendering Chain Analysis

Diagnoses intermittent blurry/fuzzy chart rendering on initial mount and symbol switch.
All lines including axes are affected, ruling out overlay-specific or indicator-specific causes.

## Problem Statement

Chart renders appear blurry for 1-2 frames on initial load and occasionally during symbol
switches. The issue is inconsistent — sometimes a hard refresh clears it, sometimes it
persists until the next resize event.

## Architecture Overview

Each chart instance creates multiple canvas elements via klinecharts' internal `Canvas` class.
A default layout (candle pane + indicator pane) produces **4-6 Canvas instances** (main +
overlay per pane). Each Canvas has an independent rAF coalescing guard (`_requestAnimationId`)
that prevents double-renders within a single frame.

### Key Internal Mechanisms

| Mechanism | Location (klinecharts.js) | Purpose |
|-----------|--------------------------|---------|
| `_resetPixelRatio()` | L6726 | Sets canvas buffer size and scales 2D context for DPR |
| `_executeListener(fn)` | L6742 | rAF coalescing guard — schedules `fn()` + draw callback, drops duplicates |
| `Canvas.update(w, h)` | L6753 | Sets CSS dimensions, triggers `_resetPixelRatio` if dims changed |
| `isSupportedDevicePixelContentBox()` | L6667 | Async check for `devicePixelContentBoxSize` ResizeObserver support |
| `adjustPaneViewport()` | — | Recalculates pane layout, calls `Canvas.update` on all canvases |

## Chronological Rendering Chain

### Phase 1: Component Mount

**File**: `src/components/ChartDisplay.svelte:390`

```
onMount fires (Svelte lifecycle)
  ├─ registerChartKeys()                          [SYNC]
  ├─ setupInteract()                              [SYNC]
  ├─ setupWheelHandler(chartContainer, null)      [SYNC]  ← chart is null
  └─ setTimeout(0) → Phase 2                     [MACROTASK]
```

### Phase 2: Chart Init

**Files**: `ChartDisplay.svelte:401`, `src/lib/chart/chartLifecycle.js:92`

```
setTimeout(0) fires — layout engine has computed clientWidth/Height
  └─ klinecharts.init(container, { styles })
       ├─ _initContainer → reads clientWidth/Height          [SYNC]
       ├─ _initPanes → creates DrawWidgets
       │    └─ Each DrawWidget → 2 Canvas objects (main + overlay)
       │         └─ Canvas constructor:
       │              ├─ _nextPixelWidth = 0                 ← NOT yet set
       │              ├─ isSupportedDevicePixelContentBox()   [ASYNC PROMISE]
       │              │   └─ .then(...) → Phase 4             ← resolves LATER
       │              └─ (DPR setup deferred to first Canvas.update)
       │
       ├─ adjustPaneViewport(true,true,true)
       │    └─ updatePane(All) → Canvas.update(w,h) on ALL canvases
       │         └─ _supportedDevicePixelContentBox === false  ← Promise NOT resolved
       │              └─ FALLBACK PATH: Math.round(w * getPixelRatio())
       │                   └─ _resetPixelRatio() → _executeListener(fn)
       │                        └─ rAF scheduled (first render deferred)
       │
       ├─ setCustomApi, setTimezone, setPaneOptions            [SYNC]
       ├─ project's rAF-1 scheduled → Phase 3
       └─ project ResizeObserver attached to chartContainer
```

**Key point**: The very first `Canvas.update` always hits the fallback DPR path because
`isSupportedDevicePixelContentBox()` is still pending. This produces a numerically correct
but potentially sub-pixel-accurate DPR scaling.

### Phase 3: Post-Init rAF

**File**: `ChartDisplay.svelte:411`

```
rAF-1 fires (same frame as library's first render rAF)
  ├─ createIndicator('BOLL')
  │    └─ adjustPaneViewport → Canvas.update → _executeListener
  │         └─ COALESCE GUARD: library rAF still pending → DROPPED (no-op)
  │
  ├─ createIndicator('AD')
  │    └─ NEW IndicatorPane → new Canvas pair → new async DPR Promise
  │    └─ adjustPaneViewport → ALL Canvas.update → _executeListener
  │         └─ COALESCE GUARD: likely DROPPED again
  │
  ├─ createWatermarkIndicator()
  ├─ setupChartActions()
  └─ loadChartData() → subscribes stores, fires WS request → Phase 5 (async)
```

The coalesce guard correctly prevents duplicate renders — the library's rAF from Phase 2
will fire and draw with the latest state. No bug here, just timing dependency.

### Phase 4: Library Async DPR Detection Resolves

**File**: `klinecharts.js:6703`

```
isSupportedDevicePixelContentBox Promise resolves (microtask, ~same frame or next)
  │
  ├─ IF browser supports devicePixelContentBoxSize:
  │    └─ Installs ResizeObserver({ box: 'device-pixel-content-box' }) on EACH canvas
  │         └─ Fires immediately with exact pixel dimensions from browser
  │              └─ If dims differ from fallback Math.round() value:
  │                   _resetPixelRatio() → _executeListener → rAF → CORRECTION RENDER
  │
  └─ IF NOT supported:
       └─ matchMedia("(resolution: Ndppx)") listener installed
            └─ Only fires on DPR changes (monitor switch), NOT initial sizing
```

**This is the primary source of initial-render blur.** Between Phase 2's fallback render
and Phase 4's correction render, there is a 1-2 frame window where the canvas buffer may
not exactly match the display's pixel grid.

### Phase 5: Data Arrives

**Files**: `chartTickSubscriptions.js`, `chartDataLoader.js`

```
Bar store fires (state: 'ready')
  └─ tryApplyData → container has dims → applyDataToChart
       ├─ chart.applyNewData(data)
       │    └─ adjustPaneViewport → Canvas.update → _executeListener → rAF
       │
       └─ rAF-2 scheduled:
            └─ applyBarSpace()
                 ├─ setBarSpace → adjustPaneViewport → Canvas.update → _executeListener
                 ├─ setOffsetRightDistance → Canvas.update → _executeListener
                 │                                    ↑ COALESCE GUARD: DROPPED
                 └─ scrollToRealTime → Canvas.update → _executeListener
                                              ↑ COALESCE GUARD: DROPPED
```

The triple-trigger from `applyBarSpace` is absorbed by the coalesce guard. Only one actual
render fires per canvas. No bug here.

### Phase 6: External Resize (Project ResizeObserver)

**Files**: `chartLifecycle.js:13`, `chartResize.js:14`

Two ResizeObservers exist simultaneously:
- **Project's RO** — watches `chartContainer` div, fires `scheduleResize()`
- **Library's RO** — watches each canvas element with `{ box: 'device-pixel-content-box' }`

```
chartContainer resized
  └─ scheduleResize()
       └─ rAF-3:
            ├─ chart.resize() → adjustPaneViewport → Canvas.update → _executeListener
            ├─ applyBarSpace() → triple trigger (2 DROPPED by coalesce)
            └─ if pendingData:
                 ├─ chart.applyNewData(data)        ← renders with WRONG bar space
                 └─ rAF-4:                          ← SECOND FRAME
                      chart.resize() + applyBarSpace() + scrollToRealTime()
```

**Two-frame stutter**: When `pendingDataApply` has data (deferred because container had
zero dimensions at subscription time), the resize handler renders across two separate rAF
frames. Frame 1 has incorrect bar space, frame 2 corrects it.

### Phase 7: Symbol Switch / Reload

**Files**: `ChartDisplay.svelte:216`, `reloadChart.js:19`

```
handleSymbolChange(newSymbol)
  └─ reload()
       ├─ teardownSubscriptions()                     [SYNC]
       ├─ chart.removeOverlay()
       │    └─ adjustPaneViewport → Canvas.update → rAF (renders empty chart)
       ├─ chart.clearData()                           ← wipes store, NO redraw triggered
       │    ↑ STALE PIXELS visible until new data arrives
       ├─ applyPricePrecision()
       ├─ removeIndicator('symbolWatermark')
       └─ loadChartData() → async → Phase 5 again
```

`clearData()` does not trigger a canvas redraw. The `removeOverlay()` before it triggers one
redraw of an empty chart, but old candle pixels may persist until `applyNewData` fires
asynchronously.

## Root Cause Analysis

### Library issue (primary cause): async DPR detection gap

The `isSupportedDevicePixelContentBox()` Promise at klinecharts.js:6703 is asynchronous.
The very first `Canvas.update` always uses the fallback path (`Math.round(w * getPixelRatio)`).
When the Promise resolves and the device-pixel ResizeObserver fires with exact dimensions,
a correction render occurs. If the exact dimensions differ from the rounded fallback by even
1 sub-pixel, the first 1-2 frames render at a slightly wrong DPR → blurry.

**Cannot be fixed without patching the library or pre-resolving the Promise.**

### Project issue: double-rAF stutter on pending data

**File**: `src/lib/chart/chartResize.js:22-33`

When `pendingDataApplyRef` has data, the resize handler splits work across two rAF frames:
- Frame 1: `chart.resize()` + `chart.applyNewData(data)` — bar space is wrong
- Frame 2: `chart.resize()` + `applyBarSpace()` + `chart.scrollToRealTime()` — corrected

This produces a visible layout jump. If it coincides with the library's DPR correction from
Phase 4, the two effects compound into noticeable blur.

### Project issue: stale pixels during symbol switch

**File**: `src/lib/chart/reloadChart.js:13`

`clearData()` wipes the chart store without triggering a redraw. `removeOverlay()` fires one
redraw before `clearData()`, showing an empty chart. The old candle pixels remain until
`applyNewData` fires asynchronously. This isn't blur but appears as a rendering glitch.

## Coalescing Guard Reference

Each Canvas instance has an independent rAF guard:

```
Canvas._executeListener(fn):
  if (_requestAnimationId === -1):
    _requestAnimationId = rAF(() => {
      ctx.clearRect(0, 0, _width, _height)
      fn()               // DPR setup (scale, buffer size)
      _listener()        // draw callback — reads LIVE state
      _requestAnimationId = -1
    })
  else:
    // NO-OP — fn is DROPPED, not queued
```

The `_listener` (draw callback) always reads from live state objects, so it renders the
latest data regardless of how many operations were coalesced. However, the `fn` parameter
(which sets DPR/scales the canvas buffer) IS lost if dropped. This is safe only when the
rAF fires after all state mutations are complete.

## Summary Table

| Phase | Trigger | DPR Source | Frames to Correct Render | Project Fixable? |
|-------|---------|-----------|--------------------------|-----------------|
| 2 | First Canvas.update | Fallback: `Math.round(w * dpr)` | 1-2 (waits for Phase 4) | No (library async) |
| 3 | Post-init rAF | Coalesced into Phase 2 | 0 (dropped by guard) | N/A |
| 4 | DPR Promise resolves | devicePixelContentBoxSize RO | 0-1 (correction render) | No (library async) |
| 5 | Data arrives | Whichever was last set | 1 (rAF defers applyBarSpace) | No (by design) |
| 6 | External resize | Library RO + project resize | 1-2 (double-rAF on pending) | **Yes** |
| 7 | Symbol switch | Library RO (if size changed) | 1+ (stale pixels until data) | **Yes** |

## Recommended Fixes

### Fix 1: Consolidate pending-data double-rAF into single frame

**File**: `src/lib/chart/chartResize.js`

The pending data path currently renders across two rAF frames. Consolidate into one:

```javascript
// Before (two frames):
if (pendingDataApplyRef.value) {
  chart.applyNewData(data);
  requestAnimationFrame(() => {
    chart.resize();
    applyBarSpace();
    chart.scrollToRealTime();
  });
}

// After (single frame):
if (pendingDataApplyRef.value) {
  chart.applyNewData(data);
  // applyNewData already triggers adjustPaneViewport,
  // so just apply bar space + scroll within the same rAF
  applyBarSpace();
  chart.scrollToRealTime();
}
```

### Fix 2: Trigger redraw after clearData in reload

**File**: `src/lib/chart/reloadChart.js`

After `clearData()`, explicitly trigger a canvas update so the chart goes blank immediately
instead of showing stale pixels:

```javascript
function clearChartState() {
  if (deps.chart) {
    deps.chart.removeOverlay();
    deps.chart.clearData();
    deps.chart.resize();  // force redraw with empty data
  }
  // ...
}
```

### Fix 3 (optional): Force DPR-correct resize after data load settles

**File**: `src/components/ChartDisplay.svelte`

After `loadChartData` completes, schedule a resize that is guaranteed to run after the
library's async DPR detection has resolved. Double-rAF ensures we're outside the library's
coalescing window:

```javascript
loadChartData(symbol, resolution, window, () => {
  overlayRestore.restoreDrawings(symbol, resolution);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      chart?.resize();
      barSpace.applyBarSpace();
      chart?.scrollToRealTime();
    });
  });
});
```

## Files Reference

| File | Role in rendering chain |
|------|------------------------|
| `src/components/ChartDisplay.svelte` | Component mount, setTimeout(0) init, rAF post-init, symbol switch |
| `src/lib/chart/chartLifecycle.js` | `initChart`, `setupResizeObserver`, `setupIndicators` |
| `src/lib/chart/chartResize.js` | rAF-coalesced resize scheduling, pending data double-rAF |
| `src/lib/chart/chartTickSubscriptions.js` | `applyDataToChart`, `tryApplyData`, bar/tick subscriptions |
| `src/lib/chart/chartDataLoader.js` | Data loading orchestration, store subscription |
| `src/lib/chart/chartBarSpace.js` | Bar space calculation, triple-trigger (setBarSpace + offset + scroll) |
| `src/lib/chart/reloadChart.js` | Symbol/source switch teardown and reload |
| `node_modules/klinecharts/dist/umd/klinecharts.js:6667-6766` | Canvas class, DPR handling, rAF coalescing |
| `node_modules/klinecharts/dist/umd/klinecharts.js:12995-13104` | ChartImp constructor, pane init |
| `node_modules/klinecharts/dist/umd/klinecharts.js:6908-6934` | DrawWidget → Canvas.update chain |
