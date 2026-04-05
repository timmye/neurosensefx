# X-Axis Hardcoded Transition Matrix

## Problem

The current x-axis (`xAxisCustom.js`) uses dynamic span classification (`classifySpan()`) to determine tick behavior. This has been through 3 rewrites and still carries complexity from adaptive heuristics (MIN_FLOOR dedup, adaptive fill steps, overlap suppression). The tests never caught real issues because they only verify vague properties ("at least N month labels") rather than exact expected behavior.

## Solution

Replace dynamic classification with a **hardcoded transition matrix** keyed on the time window string. Each window defines which calendar levels to show. Higher-order transitions (Year, Quarter, Month) **always fire** when their boundary falls within the visible range, regardless of window. The window only controls the **finest granularity** (fill level).

## Design Decisions (from review)

- **Module state, not parameter**: `_window` stored at module level like `_resolution`. `setAxisWindow(window)` called from `ChartDisplay.svelte`. `generateTicks()` signature unchanged: `(fromTs, toTs, dataList, chart)`.
- **No boundary/fill distinction**: All ticks are boundary ticks at their respective level. The finest level in the matrix naturally produces the most ticks (acts as fill). `formatBaseLabel()` eliminated — `formatBoundaryLabel()` handles all ranks including HOUR.
- **Coincidence dedup by snapped timestamp**: When two boundaries snap to the same bar, keep the highest-rank label. This is identity-based (same bar), not proximity-based (within N pixels).
- **MIN_FLOOR for label collision only**: After dedup, walk the sorted tick list and suppress the `text` of any tick within 30px of the previous emitted tick. The tick itself (coord/value) is still returned so KLineChart renders the tick mark.
- **Scroll behavior**: Window string does not change on scroll. This is intentional — user chose the window, they expect window-level labels. The current adaptive behavior caused the problems we're fixing.
- **Resolution awareness**: Not needed. If `D` resolution is viewed at `1d` window (non-default combo), hour boundaries simply produce no ticks because there are no intraday bars to snap to.
- **`formatAxisLabel` in ChartDisplay.svelte**: Unchanged. It handles KLineChart's crosshair/tooltip display via `formatDate` override — a separate rendering path from the custom `registerXAxis`.

## Transition Resolution Matrix

```javascript
const TRANSITION_MATRIX = {
  '1d':  ['YEAR', 'QUARTER', 'MONTH', 'DAY', 'HOUR'],
  '2d':  ['YEAR', 'QUARTER', 'MONTH', 'DAY', 'HOUR'],
  '1W':  ['YEAR', 'QUARTER', 'MONTH', 'WEEK', 'DAY'],
  '2W':  ['YEAR', 'QUARTER', 'MONTH', 'WEEK', 'DAY'],
  '1M':  ['YEAR', 'QUARTER', 'MONTH', 'WEEK', 'DAY'],
  '3M':  ['YEAR', 'QUARTER', 'MONTH', 'WEEK'],
  '6M':  ['YEAR', 'QUARTER', 'MONTH', 'WEEK'],
  '1Y':  ['YEAR', 'QUARTER', 'MONTH'],
  '2Y':  ['YEAR', 'QUARTER', 'MONTH'],
  '5Y':  ['YEAR', 'QUARTER'],
  '10Y': ['YEAR', 'QUARTER'],
};
```

Last entry = finest level (most ticks). Higher-order transitions always fire when in range.

**Key rule**: Higher-order transitions are inclusive. A `1d` window spanning Dec 31 → Jan 1 shows the YEAR boundary. A `1W` window spanning Mar 28 → Apr 4 shows both MONTH and WEEK boundaries.

**Coincidence rule**: When boundaries coincide (Jan 1 = YEAR + QUARTER + MONTH), the highest-rank label wins. Dedup is by snapped timestamp equality, not pixel proximity.

## Data Flow Change

```
BEFORE: visibleSpan → classifySpan() → STRATEGY[tier] → generateTicks()
AFTER:  _window (module state) → TRANSITION_MATRIX[_window] → generateTicks()
```

## Algorithm

`generateTicks(fromTs, toTs, dataList, chart)`:

1. Look up `TRANSITION_MATRIX[_window]` to get ordered list of levels
2. For each level (coarse to fine):
   a. Walk calendar boundaries of that type within `[fromTs, toTs]`
   b. Snap each boundary to nearest bar via `snapToBar()`
   c. Record `{ ts, snappedTs, coord, rank }` candidate
3. Sort candidates by coord, deduplicate coincident boundaries by snapped timestamp (keep highest rank)
4. Format labels using `formatBoundaryLabel()` with context from previous emitted tick
5. Walk formatted ticks, suppress `text` of any tick within MIN_FLOOR (30px) of previous emitted tick. Keep coord/value so tick mark renders.

### Label Formatting (formatBoundaryLabel)

