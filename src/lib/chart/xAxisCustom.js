/**
 * Calendar-aware custom X-axis for KLineChart.
 *
 * Uses a hardcoded transition matrix keyed on the time window string.
 * Each window defines which calendar levels to show. Higher-order transitions
 * always fire when their boundary falls within the visible range.
 *
 * @module xAxisCustom
 */

import { registerXAxis } from 'klinecharts';
import { TRANSITION_MATRIX } from './chartConfig.js';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

// Single-instance only. Multi-chart support requires WeakMap keyed on chart instance.
let _chart = null;
let _window = '3M';

export function setAxisChart(chart) {
  _chart = chart;
}

export function setAxisWindow(window_) {
  _window = window_;
}

// Legacy — kept for backward compat but no longer used by generateTicks.
export function setAxisResolution(_resolution) {
  // no-op: resolution no longer drives tick behavior
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_FLOOR = 30;   // px, minimum gap between adjacent label centers
const WEEK_START_DAY = 0; // Sunday for forex

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const MS_PER_MONTH = 2_592_000_000;
const MS_PER_QUARTER = 3 * MS_PER_MONTH;
const MS_PER_YEAR = 4 * MS_PER_QUARTER;

const RANK = { YEAR: 1, QUARTER: 2, MONTH: 3, WEEK: 4, DAY: 5, HOUR: 6 };
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad2(n) {
  return String(n).padStart(2, '0');
}

function _binarySearch(dataList, timestamp) {
  let lo = 0;
  let hi = dataList.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const ts = dataList[mid].timestamp;
    if (ts < timestamp) lo = mid + 1;
    else if (ts > timestamp) hi = mid - 1;
    else return { found: mid, lo, hi };
  }
  return { found: -1, lo, hi };
}

function dataIndexOf(dataList, timestamp) {
  return _binarySearch(dataList, timestamp).found;
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
  const { found, lo, hi } = _binarySearch(dataList, targetTs);
  if (found !== -1) return targetTs;

  if (lo >= dataList.length) return hi >= 0 ? dataList[hi].timestamp : null;
  if (hi < 0) return dataList[0].timestamp;
  const diffLo = dataList[lo].timestamp - targetTs;
  const diffHi = targetTs - dataList[hi].timestamp;
  return diffLo <= diffHi ? dataList[lo].timestamp : dataList[hi].timestamp;
}

// ---------------------------------------------------------------------------
// Calendar boundary generators
// ---------------------------------------------------------------------------

function nextYear(d)    { return new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1)); }
function nextQuarter(d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1)); }
function nextMonth(d)   { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); }
function nextWeek(d)    { return new Date(d.getTime() + MS_PER_WEEK); }
function nextDay(d)     { return new Date(d.getTime() + MS_PER_DAY); }
function nextHour(d)    { return new Date(d.getTime() + MS_PER_HOUR); }

