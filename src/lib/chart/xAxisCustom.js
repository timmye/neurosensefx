/**
 * Calendar-aware custom X-axis for KLineChart.
 *
 * Replaces the index-based x-axis with calendar-aligned ticks that
 * understand year/quarter/month/week/day boundaries and suppress
 * overlapping labels.
 *
 * Uses a two-phase "Anchor + Fill" algorithm:
 *   Phase 1: Place boundary ticks (anchors) sorted by rank.
 *   Phase 2: Context fill around MONTH+ anchors, then gap fill.
 *   Phase 3: Format labels in a final pass.
 *
 * @module xAxisCustom
 */

import { registerXAxis } from 'klinecharts';
import { TICK_INTERVALS, RESOLUTION_FLOOR } from './chartConfig.js';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

// Single-instance chart: safe to store as module state.
// If multi-chart is ever supported, replace with WeakMap keyed on chart instance.
let _chart = null;
let _resolution = '4h';
let _tickTextStyles = null;

export function setAxisChart(chart) {
  _chart = chart;
  if (chart) {
    const styles = chart.getStyles?.();
    if (styles?.xAxis?.tickText) {
      _tickTextStyles = styles.xAxis.tickText;
    }
  }
}

export function setAxisResolution(resolution) {
  _resolution = resolution;
}

// ---------------------------------------------------------------------------
// Constants (local to module)
// ---------------------------------------------------------------------------

const TARGET_MIN_TICKS = 8;
const TARGET_MAX_TICKS = 18;
const MIN_FLOOR = 30;   // px, absolute minimum suppression radius
const PADDING = 8;      // px, minimum gap between adjacent label edges
const WEEK_START_DAY = 0; // Sunday for forex

const RANK = { YEAR: 1, QUARTER: 2, MONTH: 3, WEEK: 4, DAY: 5 };
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dataIndexOf(dataList, timestamp) {
  let lo = 0;
  let hi = dataList.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const ts = dataList[mid].timestamp;
    if (ts < timestamp) lo = mid + 1;
    else if (ts > timestamp) hi = mid - 1;
    else return mid;
  }
  return -1;
}

function barCoord(chart, dataIndex) {
  const pixels = chart.convertToPixel([{ dataIndex }], { paneId: 'candle_pane' });
  if (!pixels || !pixels.length) return null;
  return pixels[0].x;
}

// ---------------------------------------------------------------------------
// snapToBar
// ---------------------------------------------------------------------------

export function snapToBar(targetTs, dataList) {
  if (!dataList || dataList.length === 0) return null;
  let lo = 0;
  let hi = dataList.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const ts = dataList[mid].timestamp;
    if (ts < targetTs) lo = mid + 1;
    else if (ts > targetTs) hi = mid - 1;
    else return ts;
  }
  // lo is the first bar >= targetTs, hi is the last bar < targetTs
  if (lo >= dataList.length) {
    // Target is after all bars — return last bar if it exists
    return hi >= 0 ? dataList[hi].timestamp : null;
  }
  if (hi < 0) {
    // Target is before all bars — return first bar
    return dataList[0].timestamp;
  }
  // Both candidates exist — return whichever is closer to targetTs
  const diffLo = dataList[lo].timestamp - targetTs;
  const diffHi = targetTs - dataList[hi].timestamp;
  return diffLo <= diffHi ? dataList[lo].timestamp : dataList[hi].timestamp;
}

// ---------------------------------------------------------------------------
// selectTickInterval
// ---------------------------------------------------------------------------

export function selectTickInterval(resolution, spanMs) {
  const floorName = RESOLUTION_FLOOR[resolution] || 'DAY';
  const floorIdx = TICK_INTERVALS.findIndex(iv => iv.name === floorName);
  if (floorIdx === -1) return TICK_INTERVALS[TICK_INTERVALS.length - 1];

  // Walk coarsest (end) → finest (floorIdx)
  for (let i = TICK_INTERVALS.length - 1; i >= floorIdx; i--) {
    const iv = TICK_INTERVALS[i];
    let count;
    if (iv.calendar) {
      // Calendar intervals: estimate by fixed averages
      if (iv.name === 'YEAR') count = spanMs / 31_536_000_000;
      else if (iv.name === 'QUARTER') count = spanMs / 7_776_000_000;
      else if (iv.name === 'MONTH') count = spanMs / 2_592_000_000;
      else count = spanMs / 2_592_000_000;
    } else {
      count = spanMs / iv.durationMs;
    }

    if (count >= TARGET_MIN_TICKS) {
      // If too many ticks and not at finest, try next finer
      if (count > TARGET_MAX_TICKS && i > floorIdx) {
        return TICK_INTERVALS[i - 1];
      }
      return iv;
    }
  }

  return TICK_INTERVALS[floorIdx];
}