| Rank | Format rule |
|------|------------|
| YEAR (1) | Always: `"YYYY"` |
| QUARTER (2) | `"Qn"` if same year as prev; `"Qn YYYY"` if year changed |
| MONTH (3) | `"Mon"` if same year as prev; `"Mon YYYY"` if year changed |
| WEEK (4) | `"DD Mon"` if month/year changed; `"DD"` within same month |
| DAY (5) | `"DD Mon"` if month changed; `"DD"` within same month |
| HOUR (6) | `"HH:MM"` if same day; `"DD HH:MM"` if day changed |

Context is tracked relative to the previous **emitted** tick (not previous boundary of same rank).

## Files Changed

### Modified

1. **`src/lib/chart/chartConfig.js`** — Add `TRANSITION_MATRIX` constant. Add `nextHour` to boundary step functions (or define inline in xAxisCustom).

2. **`src/lib/chart/xAxisCustom.js`** — Major rewrite (~476 → ~200 lines):
   - Add `setAxisWindow(window)` module state setter, `let _window = '3M'`
   - Add `RANK.HOUR = 6`
   - Add `HOUR` to `BOUNDARY_STEP`, `alignToBoundary`, `formatBoundaryLabel`
   - Remove: `classifySpan()`, `STRATEGY`, `getFillMs()`, `formatBaseLabel()`, adaptive fill logic
   - Rewrite `generateTicks()`: matrix lookup → walk levels → snap → dedup → format → MIN_FLOOR label suppression
   - Keep: `snapToBar()`, `barCoord()`, `_binarySearch()`, `dataIndexOf()`, `pad2()`, calendar boundary generators for YEAR/QUARTER/MONTH/WEEK/DAY
   - Keep: `registerXAxis` block (update `generateTicks` call to use `_window`)

3. **`src/components/ChartDisplay.svelte`** — Add `setAxisWindow(currentWindow)` in:
   - `onMount` (after `setAxisResolution(currentResolution)`)
   - `handleWindowChange` (currently has NO axis update — this is the integration point most likely to be missed)
   - `handleResolutionChange` (already calls `setAxisResolution`, add `setAxisWindow` since resolution change may change default window)

4. **`src/lib/chart/__tests__/xAxisCustom.test.js`** — Full rewrite. See test plan.

### Deleted

5. **`src/lib/chart/__tests__/xAxisCustom.diagnostic.test.js`** — Remove. Was temporary.

## Test Plan

The existing tests are insufficient — they check vague properties ("at least 1 month label") and never caught real bugs. New tests use **exact expected tick sequences** for deterministic scenarios.

### Test helpers (kept from current)

`generate4HBars`, `generateDailyBars`, `generate5mBars`, `generate15mBars`, `generate1HBars`, `mockChart`.

### Test structure

For each window in the matrix, test with a known bar dataset and verify the **exact ordered sequence** of tick labels. This catches:
- Missing transitions (boundary in range but no tick)
- Wrong label format ("Jan" instead of "Jan 2026" on year change)
- Duplicate ticks at coincident boundaries
- Wrong ordering

### Key test scenarios

1. **Coincident boundaries**: Jan 1 (YEAR + QUARTER + MONTH) — one tick, YEAR label wins
2. **Higher-order at small window**: `1d` window spanning Dec 31 → Jan 1 — YEAR marker appears
3. **`1Y` window with daily bars**: 2025-01-06 to 2026-01-06 — "2026" at Jan 1, "Q1"/"Q2"/"Q3"/"Q4" at quarter starts, month abbreviations
4. **`3M` window with daily bars**: Oct-Dec 2025 — "Q4 2025" at Oct 1, "Nov", "Dec", week-start day labels as fill
5. **`1M` window with daily bars**: Mar 2026 — "Mar 2026" at Mar 1, day-number labels as fill
6. **`1W` window with 4H bars**: One week — day-of-month labels
7. **`1d` window with 4H bars**: One day — "HH:MM" labels at 08:00, 12:00, 16:00, 20:00
8. **MIN_FLOOR collision**: Dense bars where two boundaries fall within 30px — second text suppressed
9. **Edge cases**: Empty data, single bar, all bars in same month, window with no boundary crossings
10. **Label context tracking**: After "Jan 2026", next month is "Feb". After "Dec 2026", next month is "Jan 2027"
11. **`setAxisWindow` integration**: Verify `setAxisWindow()` correctly updates `_window` module state
12. **`2W` and `1M` windows**: Day-level fill produces correct day-number sequences

### Tests removed

All tests for `formatBaseLabel()` (function is deleted). All tests that use vague assertions ("at least N labels").

## Out of Scope

- Visual styling of transition markers (dashed lines, bold text) — separate concern
- KLineChart's built-in `formatDate` override in `ChartDisplay.svelte` — unchanged (handles crosshair/tooltip only, separate rendering path)
- `WINDOW_TIER` / `getWindowTier()` in `chartConfig.js` — still used by `formatAxisLabel` for crosshair. Can be unified with TRANSITION_MATRIX later.
- Drawing tools, indicators — unchanged
