# X-Axis Transition Tick Position Bug

**Status:** Implemented — two-phase Anchor + Fill algorithm replaces generate-then-suppress pipeline
**Date:** 2026-04-04
**Updated:** 2026-04-04 (implementation complete; bugs B1-B4 resolved)
**Related:** `src/lib/chart/xAxisCustom.js`, commit `c7063f6` (custom calendar x-axis)
**KLineChart reference:** `docs/klinecharts/` (pulled from commit `0368f9d`)

## Timeline

1. **Original bug:** KLineChart default axis had transition offset issues. Custom axis built to fix.
2. **Axis not activated:** `chart.setStyles({ xAxis: { name: 'calendar' } })` was a no-op. Fixed with `setPaneOptions`. H1–H3 applied as preemptive fixes.
3. **Recovery pass added:** After activation, the tick before each boundary was always suppressed. A third pass was added to `applySuppression` to recover the closest suppressed tick before each boundary.
4. **Recovery introduced new bugs:** Recovery applied to ALL kept boundary ticks (including DAY rank), creating double-tick pairs everywhere. After-boundary ticks remained missing. WEEK labels showed month names at non-transition positions.
5. **Architectural diagnosis:** The three-pass generate→suppress→recover pipeline cannot be patched incrementally. Requires redesign as a single-pass greedy sweep.

---

## Original Observations (Resolved)

1. **4H chart, year transition shows at Jan 6** — fixed by activating the custom axis (see Root Cause below).
2. **4H chart, Feb label shows on the 8th** — fixed by activating the custom axis.
3. **1min chart, hour transition is 3 hours late** — fixed by activating the custom axis.

---

## Root Cause (Original — Fixed)

`chart.setStyles({ xAxis: { name: 'calendar' } })` in `ChartDisplay.svelte` was a **no-op** —
KLineChart's `XAxisStyle` has no `name` field. The custom axis was registered via `registerXAxis`
but never activated at runtime. All visible labels came from KLineChart's default axis via
`formatAxisLabel` (`setCustomApi`). None of the H1/H2/H3 code paths ever executed.

**The fix:** Changed to:
```javascript
chart.setPaneOptions({ id: 'x_axis_pane', axisOptions: { name: 'calendar' } })
```

---

## Preemptive Fixes (Applied — Still Valid)

These were identified through static code analysis. They are real bugs in the custom axis logic
that were never reached at runtime before activation. Fixes are correct and should be preserved
in any redesign.

### H1: Boundary tick suppression ignores rank priority

**File:** `src/lib/chart/xAxisCustom.js:461`

`applySuppression()` sorts boundary ticks by rank ascending before the suppression loop, so
YEAR/QUARTER/MONTH are always kept over WEEK/DAY when they overlap:

```javascript
const sortedBoundary = [...boundaryTicks].sort((a, b) => a.rank - b.rank || a.coord - b.coord);
```

### H2: `formatBoundaryLabel` uses original boundary timestamp

**File:** `src/lib/chart/xAxisCustom.js:343`

Passes `best.ts` (original calendar boundary) instead of `snappedTs` (nearest bar timestamp) to
the label formatter. Ensures "2025" label at a year boundary even when snapped to a bar at 08:00.

```javascript
const text = formatBoundaryLabel(best.ts, best.rank, prevTs);
```

### H3: `snapToBar` snaps to nearest bar (bidirectional)

**File:** `src/lib/chart/xAxisCustom.js:82-106`

Returns the bar with smallest absolute time difference from the target, handling broker server
time offsets and weekend gaps.

---

## Current Bugs (Post-Recovery-Pass) — All Resolved

### ~~B1: Two ticks before every transition, none after~~ (Retired — was already fixed)

### ~~B2: Month names at non-transition positions~~ (Fixed)

