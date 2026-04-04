/**
 * Calendar-aware custom X-axis for KLineChart.
 *
 * Uses a span-tier lookup matrix to determine tick placement and formatting.
 * No overlap suppression — ticks are placed at deterministic intervals
 * and skipped only if they'd be closer than MIN_FLOOR px to the previous tick.
 *
 * @module xAxisCustom
 */

import { registerXAxis } from 'klinecharts';
import { RESOLUTION_FLOOR, TICK_INTERVALS } from './chartConfig.js';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

// Single-instance only. Multi-chart support requires WeakMap keyed on chart instance.
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
// Constants
// ---------------------------------------------------------------------------

const MIN_FLOOR = 30;   // px, minimum gap between adjacent tick centers
const WEEK_START_DAY = 0; // Sunday for forex

const MS_PER_DAY = 86_400_000;
const MS_PER_TWO_DAYS = 2 * MS_PER_DAY;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const MS_PER_MONTH = 2_592_000_000;
const MS_PER_QUARTER = 3 * MS_PER_MONTH;
const MS_PER_YEAR = 4 * MS_PER_QUARTER;

const RANK = { YEAR: 1, QUARTER: 2, MONTH: 3, WEEK: 4, DAY: 5 };
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Duration lookup for sub-day interval names
const INTERVAL_MS = Object.fromEntries(
  TICK_INTERVALS.filter(iv => iv.durationMs).map(iv => [iv.name, iv.durationMs])
);

// ---------------------------------------------------------------------------
// Span-tier classification
// ---------------------------------------------------------------------------

function classifySpan(spanMs) {
  if (spanMs <= MS_PER_TWO_DAYS) return 'INTRADAY';
  if (spanMs <= 2 * MS_PER_WEEK) return 'DAILY';
  if (spanMs <= 2 * MS_PER_MONTH) return 'WEEKLY';
  if (spanMs <= 6 * MS_PER_MONTH) return 'MONTHLY';
  if (spanMs <= MS_PER_YEAR) return 'QUARTERLY';
  return 'YEARLY';
}

// ---------------------------------------------------------------------------
// Tick strategy matrix
//
// Each row defines: which calendar boundaries to place as anchors,
// what interval to use for fill ticks between boundaries, and label format.
// ---------------------------------------------------------------------------

const STRATEGY = {
  INTRADAY:  { boundaries: ['DAY'],                                           fillMs: null /* overridden by getFillMs */, fillStep: 1 },
  DAILY:     { boundaries: ['MONTH', 'QUARTER', 'YEAR'],                      fillMs: 12 * 3600000, fillStep: 1 },
  WEEKLY:    { boundaries: ['MONTH', 'QUARTER', 'YEAR'],                      fillMs: MS_PER_DAY,    fillStep: 1 },
  MONTHLY:   { boundaries: ['MONTH', 'QUARTER'],                              fillMs: 12 * 3600000, fillStep: 2 },
  QUARTERLY: { boundaries: ['MONTH', 'QUARTER'],                              fillMs: MS_PER_DAY,    fillStep: 3 },
  YEARLY:    { boundaries: ['MONTH', 'QUARTER', 'YEAR'],                      fillMs: MS_PER_MONTH,  fillStep: 1 },
};

// For INTRADAY, use the resolution's own floor interval for fill
function getFillMs(tier) {
  if (tier !== 'INTRADAY') return STRATEGY[tier].fillMs;
  const floorName = RESOLUTION_FLOOR[_resolution];
  if (!floorName) return 3600000; // 1HOUR default
  return INTERVAL_MS[floorName] || 3600000;
}

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
    default: return d;
  }
}

const BOUNDARY_STEP = { YEAR: nextYear, QUARTER: nextQuarter, MONTH: nextMonth, WEEK: nextWeek, DAY: nextDay };

function rankForBoundary(type) {
  return RANK[type]; // YEAR→1, QUARTER→2, MONTH→3, WEEK→4, DAY→5
}

// ---------------------------------------------------------------------------
// calcTextWidth
// ---------------------------------------------------------------------------

const _canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const _ctx = _canvas?.getContext('2d') || null;
const _widthCache = new Map();

export function calcTextWidth(text, size, weight, family) {
  if (!text) return 0;
  const key = `${text}|${size || 12}|${weight || 'normal'}|${family || 'Helvetica Neue'}`;
  const cached = _widthCache.get(key);
  if (cached !== undefined) return cached;
  if (!_ctx) return text.length * 7;
  _ctx.font = `${weight || 'normal'} ${size || 12}px ${family || 'Helvetica Neue'}`;
  const width = _ctx.measureText(text).width;
  _widthCache.set(key, width);
  return width;
}

