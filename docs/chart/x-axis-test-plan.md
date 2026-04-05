# X-Axis Custom Test Plan

## Overview

Comprehensive test suite for `src/lib/chart/xAxisCustom.js`, the calendar-aware custom X-axis module. Tests cover all exported functions, the two-phase Anchor+Fill pipeline, label formatting, and regression tests for resolved bugs.

**Module under test:** `src/lib/chart/xAxisCustom.js`
**Test file:** `src/lib/chart/__tests__/xAxisCustom.test.js`
**Framework:** vitest

## Source Functions Tested

| Function | Exported | Purpose |
|----------|----------|---------|
| `snapToBar` | Yes | Binary search to find nearest bar timestamp to a target |
| `selectTickInterval` | Yes | Choose tick interval based on resolution and visible span |
| `formatBoundaryLabel` | Yes | Format label for calendar boundary ticks (year/quarter/month/week/day) |
| `formatBaseLabel` | Yes | Format label for regular interval ticks (sub-day, day) |
| `generateBoundaryTicks` | Yes | Generate raw boundary tick candidates |
| `generateBaseTicks` | Yes | Generate raw base tick candidates |
| `generateTicks` | Yes | Main pipeline: anchor + fill + format |
| `setAxisResolution` | Yes | Set module-level resolution state |
| `formatLabel` (internal) | No | Routes to boundary or base label formatter — tested indirectly |
| `overlapsPlaced` (internal) | No | Overlap detection — tested indirectly through pipeline |
| `calcTextWidth` (internal) | No | Text width estimation — tested indirectly through pipeline |

## Test Groups

### Group 1: selectTickInterval (5 tests)
Tests interval selection logic for various resolutions and spans.

- For each resolution, selected interval is >= the floor
- 4h resolution with 3-month span selects a reasonable interval
- 1m resolution with 1-day span selects 2HOUR or similar
- D resolution with 1-year span selects MONTH
- Very narrow span falls back to floor

### Group 2: snapToBar (9 tests)
Tests binary search edge cases for bar snapping.

- Exact match returns that timestamp
- Target before first returns first bar timestamp
- Target after last returns nearest (last) bar timestamp
- Weekend gap: Saturday target snaps to nearest bar (Friday)
- Empty list returns null
- Null dataList returns null
- Single element: exact match returns that timestamp
- Single element: non-match returns that timestamp (before)
- Single element: non-match returns that timestamp (after)

### Group 3: formatBoundaryLabel (12 tests)
Tests label formatting for all 5 boundary ranks.

- YEAR rank returns just the year
- QUARTER rank with prevTs in same year returns "Qn"
- QUARTER rank with prevTs in different year returns "Qn YYYY"
- QUARTER rank with prevTs=null returns "Qn YYYY"
- MONTH rank with prevTs in same year returns short month name
- MONTH rank with prevTs in different year returns "Mon YYYY"
- MONTH rank with prevTs=null returns "Mon YYYY"
- WEEK rank returns "DD Mon" on month transition
- WEEK rank within same month returns "DD"
- WEEK rank with year change returns "DD Mon YYYY"
- DAY rank within same month returns "DD"
- DAY rank with month change returns "DD Mon"

### Group 4: formatBaseLabel — MULTIDAY branch (6 tests)
Tests the MULTIDAY tier label formatting (the most common code path).

- Sub-day interval, cross-day tick returns "DD"
- Sub-day interval, same-day tick returns "" (suppressed)
- Sub-day interval, prevTs=null (first tick) returns "DD"
- DAY interval returns "DD"
- No time component in MULTIDAY sub-day cross-day ticks
- With lastBoundaryRank set still returns "DD"

### Group 5: formatBaseLabel — INTRADAY + boundary context (4 tests)
Tests boundary suppression logic in INTRADAY tier.

- Cross-day, prevRank=3 (MONTH) returns "DD" only
- Cross-day, lastBoundaryRank=3 (MONTH) returns "DD" only
- Cross-day, no boundary context returns "DD HH:mm"
- Same-day returns "HH:mm" only

### Group 6: formatBaseLabel — interval edge cases (3 tests)
Tests WEEK, MONTH, and DAY interval behavior.

- DAY interval returns "DD"
- WEEK interval returns empty string
- MONTH interval returns empty string

### Group 7: generateBoundaryTicks — raw candidate format (2 tests)
Tests raw candidate generation.

- Returns raw candidates with ts, snappedTs, coord, rank (no text)
- Groups multiple boundaries at same snapped timestamp by highest rank

### Group 8: generateBaseTicks — raw candidate format (2 tests)
Tests raw base candidate generation.

- Returns raw candidates with ts, snappedTs, coord, type, intervalName (no text)
- Calendar, WEEK, and DAY intervals return empty array

### Group 9: Full label sequence assertions (4 tests)
Verifies exact ordered labels through the full generateTicks pipeline.

- 4H, 2-month span: month boundary + day labels, sorted by coord
- Daily, 6-month span: quarter/month + day labels
- 1H, 2-week span (MULTIDAY): no time labels, day numbers present
- 4H, 1-day span (INTRADAY): time labels present, no day-only without time

### Group 10: End-of-month coverage (3 tests)
Tests the previously buggy end-of-month dead zone (days 20-31).

- 4H data spanning Jan 25-31: labels exist for end-of-month days
- Daily data for 31-day month: day numbers 28-31 appear
- Month boundary at 31st to next month: no dead zone gap