**Resolution:** The two-phase Anchor + Fill algorithm eliminates this. WEEK ticks are placed in Phase 1
only if they don't overlap higher-rank anchors. Phase 2 context fill only targets MONTH+ boundaries.
WEEK ticks mid-month no longer appear at non-boundary positions. `formatBoundaryLabel` WEEK case
still shows `"DD"` when same month as previous visible tick (label pass uses actual predecessor).

### ~~B3: Consecutive gaps between transitions~~ (Fixed)

**Resolution:** Phase 1 places boundary anchors by rank priority with overlap rejection — no more
uniform DAY-tick gaps. Phase 2 explicitly fills context around MONTH+ anchors. Phase 3 gap-fills
remaining base candidates. Ticks near meaningful boundaries are always preferred over mid-gap positions.

### ~~B4: Quarter boundary test was never correct~~ (Fixed)

**Resolution:** Test rewritten to check for QUARTER-rank candidate at Apr 1 instead of searching for
`"Apr"` text in formatted output. The test now verifies the raw candidate structure directly.

---

## Architectural Diagnosis — Resolved

The three-pass pipeline (generate→suppress→recover) had three fundamental flaws that could not be
patched incrementally:

### F1: Generate-then-suppress has no global context

The pipeline generates ALL candidates for ALL ranks independently, then suppresses overlaps.
The suppression pass does not know *why* a tick exists — only its position and rank. It cannot
distinguish "this DAY tick is the last one before a month boundary" (must keep) from "this DAY
tick is in the middle of a uniform region" (can drop). The recovery pass is an admission that
suppression makes locally-correct but globally-wrong decisions.

### F2: Separate prevTs chains produce wrong label context

Boundary ticks and base ticks maintain independent `prevTs` tracking during generation. But the
user sees a MERGED sequence. When a boundary tick is suppressed, the base tick's label was
formatted against the previous *base* tick — not the visible predecessor. A base tick at "01 08:00"
after a suppressed month boundary shows no month context.

### F3: Base ticks carry no rank

Base ticks are created as `{ text, coord, value }` with no `rank` field. This means:
- `applySuppression` cannot compare a base tick's semantic importance against a boundary tick.
- The recovery pass uses `candidate.rank !== undefined` to decide which bucket to place recovered
  ticks — a structural distinction, not a semantic one.

### RANK Usage Audit

| Location | Purpose | Consistent? |
|----------|---------|-------------|
| `generateBoundaryTicks` line 268-316 | Assigns rank to each boundary type | Yes |
| `generateBoundaryTicks` line 335 | Picks highest rank when multiple snap to same bar | Yes |
| `applySuppression` line 461 | Sort order for boundary-vs-boundary suppression | Yes |
| `applySuppression` line 525 | Recovery eligibility (rank ≤ MONTH only) | Yes |
| `formatBoundaryLabel` line 172-208 | Label format dispatch | Yes |
| `generateBaseTicks` line 370 | **No rank assigned to base ticks** | **No** |
| `formatBaseLabel` line 214-238 | Uses `intervalName` instead of rank | **Inconsistent** |
| ~~`detectBoundaryRanks`~~ line 147-166 | ~~Returns rank array for a timestamp~~ | **Removed** — was unused dead code |

---

## Proposed Fix: Two-Phase Anchor + Fill

Replace `generateBoundaryTicks` + `generateBaseTicks` + `applySuppression` with a two-phase
algorithm. Phase 1 places boundary ticks (anchors) with rank-priority suppression. Phase 2 fills
gaps with base ticks, adding explicit context ticks around each placed MONTH+ anchor.

Based on analysis of D3.js, ECharts, TradingView Lightweight Charts, Plotly, and Highcharts axis
implementations, plus evaluation of five alternative architectures (greedy sweep, weighted
scheduling, DP, hierarchical, CSP). See appendix below.

### Algorithm