// ---------------------------------------------------------------------------
// Label formatters
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
      const dayLabel = pad2(day);
      const monthLabel = `${dayLabel} ${SHORT_MONTHS[month]}`;
      if (!prev || prev.getUTCFullYear() !== year) return `${monthLabel} ${year}`;
      if (prev.getUTCMonth() !== month) return monthLabel;
      return dayLabel;
    }
    case RANK.DAY: {
      const label = pad2(day);
      if (!prev || prev.getUTCMonth() !== month) return `${label} ${SHORT_MONTHS[month]}`;
      return label;
    }
    default:
      return '';
  }
}

export function formatBaseLabel(ts, prevTs, tier) {
  const d = new Date(ts);
  const prev = prevTs != null ? new Date(prevTs) : null;
  const day = d.getUTCDate();
  const month = d.getUTCMonth();
  const hours = pad2(d.getUTCHours());
  const mins = pad2(d.getUTCMinutes());

  if (tier === 'INTRADAY') {
    const timeLabel = `${hours}:${mins}`;
    const crossedDay = !prev || prev.getUTCDate() !== day || prev.getUTCMonth() !== month;
    return crossedDay ? `${pad2(day)} ${timeLabel}` : timeLabel;
  }

  // MULTIDAY tiers: show day number for cross-day ticks, suppress same-day
  const crossedDay = !prev || prev.getUTCDate() !== day || prev.getUTCMonth() !== month;
  if (!crossedDay) return '';
  return pad2(day);
}

// ---------------------------------------------------------------------------
// generateTicks — single-pass sweep using strategy matrix
// ---------------------------------------------------------------------------