### Group 11: Multiple resolutions through pipeline (3 tests)
Tests 5min, 15min, and 1H resolutions through generateTicks.

- 5min, 3-day span (INTRADAY): time format labels, reasonable count
- 15min, 2-week span (MULTIDAY): day numbers, no time-only labels
- 1H, 1-month span: month boundary + day numbers

### Group 12: Tick spacing / overlap (2 tests)
Asserts minimum pixel distance between consecutive ticks.

- MULTIDAY spacing: consecutive ticks >= 30px apart
- INTRADAY spacing: consecutive ticks >= 30px apart

### Group 13: formatLabel routing / lastBoundaryRank propagation (2 tests)
Tests internal formatLabel behavior indirectly through generateTicks output.

- After MONTH boundary, next base tick is day-only
- After YEAR boundary, no year repetition in subsequent labels

### Group 14: Phase 2 context fill quality (2 tests)
Tests that context fill algorithm produces ticks around anchors.

- Ticks on both sides of MONTH anchors
- No dead zones: max gap <= 3x median gap

### Group 15: B5+B6 regression tests (5 tests)
Regression tests for previously resolved bugs.

- B5: 4H multi-month chart produces base ticks alongside boundary ticks
- B6: 4H multi-week chart has sub-day base candidates (fallback works)
- B5: WEEK/DAY boundaries do not appear as Phase 1 anchors
- B6: 1H multi-week chart has time-based ticks (DAY fallback)
- INTRADAY tier: sub-day span shows time labels

### Group 16: generateTicks pipeline basics (3 tests)
Tests pipeline-level behavior.

- Suppresses overlapping boundary ticks: higher rank wins
- Context fill adds ticks around MONTH boundaries
- Returns ticks with text, coord, value in coord-sorted order

## Coverage Matrix

| Source Function | Test Groups |
|-----------------|-------------|
| `snapToBar` | 2 |
| `selectTickInterval` | 1 |
| `formatBoundaryLabel` | 3 |
| `formatBaseLabel` | 4, 5, 6 |
| `generateBoundaryTicks` | 7, 9-16 (via pipeline) |
| `generateBaseTicks` | 8, 9-16 (via pipeline) |
| `generateTicks` | 9-16 |
| `setAxisResolution` | 9-16 (setup) |
| `formatLabel` (internal) | 13, 9-16 (via pipeline) |
| `overlapsPlaced` (internal) | 12, 16 (via pipeline) |
| `calcTextWidth` (internal) | 12, 16 (via pipeline) |

## Test Helpers

| Helper | Bars Generated | Purpose |
|--------|---------------|---------|
| `generate4HBars(startMs, count)` | 4H at 08:00/20:00 UTC, skip weekends | Standard 4H test data |
| `generate1HBars(startMs, count)` | 1H at :00 UTC, Mon-Fri only | 1H resolution tests |
| `generate1mBars(startMs, count)` | 1-min, forex hours (Sun 22-Fri 22) | 1-minute resolution tests |
| `generateDailyBars(startMs, count)` | Daily at 00:00 UTC, Mon-Fri only | Daily resolution tests |
| `generate5mBars(startMs, count)` | 5-min, forex hours | 5-minute resolution tests |
| `generate15mBars(startMs, count)` | 15-min, forex hours | 15-minute resolution tests |
| `mockChart(dataList, pxPerBar)` | N/A | Mock chart with linear pixel mapping |

## Limitations

1. **Canvas text measurement**: `calcTextWidth` uses `document.createElement('canvas')` which requires a DOM environment. In vitest/jsdom, the canvas API returns fallback values. Tests that depend on exact pixel spacing may vary across environments.

2. **Timezone dependence**: All timestamps use `Date.UTC()` to avoid timezone issues. However, `new Date()` constructors in the source code could be affected if the test runner's default timezone differs from UTC. The test environment should run with `TZ=UTC`.

3. **KLineChart registration**: The module calls `registerXAxis()` at import time. Tests that import the module will trigger this registration. Since we test individual functions directly (not through KLineChart's `createTicks` callback), this has no effect on test correctness.

4. **Module-level state**: `setAxisResolution` and `setAxisChart` mutate module-level variables. Pipeline tests must call `setAxisResolution` before `generateTicks` to ensure correct state. Tests should be careful about ordering if run in parallel.

5. **No snapshot tests**: The pipeline produces layout-dependent output (pixel coordinates). Snapshot tests would be fragile across environments, so we assert structural properties (label formats, ordering, spacing) instead.

## Total Test Count

| Group | Tests |
|-------|-------|
| 1. selectTickInterval | 5 |
| 2. snapToBar | 9 |
| 3. formatBoundaryLabel | 12 |
| 4. formatBaseLabel MULTIDAY | 6 |
| 5. formatBaseLabel INTRADAY | 4 |
| 6. formatBaseLabel edge cases | 3 |
| 7. generateBoundaryTicks | 2 |
| 8. generateBaseTicks | 2 |
| 9. Full label sequences | 4 |
| 10. End-of-month coverage | 3 |
| 11. Multiple resolutions | 3 |
| 12. Tick spacing | 2 |
| 13. formatLabel routing | 2 |
| 14. Context fill quality | 2 |
| 15. B5+B6 regression | 5 |
| 16. Pipeline basics | 3 |
| **Total** | **67** |