function alignToBoundary(fromTs, boundaryType) {
  const d = new Date(fromTs);
  switch (boundaryType) {
    case 'YEAR':    return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    case 'QUARTER': {
      const qMonth = Math.floor(d.getUTCMonth() / 3) * 3;
      return new Date(Date.UTC(d.getUTCFullYear(), qMonth, 1));
    }
    case 'MONTH':   return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    case 'WEEK': {
      d.setUTCHours(0, 0, 0, 0);
      const dow = d.getUTCDay();
      const daysToSunday = (WEEK_START_DAY - dow + 7) % 7;
      d.setUTCDate(d.getUTCDate() + daysToSunday);
      return d;
    }
    case 'DAY': {
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    case 'HOUR': {
      d.setUTCMinutes(0, 0, 0);
      return d;
    }
    default: return d;
  }
}

const BOUNDARY_STEP = { YEAR: nextYear, QUARTER: nextQuarter, MONTH: nextMonth, WEEK: nextWeek, DAY: nextDay, HOUR: nextHour };

// ---------------------------------------------------------------------------
// Label formatter
// ---------------------------------------------------------------------------

export function formatBoundaryLabel(ts, rank, prevTs) {
  const d = new Date(ts);
  const prev = prevTs != null ? new Date(prevTs) : null;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  const hours = pad2(d.getUTCHours());
  const mins = pad2(d.getUTCMinutes());

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
      const dayLabel = pad2(day);
      const monthLabel = `${dayLabel} ${SHORT_MONTHS[month]}`;
      if (!prev || prev.getUTCFullYear() !== year) return `${monthLabel} ${year}`;
      if (prev.getUTCMonth() !== month) return monthLabel;
      return dayLabel;
    }
    case RANK.DAY: {
      const label = pad2(day);
      if (!prev || prev.getUTCMonth() !== month || prev.getUTCFullYear() !== year) return `${label} ${SHORT_MONTHS[month]}`;
      return label;
    }
    case RANK.HOUR: {
      const timeLabel = `${hours}:${mins}`;
      if (!prev || prev.getUTCFullYear() !== year || prev.getUTCMonth() !== month || prev.getUTCDate() !== day) {
        return `${pad2(day)} ${timeLabel}`;
      }
      return timeLabel;
    }
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// generateTicks — matrix-driven boundary walk
// ---------------------------------------------------------------------------

export function generateTicks(fromTs, toTs, dataList, chart) {
  if (!dataList || dataList.length === 0) return [];

  const levels = TRANSITION_MATRIX[_window] || TRANSITION_MATRIX['3M'];

  // --- Step 1: Collect boundary candidates for each level ---
  const candidates = []; // { ts, snappedTs, coord, rank }

  for (const type of levels) {
    let d = alignToBoundary(fromTs, type);
    const step = BOUNDARY_STEP[type];

    // Skip boundaries before the visible range
    while (d.getTime() < fromTs) {
      d = step(d);
    }

    while (d.getTime() <= toTs) {
      const snapped = snapToBar(d.getTime(), dataList);
      if (snapped != null) {
        const idx = dataIndexOf(dataList, snapped);
        if (idx !== -1) {
          const coord = barCoord(chart, idx);
          if (coord != null) {
            candidates.push({ ts: d.getTime(), snappedTs: snapped, coord, rank: RANK[type] });
          }
        }
      }
      d = step(d);
    }
  }

  // --- Step 2: Sort by coord, deduplicate coincident boundaries (same snapped bar) ---
  candidates.sort((a, b) => a.coord - b.coord);

  const deduped = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    // Check if a previous candidate already claimed this same snapped bar
    const existing = deduped.find(d => d.snappedTs === c.snappedTs);
    if (existing) {
      // Keep higher rank (lower number)
      if (c.rank < existing.rank) {
        existing.ts = c.ts;
        existing.rank = c.rank;
      }
    } else {
      deduped.push({ ts: c.ts, snappedTs: c.snappedTs, coord: c.coord, rank: c.rank });
    }
  }

  deduped.sort((a, b) => a.coord - b.coord);

  // --- Step 3: Format labels with context tracking and rank-priority MIN_FLOOR ---
  const result = [];
  let prevEmittedTs = null;
  let lastVisibleCoord = -Infinity;
  let lastVisibleRank = Infinity;

  for (const tick of deduped) {
    const text = formatBoundaryLabel(tick.ts, tick.rank, prevEmittedTs);
    const gap = tick.coord - lastVisibleCoord;

    if (gap < MIN_FLOOR && result.length > 0) {
      if (tick.rank < lastVisibleRank) {
        // Higher rank wins — demote last visible label, show current
        for (let i = result.length - 1; i >= 0; i--) {
          if (result[i].text !== '') {
            result[i] = { text: '', coord: result[i].coord, value: result[i].value };
            break;
          }
        }
        result.push({ text, coord: tick.coord, value: tick.snappedTs });
        if (text !== '') {
          prevEmittedTs = tick.ts;
          lastVisibleCoord = tick.coord;
          lastVisibleRank = tick.rank;
        }
      } else {
        // Lower or equal rank — suppress current
        result.push({ text: '', coord: tick.coord, value: tick.snappedTs });
      }
    } else {
      result.push({ text, coord: tick.coord, value: tick.snappedTs });
      if (text !== '') {
        prevEmittedTs = tick.ts;
        lastVisibleCoord = tick.coord;
        lastVisibleRank = tick.rank;
      }
    }
  }

  return result;
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

    const result = generateTicks(fromTs, toTs, dataList, _chart);

    if (result.length === 0) {
      console.warn('[calendarAxis] createTicks produced 0 ticks', {
        from, to, dataLen: dataList.length, fromTs, toTs, window: _window
      });
      return defaultTicks;
    }

    return result;
  }
});