```
1. COMPUTE base interval from resolution + visible span (existing selectTickInterval)

2. ENUMERATE candidates:
   - Boundary candidates: existing generateBoundaryTicks logic, but defer formatting
     Produces [{ ts, snappedTs, coord, rank }] for YEAR/QUARTER/MONTH/WEEK/DAY
   - Base candidates: existing generateBaseTicks logic, but defer formatting
     Produces [{ ts, snappedTs, coord, type: 'base', intervalName }]
   - Compute adaptive transitionRadius:
     transitionRadius = 2 * minSpacing  (where minSpacing = 2 * MIN_FLOOR + 2 * PADDING)

3. PHASE 1 — Anchor placement (boundary ticks only):
   Sort boundary candidates by rank ascending (YEAR first), then coord ascending.
   placed = []
   for each candidate in sorted boundary candidates:
     if !overlapsPlaced(candidate, placed):
       placed.push(candidate)

4. PHASE 2 — Context fill:
   For each placed anchor with rank <= RANK.MONTH:
     a. Scan backward through UNPLACED candidates (base + DAY) for nearest within transitionRadius
     b. Scan forward through UNPLACED candidates for nearest within transitionRadius
     c. Place each found candidate if !overlapsPlaced(candidate, placed)

5. PHASE 3 — Gap fill:
   Sort remaining unplaced base candidates by coord ascending.
   for each candidate in remaining base candidates:
     if !overlapsPlaced(candidate, placed):
       placed.push(candidate)

6. FORMAT labels in a final pass:
   Sort placed by coord ascending.
   prev = null
   for each tick in placed:
     tick.text = formatLabel(tick, prev)   // prev is full tick object, not just timestamp
     prev = tick

7. RETURN placed ticks sorted by coord.
```

### Why This Works

- **No suppression pass needed.** Phase 1 places anchors with intrinsic spacing — rejects on
  overlap. No separate suppression, no recovery paradox.
- **Transition context is explicit.** Phase 2 scans around each MONTH+ anchor and places the
  nearest non-overlapping candidate on each side. No rank boosting, no fractional ranks.
- **No label-context bug.** Labels formatted after all placement decisions (step 6), using the
  actual visible predecessor tick object — not a chain that breaks when ticks are suppressed.
- **Base ticks don't need rank.** Base ticks are never compared by rank. They are placed only
  by position (context fill in phase 2, then gap fill in phase 3). No fractional rank coupling.
- **Simpler code.** Current ~594 lines → estimated ~300-350 lines. Three functions deleted
  (`applySuppression`, `tryEmitBaseTick`, `detectBoundaryRanks`), two refactored, one new.

### Critical Risks and Mitigations

**R1: `transitionRadius` tuning surface**

Risk: Hardcoding transitionRadius breaks across resolutions, chart widths, and zoom levels.

Mitigation: Make it adaptive — derive from the same minimum spacing used for overlap detection:
```js
const minSpacing = 2 * MIN_FLOOR + 2 * PADDING;  // 76px
const transitionRadius = 2 * minSpacing;            // 152px
```
This ensures context recovery scales with the visual density of the chart. If MIN_FLOOR or
PADDING change, transitionRadius updates automatically.

**R2: "Contextual rank boosting" (rejected approach)**

Risk: The initial proposal used fractional ranks (e.g., 3.5) to boost base ticks near boundaries.
Fractional ranks break sort stability, introduce floating-point comparison bugs, and create hidden
coupling between phases.

Mitigation: Dropped entirely. The two-phase approach handles transition context without rank
manipulation. Phase 2 explicitly scans for context candidates by position, not rank. No fractional
values, no sort coupling, no floating-point concerns.

**R3: Gap-fill overlap violations (AC1 risk)**

Risk: Context fill (phase 2) or gap fill (phase 3) might place a tick too close to an existing
anchor or another filler.

Mitigation: Both phases use the same `overlapsPlaced` check with early exit:
```js
function overlapsPlaced(candidate, placed) {
  const halfW = halfWidth(candidate.text) + PADDING;
  for (const p of placed) {
    const pHalfW = halfWidth(p.text) + PADDING;
    if (Math.abs(candidate.coord - p.coord) < halfW + pHalfW) return true;
  }
  return false;
}
```
Since `placed` grows monotonically and never shrinks, once a candidate is placed it cannot
overlap with any future candidate. Early exit on first overlap keeps the inner loop fast.

