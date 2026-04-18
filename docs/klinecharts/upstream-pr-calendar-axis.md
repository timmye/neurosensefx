# Upstream PR: Calendar-Aware X-Axis for KLineChart

## Date: 2026-04-18

## Motivation

We built a custom calendar-aware X-axis on top of KLineChart v9.8.12 (`registerXAxis` API) that provides calendar-boundary-aligned ticks, timezone-aware labels, and smart tier-based formatting. This doc captures the exploration of whether this work is viable as an upstream contribution.

## Our Implementation

**3 files, ~375 LOC total:**

| File | LOC | Purpose |
|------|-----|---------|
| `src/lib/chart/xAxisCustom.js` | 109 | `registerXAxis({ name: 'calendar', createTicks })` entry point + per-chart state registry |
| `src/lib/chart/xAxisTickGenerator.js` | 119 | Tick generation pipeline: collect candidates, dedup, emit labeled ticks |
| `src/lib/chart/calendarBoundaries.js` | 141 | Calendar boundary alignment (week/month/quarter/year) + rank-priority label formatting |
| `src/lib/chart/chartTimeWindows.js` | 115 | Calendar-aligned time range computation + barSpace calculation |

Supporting modules (imported but not part of the axis core):
- `chartConstants.js` — `TRANSITION_MATRIX`, `TIME_WINDOW_GROUPS`, resolution/window constants
- `dataSearch.js` — `snapToBar`, `dataIndexOf` binary search utilities

### Key Features

1. **Calendar boundary alignment** — ticks snap to real calendar boundaries (Sunday for forex weeks, 1st for months, Jan/Apr/Jul/Oct for quarters, Jan 1 for years)
2. **Timezone-aware formatting** — `Intl.DateTimeFormat` with per-chart timezone support, formatter caching for performance
3. **Tier-based smart labels** — transition matrix controls which time units appear per zoom window:
   - INTRADAY (1d-2d): `HH:mm`
   - DAILY (1W-2W): `DD-MM`
   - WEEKLY (1M): `DD-MM`
   - MONTHLY (3M-6M): month name
   - QUARTERLY (1Y): `Month Year`
   - YEARLY (2Y+): year only
4. **Multi-chart support** — per-chart registry for timezone and window state, safe for multiple chart instances

## KLineChart Repo Status

| Metric | Value |
|--------|-------|
| Repo | `klinecharts/KLineChart` |
| Stars | 3,700 |
| Forks | 913 |
| License | Apache-2.0 |
| Default branch | `main` (v10 development) |
| Stable branch | `v9` |
| CONTRIBUTING.md | Yes — lint check, one thing per PR, tested code |
| Open PRs | 5 (community contributors, actively merged) |
| Open issues | 55 |

## v9 vs v10 X-Axis Comparison

### API Signature (identical)

```ts
// Both v9 and v10
registerXAxis({
  name: string,
  scrollZoomEnabled?: boolean,  // v10 only
  createTicks: ({ range, bounding, defaultTicks }) => AxisTick[]
})
```

Our code uses exactly this interface. Porting to v10 requires no API changes.

### Key Differences

| Aspect | v9 | v10 |
|--------|-----|-----|
| Default axis name | `default` | `normal` |
| `AxisRange` fields | `from, to, range, realFrom, realTo, realRange` | Adds `displayFrom, displayTo, displayRange` |
| `AxisTemplate` options | `name` + `createTicks` | Adds `scrollZoomEnabled`, `createRange`, `reverse`, `inside`, `position`, `gap`, value conversion callbacks |
| Built-in tick logic | `optimalTicks()` — diff-based label optimization between adjacent bars | `createTicksImp()` — period-aware via `PeriodTypeXAxisFormat` static map |
| Timezone support | `Intl.DateTimeFormat` in `_optimalTickLabel` (per-chart, via `setTimezone`) | **None** — zero timezone references in entire codebase |
| Format strings | Dynamic per-comparison (`YYYY` vs `YYYY-MM` vs `MM-DD`) | Static `PeriodTypeXAxisFormat` map keyed by period type |

### v10 PeriodTypeXAxisFormat (what they ship)

```ts
const PeriodTypeXAxisFormat: Record<PeriodType, string> = {
  second: 'HH:mm:ss',
  minute: 'HH:mm',
  hour:   'MM-DD HH:mm',
  day:    'YYYY-MM-DD',
  week:   'YYYY-MM-DD',
  month:  'YYYY-MM',
  year:   'YYYY'
}
```

This is a single static format per period type — no zoom-aware transitions, no calendar boundary alignment, no timezone support.

### v10 XAxis.createTicksImp() Flow

1. Gets visible range from chart store
2. Calculates `tickBetweenBarCount` based on `barSpace` vs `tickTextWidth`
3. Iterates data indices at `tickBetweenBarCount` intervals
4. Formats each tick using `formatDate(timestamp, PeriodTypeXAxisFormat[period.type], 'xAxis')`
5. If custom `createTicks` is registered, calls it with `{ range, bounding, defaultTicks }`

