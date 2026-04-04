# Chart Time Windows & Time Axis Report

## 1. Window Alignment Status

All calendar alignment logic is correct and verified across 6 edge-case scenarios.

| Window | Snap boundary | Verified | Notes |
|--------|--------------|----------|-------|
| 1d | Rolling (unchanged) | OK | `to - windowMs * 2` |
| 2d | Rolling (unchanged) | OK | Same |
| 1W | Monday UTC | OK | Always lands on Monday |
| 2W | Monday UTC | OK | 2 weeks back from current Monday |
| 1M | 1st of month UTC | OK | Previous complete month + current in-progress |
| 3M | 1st of month UTC | OK | 3 complete months + current + 1 buffer month |
| 6M | 1st of month UTC | OK | Same pattern |
| 1Y | Quarter start UTC | OK | Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct |
| 2Y | Jan 1 UTC | OK | Multi-year snap to Jan 1 |
| 5Y | Jan 1 UTC | OK | Same |
| 10Y | Jan 1 UTC | OK | Same |

### 1M User Report: "seems exact not calendar"

The 1M alignment logic is correct (verified: always snaps to 1st of previous month). The likely cause is that the **time axis labels don't reflect calendar boundaries** — KLineChart's default ticks land at arbitrary data-index positions. The data range is correct, but axis markings don't visually confirm it.

### Bugs fixed

- **BarSpace / Price Axis Inset**: `getBarSpace()` now uses `chart.getSize('candle_pane', 'main')?.width` instead of `chartContainer.clientWidth`, excluding the price axis area.
- **Duplicate loadHistoricalBars**: Removed leftover call with undefined variables.
- **Right padding destroyed on resize/zoom**: Removed `pendingScrollIndex` mechanism. It saved only a data index, discarding the offset distance needed to reconstruct scroll position after dimension changes. The deferred `scrollToDataIndex(idx)` then overwrote the 10px offset set by `applyBarSpace()`, producing 0px padding. All scroll-restoration paths now use `scrollToRealTime()` — the same pattern already used correctly in `applyDataToChart` — which preserves the configured offset. Affects ResizeObserver handler and onZoom handler.

---

## 2. Time Axis — Current State (Broken)

The custom `formatAxisLabel` override was implemented to produce tiered labels, but it **breaks KLineChart's transition detection** at every level. Result: transitions never fire, and all labels show the same format regardless of calendar boundaries.

### Why Transitions Never Work

KLineChart detects transitions by calling `formatDate` with format strings `'YYYY'`, `'YYYY-MM'`, `'MM-DD'` and **comparing adjacent tick strings for equality**. If two adjacent ticks produce the same string, no transition is detected.

Our implementation returns:
- The same string for every day in a month at MONTHLY tier (`"▸ 2026-04"` for all ticks in April)
- The same string for every month in a quarter at QUARTERLY tier (`"▸ Q2 2026"`)
- The same string for every month in a year at YEARLY tier (`"▸ 2026"`)
- Strings with a `▸` prefix that break KLineChart's first-tick regex matching
- No handler for `'YYYY-MM-DD HH:mm'` (single-tick view)

See `docs/chart/date-marker-analysis.md` for full root cause analysis.

---

## 3. Implementation Plan

### Approach: `setCustomApi` + vertical line overlays

`registerXAxis` was rejected (no axis reference in callback, no data access, no timestamp conversion). Two well-supported APIs instead:

1. **`chart.setCustomApi({ formatDate })`** — smart labels that adapt to the window
2. **Vertical line overlays** at calendar boundaries — subtle visual anchors

### Required Fixes

| Fix | File | What |
|-----|------|------|
| Rewrite `formatAxisLabel` | `ChartDisplay.svelte` | Return clean strings for `'YYYY'`/`'YYYY-MM'`/`'MM-DD'` that change when year/month/day changes. Remove tier-based variations from comparison returns. Handle `'YYYY-MM-DD HH:mm'`. |
| Remove `▸` prefix | `ChartDisplay.svelte` | Strip from all `formatDate` returns. Breaks KLineChart's regex matching. Boundary overlays provide visual distinction instead. |
| Set timezone | `ChartDisplay.svelte` | Add `chart.setTimezone('UTC')` after init. Aligns KLineChart's internal DateTimeFormat with our `getUTC*()` calls. |

### Boundary line style

- Color: `rgba(0, 0, 0, 0.08)` — subtle, behind candles
- Style: `dashed` — distinguishes from drawing tools
- Only within the current window range
- Cleared and redrawn on window/resolution change

---

## 4. Label Rules (Target Specification)

Simple tiered system. The window determines the label granularity. Higher-order boundaries always show when crossed.

