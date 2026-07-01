# Cohesive Shell-Canvas Theme System

**Status:** ✅ IMPLEMENTED 2026-07-01 — full sweep landed; build clean (~637 kB); 487/487 unit tests green; UI verified in-browser both themes. New module `src/lib/canvasTheme.js`. Quality-reviewer pass: no critical/major (2 minors + 1 nit found and fixed). Design record: `docs/frontend-cohesion-design-2026-06-30.md` §13.

## Context

The frontend cohesion/design-system work (implemented 2026-07-01) gave the **DOM** a clean 2-tier token layer (`src/styles/tokens.css`, themed via `<html data-theme>` driven by `themeStore`). The **canvas** renderers were explicitly scoped out — so they now duplicate those colors as hardcoded literals and hand-branch on theme.

This cost **5 commits** to settle one TWAP-dot color on light theme (`7120604`→`a9469bf`): the mini-profile reads `get(themeStore)` and threads `isLight` into draw functions that each hardcode a per-theme pair (`isLight ? '#e8e8e8' : '#111111'`, `isLight ? '#555' : '#00FF66'`). Worse, the other ~15 shell-canvas files (day-range meter, FX basket, price markers, status text) have **~38 hardcoded colors that assume dark** — so light theme is silently broken there (dark canvas blocks in light frames, white text, `rgba(10,10,10,.7)` label backgrounds).

