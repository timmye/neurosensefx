# Chart Dark Mode

## Goal
Add a dark mode toggle (sun/moon icon) in the chart toolbar, next to the timezone selector. Clicking switches all chart colors between light and dark themes. Preference persists per-session in localStorage.

## Design Decision: Chart-Only Scope

Architect assessment (2026-04-17) confirmed **chart-only dark mode** over a project-wide design token system.

**Rationale:**
- The rest of the app (Day Range, FX Basket, Price Ticker, Market Profile, BackgroundShader) is **already dark-themed**. No theme toggle needed there.
- The chart subsystem uses a deliberately different palette (green/red financial coloring on light surfaces) from the display subsystem (dark professional visualization). These are domain-separate, not accidental inconsistency.
- KLineChart consumes a plain JS object — it can't read CSS custom properties. A token system doesn't simplify chart theming.
- Retrofit cost if a project-wide token system is needed later: ~2-3 days. No patterns introduced here need undoing.

**Revisit project-wide tokens when:**
- User requests app-wide theme switching
- A third palette is needed (e.g., high-contrast accessibility mode)
- Hardcoded hex count exceeds ~400 (currently ~302 across 37 files)

## Color Mapping

### Candle

| Element | Light | Dark |
|---------|-------|------|
| Candle Up Body | `#c8e6b8` | `#26a69a` |
| Candle Down Body | `#f0c4c2` | `#ef5350` |
| No Change Candle | `#999999` | `#787b86` |
| Border & Wick | `#000000` | `#a3a6ad` |
| High Price Mark | `#48752c` | `#66bb6a` |
| Low Price Mark | `#bb2719` | `#ef5350` |
| Last Up | `#48752c` | `#66bb6a` |
| Last Down | `#bb2719` | `#ef5350` |
| Last No Change | `#999999` | `#787b86` |
| Last Text Color | `#FFFFFF` | `#131722` |
| Last Text Border | `rgba(0,0,0,0.1)` | `rgba(255,255,255,0.1)` |
| Extend Text Color | `#FFFFFF` | `#131722` |
| Tooltip Title | `#333333` | `#d1d4dc` |
| Tooltip Legend | `#555555` | `#a3a6ad` |

### Area (candle.area)

| Element | Light | Dark |
|---------|-------|------|
| Line Color | `#48752c` | `#66bb6a` |
| BG Start | `rgba(157,195,132,0.01)` | `rgba(38,166,154,0.01)` |
| BG End | `rgba(157,195,132,0.25)` | `rgba(38,166,154,0.25)` |
| Point Color | `#48752c` | `#66bb6a` |
| Point Ripple | `rgba(72,117,44,0.3)` | `rgba(38,166,154,0.3)` |

### Indicator

| Element | Light | Dark |
|---------|-------|------|
| OHLC Up | `rgba(72,117,44,.7)` | `rgba(38,166,154,.7)` |
| OHLC Down | `rgba(187,39,25,.7)` | `rgba(239,83,80,.7)` |
| OHLC No Change | `#999999` | `#787b86` |
| Bars Up | `rgba(157,195,132,.7)` | `rgba(38,166,154,.7)` |
| Bars Down | `rgba(222,157,155,.7)` | `rgba(239,83,80,.7)` |
| Bars No Change | `#999999` | `#787b86` |
| Line 0 (BOLL upper) | `#bb2719` | `#ef5350` |
| Line 1 (BOLL MA) | `#000000` | `#d1d4dc` |
| Line 2 (BOLL lower) | `#48752c` | `#66bb6a` |
| Line 3 (general) | `#48752c` | `#66bb6a` |
| Line 4 (general) | `#bb2719` | `#ef5350` |
| Circles Up | `rgba(72,117,44,.7)` | `rgba(38,166,154,.7)` |
| Circles Down | `rgba(187,39,25,.7)` | `rgba(239,83,80,.7)` |
| Circles No Change | `#999999` | `#787b86` |
| Last Value Text | `#FFFFFF` | `#131722` |
| Tooltip Title | `#555555` | `#a3a6ad` |
| Tooltip Legend | `#555555` | `#a3a6ad` |

### Grid, Axes, Separator

| Element | Light | Dark |
|---------|-------|------|
| Grid Lines | `#E0E0E0` | `#2a2e39` |
| Axis Lines | `#CCCCCC` | `#363a45` |
| Axis Tick Lines | `#CCCCCC` | `#363a45` |
| Axis Text | `#666666` | `#a3a6ad` |
| Separator Color | `#CCCCCC` | `#363a45` |
| Separator Active BG | `rgba(72,117,44,.08)` | `rgba(38,166,154,.08)` |

### Crosshair

| Element | Light | Dark |
|---------|-------|------|
| Line Color | `#958f00` | `#d4c44f` |
| Text BG | `#958f00` | `#d4c44f` |
| Text Border | `#958f00` | `#d4c44f` |
| Text Color | `#FFFFFF` | `#131722` |

