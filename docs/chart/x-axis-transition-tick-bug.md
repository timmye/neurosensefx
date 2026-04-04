# X-Axis Transition Tick Position Bug

**Status:** Anchor+fill algorithm retired — matrix-based rewrite in progress
**Date:** 2026-04-04
**Updated:** 2026-04-04 (architectural decision: replace anchor+fill with span-tier matrix)
**Related:** `src/lib/chart/xAxisCustom.js`, `src/lib/chart/chartConfig.js`
**KLineChart reference:** `docs/klinecharts/` (pulled from commit `0368f9d`)

## Architectural Decision: Retire Anchor+Fill, Replace with Matrix-Based Approach

**Date:** 2026-04-04
**Trigger:** Post-implementation quality audit revealed structural flaw in overlap suppression

### Why Anchor+Fill Failed

The two-phase anchor+fill algorithm (implemented in commit `1a3554f`, refined through B5–B15)
resolved the original pipeline bugs but introduced a new class of failures. 13 of 15 documented
bugs (B1–B15) were caused by the overlap suppression machinery. The root causes are structural:

1. **Circular dependency between placement and formatting.** Overlap detection needs label width,
   but actual label format depends on which ticks were placed. The code compensates with fake
   estimate strings (`"AAA"`, `"Q0"`, `"00"`) that must be manually kept in sync with formatters.
   B15 was exactly this divergence — WEEK/DAY estimates used `"00 AAA"` (42px) but real labels
   were `"00"` (14px), creating 28px dead zones per WEEK boundary.

2. **Generate-then-reject wastes 80-90% of work.** For a 6-month 4H chart, the algorithm generates
   boundary + base candidates, then three phases of rejection discard most of them. The suppression
   is where all the bugs live.

3. **Too few degrees of freedom to justify constraint satisfaction.** The domain has only 6 span
   tiers, 10 distinct label formats, and a fixed calendar hierarchy (YEAR > QUARTER > MONTH > fill).
   A lookup table eliminates the entire class of suppression bugs by construction.

### Evidence from Debug Output