**R4: Deferred formatting contract (AC5 risk)**

Risk: `formatLabel(current, prev)` receives mixed types (boundary vs base), breaking legacy
`prevTs` assumptions in `formatBaseLabel`.

Mitigation: Pass the full placed tick object as `prev`, not just a timestamp. The unified
`formatLabel` inspects `prev.rank` to decide context:
```js
function formatLabel(tick, prev) {
  if (tick.rank !== undefined) {
    // Boundary tick — delegate to existing formatBoundaryLabel
    return formatBoundaryLabel(tick.ts, tick.rank, prev?.ts ?? null);
  }
  // Base tick — delegate to existing formatBaseLabel, with prevTs from prev tick
  return formatBaseLabel(tick.ts, tick.intervalName, prev?.ts ?? null);
}
```
`formatBoundaryLabel` and `formatBaseLabel` remain unchanged — they already accept `(ts, rank/name, prevTs)`.
The unified wrapper just routes correctly based on tick type. Tests for both formatters pass unchanged.

### Functions to Keep Unchanged

| Function | Reason |
|----------|--------|
| `selectTickInterval` | Correctly maps resolution+span to interval |
| `snapToBar` | Already bidirectional nearest-bar |
| `calcTextWidth` | Canvas measurement, no logic changes |
| `formatBoundaryLabel` | Pure label formatter — unchanged, called by unified `formatLabel` wrapper |
| `formatBaseLabel` | Pure label formatter — unchanged, called by unified `formatLabel` wrapper |
| `setAxisChart` / `setAxisResolution` | Module state, unchanged |
| `registerXAxis` block | Updated to call new `generateTicks` instead of old pipeline |

### Functions to Remove

| Function | Reason |
|----------|--------|
| `detectBoundaryRanks` | Unused in the pipeline (exported but never called). Dead code. |
| `tryEmitBaseTick` | Merged into candidate enumeration in phase 2/3 |
| `applySuppression` | Replaced by two-phase anchor + fill algorithm |

### Functions to Refactor

| Old | New |
|-----|-----|
| `generateBoundaryTicks` | Return raw candidates `{ ts, snappedTs, coord, rank }` without formatting |
| `generateBaseTicks` | Return raw candidates `{ ts, snappedTs, coord, type: 'base', intervalName }` without formatting |

### Functions to Add

| Function | Purpose |
|----------|---------|
| `generateTicks` | Main entry: orchestrates phases 1–3, calls formatLabel, returns final tick array |
| `formatLabel(tick, prev)` | Unified router: dispatches to `formatBoundaryLabel` or `formatBaseLabel` based on tick type |
| `overlapsPlaced(candidate, placed)` | Overlap check against all placed ticks, used by all three phases |

---

## Architecture Evaluation (Appendix)

### Approaches Evaluated

| # | Approach | Correctness | Transition Context | Impl Risk | Verdict |
|---|----------|-------------|-------------------|-----------|---------|
| 1 | **Two-Phase Anchor + Fill** | HIGH | Explicit (phase 2) | LOW | **Selected** |
| 2 | Weighted Interval Scheduling | HIGH | Weight bonus | MEDIUM | Runner-up |
| 3 | Dynamic Programming (globally optimal) | HIGHEST | Score function | MEDIUM-HIGH | Overkill |
| 4 | Hierarchical / Level-Based | HIGH | Needs augmentation | LOW-MEDIUM | Consider for multi-row |
| 5 | Constraint Satisfaction (CSP) | HIGHEST | Explicit constraint | HIGH | Overkill |
| 6 | Single Greedy Sweep (original proposal) | MEDIUM | None (C1) | LOW | Rejected — no recovery |

### Industry Reference

