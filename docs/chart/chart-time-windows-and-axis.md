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

## 2. Time Axis — Current State

KLineChart's default tick generation:
- Places ticks at **even data-index intervals** (every Nth bar), not calendar boundaries
- Formats labels as `HH:mm` by default, upgrades to `MM-DD` or `YYYY-MM` when adjacent ticks cross a boundary
- No concept of month starts, Mondays, or quarter boundaries

The result: a 3M chart shows ticks at `Jan 14 08:00`, `Feb 02 20:00`, `Mar 09 20:00` — arbitrary positions a trader can't read at a glance.

---

## 3. Implementation Plan

### Approach: `setCustomApi` + vertical line overlays

`registerXAxis` was rejected (no axis reference in callback, no data access, no timestamp conversion). Two well-supported APIs instead:

1. **`chart.setCustomApi({ formatDate })`** — smart labels that adapt to the window
2. **Vertical line overlays** at calendar boundaries — subtle visual anchors

### Files to modify

| File | Change |
|------|--------|
| `src/lib/chart/chartConfig.js` | Add `getCalendarBoundaryTimestamps(from, to, window)` |
| `src/components/ChartDisplay.svelte` | Add `setCustomApi({ formatDate })` after init. Add boundary line overlays after data loads. Clear/recreate on window change. |

### Boundary line style

- Color: `rgba(0, 0, 0, 0.08)` — subtle, behind candles
- Style: `dashed` — distinguishes from drawing tools
- Only within the current window range
- Cleared and redrawn on window/resolution change

---

## 4. Label Rules

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

## 5. KLineChart formatDate API

KLineChart calls `formatDate(dateTimeFormat, timestamp, format, type)` once per tick per render.

- `type === 2` (FormatDateType.XAxis) targets the axis — we only override this
- `format` is KLineChart's suggested string ('HH:mm', 'MM-DD', etc.) — we ignore it
- `timestamp` is the tick's actual timestamp — we use this to detect boundaries

Our override:
1. Get current window tier
2. Check if timestamp is on a boundary (month 1st, Monday, quarter start, year start)
3. If boundary → show the higher-order label (month name, year, quarter)
4. Otherwise → show the tier's default format

---

## 6. Research Sources

- **TradingView**: Weighted tick-mark system. Labels transition HH:MM → DD MMM → MMM YYYY → YYYY. Higher-order boundaries always visible.
- **cTrader**: Similar adaptive formatting. MMM YYYY for monthly, DD MMM for daily, HH:MM for intraday.
- **Bloomberg**: Compact formats. Drops year when all data is current year.
- **D3.js** (reference): Prioritized tick intervals from seconds to years. Always snaps to "nice" boundaries.