| Scenario | Ticks | Problem |
|----------|-------|---------|
| 1H / 2 days (INTRADAY) | 1 | Shows `"06 Jan"` instead of `08:00`, `12:00` — useless |
| Daily / 3 months | 5 | Dead zones between month/quarter boundaries — no fill ticks |
| 4H / 1 week | 3 | Bare day numbers, no time info — extremely sparse |
| 4H / borderline day | 2 | Bare day numbers — confusing for near-intraday view |
| 4H / 2 months | 17 | Clean (only works by luck — suppression doesn't destroy candidates) |
| 4H / 6 months | 28 | Clean (same — luck) |

### Matrix Approach

Replace the 638-line algorithmic implementation with a ~150-line single-pass sweep using a
6-row lookup table. No overlap suppression, no estimated label widths, no candidate rejection.

**Span tier classification** (from visible time range):

| Tier | Threshold | Label Policy |
|------|-----------|-------------|
| INTRADAY | ≤ 2 days | Show times (`HH:mm`), cross-day as `DD HH:mm` |
| DAILY | ≤ 2 weeks | Show day numbers, month boundaries |
| WEEKLY | ≤ 2 months | Show day numbers, month boundaries |
| MONTHLY | ≤ 6 months | Show day numbers, month + quarter boundaries |
| QUARTERLY | ≤ 1 year | Show day numbers, month + quarter boundaries |
| YEARLY | > 1 year | Show month names, quarter + year boundaries |

**Tick strategy matrix** (determines what to place, not what to suppress):

| Tier | Boundaries | Fill Interval | Fill Step | Fill Label | Boundary Labels |
|------|-----------|---------------|-----------|------------|-----------------|
| INTRADAY | DAY | resolution floor | 1 | `HH:mm` | `DD`, `DD Mon`, `DD Mon YYYY` |
| DAILY | MONTH | 12HOUR | 1 | `DD` | `Mon`, `Mon YYYY` |
| WEEKLY | MONTH | DAY | 1 | `DD` | `Mon`, `Mon YYYY` |
| MONTHLY | MONTH + QUARTER | 12HOUR | 2 | `DD` | `Mon`, `Qn`, `Mon YYYY` |
| QUARTERLY | MONTH + QUARTER | DAY | 3 | `DD` | `Mon`, `Qn`, `Qn YYYY` |
| YEARLY | YEAR + QUARTER | MONTH | 1 | `Mon` | `YYYY`, `Qn`, `Qn YYYY` |

**10 distinct label formats** (determined by what changed since previous tick + span tier):

| Format | When | Example |
|--------|------|---------|
| `YYYY` | Year boundary | `2026` |
| `Qn YYYY` | Quarter, first or year change | `Q1 2026` |
| `Qn` | Quarter, same year | `Q2` |
| `Mon YYYY` | Month, first or year change | `Apr 2026` |
| `Mon` | Month, same year | `Apr` |
| `DD Mon YYYY` | Day/week crossing year | `04 Jan 2026` |
| `DD Mon` | Day/week crossing month | `14 Apr` |
| `DD` | Day within month | `14` |
| `HH:mm` | Time within day (INTRADAY) | `08:00` |
| `DD HH:mm` | First cross-day tick, no preceding boundary (INTRADAY) | `02 20:00` |

**Algorithm (single left-to-right sweep):**
1. Classify span tier from visible time range
2. Walk left-to-right, placing boundary ticks at calendar boundaries
3. Between boundaries, place fill ticks at the matrix-specified interval
4. Skip any tick that would be closer than MIN_FLOOR px to the previous tick
5. Format all ticks in a final pass using the 10-format table

**What gets deleted:** `generateBoundaryTicks`, `generateBaseTicks`, `overlapsPlaced`,
`estimateLabelForRank`, `estimateLabelForBase`, `prepareCandidates`, `resolveBaseInterval`,
`selectTickInterval` (absorbed into matrix), `generateTicks` (rewritten as simple sweep).

**What gets kept:** `snapToBar`, `barCoord`, `calcTextWidth`, `formatBoundaryLabel`,
`formatBaseLabel`, `setAxisChart`, `setAxisResolution`, `registerXAxis` block.

---

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

### ~~B5: WEEK/DAY boundary anchors crowd out all base ticks~~ (Fixed)

**Observed:** 4h chart (3-month span) shows `"Jan...25,28,Feb, 04,08,11,15,18,22,25,Mar, 04,08,11"` —
only boundary ticks, zero time-based labels. 4h chart (narrower) shows `"2026, 05,11,18,25, Feb, 08,15,22, Mar"` —
even sparser, pure boundary ticks.

**Root cause:** Phase 1 places ALL boundary candidates by rank, including WEEK (rank 4) and DAY (rank 5).
At typical 4h bar spacings (5–9px), WEEK boundaries are ~50–90px apart and DAY boundaries are ~18–36px apart.
With estimated overlap thresholds of ~60px, WEEK boundaries barely fit and DAY boundaries suppress each other
heavily. The surviving WEEK/DAY anchors then block Phase 3 gap-fill for ALL base candidates.

**Diagnosis detail:**
- `selectTickInterval('4h', 3months)` returns WEEK. `generateBaseTicks` returns `[]` for WEEK (Fix 1).
- Phase 1 places MONTH + WEEK + sparse DAY boundaries. Phase 3 has zero base candidates.
- Even when base candidates DO exist (e.g., 12HOUR at 3-week 1h span), DAY boundaries at ~24px spacing
  occupy every available slot, suppressing all 58 base candidates.

**Fix required:** Phase 1 should only anchor MONTH+ boundaries (rank ≤ 3). WEEK and DAY boundaries should
move to the Phase 3 unplaced pool and compete with base ticks on equal footing (position-based, not
rank-based). This matches the anchor+fill design intent — only meaningful calendar transitions are anchors.

### ~~B6: No base tick fallback when selectTickInterval returns WEEK/DAY/calendar~~ (Fixed)

**Observed:** Same as B5 — zero time-based labels in the output for multi-week/multi-month spans.

**Root cause:** `selectTickInterval` returns WEEK or DAY for most multi-week/multi-month chart spans
(4h/2M→WEEK, 4h/3M→WEEK, 4h/6M→DAY, 1h/2W→DAY, 1h/8W→WEEK). `generateBaseTicks` returns `[]` for
these intervals (Fix 1 early return). Phase 3 has no base candidates at all.

**Span table (4h resolution):**

| Span | selectTickInterval | generateBaseTicks | Base candidates |
|------|-------------------|-------------------|-----------------|
| 1M | 12HOUR | sub-day | YES |
| 2M | WEEK | `[]` | **NO** |
| 3M | WEEK | `[]` | **NO** |
| 6M | DAY | `[]` | **NO** |
| 1Y | MONTH | `[]` (calendar) | **NO** |

**Span table (1h resolution):**

| Span | selectTickInterval | generateBaseTicks | Base candidates |
|------|-------------------|-------------------|-----------------|
| 1W | 12HOUR | sub-day | YES |
| 2W | DAY | `[]` | **NO** |
| 3W | 12HOUR | sub-day | YES (but suppressed by B5) |
| 8W | WEEK | `[]` | **NO** |
| 12W | WEEK | `[]` | **NO** |

**Fix required:** In `generateTicks`, when `selectTickInterval` returns WEEK, DAY, or a calendar
interval, compute a fallback sub-day interval from `RESOLUTION_FLOOR` (e.g., 4h→1HOUR, 1h→1MIN)
and pass that to `generateBaseTicks` instead. This ensures Phase 3 always has sub-day base candidates
to gap-fill between MONTH+ anchors.

### ~~B7: Time labels shown next to date boundary labels~~ (Fixed)

**Observed:** After "Feb" boundary label, next tick showed "07 08:00" instead of just "07".

**Root cause:** `formatBaseLabel` produced "DD HH:MM" for sub-day intervals regardless of whether the
previous visible tick was a MONTH+ boundary. It only checked calendar day, not semantic rank of the
previous tick.

**Resolution:** Added `prevRank` parameter to `formatBaseLabel`. When `prevRank <= RANK.MONTH`,
returns day-only label ("07") instead of "DD HH:MM". `formatLabel` passes `prev?.rank`.

### ~~B8: Chart unresponsive with large spans~~ (Fixed)

**Observed:** Chart froze when viewing multi-month or multi-week spans.

**Root cause:** Two compounding issues: (1) `calcTextWidth` allocated a new canvas DOM element per
call — with thousands of overlap checks, this meant ~91K canvas allocations for a 6-month 4h span.
(2) B6 fallback generated too many base candidates (4,320 hourly for 6-month span, 120K minute
for 12-week 1h span), causing O(n*m) overlap checks to explode.

**Resolution:** (1) Replaced per-call canvas allocation with single reusable canvas + `Map`-based
width cache (cache hits approach 100% after warmup). (2) Capped base candidates at 200 via uniform
sampling after `generateBaseTicks`.

### ~~B9: American date format in default axis~~ (Fixed)

**Observed:** KLineChart default axis showed MM-DD format (e.g., "04-14") instead of ISO DD-MM.

**Root cause:** `ChartDisplay.svelte` `formatAxisLabel` used `month-day` ordering at three locations
(lines 77, 84, 85). The custom calendar axis (`xAxisCustom.js`) already used unambiguous "DD Mon"
format — no changes needed there.

**Resolution:** Swapped to `day-month` (DD-MM) at all three locations. YYYY-MM-DD and YYYY-MM
formats (lines 76, 78) were already ISO and left unchanged.

### ~~B10: Crosshair/tooltip dates in American format~~ (Fixed)

**Observed:** Hovering over chart showed dates in American format (browser locale en-US) via
crosshair and tooltip.

**Root cause:** `formatAxisLabel` in `ChartDisplay.svelte` had early return `dateTimeFormat.format()`
for `type !== 2` (non-x-axis types). `dateTimeFormat` is a KLineChart-provided `Intl.DateTimeFormat`
defaulting to browser locale (en-US = MM/DD/YYYY). The variable extraction (`d`, `year`, `month`,
`day`, `hour`, `minute`) was defined AFTER the early return, so ISO formatting couldn't be used.

**Resolution:** Moved variable extraction before the type check. Changed early return and default
case to return ISO `YYYY-MM-DD HH:mm`. Removed all `dateTimeFormat.format()` calls from the function.

### ~~B11: Day-transition ticks still showed time after WEEK/DAY boundaries~~ (Fixed)

**Observed:** After WEEK boundary showing "05" or DAY boundary showing "14", next base tick showed
"07 08:00" instead of just "07".

**Root cause:** B7 fix added `prevRank` check to `formatBaseLabel` but only for `prevRank <= RANK.MONTH`
(ranks 1-3). WEEK (rank 4) and DAY (rank 5) boundaries were excluded, even though all boundary
labels are date-only (no time component).

**Resolution:** Changed condition from `prevRank !== undefined && prevRank <= RANK.MONTH` to
`prevRank !== undefined`. Any boundary tick (any defined rank) now suppresses time on the following
base tick. Full audit of all 35 transition combinations (boundary↔boundary, boundary→base,
base→boundary, base→base) confirmed correct behavior.

### ~~B12: Base ticks show time after first post-boundary tick~~ (Fixed)

**Observed:** After a month boundary, the first base tick correctly showed "07" (day-only), but
subsequent base ticks showed "13 08:00", "18 20:00" etc. — time reappeared after the first tick.

**Root cause:** `formatBaseLabel` checked `prevRank` (immediately previous tick's rank). After the
first base tick, prev became another base tick (no rank), so `prevRank=undefined` and time was shown
again. The check only worked for the single base tick immediately after a boundary.

**Resolution:** Added `lastBoundaryRank` as running state in the `generateTicks` formatting loop.
Carries the most recent boundary's rank across multiple base ticks. `formatBaseLabel` now checks
both `prevRank` and `lastBoundaryRank` — any base tick after a boundary shows day-only.

### ~~B13: Context ticks missing before/after month and quarter boundaries~~ (Fixed)

**Observed:** Day before month boundary missing. Day after month boundary missing. Day after quarter
boundary missing. Large gaps (8-14 bars) around every boundary.

**Root cause:** Phase 2 context fill picked the single nearest candidate within `transitionRadius`
and tried to place it once. At 8.9px/bar spacing, the nearest candidate was 1-2 bars away (~8.9px),
but the overlap threshold was ~64-68px (MONTH halfWidth 34px + BASE halfWidth 34px). The nearest
always overlapped and was rejected. Phase 2 gave up without trying farther candidates. The first
non-overlapping candidate was at 8+ bars (71.2px) but was never attempted.

**Resolution:** Changed Phase 2 from "pick nearest, try once" to "filter candidates within radius,
sort by distance, iterate until one fits." Both backward and forward scans now try candidates in
order until one passes `overlapsPlaced`.

### ~~B14: 2d window shows no time labels for all sub-day resolutions~~ (Fixed)

**Observed:** 5min/15min/1h/4h at 2d window showed only day numbers, no times.

**Root cause:** `WINDOW_MS['2d']` (172,800,000ms) exactly equals `TWO_DAYS` (2 × 86,400,000ms).
The strict `<` comparison classified 2d as MULTIDAY, suppressing all same-day time labels.

**Resolution:** Changed threshold from `<` to `<=` — 2d window is now INTRADAY, showing times.

### ~~B15: WEEK/DAY boundary estimates too wide, suppressing nearby base candidates~~ (Fixed)

**Observed:** 4h/3m view missing days around ~25th of month.

**Root cause:** WEEK/DAY boundaries estimated as "00 AAA" (~42px) for overlap detection, but in
MULTIDAY mode they render as day-only "00" (~14px). The 28px overestimate caused each WEEK boundary
to suppress base candidates for ~4 days (~9 bars at 8.9px/bar).

**Resolution:** In MULTIDAY mode, WEEK/DAY boundary estimates use "00" (2 chars) instead of
"00 AAA" (6 chars). MONTH+ boundaries keep their full estimates since they always render with
month/year context.

### Framework: Tier-based label policy (replaces B6–B12 patches)

**The systemic issue:** Previous fixes (B6–B12) were patchwork — each addressed a symptom for a
specific resolution/span combination without a unifying principle. Label format was determined by
the bar resolution and previous-tick relationships, not by what the user can see.

**The framework fix:** Label format is now determined by the VISIBLE SPAN via `visibleTier`:

| Visible Span | Tier | Label Format |
|---|---|---|
| ≤ 2 days | `INTRADAY` | Times ("HH:mm"), cross-day as "DD HH:mm" |
| > 2 days | `MULTIDAY` | Day-only ("DD"), same-day ticks dropped |

**Changes to `generateTicks`:**
- Computes `visibleTier` from `visibleSpanMs` at entry
- B6 fallback: INTRADAY → RESOLUTION_FLOOR; MULTIDAY → 12HOUR (~1 tick/day after overlap)
- `formatBaseLabel` accepts `visibleTier` param: MULTIDAY returns "DD" for cross-day, "" for same-day
- Overlap estimates: MULTIDAY base = "00", MULTIDAY WEEK/DAY = "00" (not "00 AAA")
- Phase 3 gap fill includes WEEK/DAY boundary candidates (not just `type === 'base'`)

**48-cell audit matrix** verified correct behavior across all resolution × window combinations
(1min/5min/15min/1h/4h/D × 1d/2d/1W/2W/1M/3M/6M/1Y). Daily/1Y sparsity confirmed as
geometric constraint (~24 tick slots at 4px/bar, ~16 consumed by Y/Q/M anchors) — not a bug.

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

### Applied changes (commit `1a3554f`)

Implemented as described in the "Proposed Fix: Two-Phase Anchor + Fill" section above.

**Changes to `xAxisCustom.js`:**
- `generateBoundaryTicks` — returns raw candidates `{ ts, snappedTs, coord, rank }` (no formatting)
- `generateBaseTicks` — returns raw candidates `{ ts, snappedTs, coord, type: 'base', intervalName }` (no formatting)
- `generateTicks(fromTs, toTs, dataList, chart, tickTextStyles)` — new main entry: Phase 1 anchor, Phase 2 context fill, Phase 3 gap fill, then label formatting
- `formatLabel(tick, prev)` — unified router dispatching to `formatBoundaryLabel`/`formatBaseLabel`
- `overlapsPlaced(candidate, placed, halfWidthFn)` — internal overlap check
- Removed: `detectBoundaryRanks`, `tryEmitBaseTick`, `applySuppression`
- `registerXAxis` `createTicks` now calls `generateTicks` directly
- Added: WEEK/DAY early return in `generateBaseTicks` (prevents duplicate candidates)
- Added: `estimateLabelForRank` / `estimateLabelForBase` for overlap detection during placement

### Remaining defects (B5, B6) — Applied

**Fix for B5:** In `generateTicks` Phase 1, filter boundary candidates to `rank <= RANK.MONTH` only.
Move WEEK/DAY boundaries into `allUnplaced` pool for Phase 3 gap-fill alongside base candidates.

Note: WEEK/DAY boundaries are moved to `allUnplaced` but Phase 3 gap-fill only considers
`type === 'base'` candidates. This intentionally excludes WEEK/DAY from gap-fill because their
calendar labels (e.g., "05 Apr") would be semantically redundant alongside sub-day time labels.
WEEK/DAY boundaries only appear in the final output when placed by Phase 2 context fill near
MONTH+ anchors.

**Fix for B6:** In `generateTicks`, when `selectTickInterval` returns WEEK/DAY/calendar, compute
fallback base interval from `RESOLUTION_FLOOR` (import from `chartConfig.js`). Pass fallback to
`generateBaseTicks` instead of the WEEK/DAY interval.

### Follow-up fixes (B7, B8, B9)

**Fix for B7: Time labels shown next to date labels.** `formatBaseLabel` produced "DD HH:MM" (e.g.,
"07 08:00") even when the previous visible tick was a MONTH+ boundary (e.g., "Feb"). Fixed by
adding `prevRank` parameter to `formatBaseLabel` — when `prevRank <= RANK.MONTH`, returns day-only
label ("07") instead of full time. `formatLabel` passes `prev?.rank` to `formatBaseLabel`.

**Fix for B8: Chart unresponsive with large spans.** Two compounding issues: (1) `calcTextWidth`
allocated a new canvas DOM element per call — replaced with single reusable canvas + `Map`-based
width cache. (2) B6 fallback generated thousands of base candidates for large spans (e.g., 4,320
hourly candidates for 6-month 4h span) — capped at `MAX_BASE_CANDIDATES = 200` via uniform sampling.

**Fix for B9: American date format in default axis.** `ChartDisplay.svelte` `formatAxisLabel` used
MM-DD ordering at three locations (lines 77, 84, 85). Changed to DD-MM ISO format. The custom
calendar axis (`xAxisCustom.js`) already used unambiguous "DD Mon" format throughout — no changes
needed there.

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