| Timeframe | Primary labels | Vertical lines at | Always show |
|-----------|---------------|-------------------|-------------|
| < 1W | Days | Day boundaries | Month start, year start |
| < 1M | Weeks (Mondays) | Monday | Month start, year start |
| < 6M | Months | Month 1st | Year start |
| < 2Y | Quarters | Quarter start | Year start |
| 2Y+ | Years | Year start | — |

**"Always show"** means: if a month start or year start falls within the view, it gets a label and vertical line regardless of the primary tier. A 1W view showing daily labels still says "Apr" on April 1st. A 3M view showing months still says "2026" on January 1st.

### Window → tier mapping

| Window | Tier | Label format | Example |
|--------|------|-------------|---------|
| 1d, 2d | INTRADAY | `HH:mm` | `08:00  12:00  16:00  20:00` |
| 1W, 2W | DAILY | `dd MMM` | `Mon 30  Tue 31  Wed 01` |
| 1M | WEEKLY | `dd MMM` | `03 Mar  10 Mar  17 Mar  24 Mar  31 Mar` |
| 3M, 6M | MONTHLY | `MMM` | `Jan  Feb  Mar` |
| 1Y | QUARTERLY | `QQ` or `YYYY MMM` | `Q2  Q3  Q4  Q1  Q2` |
| 2Y, 5Y, 10Y | YEARLY | `YYYY` | `2022  2023  2024  2025` |

### Boundary label examples

```
3M view spanning Dec-Mar:
  Dec | Jan | Feb | Mar
  (month labels, year label "2026" shown at Jan 1)

1W view spanning Mar 30-Apr 3:
  Mon 30  Tue 31  Wed 01  Thu 02  Fri 03
  (day labels, "Apr" shown at Apr 1 instead of "01")

1Y view spanning Q2'25-Q2'26:
  Q2  Q3  Q4  Q1  Q2
  (quarter labels, "2026" shown at Jan 1)
```

---

## 5. KLineChart formatDate API Contract

KLineChart calls `formatDate(dateTimeFormat, timestamp, format, type)` once per tick per render.

### Parameters

- `dateTimeFormat` — KLineChart's internal `Intl.DateTimeFormat` instance
- `timestamp` — the tick's Unix millisecond timestamp
- `format` — one of: `'YYYY'`, `'YYYY-MM'`, `'MM-DD'`, `'HH:mm'`, `'YYYY-MM-DD HH:mm'`
- `type` — `2` for X-axis ticks (we only override this)

### How KLineChart Uses the Return Value

**The return value serves dual purposes: comparison AND display.**

KLineChart's `_optimalTickLabel` detects transitions by comparing strings between adjacent ticks:

```
1. Call formatDate(ts, 'YYYY') for current and previous tick
   → If strings differ → year transition detected → return value becomes tick text

2. Call formatDate(ts, 'YYYY-MM') for current and previous tick
   → If strings differ → month transition detected → return value becomes tick text

3. Call formatDate(ts, 'MM-DD') for current and previous tick
   → If strings differ → day transition detected → return value becomes tick text

4. No transition → fall back to formatDate(ts, 'HH:mm') for primary display
```

**Critical implication**: The strings returned for `'YYYY'`, `'YYYY-MM'`, and `'MM-DD'` must change when year/month/day changes. If they don't (e.g., returning `"▸ 2026-04"` for every day in April), the comparison produces identical strings and transitions are never detected.

### First-Tick Formatting

KLineChart's `optimalTicks` regex-matches the third tick's text to determine the first tick's format:

- `/^[0-9]{2}-[0-9]{2}$/` expects `"04-03"` (not `"▸ 04-03"`)
- `/^[0-9]{4}-[0-9]{2}$/` expects `"2026-04"` (not `"▸ 2026-04"`)
- `/^[0-9]{4}$/` expects `"2026"` (not `"▸ 2026"`)

Any prefix characters prevent matching. The returned strings must start with the expected digit pattern.

### Implementation Constraints

- Per-tick styling is impossible — `AxisTick` only has `{ coord, value, text }`
- No font weight, color, or size variation per tick regardless of API (`formatDate`, `createTicks`, or `registerXAxis`)
- Visual distinction for major boundaries must come from text content (e.g., "2026" vs "04-03") or from the boundary overlay system (dashed vertical lines)

---

## 6. Research Sources

- **TradingView**: Weighted tick-mark system. Labels transition HH:MM → DD MMM → MMM YYYY → YYYY. Higher-order boundaries always visible.
- **cTrader**: Similar adaptive formatting. MMM YYYY for monthly, DD MMM for daily, HH:MM for intraday.
- **Bloomberg**: Compact formats. Drops year when all data is current year.
- **D3.js** (reference): Prioritized tick intervals from seconds to years. Always snaps to "nice" boundaries.