**Outcome wanted:** one centralized resolver that every shell-canvas renderer consumes, reading `themeStore` at paint time — mirroring the *existing* chart-canvas idiom (`src/lib/chart/themeColors.js` `getThemeColor()` + `fadedStyleDefaults.js`) so the whole app shares one canvas-theming pattern. DOM stays CSS tokens; canvas stays a JS resolver (the codebase's existing boundary). Light theme becomes correct everywhere; no more per-theme hand-tuning commit cycles.

**User decisions (locked):** (1) JS resolver mirroring chart canvas — *not* a CSS-variable bridge. (2) Full sweep of all shell canvases.

**Out of scope (unchanged):** `src/lib/chart/**` (chart canvas, reads `chartThemeStore`, deferred); canvas *fonts* (DOM-only token); chart internals.

---

## Approach

### New module: `src/lib/canvasTheme.js`

The shell-store analog of `chart/themeColors.js` + `fadedStyleDefaults.js`, but centralized, grouped, and covering every shell-canvas role.

```js
import { themeStore } from '../stores/themeStore.js';

// Pre-built module constants — built ONCE at load (withAlpha used here, not per-frame).
const DARK = { surfaces:{...}, text:{...}, marketProfile:{...}, dayRange:{...}, ... };
const LIGHT = { ... };

// ONE subscription for the app lifetime caches the resolved set. getCanvasColors()
// becomes a plain variable read — no per-call get()/subscribe/unsubscribe, no allocation.
let current = DARK;                                  // themeStore default is 'dark'
themeStore.subscribe(t => { current = t === 'light' ? LIGHT : DARK; });

// Replace every hand-written rgba(r,g,b,a) literal; used at module load to precompute
// alpha variants into DARK/LIGHT, NOT called on the per-frame render path.
export function withAlpha(hex, a) { /* parse #RGB/#RRGGBB/(#RRGGBBAA) → 'rgba(r,g,b,a)' */ }

export function getCanvasColors() { return current; }   // ≈ free: variable read
```

**Performance constraints (hard — not execution discretion):**
- `DARK`/`LIGHT` are **module-level constants built once at load** (alpha variants precomputed via `withAlpha` into the constants). `getCanvasColors()` returns a reference — **zero per-frame allocation**.
- Theme is read via a **single app-lifetime subscription**, not per-call `get()`. (Cheaper than the chart-canvas precedent, which calls `get()` per color per render.)
- **Hot per-marker paths** (`renderPriceMarkers`, `renderPriceDelta`, `renderMultiSizePrice`) resolve `getCanvasColors()` **once at the render entry** and thread the object down — never resolve per marker/label. `getConfig()` already builds once per render; the resolver read inside it is a variable read.

`DARK`/`LIGHT` are plain object literals with the **same grouped shape**: `surfaces`, `text`, `marketProfile`, `dayRange`, `fxBasket`, `fxBasketZones`, `overlays`. Two color kinds are explicitly distinguished by comment:
- **theme-aware** — has a light + dark variant (the bug-causing surfaces/text/label-backgrounds/hover).
- **theme-invariant** — semantic encoding where hue IS the information (amber=warn, red=error, the cyan intensity ramp, the FX zone ramp, POC/current/open oranges, selection-orange). Identical in both palettes; marked so no one later "fixes" them for light.

This is the single auditable table of every shell-canvas color — replaces ~38 literals scattered across 16 files.

### Config-driven integration (the key pattern)

Several renderers are config-driven: `dayRangeConfig.defaultConfig.colors` (14 colors) and `fxBasketConfig` colors flow to renderers/compute as `config.colors.*`. **Verified:** no file reads `defaultConfig.colors` directly — all production paths go through `getConfig()` (`visualizers.js:2`, `displayCanvasRenderer.js:181`, `marketProfile/orchestrator.js:14`, `fxBasketOrchestrator.js:8`). `priceMarkerBase.js:6` imports `defaultConfig` but uses **only** `.fonts`/`.emphasis`, never `.colors`.

Therefore: **remove `colors` from `defaultConfig`; `getConfig()` injects resolver colors.** Renderers and compute functions keep reading `config.colors.*` — untouched.

```js
// dayRangeConfig.js
import { getCanvasColors } from '../canvasTheme.js';
const baseConfig = { fonts, emphasis, positioning, features, scaling }; // colors removed
export const defaultConfig = baseConfig;
export function getConfig(overrides = {}) {
  const { colors: _omit, ...rest } = overrides;
  return { ...baseConfig, colors: { ...getCanvasColors().dayRange, ...(overrides.colors||{}) }, ...rest };
}
```
`fxBasketConfig.js` mirrors this (`colors.text`/`baseline` themified; `ZONE_COLORS` stays theme-invariant, sourced from `getCanvasColors().fxBasketZones`). `createDayRangeConfig()` (`dayRangeRenderingUtils.js:14`) calls `getConfig()` ~3×/build — fine, each is one `get()` + literal return.

**Tests stay green:** `priceMarkerCompute.test.js` injects its own stub `colors` (`#414141`, `#ff6b35` are test-local, never resolver outputs) and asserts the `#414141` *fallback literal* in `priceMarkerCompute.js` — keep that literal. `dayRangeCompute.test.js` passes its own `makeGetConfig()` (no `colors` key, numeric-only assertions). Neither touches the real `getConfig()`.

### Repaint-on-theme hooks

Only `PriceTicker.svelte` repaints on theme change today (`:203-206` `$: if(canvasRef&&...){ void $themeStore; scheduleProfileRender(); }`). The resolver reads theme at paint time, so every other shell canvas needs the same hook or a toggle leaves a stale frame until the next tick.

| Canvas | Component | Scheduler | Hook |
|---|---|---|---|
| Mini profile | `PriceTicker.svelte` | `scheduleProfileRender()` | **exists — no change** |
| Day-range / market-profile / markers / delta | `displays/DisplayCanvas.svelte` | `scheduleRender()` (`:30`) | add `$: if(canvas&&ctx){ void $themeStore; scheduleRender(); }` near `:102` |
| FX basket | `FxBasketDisplay.svelte` | `renderCanvas()` (`:120`) | add same hook; import `themeStore` |

Also: `DisplayCanvas.svelte:158` CSS `background:#0a0a0a` → `background:var(--bg-app)` (the day-range surface). `FxBasketDisplay.svelte:197` already uses `var(--bg-app)`. `HeadlinesWidget` has no canvas — skip.

---

## Light-theme values

`DARK` = today's literals (zero visual change in dark). `LIGHT` proposals (verified-sensible; flag the few genuine design calls):

**Surfaces / text (theme-aware — the headline fixes):**
- day-range & combined bg `#0a0a0a` → `#e8e8e8`; mini-profile bg/border keep (`#e8e8e8`/`#ccc`); FX waiting/error bg `#1a1a1a` → `#e8e8e8`.
- **label backgrounds** `rgba(10,10,10,.7)` (×4) and DR% `rgba(0,0,0,.6)` → `rgba(255,255,255,.75)` / `.7` — **the primary light-theme bug** (dark block behind price labels).
- FX text `#FFFFFF` → `#1a1a1a` (matches `--text-primary` light).
- hover line/text `rgba(255,255,255,.5/.8)` → `rgba(0,0,0,.4/.65)`.

**Day-range config (theme-aware grays darken on light for contrast):**
`axisPrimary #4B5563→#9CA3AF`; `currentPrice/openPrice #6B7280→#4B5563`; `percentageLabels #9CA3AF→#6B7280`; `markers #374151→#9CA3AF`; `previousDay #414141→#6B7280` (config value only — keep the `#414141` compute fallback); `adrRange rgba(224,224,224,.3)→rgba(75,85,99,.18)`.
**[JUDGMENT — darken-on-light, verified in app]:** `priceUp #4a9eff→#1d6fd6`; `priceDown #8f6ce0→#6d3fb8`; `boundaryLine #854be8→#6d3fb8`; `sessionPrices #f69051→#d9661f`; `sessionRange rgba(59,130,246,.3)→rgba(29,111,214,.25)`; `twapMarker #10b981→#059669`; FX `baseline #6B7280→#9CA3AF`.

**Theme-invariant encodings (same both themes):** POC `#ff8c4a`; current/open `#FF6600`/`#FF8800`; delta `#FFD700`; selected `#ff6b35`; status `#F59E0B`; error `#EF4444`; FX zones `#6B7280/#F59E0B/#F97316/#EF4444`; FX positive/negative.
**[JUDGMENT — intensity ramp, verified in app]:** full-profile intensity cyans `#0891b2/#22d3ee/#67e8f9` wash out on light. Adopted: darken the ramp one step on light (`#0e7490/#0891b2/#22d3ee`) preserving "brighter=hotter" direction.

---

## Migration (ordered, each step shippable + `npm run test:unit` 487 green)

1. **Foundation** — create `canvasTheme.js` (`getCanvasColors`, `withAlpha`, DARK/LIGHT literals). No consumers yet. Additive, zero risk.
2. **dayRangeConfig** — remove `colors` from `defaultConfig`, themify `getConfig()`. Dark unchanged. Tests green (own configs).
3. **fxBasketConfig + fxBasketElements** — themify `getConfig()` colors; replace `#1a1a1a`/`#FFFFFF` in waiting/error states with resolver reads; `ZONE_COLORS` sourced from resolver (invariant values). Add FxBasketDisplay repaint hook.
4. **Label-background headline fix** — `displayCanvasRenderer.js`, `dayRange/dayRangeElements.js`, `priceMarkers/priceMarkerBase.js`, `percentageMarkerRenderer.js`: replace the `rgba(10,10,10,.7)`/`rgba(0,0,0,.6)` literals with `getCanvasColors().surfaces.*`. Resolve once per render entry, pass down (hot path).
5. **Backgrounds + market-profile + status + overlays** — `visualizers.js`, `dayRangeRenderingUtils.js`, `canvasStatusRenderer.js`, `marketProfile/rendering.js`+`calculations.js`+`orchestrator.js` (retire the `isLight` plumbing — the resolver encodes it), `priceMarkers/priceMarkerRenderer.js`. Mechanical replacements.
6. **Activate light theme** — add DisplayCanvas repaint hook; `DisplayCanvas.svelte:158` `#0a0a0a`→`var(--bg-app)`. (Without this, steps 2-5 are invisible until next tick.)
7. **Retire legacy `colors.js` COLORS** (zero consumers — verified); keep `FONT_SIZES`/`LINE_WIDTHS`/`SYSTEM_FONT_FAMILY` re-export (still used by `dayRangeElements.js`, `priceMarkerBase.js`). **Docs:** add `canvasTheme.js` to `src/lib/CLAUDE.md`; note in design doc `docs/frontend-cohesion-design-2026-06-30.md` §13 that the canvas-token carry-over is now resolved.

---

## Risks & verification

**Risks:** (1) render-path cost — **eliminated by design**: single app-lifetime subscription caches the resolved set; `getCanvasColors()` is a variable read returning a module constant (no per-frame allocation/`get()`); hot per-marker paths resolve once and thread down. Net-new per-frame work for the (previously theme-unaware) day-range/FX paths is a cached variable read — cheaper than the chart canvas's existing per-color `get()`. (2) `defaultConfig` shape — `fonts`/`emphasis` preserved (step 2 keeps them). (3) stale paint on toggle — fully addressed by step-6 hooks. (4) intensity-ramp perceptual change — flagged, verified in app. (5) no `window.*`/`console.error` impact (resolver only reads a Svelte store).

**Per-step gates:** `npm run build` (clean) + `npm run test:unit` (expect **487 green**; re-run after steps 2, 3, 5).

**Manual (both themes, per canvas):** day-range meter — bg/axis/markers/ADR bands/percentage labels/delta block/label-backgrounds repaint immediately on toggle; combined view — value-area tint + POC + intensity bars readable on light; FX basket — labels visible on light (white-text bug fixed), waiting/error states paint light bg, zone encoding retained; mini profile — regression-only; status/error — amber/red readable once CSS bg is themed. Rapid-toggle to confirm rAF coalescing (no flicker/stale frames).

**Note:** full E2E is flaky in this env (console-check spec hardcodes `localhost:5174`; the one `console.error` it catches is a pre-existing 401 from `checkSession()`, not this work). Gate on unit tests + manual visual check.

---

## Execution record (2026-07-01)

All 7 steps executed, each gated by `npm run build` + `npm run test:unit` (**487/487 green** throughout; build clean ~637 kB). Quality-reviewer pass over the full diff found **no critical/major** issues; two minors fixed (per-bar resolver read in `drawBars` hoisted out of the loop; leftover `DELTA_MARKER_COLOR` literal routed through `overlays.delta`) plus one nit (8-digit hex normalized). Confirmed: `src/lib/chart/**` untouched, `window.*` untouched, `#414141` compute fallback kept, `defaultConfig.fonts`/`.emphasis` preserved, `COLORS` retired while `FONT_SIZES`/`LINE_WIDTHS`/`SYSTEM_FONT_FAMILY` kept. UI verified in-browser on both themes by the user.

## Critical files

- `src/lib/canvasTheme.js` (new — the resolver; everything pivots on this)
- `src/lib/dayRange/dayRangeConfig.js` (config-integration anchor; `getConfig()` themify pattern fxBasket mirrors)
- `src/lib/fxBasket/fxBasketConfig.js` + `fxBasketElements.js`
- `src/lib/displayCanvasRenderer.js`, `dayRange/dayRangeElements.js`, `priceMarkers/priceMarkerBase.js`, `percentageMarkerRenderer.js` (the `rgba(10,10,10,.7)` headline fix)
- `src/lib/marketProfile/rendering.js` + `orchestrator.js` (retire `isLight` plumbing) + `calculations.js`
- `src/components/displays/DisplayCanvas.svelte` (repaint hook + `#0a0a0a`→`var(--bg-app)`), `src/components/FxBasketDisplay.svelte` (repaint hook)
- `src/lib/colors.js` (retire `COLORS` only)
