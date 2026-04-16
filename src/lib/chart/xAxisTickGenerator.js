/**
 * Calendar-aware X-axis tick generation and deduplication.
 *
 * Generates ticks from a transition matrix. Uses calendarBoundaries.js
 * for boundary alignment and stepping, dataSearch.js for bar snapping.
 * Module-level `_window` state is managed by xAxisCustom.js via setAxisWindow.
 *
 * @module xAxisTickGenerator
 */

import { TRANSITION_MATRIX } from './chartConstants.js';
import {
  BOUNDARY_STEP, RANK,
  alignToBoundary, formatBoundaryLabel,
} from './calendarBoundaries.js';
import { snapToBar, dataIndexOf } from './dataSearch.js';

let _window = '3M';

export function setAxisWindow(window_) {
  _window = window_;
}

export { snapToBar, formatBoundaryLabel };

function barCoord(chart, dataIndex) {
  const pixels = chart.convertToPixel([{ dataIndex }], { paneId: 'candle_pane' });
  if (!pixels || !pixels.length) return null;
  return pixels[0].x;
}

// ---------------------------------------------------------------------------
// Tick generation pipeline
// ---------------------------------------------------------------------------

const MIN_FLOOR = 30;

function collectCandidates(levels, fromTs, toTs, dataList, chart) {
  const candidates = [];
  for (const type of levels) {
    let d = alignToBoundary(fromTs, type);
    const step = BOUNDARY_STEP[type];
    while (d.getTime() < fromTs) d = step(d);

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
  return candidates;
}

function dedupCandidates(candidates) {
  candidates.sort((a, b) => a.coord - b.coord);
  const deduped = [];
  for (const c of candidates) {
    const existing = deduped.find(d => d.snappedTs === c.snappedTs);
    if (existing) {
      if (c.rank < existing.rank) { existing.ts = c.ts; existing.rank = c.rank; }
    } else {
      deduped.push({ ts: c.ts, snappedTs: c.snappedTs, coord: c.coord, rank: c.rank });
    }
  }
  deduped.sort((a, b) => a.coord - b.coord);
  return deduped;
}

function emitLabeledTicks(deduped) {
  const result = [];
  let prevEmittedTs = null;
  let lastVisibleCoord = -Infinity;
  let lastVisibleRank = Infinity;

  for (const tick of deduped) {
    const text = formatBoundaryLabel(tick.ts, tick.rank, prevEmittedTs);
    const gap = tick.coord - lastVisibleCoord;

    if (gap < MIN_FLOOR && result.length > 0 && tick.rank >= lastVisibleRank) {
      result.push({ text: '', coord: tick.coord, value: tick.snappedTs });
      continue;
    }

    if (gap < MIN_FLOOR && result.length > 0) {
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].text !== '') {
          result[i] = { text: '', coord: result[i].coord, value: result[i].value };
          break;
        }
      }
    }

    result.push({ text, coord: tick.coord, value: tick.snappedTs });
    if (text !== '') {
      prevEmittedTs = tick.ts;
      lastVisibleCoord = tick.coord;
      lastVisibleRank = tick.rank;
    }
  }
  return result;
}

export function generateTicks(fromTs, toTs, dataList, chart) {
  if (!dataList || dataList.length === 0) return [];
  const levels = TRANSITION_MATRIX[_window] || TRANSITION_MATRIX['3M'];
  const candidates = collectCandidates(levels, fromTs, toTs, dataList, chart);
  const deduped = dedupCandidates(candidates);
  return emitLabeledTicks(deduped);
}
