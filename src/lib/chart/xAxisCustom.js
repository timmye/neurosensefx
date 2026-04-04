/**
 * Calendar-aware custom X-axis for KLineChart.
 *
 * Replaces the index-based x-axis with calendar-aligned ticks that
 * understand year/quarter/month/week/day boundaries and suppress
 * overlapping labels.
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
  // lo is the first bar >= targetTs
  if (lo < dataList.length) return dataList[lo].timestamp;
  return null;
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
// detectBoundaryRanks
// ---------------------------------------------------------------------------

export function detectBoundaryRanks(ts) {
  const d = new Date(ts);
  const ranks = [];

  if (d.getUTCMonth() === 0 && d.getUTCDate() === 1) {
    ranks.push(RANK.YEAR);
  }
  if (d.getUTCMonth() % 3 === 0 && d.getUTCDate() === 1) {
    ranks.push(RANK.QUARTER);
  }
  if (d.getUTCDate() === 1) {
    ranks.push(RANK.MONTH);
  }
  if (d.getUTCDay() === WEEK_START_DAY) {
    ranks.push(RANK.WEEK);
  }
  ranks.push(RANK.DAY);

  return ranks;
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
      const label = `${pad2(day)} ${SHORT_MONTHS[month]}`;
      if (!prev || prev.getUTCFullYear() !== year) return `${label} ${year}`;
      return label;
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
// generateBoundaryTicks
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
  const ticks = [];
  let prevTs = null;

  const sorted = Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  for (const [snappedTs, entries] of sorted) {
    // Pick the entry with lowest rank number (highest rank)
    entries.sort((a, b) => a.rank - b.rank);
    const best = entries[0];

    const idx = dataIndexOf(dataList, snappedTs);
    if (idx === -1) continue;
    const coord = barCoord(chart, idx);
    if (coord == null) continue;

    const text = formatBoundaryLabel(snappedTs, best.rank, prevTs);
    if (!text) { prevTs = snappedTs; continue; }

    ticks.push({ text, coord, value: snappedTs, rank: best.rank });
    prevTs = snappedTs;
  }

  return ticks;
}

// ---------------------------------------------------------------------------
// generateBaseTicks
// ---------------------------------------------------------------------------

/**
 * Attempt to emit a base tick for a candidate timestamp.
 * Returns updated prevTs (or same prevTs if tick was skipped).
 */
function tryEmitBaseTick(ts, dataList, chart, intervalName, prevTs, ticks) {
  const snapped = snapToBar(ts, dataList);
  if (snapped == null) return prevTs;
  const idx = dataIndexOf(dataList, snapped);
  if (idx === -1) return prevTs;
  const coord = barCoord(chart, idx);
  if (coord == null) return prevTs;
  const text = formatBaseLabel(snapped, intervalName, prevTs);
  if (text) {
    ticks.push({ text, coord, value: snapped });
    return snapped;
  }
  return prevTs;
}

export function generateBaseTicks(interval, fromTs, toTs, dataList, chart) {
  // MONTH/QUARTER/YEAR are handled by boundary ticks
  if (interval.calendar) return [];

  const ticks = [];
  let prevTs = null;

  if (interval.name === 'WEEK') {
    // Sunday midnight
    let d = new Date(fromTs);
    d.setUTCHours(0, 0, 0, 0);
    const dow = d.getUTCDay();
    const daysToSunday = (WEEK_START_DAY - dow + 7) % 7;
    d.setUTCDate(d.getUTCDate() + daysToSunday);
    while (d.getTime() <= toTs) {
      if (d.getTime() >= fromTs) prevTs = tryEmitBaseTick(d.getTime(), dataList, chart, interval.name, prevTs, ticks);
      d = new Date(d.getTime() + 7 * 86_400_000);
    }
    return ticks;
  }

  if (interval.name === 'DAY') {
    // Midnight UTC
    let d = new Date(fromTs);
    d.setUTCHours(0, 0, 0, 0);
    if (d.getTime() < fromTs) d = new Date(d.getTime() + 86_400_000);
    while (d.getTime() <= toTs) {
      if (d.getTime() >= fromTs) prevTs = tryEmitBaseTick(d.getTime(), dataList, chart, interval.name, prevTs, ticks);
      d = new Date(d.getTime() + 86_400_000);
    }
    return ticks;
  }

  // Time-based intervals (1MIN through 12HOUR)
  const durationMs = interval.durationMs;
  if (!durationMs) return ticks;

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
    if (d.getTime() >= fromTs) prevTs = tryEmitBaseTick(d.getTime(), dataList, chart, interval.name, prevTs, ticks);
    d.setTime(d.getTime() + durationMs);
  }

  return ticks;
}

// ---------------------------------------------------------------------------
// applySuppression
// ---------------------------------------------------------------------------

export function applySuppression(boundaryTicks, baseTicks, tickTextStyles) {
  const styles = tickTextStyles || {};
  const size = styles.size || 12;
  const weight = styles.weight || 'normal';
  const family = styles.family || 'Helvetica Neue';

  function halfWidth(text) {
    return Math.max(calcTextWidth(text, size, weight, family) / 2 + PADDING, MIN_FLOOR);
  }

  // First pass: among boundary ticks, high-rank suppresses low-rank within radius
  const sortedBoundary = [...boundaryTicks].sort((a, b) => a.coord - b.coord);
  const keptBoundary = [];
  for (let i = 0; i < sortedBoundary.length; i++) {
    const current = sortedBoundary[i];
    let suppressed = false;
    // Check against previously kept boundaries (which have higher or equal rank due to sort)
    for (const kept of keptBoundary) {
      const radius = (halfWidth(kept.text) + halfWidth(current.text));
      if (Math.abs(current.coord - kept.coord) < radius) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) keptBoundary.push(current);
  }

  // Second pass: suppress base ticks that fall within any boundary tick's radius
  const keptBase = [];
  const sortedBase = [...baseTicks].sort((a, b) => a.coord - b.coord);
  for (const bt of sortedBase) {
    let suppressed = false;
    for (const bnd of keptBoundary) {
      const radius = (halfWidth(bnd.text) + halfWidth(bt.text));
      if (Math.abs(bt.coord - bnd.coord) < radius) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) keptBase.push(bt);
  }

  return { boundary: keptBoundary, base: keptBase };
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

    const interval = selectTickInterval(_resolution, visibleSpanMs);
    const boundaryTicks = generateBoundaryTicks(fromTs, toTs, dataList, _chart);
    const baseTicks = generateBaseTicks(interval, fromTs, toTs, dataList, _chart);
    const { boundary, base } = applySuppression(boundaryTicks, baseTicks, _tickTextStyles);

    const result = [...boundary, ...base]
      .map(t => ({ text: t.text, coord: t.coord, value: t.value }))
      .sort((a, b) => a.coord - b.coord);

    if (result.length === 0) {
      console.warn('[calendarAxis] createTicks produced 0 ticks', {
        from, to, dataLen: dataList.length, fromTs, toTs, visibleSpanMs, resolution: _resolution
      });
      return defaultTicks;
    }

    return result;
  }
});