Our calendar axis receives these `defaultTicks` as a fallback but generates its own boundary-aligned ticks instead.

## Community Demand Evidence

| Issue | Status | Relevance |
|-------|--------|-----------|
| #96 "x-axis label should be based on bar interval" | Closed | Label formatting based on zoom level — exactly what our tier system does |
| #663 "setTimezone not overriding timezone in formatDate" | Closed (bug fix, not feature) | Timezone support was requested, fix was minimal — no real timezone-aware axis |
| #93 "Support for 12 hour time (X-axis)" | Closed | Custom time formatting on X-axis |
| #542 "Scale Y-Axis Programmatically (w/ mouse scroll)" | Open | Shows interest in axis customization |
| #754 "Provide parameter for K-line spacing" | Open | Bar space control |

No existing issue directly requests calendar-boundary-aligned or timezone-aware X-axis ticks.

## PR Viability Assessment

### Green Flags

1. **API is stable across v9 and v10** — our `createTicks` callback ports with zero changes
2. **Real gap in v10** — zero timezone support, no calendar boundary alignment, no zoom-aware tier transitions
3. **Self-contained contribution** — all our logic lives in the `createTicks` callback, no patches to klinecharts internals
4. **Active maintainer** — accepting community PRs, v10 beta still in progress
5. **Apache-2.0 license** — no contributor license agreement complexity

### Risks

1. **v10 is still beta** — API could shift before stable release
2. **No existing issue for this feature** — maintainer may not see the need; should open feature request first
3. **Our code is tightly coupled to our app** — chart registry, timezone store, `TRANSITION_MATRIX` constants would need to be generalized for upstream
4. **v10's `createTicksImp` already does period-aware formatting** — may overlap with our approach; need to understand if we should enhance it or replace via `createTicks`

### Required Generalization for Upstream

Our code needs these changes to be upstream-ready:

- **Remove app-specific state management** — the `chartRegistry` Map and `_lastChart` workaround are specific to our multi-chart Svelte app. Upstream should use the chart instance or context passed through the API.
- **Parameterize configuration** — `TRANSITION_MATRIX`, `WEEK_START_DAY`, tier thresholds, and format strings should be configurable via the `registerXAxis` template or chart options, not hardcoded.
- **Remove Svelte store dependency** — our timezone store integration needs to be replaced with a simple timezone parameter.
- **Add tests** — CONTRIBUTING.md requires tests. Our `src/lib/chart/__tests__/` has some coverage but would need upstream-compatible tests.
- **Add TypeScript types** — v10 is TypeScript-first. Our JS implementation would need type definitions.

## Recommended Next Steps

1. **Open a feature request issue** on `klinecharts/KLineChart` describing the calendar-aware X-axis concept. Ask maintainer `lihy` if:
   - This aligns with v10's axis module direction
   - They'd prefer enhancing the built-in `normal` axis or a separate `calendar` registration
   - v10's `AxisTemplate` could accept timezone configuration

2. **Wait for maintainer response** before investing in the generalization work.

3. **If approved**, fork against `main` (v10) branch and:
   - Create a standalone `calendar` x-axis extension
   - Extract calendar boundary logic as a shared utility
   - Add timezone parameter to `AxisTemplate` or chart options
   - Write tests compatible with their test framework
   - Provide TypeScript declarations

4. **If declined**, keep our implementation as a local extension — it works perfectly via `registerXAxis` and doesn't depend on internals.

## Source Files Referenced

| Path | Branch | What |
|------|--------|------|
| `src/extension/x-axis/index.ts` | main (v10) | `registerXAxis` implementation, `getXAxisClass` |
| `src/component/XAxis.ts` | main (v10) | `XAxisImp` base class, `createTicksImp()`, `extend()` static |
| `src/component/Axis.ts` | main (v10) | `AxisTemplate`, `AxisTick`, `AxisRange`, `AxisCreateTicksParams` |
| `src/extension/x-axis/normal.ts` | main (v10) | Default x-axis (empty template, relies on base `createTicksImp`) |
| `src/common/Period.ts` | main (v10) | `PeriodType`, `PeriodTypeXAxisFormat` static map |
| `src/view/XAxisView.ts` | main (v10) | Tick rendering (line + text attrs from `AxisTick[]`) |
| `docs/@views/api/samples/registerXAxis/index.js` | main (v10) | Official custom x-axis sample |
| `src/component/XAxis.ts` | v9 | v9 `XAxisImp` with `optimalTicks()` diff-based formatting |
| `src/component/Axis.ts` | v9 | v9 `AxisTemplate` (simpler: `name` + `createTicks` only) |
| `src/extension/x-axis/default.ts` | v9 | v9 default x-axis (passthrough `createTicks`) |