| Library | Algorithm | Transition Context | Label Dedup |
|---------|-----------|-------------------|-------------|
| D3.js | Bisect into interval cascade | None | Format cascade shows only changed unit |
| ECharts | Multi-level hierarchy (coarse→fine) | Natural via hierarchy | Context-aware dictionary |
| TradingView Lightweight Charts | Weight-based greedy suppression | None | Fixed format per weight type |
| Plotly | Nice-interval rounding + sweep | "Period" mode shifts label | Fixed format string |
| Highcharts | Unit cascade + `higherRanks` map | Marks midnight within hourly | `closestPointRange` + override |

ECharts' multi-level hierarchy is the closest industry analog to the anchor+fill approach.
The current NeuroSenseFX "transition tick recovery" logic (Pass 3 in `applySuppression`) is
novel — no major library uses post-hoc recovery. The anchor+fill approach replaces it with
explicit context placement (phase 2), which is architecturally cleaner.

---

## Implementation Notes (2026-04-04)

Implemented as described in the "Proposed Fix: Two-Phase Anchor + Fill" section above.

**Changes to `xAxisCustom.js`:**
- `generateBoundaryTicks` — returns raw candidates `{ ts, snappedTs, coord, rank }` (no formatting)
- `generateBaseTicks` — returns raw candidates `{ ts, snappedTs, coord, type: 'base', intervalName }` (no formatting)
- `generateTicks(fromTs, toTs, dataList, chart, tickTextStyles)` — new main entry: Phase 1 anchor, Phase 2 context fill, Phase 3 gap fill, then label formatting
- `formatLabel(tick, prev)` — unified router dispatching to `formatBoundaryLabel`/`formatBaseLabel`
- `overlapsPlaced(candidate, placed, halfWidthFn)` — internal overlap check
- Removed: `detectBoundaryRanks`, `tryEmitBaseTick`, `applySuppression`
- `registerXAxis` `createTicks` now calls `generateTicks` directly

**Changes to `xAxisCustom.test.js`:**
- Removed `detectBoundaryRanks` and `applySuppression` imports and test suites
- Added `generateTicks` and `setAxisResolution` imports
- Updated integration tests for raw candidate format and new pipeline
- Fixed B4: quarter boundary test checks QUARTER-rank candidate directly
- 48 tests passing

---

## Acceptance Criteria

| # | Criterion | Testable |
|---|-----------|----------|
| AC1 | No two visible ticks have overlapping labels | Measure output tick positions vs text widths |
| AC2 | Every MONTH/QUARTER/YEAR boundary has a visible tick | Assert presence for known boundaries |
| AC3 | Tick immediately before and after each MONTH+ boundary is at most 2× normal spacing | Measure max gap, assert ≤ 2 × median gap |
| AC4 | No double-tick pairs (two ticks before transition, none after) | Assert symmetric gaps around boundaries |
| AC5 | Label context uses actual visible predecessor: tick after year shows "Mon YYYY" | Assert label format across Jan 1 |
| AC6 | WEEK ticks mid-month show "DD" not "DD Mon" | Assert label format |
| AC7 | Total tick count within TARGET_MIN..TARGET_MAX range | Assert count for typical charts |
| AC8 | `selectTickInterval`, `snapToBar`, `formatBoundaryLabel`, `formatBaseLabel` tests pass unchanged | Run existing unit tests |

---

## KLineChart Version Notes

**Current:** `^9.8.12` (v9 line)
**Latest stable:** 9.x (same line)
**Beta:** `10.0.0-beta1` (2025-11-21) — **axis module rewritten**

v10 changelog highlights (see `docs/klinecharts/guide/changelog.md`):
- Axis module rewritten; custom y-axis supports setting the range
- `setCustomApi` → `setFormatter`, `options.customApi` → `options.formatter`
- `formatDate` parameter changed from positional to single object
- Removed: `applyNewData`, `updateData`, `setLoadMoreData` → `setDataLoader`
- Removed: `setPriceVolumePrecision` → `setSymbol`

Migration to v10 is a separate task. The current fixes target v9.x only.
