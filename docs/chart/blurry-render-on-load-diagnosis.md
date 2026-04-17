# Chart Blurry on Initial Load — Root Cause Analysis

**Date:** 2026-04-16 (updated 2026-04-17)
**Status:** Fix v2 implemented. Blurry render on load **still present** — v2 strategy did not resolve the root cause.
**KLineCharts version:** 9.8.12

## Symptom

Charts render with blurry/fuzzy lines and text on initial page load. They become crisp only after:
- A browser window resize
- Pressing "c" (destroys and recreates the chart component)

## How KLineCharts Natively Handles DPR

KLineCharts has **built-in** DPR handling. Understanding this is critical before writing any fix.

### Canvas class (`index.esm.js:6678-6778`)

Each canvas element is managed by a `Canvas` instance that:

1. **Constructor** (line 6679): Creates a `<canvas>` element with 0x0 dimensions. Starts an **async** `isSupportedDevicePixelContentBox()` check.

2. **`update(w, h)`** (line 6748): Sets `canvas.style.width/height` (CSS pixels). Then:
   - If `_supportedDevicePixelContentBox` is `true`: the CSS change triggers klinecharts' **internal ResizeObserver** on the canvas element, which fires `_resetPixelRatio()` asynchronously.
   - If `false` (initial state, check hasn't resolved): manually calculates `pixelRatio * w/h` and calls `_resetPixelRatio()` directly.

3. **`_resetPixelRatio()`** (line 6721): The function that actually sets canvas buffer dimensions:
   ```
   canvas.width = nextPixelWidth    (physical pixels)
   canvas.height = nextPixelHeight  (physical pixels)
   ctx.scale(horizontalPixelRatio, verticalPixelRatio)
   ```
   This is wrapped in `_executeListener(fn)` — an rAF-coalescing guard.

4. **`_executeListener(fn)`** (line 6737): **Drops duplicate calls within the same frame**. If a rAF is already pending (`_requestAnimationId !== -1`), the new call is silently discarded. Only one rAF runs per frame per canvas.

5. **Internal ResizeObserver** (line 6698-6718): Set up **asynchronously** after the `isSupportedDevicePixelContentBox()` Promise resolves. Observes each **canvas element** (not the container) with `box: 'device-pixel-content-box'`.

### Key insight: klinecharts does NOT have a ResizeObserver on the container div

KLineCharts only observes its own `<canvas>` elements. It has **no mechanism** to detect when the **container div** is resized by CSS/layout. External container resize requires a manual `chart.resize()` call. This is by design (or a limitation) of klinecharts v9.8.12.

### When DPR is set during native init

```
init(container, options)
  -> new ChartImp(container, options)
    -> _initPanes() — creates Canvas objects (async DPR check starts)
    -> adjustPaneViewport(true, true, true) — FIRST render
      -> updatePane(All) — cascades to all panes
        -> DrawWidget.updateImp() — sets CSS dimensions
          -> Canvas.update(w, h)
            -> _supportedDevicePixelContentBox is still false (async not resolved)
            -> takes MANUAL path: calculates pixelRatio, calls _resetPixelRatio()
              -> _executeListener(fn) — schedules rAF
                -> [rAF fires]: canvas.width = w*dpr, ctx.scale(dpr, dpr)
```

So klinecharts **does** set DPR correctly on first paint. The question is: what happens AFTER that, when our code triggers additional resize cycles?

## Our Code's Resize Calls During Init

### Full timeline (13+ `adjustPaneViewport` calls before stable render)

| # | When | What | Trigger | Necessary? |
|---|------|------|---------|------------|
| 1 | Sync | `adjustPaneViewport(true,true,true)` | ChartImp constructor | **Native** — first layout |
| 2 | Sync | `adjustPaneViewport(true,true,true,true,true)` | `setCustomApi()` | **No** — just sets a date formatter, doesn't need full relayout |
| 3 | Sync | `_xAxisPane.update(Drawer)` | `setTimezone('UTC')` | **Yes** — timezone affects tick labels (NOTE: this is NOT a full `adjustPaneViewport` — only updates the x-axis pane drawer, not all panes) |
| 4 | Sync | `adjustPaneViewport(false,true,true,true,true)` | `setPaneOptions(x_axis_pane)` | **Yes** — pane option changes |
| 5 | rAF | `chart.resize()` | `initChart()` line 105 | **Redundant** — see analysis below |
| 6 | Microtask | conditional `adjustPaneViewport` | BOLL indicator `.then()` | **Yes** — indicator layout |
| 7 | Microtask | `adjustPaneViewport(true,true,true,true,true)` | AD indicator `.finally()` | **Yes** — new pane created |
| 8 | Microtask | conditional `adjustPaneViewport` | Watermark indicator `.then()` | **Yes** — indicator layout |
| 9 | Microtask | `adjustPaneViewport(false,true,true,true)` | `addData()` after `calcInstance()` await | **Yes** — data-driven render |
| 10 | rAF | `chart.resize()` | `applyDataToChart()` rAF (chartTickSubscriptions.js:31) | **Redundant** — render #9 already drew data |
| 11 | rAF | `chart.resize()` | `scheduleResize()` from ResizeObserver initial fire | **Redundant** — duplicates #10 |
| 12 | rAF | `chart.resize()` | `scheduleResize()` defer path nested rAF | Only if data was deferred (container had 0 size) |

### The critical path for blurriness

The issue is NOT that DPR isn't set initially (klinecharts handles that). The issue is that **CSS dimensions update immediately while buffer dimensions are deferred to a rAF**, creating a window where a paint can occur with mismatched CSS vs buffer sizes.

Here's the mechanism:

1. **Native init** (`adjustPaneViewport` #1): `Canvas.update(w, h)` sets CSS size (`style.width/height`) immediately, takes manual path (async check not resolved), calls `_resetPixelRatio()` which schedules **rAF-A**. Inside rAF-A: `canvas.width = w*dpr`, `canvas.height = h*dpr`, `ctx.scale(dpr, dpr)`, and `_width = w`, `_height = h` are set. DPR is correct after rAF-A fires.

2. **`setCustomApi`** (`adjustPaneViewport` #2): Triggers another `Canvas.update(w, h)`. Since `_width === w` (set in rAF-A), enters the `else` branch and calls `_executeListener()` (no fn). This just triggers a repaint. **Harmless — DPR preserved.**

3. **Indicator `.finally()`** (`adjustPaneViewport` #7): Creates AD pane, changes candle pane height. `Canvas.update(w, newH)` where `newH !== _height`. Enters `if` branch: sets CSS dimensions immediately (`style.height = newH + "px"`), calculates `_nextPixelWidth`/`_nextPixelHeight`, calls `_resetPixelRatio()` → `_executeListener(fn)`. **If rAF-A from step 1 hasn't fired yet, this new rAF is DROPPED** by the guard. The CSS size is now `newH` but the canvas buffer is still at the old size. `_width`/`_height` are NOT updated (they're set inside the rAF callback). A paint in this window renders at old buffer size but new CSS size → **blurry**.

4. **`addData` continuation** (`adjustPaneViewport` #9): Data is applied, indicators calculated. `adjustPaneViewport(false, true, true, true)` — full update. `Canvas.update(w, h)` — `_width` still reflects old value (rAF from step 3 was dropped), so `_width !== h` → enters `if` branch again, calls `_resetPixelRatio()`. If this rAF is also blocked by another pending rAF, the stale state persists.

5. **Our rAF from `initChart`** (#5): `chart.resize()` fires. Full measure + update. Same pattern — if a klinecharts internal rAF is still pending, our resize's `_resetPixelRatio` is dropped. **Adds to the collision count without helping.**

6. **Our rAF from `applyDataToChart`** (#10) and **`scheduleResize`** (#11): Same — more resize calls competing with klinecharts' internal rAF.

**The blurriness occurs because `Canvas.update()` sets CSS dimensions synchronously but defers buffer dimension updates to a rAF. When multiple `adjustPaneViewport` calls fire in rapid succession, the rAF coalescing guard drops buffer updates, leaving the canvas buffer at old dimensions while the CSS size has already changed. Any paint in that window renders blurry.**

**Why window resize fixes it:** A window resize changes the container dimensions, which our ResizeObserver detects and calls `chart.resize()`. This triggers `_measurePaneHeight/Width` which reads new container dimensions. `Canvas.update(newW, newH)` now has different dimensions, enters the `if` branch, and `_resetPixelRatio()` is called. By this time the init storm has settled, so no other rAF is pending — it succeeds, DPR is recalculated.

### Known unknown: `isSupportedDevicePixelContentBox` transition **(resolved in v2 Finding 1)**

> The async check resolves within 1-2 frames, switching from manual to ResizeObserver path mid-init. See "Finding 1: KLineCharts DPR Transition Race" in the v2 section below for the full mechanism.

The async `isSupportedDevicePixelContentBox()` check (line 6698-6719) starts during `Canvas` construction and resolves within a few ms. When it resolves to `true`, klinecharts switches from the manual DPR path (calculate + apply directly) to the ResizeObserver path (set CSS, let observer trigger `_resetPixelRatio` asynchronously). If this transition happens mid-init, the behavior changes silently:

- The internal ResizeObserver is attached to each canvas element in the `.then()` callback
- It observes with `box: 'device-pixel-content-box'` and fires on dimension *changes*
- If CSS dimensions were already set before the observer was attached, the observer may miss the initial state and only fire on subsequent changes

This means the blurriness mechanism could be different depending on whether the check resolves before or after the indicator creation phase. Empirical verification (logging when the check resolves relative to the init timeline) is recommended but not blocking for the fix.

## Identified Bugs

### Bug 1: Module-level `_resizeRAF` singleton ~~(REGRESSION from Phase 3 refactor)~~ **FIXED in v1**

> **Resolved.** Replaced by per-instance `createResizeState()` factory.

**File:** `src/lib/chart/chartResize.js:7`

**Before refactor:** `resizeRAF` was a local variable inside `ChartDisplay.svelte`. Each chart instance had its own guard.

**After refactor:** `_resizeRAF` is a module-level variable in `chartResize.js`. **All chart instances share one guard.**

```js
let _resizeRAF = null;  // SHARED across all charts!
```

If chart A and chart B both need to resize in the same frame, chart B's resize is silently dropped. This affects any workspace with multiple charts.

### Bug 2: `initChart()` rAF resize races with indicator creation **FIXED in v1**

> **Resolved.** Removed `requestAnimationFrame(() => chart.resize())` from `initChart()`.

**File:** `src/lib/chart/chartLifecycle.js:105`

```js
requestAnimationFrame(() => { if (chart) chart.resize(); });
```

This was carried over from the pre-refactor code, but the timing context changed. The rAF fires AFTER indicator creation microtasks (BOLL `.then()`, AD `.finally()`, watermark `.then()`), which means it re-renders a layout that was just rendered. More importantly, it can interfere with the klinecharts internal rAF that's still pending from the constructor's `_resetPixelRatio()` call.

### Bug 3: `applyDataToChart()` queues a redundant rAF resize **FIXED in v1**

> **Resolved.** Removed `chart.resize()` from the rAF, kept `applyBarSpace()` + `scrollToRealTime()`.

**File:** `src/lib/chart/chartTickSubscriptions.js:27-38`

```js
export function applyDataToChart(chart, klineData, applyBarSpace) {
  chart.applyNewData(klineData);  // internally does adjustPaneViewport async
  requestAnimationFrame(() => {
    chart.resize();  // REDUNDANT — addData already triggers adjustPaneViewport
    applyBarSpace();
    chart.scrollToRealTime();
  });
}
```

`chart.applyNewData()` internally calls `addData()` which, after calculating indicators, calls `adjustPaneViewport(false, true, true, true)` — a full render pass. The rAF from `applyDataToChart` then does another `chart.resize()` which re-does the same work. Two resize calls for one data apply.

### Bug 4: ResizeObserver + `applyDataToChart` double-fire **FIXED in v1**

**Files:** `chartLifecycle.js:14-19` and `chartTickSubscriptions.js:27-38`

When data arrives and the ResizeObserver fires in the same tick:
1. `applyDataToChart()` queues a raw rAF with `chart.resize()` (NOT coalesced)
2. `scheduleResize()` queues a coalesced rAF with `chart.resize()` (coalesced internally, but independent of #1)

These are two independent rAFs that do identical work. They can fire in the same or adjacent frames.

### Bug 5: KLineCharts `setCustomApi()` triggers full relayout

**File:** `node_modules/klinecharts/dist/index.esm.js:13422`

Calling `chart.setCustomApi()` triggers `adjustPaneViewport(true, true, true, true, true)` — a full height+width remeasure and all-pane update. This is disproportionate for just setting a date formatter. This is a **klinecharts internal issue**, not ours, but it contributes to the excessive resize count.

## Previous Fix Attempts

An earlier attempt using double-rAF settle resizes failed because it added more resize calls to an already saturated system. See "What NOT to Do" below.

## Are We Conflicting with KLineCharts Native Functionality?

**Yes, in several ways:**

1. **We call `chart.resize()` when klinecharts has already handled it.** KLineCharts sets DPR correctly during `adjustPaneViewport` in the constructor. Our manual `chart.resize()` calls after init are redundant and can interfere with the internal rAF that's setting DPR for the first time.

2. **We set up our own ResizeObserver on the container, which is correct** — klinecharts doesn't do this. But our ResizeObserver calls `scheduleResize()` which calls `chart.resize()`, and this can race with klinecharts' internal per-canvas ResizeObserver that was set up asynchronously.

3. **The async `isSupportedDevicePixelContentBox()` check creates a timing window.** During init, klinecharts uses the manual DPR path (calculates pixelRatio directly). After the async check resolves (typically within a few ms), it may switch to the ResizeObserver path. If our resize calls happen during this transition, the behavior changes silently.

4. **`applyDataToChart` does `chart.applyNewData()` + manual rAF resize.** But `applyNewData` already triggers `adjustPaneViewport` internally. The manual rAF resize is a second, redundant resize that races with klinecharts' internal one.

## Recommended Fix Strategy

The fix should **reduce** resize calls, not add more. The goal is to let klinecharts' native DPR handling work without interference.

### 1. Fix the `_resizeRAF` singleton bug

Change `_resizeRAF` from a module-level variable to a per-chart-instance mechanism. Options:
- Pass a `{ resizeRAF: null }` ref object (like `pendingDataApplyRef`)
- Or create a `ResizeScheduler` class/factory that holds its own `_resizeRAF`

### 2. Remove the redundant `initChart()` rAF

The `requestAnimationFrame(() => chart.resize())` at `chartLifecycle.js:105` is redundant. The constructor already calls `adjustPaneViewport`, and the ResizeObserver handles container size changes. However, removing it alone won't fix the issue — see point 3.

### 3. Remove the redundant `chart.resize()` from `applyDataToChart()`, keep `applyBarSpace()`/`scrollToRealTime()` in rAF

`chart.applyNewData()` already triggers `adjustPaneViewport` internally. The `chart.resize()` in `applyDataToChart`'s rAF is a duplicate. However, `applyBarSpace()` and `chart.scrollToRealTime()` in that rAF ARE needed — they should remain in a rAF (since `applyBarSpace` internally calls `chart.setBarSpace()` which triggers `adjustPaneViewport`, calling it synchronously inside a microtask like `onDataReady` would violate the "no resize in microtask" rule). Just remove the `chart.resize()` call from the rAF, keeping `applyBarSpace()` and `scrollToRealTime()`.

### 4. Consolidate all resize scheduling through one path

Currently there are TWO independent rAF resize paths:
- Raw `requestAnimationFrame` in `applyDataToChart()` (not coalesced)
- `scheduleResize()` via ResizeObserver (coalesced with module-level guard)

Both should go through `scheduleResize()`. But the singleton bug (point 1) must be fixed first. Note: `applyDataToChart`'s rAF also handles `applyBarSpace()` and `scrollToRealTime()` — after removing the redundant `chart.resize()` from it (point 3), the remaining calls can stay in `applyDataToChart`'s rAF since they're not resize-triggering in the same way (they're post-render adjustments).

### 5. Do NOT add more resize calls as "fixes"

Every additional `chart.resize()` call increases the chance of rAF guard collisions in klinecharts. The fix should reduce the total resize count from ~13 to ~5-6 during init.

## What NOT to Do

- **Do NOT add `setTimeout` or double-rAF "settle" resizes.** These are patches that add more resize calls to a system that already has too many.
- **Do NOT manually set `canvas.width`/`canvas.height` or call `ctx.scale()`.** This bypasses klinecharts' internal state management and will cause desynchronization.
- **Do NOT call `chart.resize()` inside microtask callbacks.** This fires during klinecharts' internal promise chain and can collide with its own `_executeListener` rAF.

---

## Fix v1 + v2 Implementation Results

### What v1 fixed
- Per-instance `createResizeState()` factory (Bug 1)
- Removed redundant `initChart()` rAF (Bug 2)
- Removed redundant `chart.resize()` from `applyDataToChart()` (Bug 3)
- All callers updated consistently

### What v2 fixed
- **v2 Fix A:** Deferred `setupIndicators()`, `applyPricePrecision()`, `setupChartActions()`, `loadChartData()` to a `requestAnimationFrame` after `initChart()`, avoiding DPR race with klinecharts' internal rAF.
- **v2 Fix B:** Added minimized-on-mount guard — chart creation skipped if `isMinimized`, deferred to un-minimize handler.
- **v2 Fix C:** Replaced `await tick()` with `setTimeout(0)` for correct container dimensions at init.
- **v2 Fix D:** Removed redundant initial `barSpace.applyBarSpace()` (no data loaded yet).
- **Singleton fix:** Converted `chartSubscriptions.js`, `xAxisCustom.js`, `xAxisTickGenerator.js` from module-level singletons to per-instance factories. Initial WeakMap approach replaced with Map + `_lastChart` tracking after runtime error (`WeakMap.keys()` not iterable in Node 20 / some browser engines).

### v2 did NOT fix the blurry render

Deferring post-init layout work to a rAF after `initChart()` did not resolve the blurriness. The root cause (Finding 1: klinecharts' async `isSupportedDevicePixelContentBox` transition) is **intrinsic to klinecharts' own init sequence** — even with our indicator/precision calls deferred, klinecharts still fires `setCustomApi()` → `adjustPaneViewport` → `Canvas.update` synchronously during `initChart()`, which is enough to trigger the DPR race before the constructor's first rAF fires.

The v2 timing chain is: `setTimeout(0)` → `initChart()` (sync: 3 internal `adjustPaneViewport` calls) → our rAF (indicators/data). The 3 internal calls during `initChart` alone are sufficient to collide with klinecharts' constructor rAF.

### Quality review results
- **Quality agent:** PASS_WITH_CONCERNS — no MUST/SHOULD issues. One dead import removed.
- **Architecture agent:** PASS across all 6 areas (factory consistency, singleton elimination, dependency flow, timing architecture, separation of concerns).
- **Build:** Passes. 155 modules, 0 errors.
- **Runtime fix:** `WeakMap.keys()` not iterable — replaced with `Map` + `_lastChart` (xAxisCustom.js).

### Non-blocking items for future work
1. Minimized-on-mount path duplicates init logic — extract shared `createAndInitChart()` helper.
2. `createResizeState()` is a trivial factory returning `{ rafId: null }` — could be inlined.
3. `xAxisCustom.js` re-exports from `xAxisTickGenerator.js` are unnecessary indirection.
4. `chartRequests.js` WebSocket singleton should have a comment explaining it is intentionally module-level.

---

## Deep Investigation Findings (v2)

### Finding 1: KLineCharts DPR Transition Race (Primary Cause)

The `isSupportedDevicePixelContentBox()` async check resolves within 1-2 frames. When it resolves to `true`, klinecharts switches from the manual DPR path to a per-canvas ResizeObserver path. This transition happens **during our indicator creation storm** (steps 5-7 of the init timeline).

**Mechanism:**
1. Constructor: `_supportedDevicePixelContentBox = false`. First `Canvas.update(w,h)` takes manual path, schedules rAF-A for DPR.
2. Steps 2-4 (sync): `_supportedDevicePixelContentBox` still `false`. Additional `Canvas.update` calls either enter `if` branch (new dimensions) or `else` branch (repaint only).
3. **Async check resolves** between steps 4 and 5: `_supportedDevicePixelContentBox = true`. Per-canvas ResizeObserver attached.
4. Step 5-7 (sync): `Canvas.update(w, h)` now takes the **observer path** — sets CSS dimensions but does NOT call `_resetPixelRatio()`. Defers to ResizeObserver.
5. ResizeObserver fires asynchronously: calls `_resetPixelRatio()` → `_executeListener(fn)`. If another rAF is already pending on this canvas, **the call is dropped**. Buffer stays at old dimensions while CSS is already updated. **Mismatch = blurry.**

The transition from manual to observer path mid-init is the root cause. Our code doesn't directly cause this, but our many synchronous layout calls (8-10 before first paint) increase the probability of hitting the race window.

### Finding 2: Our Init Creates 8-10 Synchronous Layout Passes Before First Paint

Verified timeline from code trace:

| # | Sync? | Action | Triggers `Canvas.update`? |
|---|-------|--------|--------------------------|
| 1 | Sync | `klinecharts.init()` | Yes — first layout |
| 2 | Sync | `setCustomApi()` | Yes — full `adjustPaneViewport` |
| 3 | Sync | `setPaneOptions()` | Yes — axis pane relayout |
| 4 | Sync | `barSpace.applyBarSpace()` | Yes — `setBarSpace` + `setOffsetRightDistance` |
| 5 | Sync | `createIndicator('BOLL')` | Yes — indicator layout |
| 6 | Sync | `createIndicator('AD')` | Yes — **new pane, major relayout** |
| 7 | Sync | `createIndicator('symbolWatermark')` | Yes — stacked indicator |

> **Note on sync vs microtask:** The v1 timeline (above) listed indicator creation as "Microtask" with `.then()`/`.finally()` callbacks. The v2 code trace confirms that in KLineCharts 9.8.12, `chart.createIndicator()` is synchronous — it does not return a Promise. The v1 timeline entries 6-8 were incorrect on timing.
| 8 | Sync | `applyNewData()` (when data arrives) | Yes — full data render |
| 9 | rAF | `applyBarSpace()` + `scrollToRealTime()` | Yes — viewport adjust |
| 10 | rAF | ResizeObserver → `scheduleResize` | Yes — full resize |

Steps 1-7 are all synchronous within `onMount`. The rAF from step 1 hasn't fired yet when steps 2-7 run.

### Finding 3: `tick()` Does Not Guarantee Layout

`await tick()` (ChartDisplay.svelte:268) flushes Svelte's reactive DOM updates but does NOT wait for the browser to perform a layout pass. `chartContainer.clientWidth` and `clientHeight` may be 0 or incorrect when `initChart()` runs immediately after `tick()`. The ResizeObserver eventually self-heals this, but by then klinecharts has already rendered multiple frames with potentially wrong dimensions.

### Finding 4: Minimized-on-Mount Is Broken

If a workspace is restored with `isMinimized: true`, the `{#if !isMinimized}` block prevents `chartContainer` from existing in the DOM. `initChart(null, ...)` runs against a null container. When later un-minimized, the reactive handler only calls `scheduleResize` if `chart` is truthy — but chart creation may have failed silently.

### Finding 5: `setBarSpace()` Is Not a Property Set

`chart.setBarSpace()` internally triggers `adjustPaneViewport` + `Canvas.update` on every pane. Combined with `setOffsetRightDistance()`, each `applyBarSpace()` call triggers **two** full layout passes. We call it 3 times during init (steps 4, 9, 10).

### Finding 6: Overlay Restore Triggers N Extra Layout Passes

Each `chart.createOverlay()` for drawing restoration triggers a layout + `Canvas.update`. For a workspace with N drawings, that's N additional render passes after data is loaded — all competing with the ResizeObserver rAF.

---

## Recommended Fix Strategy (v2) — IMPLEMENTED

### A. Defer post-init layout work to after first paint **IMPLEMENTED**

Moved `setupIndicators()`, `applyPricePrecision()`, `setupChartActions()`, and `loadChartData()` into a `requestAnimationFrame` after `initChart()`. This lets klinecharts' first rAF (from the constructor) fire and set DPR correctly before we trigger additional `Canvas.update` calls.

**File:** `src/components/ChartDisplay.svelte` — onMount lines 310-328.

### B. Guard against minimized-on-mount **IMPLEMENTED**

Added `isMinimized` check in `onMount` before calling `initChart`. If minimized, only interact.js + keyboard handlers are set up. The un-minimize reactive handler creates the chart on-demand using the same deferred pattern.

**File:** `src/components/ChartDisplay.svelte` — onMount lines 300-306, reactive statement lines 263-295.

### C. Use `setTimeout(0)` instead of `tick()` for layout-dependent init **IMPLEMENTED**

Replaced `await tick()` with `setTimeout(0)` in onMount. Timer is cleaned up via `onMount` return. `tick()` only yielded to Svelte's microtask queue; `setTimeout(0)` yields to the browser layout engine, ensuring `clientWidth`/`clientHeight` are correct.

**File:** `src/components/ChartDisplay.svelte` — onMount lines 308-331.

### D. Reduce `applyBarSpace()` calls during init **IMPLEMENTED**

Removed the `barSpace.applyBarSpace()` call immediately after `initChart()` (was step 4 of the timeline — triggered 2 layout passes with no data loaded). BarSpace is still applied post-data-load in the `applyDataToChart` rAF callback.

**File:** `src/components/ChartDisplay.svelte` — removed from onMount.

---

## Architecture Review (Crystal Clarity Post-Refactor Assessment)

**Date:** 2026-04-17
**Scope:** All 38 files in `src/lib/chart/` + `ChartDisplay.svelte`

### Critical: Module-Level Singletons Break Multi-Chart ~~UNFIXED~~ **FIXED**

Three files used module-level `_chart`/`_window` state that clobbered across chart instances:

| File | Module-level state | Fix Applied |
|------|--------------------|-------------|
| `chartSubscriptions.js` | `let _chart = null` | Converted to `createChartSubscriptions(getChart)` factory. Each chart gets its own subscription manager. |
| `xAxisCustom.js` | `let _chart = null` | Replaced with `Map<Chart, {window}>` + `_lastChart` tracking. `setAxisChart(chart)` registers per-instance. `createTicks` uses `_lastChart` (safe because it's called synchronously during chart render). `removeAxisChart()` called on dispose to prevent leaks. |
| `xAxisTickGenerator.js` | `let _window` | Removed module state entirely. `generateTicks()` now accepts `window` as a 5th parameter. |

**Dependency threading:** `chartSubs` is created in `ChartDisplay.svelte` and passed to `createChartDataLoader` (for `subscribeOnDataReady`) and `setupChartActions` (for zoom/visibleRange subscriptions). Clean tree, no circular deps.

**Remaining safe singleton:** `chartRequests.js` has `let connectionManager = null` — this is per-process by design (WebSocket connections are shared, not per-chart).

### Over-Granular Modules — Merge Candidates

**High confidence:**

| Merge | From → Into | Reason |
|-------|-------------|--------|
| `fadedStyleDefaults.js` → `styleUtils.js` | Circular import; 65-line function is the only content |
| `resolutionMapping.js` → `chartConstants.js` | 17 lines, 1 call site (`candleMessages.js`) |
| `dataSearch.js` → `xAxisTickGenerator.js` | 37 lines, 1 consumer |
| `cacheFreshness.js` → `barCache.js` | 31 lines, 1 call site (`chartDataStore.js`) |

**Moderate confidence:**

| Merge | From → Into | Reason |
|-------|-------------|--------|
| `rulerData.js` + `rulerPosition.js` + `rulerOverlays.js` → 2 files | 4 files / 170 lines for one component (`QuickRuler.svelte`) |
| `calendarBoundaries.js` → `xAxisTickGenerator.js` | 1 consumer, single subsystem |

### Factory Pattern Overuse

7 factories in `src/lib/chart/`:

| Factory | Justified? | Reasoning |
|---------|-----------|-----------|
| `createBarSpace()` | Yes | Captures mutable deps with getters; chart/resolution/window change over time |
| `createAxisFormatter()` | Yes | Closure-over-getWindow for KLineChart callback |
| `createDrawingHandlers()` | Yes | 6 handlers sharing same deps; genuine cohesive unit |
| `createReloadChart()` | Marginal | 2 functions, 7 deps; could be plain functions |
| `createChartDataLoader()` | Marginal | 1 function, 4 deps; could be plain function |
| `createOverlayRestore()` | Marginal | 1 function, 3 deps; could be plain function |
| `createResizeState()` | No | Returns `{ rafId: null }`; inline at call site |

**The wiring cost:** `ChartDisplay.svelte` creates 6 factory instances with `get x() { return x; }` deps objects across ~60 lines. The call chain for "load new data" goes 5 factories deep. A single `ChartController` object holding mutable state would be simpler.

### `xAxisCustom.js` Re-exports Are Unnecessary

Re-exports `snapToBar`, `formatBoundaryLabel`, `generateTicks` from `xAxisTickGenerator.js`. Consumers should import directly. `xAxisCustom.js` should only contain registration logic + `setAxisChart`/`setAxisWindow`.

### `ChartDisplay.svelte` Orchestration

407 lines. 14 `let` declarations, 6 factory instances, 5 inline helpers, 5 change handlers, 2 reactive statements. The integration point is inherently complex, but the factory wiring amplifies it. The deepest call chain:

```
handleSymbolChange → reload (createReloadChart) → teardownSubscriptions + loadChartData
  → dataLoader.loadChartData (createChartDataLoader)
    → subscribeToBarStore (chartTickSubscriptions)
      → applyDataToChart → barSpace.applyBarSpace (createBarSpace)
```

5 factory levels for "tear down old data, load new data."

### Good Decompositions (Keep As-Is)

`barMerge.js`, `barCache.js`, `candleMessages.js`, `drawingCommands.js`, `DeleteDrawingCommand.js`, `drawingStore.js`, `overlayMeta.js`, `chartThemeLight.js`, `chartDrawingHandlers.js`, `chartTickSubscriptions.js`, `chartLifecycle.js`, `chartResize.js`, `chartRequests.js`, `chartBarSpace.js`, `chartConstants.js` + `chartConfig.js` (barrel), `chartTimeWindows.js`, all five `overlaysXxx.js` files, `quickRulerUtils.js`.

### Net Impact Applied

- **Singleton fix:** 3 files converted from module-level state to per-instance. Multi-chart bug eliminated.
- **Init sequence:** Reduced from ~13 `adjustPaneViewport` calls before stable render to ~5-6. Post-init layout deferred to after klinecharts' first rAF.
- **Minimized-on-mount:** Chart creation deferred until un-minimize; no more silent failures.
- **Layout yield:** `setTimeout(0)` replaces `tick()` for correct container dimensions at init time.
- **Build:** Passes. 155 modules transformed, 0 errors.
- **Blurry render:** Still present. Root cause is klinecharts-internal (DPR transition race during its own init).

---

## Next Steps — v3 Strategy (Not Yet Implemented)

The v2 approach of deferring our code did not work because klinecharts' **own** synchronous calls during `initChart()` (from `setCustomApi()`, `setTimezone()`, `setPaneOptions()`) already trigger enough `Canvas.update` calls to collide with the constructor's DPR rAF. The race is inside klinecharts, not in our code.

### Possible v3 approaches

1. **Patch klinecharts' `Canvas._executeListener`** — The rAF coalescing guard drops duplicate calls. If we can ensure the constructor's DPR-setting rAF always wins (e.g., by giving it higher priority or by clearing pending rAFs before scheduling), the race is eliminated. This requires forking or patching klinecharts.

2. **Force `isSupportedDevicePixelContentBox` to resolve synchronously** — If we can make the async check resolve to `true` before `initChart()` runs, klinecharts will use the ResizeObserver path from the start, avoiding the manual-to-observer transition. This could be done by polyfilling or mocking the API before chart creation.

3. **Manually force DPR after init settles** — After all init work completes (indicators loaded, data applied), do a single `chart.resize()` inside a `requestAnimationFrame` that runs after all klinecharts internal rAFs have settled. The challenge is knowing when "settled" is — may need a double-rAF or `requestIdleCallback` approach, which the diagnosis previously warned against. However, if used as a **single corrective resize** (not an additional resize during the storm), it may work.

4. **Upgrade klinecharts** — Check if a newer version of klinecharts (9.8.13+) fixes the DPR race. The async `isSupportedDevicePixelContentBox` check and rAF coalescing guard may have been addressed upstream.