### Overlay

| Element | Light | Dark |
|---------|-------|------|
| Point Color | `#48752c` | `#26a69a` |
| Point Border | `rgba(72,117,44,0.35)` | `rgba(38,166,154,0.35)` |
| Point Active | `#48752c` | `#26a69a` |
| Point Active Border | `rgba(72,117,44,0.35)` | `rgba(38,166,154,0.35)` |
| Line Color | `#48752c` | `#26a69a` |
| Rect/Polygon/Circle Fill | `rgba(72,117,44,0.12)` | `rgba(38,166,154,0.10)` |
| Rect/Polygon/Circle Border | `#48752c` | `#26a69a` |
| Arc Color | `#48752c` | `#26a69a` |
| Text BG | `#48752c` | `#26a69a` |
| Text Border | `#48752c` | `#26a69a` |
| Text Color | `#FFFFFF` | `#131722` |

### UI Chrome Colors

| Element | Light | Dark | Used in |
|---------|-------|---------|---------|
| Chart window bg | `#FAFAFA` | `#0b0e14` | `ChartDisplay.svelte` |
| Chart window border | `#D0D0D0` | `rgba(51,65,85,0.5)` | `ChartDisplay.svelte` |
| Canvas background | `#FFFFFF` | `#131722` | `ChartDisplay.svelte` |
| Focus border | `#48752c` | `#34d399` | `ChartDisplay.svelte` |
| Focus box-shadow | `rgba(72,117,44,0.3)` | `rgba(0,0,0,0.5)` | `ChartDisplay.svelte` |
| Focus-visible box-shadow | `rgba(72,117,44,0.4)` | `rgba(0,0,0,0.5)` | `ChartDisplay.svelte` |
| Focus-visible outline | `rgba(72,117,44,0.3)` | `rgba(0,0,0,0.5)` | `ChartDisplay.svelte` |
| Header bg | `rgba(245,245,245,0.97)` | `rgba(30,41,59,0.2)` | `ChartHeader.svelte` |
| Header text (primary) | `#333333` | `#e2e8f0` | `ChartHeader.svelte` |
| Close bg | `rgba(245,245,245,0.8)` | `rgba(30,41,59,0.3)` | `ChartHeader.svelte` |
| Close text | `#777777` | `#94a3b8` | `ChartHeader.svelte` |
| Close hover bg | `#E0E0E0` | `rgba(51,65,85,0.5)` | `ChartHeader.svelte` |
| Close hover text | `#333333` | `#cbd5e1` | `ChartHeader.svelte` |
| Header button text | `#777777` | `#94a3b8` | `ChartHeader.svelte` |
| Button hover bg | `#E0E0E0` | `rgba(51,65,85,0.5)` | `ChartHeader.svelte` |
| Button hover/focus accent | `#48752c` | `#34d399` | `ChartHeader.svelte` |
| Toolbar bg | `rgba(250,250,250,0.97)` | `rgba(30,41,59,0.3)` | `ChartToolbar.svelte` |
| Toolbar border | `#D0D0D0` | `rgba(51,65,85,0.5)` | `ChartToolbar.svelte` |
| Separator | `#D0D0D0` | `rgba(51,65,85,0.5)` | `ChartToolbar.svelte` |
| Button bg | `#FFFFFF` | `rgba(30,41,59,0.3)` | `ChartToolbar.svelte` |
| Button border | `#CCCCCC` | `rgba(51,65,85,0.5)` | `ChartToolbar.svelte` |
| Button text | `#555555` | `#94a3b8` | `ChartToolbar.svelte` |
| Button hover bg | `#F0F0F0` | `rgba(51,65,85,0.5)` | `ChartToolbar.svelte` |
| Button hover border | `#999999` | `rgba(71,85,105,0.6)` | `ChartToolbar.svelte` |
| Button hover text | `#333333` | `#cbd5e1` | `ChartToolbar.svelte` |
| Active button bg | `#48752c` | `#475569` | `ChartToolbar.svelte` |
| Active button border | `#48752c` | `#475569` | `ChartToolbar.svelte` |
| Active button text | `#FFFFFF` | `#e2e8f0` | `ChartToolbar.svelte` |
| Focus outline (tz-select) | `#48752c` | `#34d399` | `ChartToolbar.svelte` |
| Context menu bg | `#FFFFFF` | `rgba(30,41,59,0.6)` | `OverlayContextMenu.svelte` |
| Context menu border | `#D0D0D0` | `rgba(51,65,85,0.5)` | `OverlayContextMenu.svelte` |
| Context menu text | `#333333` | `#e2e8f0` | `OverlayContextMenu.svelte` |
| Context menu hover | `#F0F0F0` | `rgba(51,65,85,0.5)` | `OverlayContextMenu.svelte` |
| Delete hover | `#fce4e4` | `rgba(239,83,80,0.15)` | `OverlayContextMenu.svelte` |
| Resize handle | `#555` | `#64748b` | `ChartDisplay.svelte` |
| Shadow | — | `rgba(0,0,0,0.5)` | `OverlayContextMenu.svelte` |