export function generateTicks(fromTs, toTs, dataList, chart, tickTextStyles) {
  if (!dataList || dataList.length === 0) return [];

  const spanMs = toTs - fromTs;
  const tier = classifySpan(spanMs);
  const strategy = STRATEGY[tier];
  const fillMs = getFillMs(tier);
  const fillStep = strategy.fillStep;

  // --- Step 1: Place boundary ticks first (anchors) ---
  // Collect candidates per boundary type, then deduplicate by rank
  // so that when multiple boundaries snap to nearby bars, the highest-rank wins.
  const candidates = []; // { ts, snappedTs, coord, rank }
  for (const type of strategy.boundaries) {
    let d = alignToBoundary(fromTs, type);
    const step = BOUNDARY_STEP[type];
    if (d.getTime() < fromTs) {
      // Try to include the previous boundary if it snaps within the data range.
      // This ensures the starting month/year label appears.
      const prevSnapped = snapToBar(d.getTime(), dataList);
      if (prevSnapped != null && prevSnapped >= fromTs && prevSnapped <= toTs) {
        const prevIdx = dataIndexOf(dataList, prevSnapped);
        if (prevIdx !== -1) {
          const prevCoord = barCoord(chart, prevIdx);
          if (prevCoord != null) {
            candidates.push({ ts: d.getTime(), snappedTs: prevSnapped, coord: prevCoord, rank: rankForBoundary(type) });
          }
        }
      }
      d = step(d);
    }

    while (d.getTime() <= toTs) {
      const snapped = snapToBar(d.getTime(), dataList);
      if (snapped != null) {
        const idx = dataIndexOf(dataList, snapped);
        if (idx !== -1) {
          const coord = barCoord(chart, idx);
          if (coord != null) {
            candidates.push({ ts: d.getTime(), snappedTs: snapped, coord, rank: rankForBoundary(type) });
          }
        }
      }
      d = step(d);
    }
  }

  // Sort by coord, then deduplicate: when two candidates are within MIN_FLOOR,
  // keep the one with the higher rank (lower number).
  // Same-rank boundaries at different calendar dates are both kept.
  candidates.sort((a, b) => a.coord - b.coord);
  const placed = [];
  for (const c of candidates) {
    let dominated = false;
    for (let j = placed.length - 1; j >= 0; j--) {
      const p = placed[j];
      if (Math.abs(c.coord - p.coord) < MIN_FLOOR) {
        if (c.rank < p.rank) {
          // New candidate strictly outranks existing — remove existing
          placed.splice(j, 1);
        } else if (c.rank === p.rank) {
          // Same rank at different dates — both are valid, don't dominate
          break;
        } else {
          // New candidate has lower rank (higher number) — dominated
          dominated = true;
        }
        break;
      }
    }
    if (!dominated) {
      placed.push(c);
    }
  }

  // Sort placed boundaries by coord
  placed.sort((a, b) => a.coord - b.coord);

  // --- Step 2: Fill ticks ---
  // Walk bars left-to-right, placing fill ticks at the strategy's interval.
  // Apply adaptive step to skip bars that would be too dense,
  // then enforce MIN_FLOOR against the last placed tick.
  const placedCoords = new Set(placed.map(p => p.coord));
  const actualFillMs = fillMs || MS_PER_DAY;

  // Compute adaptive step from pixel density so that fills are spaced >= MIN_FLOOR.
  // Use pxPerBar for the calculation since bars are the atomic unit.
  const startCoord = barCoord(chart, 0);
  const endCoord = barCoord(chart, dataList.length - 1);
  let adaptiveStep = strategy.fillStep;
  let minBarsBetweenFills = 1;
  if (startCoord != null && endCoord != null && endCoord > startCoord && dataList.length > 1) {
    const totalPx = endCoord - startCoord;
    const pxPerBar = totalPx / (dataList.length - 1);
    if (pxPerBar > 0) {
      minBarsBetweenFills = Math.ceil(MIN_FLOOR / pxPerBar);
      adaptiveStep = Math.max(strategy.fillStep, minBarsBetweenFills);
    }
  }

  let boundaryIdx = 0;
  let lastPlacedCoord = -Infinity;
  let lastFillBarIdx = -minBarsBetweenFills;

  for (let i = 0; i < dataList.length; i++) {
    const bar = dataList[i];
    const coord = barCoord(chart, i);
    if (coord == null) continue;

    // Advance past any boundaries at or before this bar's coord
    while (boundaryIdx < placed.length && placed[boundaryIdx].coord <= coord) {
      lastPlacedCoord = placed[boundaryIdx].coord;
      boundaryIdx++;
    }

    if (placedCoords.has(coord)) continue;

    // Check if this bar aligns with the fill interval (relative to fromTs)
    const offsetFromStart = bar.timestamp - fromTs;
    if (offsetFromStart < 0) continue;
    if (offsetFromStart % actualFillMs !== 0) continue;

    // Apply adaptive step: skip if not enough bars since last fill
    if (i - lastFillBarIdx < adaptiveStep) continue;

    // Check MIN_FLOOR against last placed (boundary or fill)
    if (coord - lastPlacedCoord < MIN_FLOOR) continue;

    // Check MIN_FLOOR against next boundary (look ahead)
    if (boundaryIdx < placed.length && placed[boundaryIdx].coord - coord < MIN_FLOOR) continue;

    placed.push({ ts: bar.timestamp, snappedTs: bar.timestamp, coord, rank: undefined });
    placedCoords.add(coord);
    lastPlacedCoord = coord;
    lastFillBarIdx = i;
  }

  // --- Step 3: Format labels ---
  // Boundary ticks take priority. Walk boundaries first, emitting fills
  // that are >= MIN_FLOOR from both the previous tick and the next boundary.
  placed.sort((a, b) => a.coord - b.coord);

  const boundaries = placed.filter(t => t.rank !== undefined);
  const fills = placed.filter(t => t.rank === undefined);

  const result = [];
  let prev = null;
  let lastResultCoord = -Infinity;
  let fillIdx = 0;

  for (let bi = 0; bi < boundaries.length; bi++) {
    const boundary = boundaries[bi];

    // Emit fills between last result and this boundary
    while (fillIdx < fills.length && fills[fillIdx].coord < boundary.coord) {
      const fill = fills[fillIdx];
      if (fill.coord - lastResultCoord >= MIN_FLOOR && boundary.coord - fill.coord >= MIN_FLOOR) {
        const text = formatBaseLabel(fill.snappedTs, prev?.snappedTs ?? null, tier);
        if (text) {
          result.push({ text, coord: fill.coord, value: fill.snappedTs });
          prev = fill;
          lastResultCoord = fill.coord;
        }
      }
      fillIdx++;
    }

    // Skip fills at or past this boundary
    while (fillIdx < fills.length && fills[fillIdx].coord <= boundary.coord) {
      fillIdx++;
    }

    // Emit boundary
    const text = formatBoundaryLabel(boundary.ts, boundary.rank, prev?.snappedTs ?? null);
    if (text) {
      result.push({ text, coord: boundary.coord, value: boundary.snappedTs });
      prev = boundary;
      lastResultCoord = boundary.coord;
    }
  }

  // Emit remaining fills after last boundary
  while (fillIdx < fills.length) {
    const fill = fills[fillIdx];
    if (fill.coord - lastResultCoord >= MIN_FLOOR) {
      const text = formatBaseLabel(fill.snappedTs, prev?.snappedTs ?? null, tier);
      if (text) {
        result.push({ text, coord: fill.coord, value: fill.snappedTs });
        prev = fill;
        lastResultCoord = fill.coord;
      }
    }
    fillIdx++;
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