// ---------------------------------------------------------------------------
// formatBoundaryLabel
// ---------------------------------------------------------------------------

export function formatBoundaryLabel(ts, rank, prevTs) {
  const d = new Date(ts);
  const prev = prevTs != null ? new Date(prevTs) : null;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();

  switch (rank) {
    case RANK.YEAR:
      return String(year);
    case RANK.QUARTER: {
      const q = Math.floor(month / 3) + 1;
      const label = `Q${q}`;
      if (!prev || prev.getUTCFullYear() !== year) return `${label} ${year}`;
      return label;
    }
    case RANK.MONTH: {
      const label = SHORT_MONTHS[month];
      if (!prev || prev.getUTCFullYear() !== year) return `${label} ${year}`;
      return label;
    }
    case RANK.WEEK: {
      const dayLabel = `${pad2(day)}`;
      const monthLabel = `${dayLabel} ${SHORT_MONTHS[month]}`;
      if (!prev || prev.getUTCFullYear() !== year) return `${monthLabel} ${year}`;
      if (prev.getUTCMonth() !== month) return monthLabel;
      return dayLabel;
    }
    case RANK.DAY: {
      const label = `${pad2(day)}`;
      if (!prev || prev.getUTCMonth() !== month) return `${label} ${SHORT_MONTHS[month]}`;
      return label;
    }
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// formatBaseLabel
// ---------------------------------------------------------------------------

export function formatBaseLabel(ts, intervalName, prevTs) {
  const d = new Date(ts);
  const prev = prevTs != null ? new Date(prevTs) : null;
  const hours = pad2(d.getUTCHours());
  const mins = pad2(d.getUTCMinutes());
  const day = d.getUTCDate();
  const month = d.getUTCMonth();

  // Sub-day intervals
  const subDayIntervals = ['1MIN','5MIN','15MIN','30MIN','1HOUR','2HOUR','4HOUR','8HOUR','12HOUR'];
  if (subDayIntervals.includes(intervalName)) {
    const timeLabel = `${hours}:${mins}`;
    if (!prev || prev.getUTCDate() !== day || prev.getUTCMonth() !== month) {
      return `${pad2(day)} ${timeLabel}`;
    }
    return timeLabel;
  }

  if (intervalName === 'DAY') {
    return `${pad2(day)}`;
  }

  // WEEK and above: boundary ticks handle these
  return '';
}

// ---------------------------------------------------------------------------
// calcTextWidth
// ---------------------------------------------------------------------------

export function calcTextWidth(text, size, weight, family) {
  if (!text) return 0;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = size || 12;
  const fontWeight = weight || 'normal';
  const fontFamily = family || 'Helvetica Neue';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);
  return metrics.width;
}

// ---------------------------------------------------------------------------
// generateBoundaryTicks — raw candidates (no formatting)
// ---------------------------------------------------------------------------

export function generateBoundaryTicks(fromTs, toTs, dataList, chart) {
  const boundaries = [];

  // Generate year starts
  let year = new Date(fromTs).getUTCFullYear();
  let d = new Date(Date.UTC(year, 0, 1));
  if (d.getTime() < fromTs) d = new Date(Date.UTC(year + 1, 0, 1));
  while (d.getTime() <= toTs) {
    if (d.getTime() >= fromTs) boundaries.push({ ts: d.getTime(), rank: RANK.YEAR });
    d = new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1));
  }

  // Generate quarter starts
  {
    const sd = new Date(fromTs);
    let qMonth = Math.floor(sd.getUTCMonth() / 3) * 3;
    d = new Date(Date.UTC(sd.getUTCFullYear(), qMonth, 1));
    if (d.getTime() < fromTs) d = new Date(Date.UTC(sd.getUTCFullYear(), qMonth + 3, 1));
    while (d.getTime() <= toTs) {
      if (d.getTime() >= fromTs) boundaries.push({ ts: d.getTime(), rank: RANK.QUARTER });
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1));
    }
  }

  // Generate month starts
  {
    const sd = new Date(fromTs);
    d = new Date(Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth(), 1));
    if (d.getTime() < fromTs) d = new Date(Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth() + 1, 1));
    while (d.getTime() <= toTs) {
      if (d.getTime() >= fromTs) boundaries.push({ ts: d.getTime(), rank: RANK.MONTH });
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    }
  }

  // Generate week starts (Sunday)
  {
    d = new Date(fromTs);
    d.setUTCHours(0, 0, 0, 0);
    const dow = d.getUTCDay();
    const daysToSunday = (WEEK_START_DAY - dow + 7) % 7;
    d.setUTCDate(d.getUTCDate() + daysToSunday);
    while (d.getTime() <= toTs) {
      if (d.getTime() >= fromTs) boundaries.push({ ts: d.getTime(), rank: RANK.WEEK });
      d = new Date(d.getTime() + 7 * 86_400_000);
    }
  }

  // Generate day starts
  {
    d = new Date(fromTs);
    d.setUTCHours(0, 0, 0, 0);
    if (d.getTime() < fromTs) d = new Date(d.getTime() + 86_400_000);
    while (d.getTime() <= toTs) {
      if (d.getTime() >= fromTs) boundaries.push({ ts: d.getTime(), rank: RANK.DAY });
      d = new Date(d.getTime() + 86_400_000);
    }
  }

  // Snap to bars and group by snapped timestamp
  const groups = new Map();
  for (const b of boundaries) {
    const snapped = snapToBar(b.ts, dataList);
    if (snapped == null) continue;
    if (!groups.has(snapped)) groups.set(snapped, []);
    groups.get(snapped).push(b);
  }

  // For each group, pick highest rank (lowest number)
  const candidates = [];
  const sorted = Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  for (const [snappedTs, entries] of sorted) {
    entries.sort((a, b) => a.rank - b.rank);
    const best = entries[0];

    const idx = dataIndexOf(dataList, snappedTs);
    if (idx === -1) continue;
    const coord = barCoord(chart, idx);
    if (coord == null) continue;

    candidates.push({ ts: best.ts, snappedTs, coord, rank: best.rank });
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// generateBaseTicks — raw candidates (no formatting)
// ---------------------------------------------------------------------------

export function generateBaseTicks(interval, fromTs, toTs, dataList, chart) {
  // MONTH/QUARTER/YEAR are handled by boundary ticks
  if (interval.calendar) return [];

  const candidates = [];

  if (interval.name === 'WEEK') {
    // Sunday midnight
    let d = new Date(fromTs);
    d.setUTCHours(0, 0, 0, 0);
    const dow = d.getUTCDay();
    const daysToSunday = (WEEK_START_DAY - dow + 7) % 7;
    d.setUTCDate(d.getUTCDate() + daysToSunday);
    while (d.getTime() <= toTs) {
      if (d.getTime() >= fromTs) {
        const snapped = snapToBar(d.getTime(), dataList);
        if (snapped != null) {
          const idx = dataIndexOf(dataList, snapped);
          if (idx !== -1) {
            const coord = barCoord(chart, idx);
            if (coord != null) {
              candidates.push({ ts: d.getTime(), snappedTs: snapped, coord, type: 'base', intervalName: interval.name });
            }
          }
        }
      }
      d = new Date(d.getTime() + 7 * 86_400_000);
    }
    return candidates;
  }

  if (interval.name === 'DAY') {
    // Midnight UTC
    let d = new Date(fromTs);
    d.setUTCHours(0, 0, 0, 0);
    if (d.getTime() < fromTs) d = new Date(d.getTime() + 86_400_000);
    while (d.getTime() <= toTs) {
      if (d.getTime() >= fromTs) {
        const snapped = snapToBar(d.getTime(), dataList);
        if (snapped != null) {
          const idx = dataIndexOf(dataList, snapped);
          if (idx !== -1) {
            const coord = barCoord(chart, idx);
            if (coord != null) {
              candidates.push({ ts: d.getTime(), snappedTs: snapped, coord, type: 'base', intervalName: interval.name });
            }
          }
        }
      }
      d = new Date(d.getTime() + 86_400_000);
    }
    return candidates;
  }

  // Time-based intervals (1MIN through 12HOUR)
  const durationMs = interval.durationMs;
  if (!durationMs) return candidates;

  // Align to interval boundaries
  const d = new Date(fromTs);
  d.setUTCSeconds(0, 0);

  let alignFn;
  switch (interval.name) {
    case '1MIN': alignFn = dt => { dt.setUTCMinutes(Math.floor(dt.getUTCMinutes() / 1) * 1, 0, 0); }; break;
    case '5MIN': alignFn = dt => { dt.setUTCMinutes(Math.floor(dt.getUTCMinutes() / 5) * 5, 0, 0); }; break;
    case '15MIN': alignFn = dt => { dt.setUTCMinutes(Math.floor(dt.getUTCMinutes() / 15) * 15, 0, 0); }; break;
    case '30MIN': alignFn = dt => { dt.setUTCMinutes(Math.floor(dt.getUTCMinutes() / 30) * 30, 0, 0); }; break;
    case '1HOUR': alignFn = dt => { dt.setUTCMinutes(0, 0, 0); }; break;
    case '2HOUR': alignFn = dt => { dt.setUTCHours(Math.floor(dt.getUTCHours() / 2) * 2, 0, 0, 0); }; break;
    case '4HOUR': alignFn = dt => { dt.setUTCHours(Math.floor(dt.getUTCHours() / 4) * 4, 0, 0, 0); }; break;
    case '8HOUR': alignFn = dt => { dt.setUTCHours(Math.floor(dt.getUTCHours() / 8) * 8, 0, 0, 0); }; break;
    case '12HOUR': alignFn = dt => { dt.setUTCHours(Math.floor(dt.getUTCHours() / 12) * 12, 0, 0, 0); }; break;
    default: alignFn = dt => { dt.setUTCMinutes(0, 0, 0); };
  }

  alignFn(d);
  if (d.getTime() < fromTs) d.setTime(d.getTime() + durationMs);

  while (d.getTime() <= toTs) {
    if (d.getTime() >= fromTs) {
      const snapped = snapToBar(d.getTime(), dataList);
      if (snapped != null) {
        const idx = dataIndexOf(dataList, snapped);
        if (idx !== -1) {
          const coord = barCoord(chart, idx);
          if (coord != null) {
            candidates.push({ ts: d.getTime(), snappedTs: snapped, coord, type: 'base', intervalName: interval.name });
          }
        }
      }
    }
    d.setTime(d.getTime() + durationMs);
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// overlapsPlaced
// ---------------------------------------------------------------------------

function overlapsPlaced(candidate, placed, halfWidthFn) {
  const halfW = halfWidthFn(candidate.text || '');
  for (const p of placed) {
    const pHalfW = halfWidthFn(p.text || '');
    if (Math.abs(candidate.coord - p.coord) < halfW + pHalfW) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// formatLabel
// ---------------------------------------------------------------------------

function formatLabel(tick, prev) {
  if (tick.rank !== undefined) {
    return formatBoundaryLabel(tick.ts, tick.rank, prev?.ts ?? null);
  }
  return formatBaseLabel(tick.snappedTs, tick.intervalName, prev?.ts ?? null);
}

// ---------------------------------------------------------------------------
// generateTicks — main entry point (Anchor + Fill)
// ---------------------------------------------------------------------------

export function generateTicks(fromTs, toTs, dataList, chart, tickTextStyles) {
  // 1. Compute base interval
  const visibleSpanMs = toTs - fromTs;
  const interval = selectTickInterval(_resolution, visibleSpanMs);

  // 2. Enumerate candidates
  const boundaryCandidates = generateBoundaryTicks(fromTs, toTs, dataList, chart);
  const baseCandidates = generateBaseTicks(interval, fromTs, toTs, dataList, chart);

  // Build half-width estimator
  const styles = tickTextStyles || {};
  const size = styles.size || 12;
  const weight = styles.weight || 'normal';
  const family = styles.family || 'Helvetica Neue';

  function halfWidth(text) {
    if (!text) return MIN_FLOOR;
    return Math.max(calcTextWidth(text, size, weight, family) / 2 + PADDING, MIN_FLOOR);
  }

  // Compute adaptive transitionRadius
  const minSpacing = 2 * MIN_FLOOR + 2 * PADDING;
  const transitionRadius = 2 * minSpacing;

  // 3. PHASE 1 — Anchor placement (boundary ticks only)
  const sortedBoundary = [...boundaryCandidates].sort((a, b) => a.rank - b.rank || a.coord - b.coord);
  const placed = [];
  for (const candidate of sortedBoundary) {
    if (!overlapsPlaced(candidate, placed, halfWidth)) {
      placed.push(candidate);
    }
  }

  // Track which boundary candidates are placed
  const placedSet = new Set(placed);
  const allUnplaced = [...boundaryCandidates, ...baseCandidates].filter(c => !placedSet.has(c));

  // 4. PHASE 2 — Context fill
  // For each placed anchor with rank <= MONTH, scan unplaced for nearest within transitionRadius
  for (const anchor of placed) {
    if (anchor.rank > RANK.MONTH) continue;

    // Scan backward through unplaced for nearest within transitionRadius
    let nearestBefore = null;
    let nearestBeforeDist = Infinity;
    for (const c of allUnplaced) {
      if (c.coord >= anchor.coord) continue;
      const dist = anchor.coord - c.coord;
      if (dist <= transitionRadius && dist < nearestBeforeDist) {
        nearestBeforeDist = dist;
        nearestBefore = c;
      }
    }
    if (nearestBefore && !overlapsPlaced(nearestBefore, placed, halfWidth)) {
      placed.push(nearestBefore);
      placedSet.add(nearestBefore);
      allUnplaced.splice(allUnplaced.indexOf(nearestBefore), 1);
    }

    // Scan forward through unplaced for nearest within transitionRadius
    let nearestAfter = null;
    let nearestAfterDist = Infinity;
    for (const c of allUnplaced) {
      if (c.coord <= anchor.coord) continue;
      const dist = c.coord - anchor.coord;
      if (dist <= transitionRadius && dist < nearestAfterDist) {
        nearestAfterDist = dist;
        nearestAfter = c;
      }
    }
    if (nearestAfter && !overlapsPlaced(nearestAfter, placed, halfWidth)) {
      placed.push(nearestAfter);
      placedSet.add(nearestAfter);
      allUnplaced.splice(allUnplaced.indexOf(nearestAfter), 1);
    }
  }

  // 5. PHASE 3 — Gap fill
  const remainingBase = allUnplaced.filter(c => c.type === 'base').sort((a, b) => a.coord - b.coord);
  for (const candidate of remainingBase) {
    if (!overlapsPlaced(candidate, placed, halfWidth)) {
      placed.push(candidate);
    }
  }

  // 6. FORMAT labels in a final pass
  placed.sort((a, b) => a.coord - b.coord);
  let prev = null;
  for (const tick of placed) {
    tick.text = formatLabel(tick, prev);
    prev = tick;
  }

  // 7. RETURN final tick array
  return placed
    .filter(t => t.text) // drop ticks with empty labels
    .map(t => ({ text: t.text, coord: t.coord, value: t.snappedTs }))
    .sort((a, b) => a.coord - b.coord);
}

// ---------------------------------------------------------------------------
// registerXAxis — KLineChart registration
// ---------------------------------------------------------------------------

registerXAxis({
  name: 'calendar',
  createTicks({ range, bounding, defaultTicks }) {
    if (!_chart) return defaultTicks;

    const dataList = _chart.getDataList();
    const { from, to } = range;

    if (!dataList || dataList.length === 0 || from < 0 || to >= dataList.length || from > to) {
      return defaultTicks;
    }

    const fromTs = dataList[from].timestamp;
    const toTs = dataList[to].timestamp;
    const visibleSpanMs = toTs - fromTs;

    const result = generateTicks(fromTs, toTs, dataList, _chart, _tickTextStyles);

    if (result.length === 0) {
      console.warn('[calendarAxis] createTicks produced 0 ticks', {
        from, to, dataLen: dataList.length, fromTs, toTs, visibleSpanMs, resolution: _resolution
      });
      return defaultTicks;
    }

    return result;
  }
});