## Implementation

### Step 1: Create `src/lib/chart/chartThemeDark.js`

Full dark theme object mirroring `chartThemeLight.js` structure with all dark colors from the Color Mapping tables above. Export as `DARK_THEME`.

### Step 2: Create `src/stores/themeStore.js`

Writable Svelte store with localStorage persistence (`nsfx-chart-theme` key) and `toggleTheme()` export.

### Step 3: Create `src/lib/chart/themeColors.js`

`getThemeColor(light, dark)` helper using `get(themeStore)` for use in overlay `createPointFigures` callbacks (canvas render loop, not Svelte reactivity).

### Step 4: Update `src/components/displays/ChartHeader.svelte`

- Import `themeStore` for dark class binding
- Apply `class:dark={$themeStore === 'dark'}` on `.header` and `.close-always-visible` divs
- Dark CSS: translucent slate backgrounds, `#e2e8f0` primary text, `#94a3b8` secondary text, `#34d399` accent

### Step 5: Update `src/components/ChartDisplay.svelte`

- Import `DARK_THEME` and `themeStore`
- `applyTheme()` function reads `$themeStore` reactively
- Reactive statement `$: if (chart) applyTheme(), $themeStore;` — the `, $themeStore` forces Svelte to track the store dependency
- `initChart()` accepts `theme` parameter (resolved from `$themeStore`) to avoid flash of wrong theme on init
- Dark CSS: `#0b0e14` window bg, `#131722` canvas bg, `#34d399` focus, `rgba(51,65,85,0.5)` borders

### Step 6: Update overlay/drawing colors

- `rulerOverlays.js` — `const LINE_COLOR` → `getLineColor()` function via `getThemeColor()`
- `overlaysPriceLines.js` — theme-aware ruler label background
- `fadedStyleDefaults.js` — static `FADED_*` constants → runtime `makeFadedDefaults()` reading themeStore
- `QuickRuler.svelte` — import `getLineColor()` (not `LINE_COLOR`), pass theme-aware text color to data window tooltip

### Step 7: Update `src/components/ChartToolbar.svelte`

- Import `themeStore` and `toggleTheme`
- Theme toggle button (sun/moon) next to timezone selector, using `action-btn` class
- Dark CSS: translucent slate backgrounds, `#94a3b8` text, `#475569` active, `#34d399` focus, `#e2e8f0` active text

### Step 8: Update `src/components/OverlayContextMenu.svelte`

- Import `themeStore`
- Dark CSS: `rgba(30,41,59,0.6)` bg, `rgba(51,65,85,0.5)` border/hover, `#e2e8f0` text

## Files Changed

| File | Change |
|------|--------|
| `src/lib/chart/chartThemeDark.js` | **NEW** — full dark theme object |
| `src/stores/themeStore.js` | **NEW** — writable store + localStorage + toggleTheme() |
| `src/lib/chart/themeColors.js` | **NEW** — `getThemeColor(light, dark)` helper |
| `src/lib/chart/fadedStyleDefaults.js` | Static constants → runtime `makeFadedDefaults()` |
| `src/lib/chart/rulerOverlays.js` | `const LINE_COLOR` → `getLineColor()` function |
| `src/lib/chart/overlaysPriceLines.js` | Theme-aware ruler label bg |
| `src/lib/chart/chartLifecycle.js` | `initChart` accepts `theme` parameter instead of `LIGHT_THEME` |
| `src/lib/chart/rulerPosition.js` | `computeDataWindowStyle` accepts `textColor` parameter |
| `src/components/displays/ChartHeader.svelte` | Dark class binding + dark CSS |
| `src/components/ChartDisplay.svelte` | Reactive theme (`, $themeStore` dep) + initChart theme param + dark CSS |
| `src/components/ChartToolbar.svelte` | Theme toggle button + dark CSS |
| `src/components/OverlayContextMenu.svelte` | Dark class binding + dark CSS |
| `src/components/QuickRuler.svelte` | `getLineColor()` calls + theme-aware tooltip text |

## Not In Scope
- App-wide dark mode (workspace background, price tickers, day range, FX basket, market profile) — already dark-themed
- Project-wide design token system — deferred until a second consumer needs theme switching (see Design Decision above)
- Theme persistence across workspaces — single global preference
- System preference detection (`prefers-color-scheme`) — manual toggle only
- Fibonacci overlay styles (`#bb2719`) — per-tool drawing defaults, not theme-driven
- Arrow overlay color (`#333333`) — structural color, constant across themes
- Annotation overlay color (`#48752c`) — functional overlay default, covered by theme's `overlay.text.backgroundColor`
