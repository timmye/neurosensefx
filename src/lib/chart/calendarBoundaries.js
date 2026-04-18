/**
 * Calendar boundary alignment and stepping for X-axis tick generation.
 *
 * Provides functions to align timestamps to calendar boundaries (year,
 * quarter, month, week, day, hour) and step forward to the next boundary.
 *
 * Boundary alignment and stepping operate on UTC timestamps (unchanged).
 * Label formatting supports timezone-aware display via Intl.DateTimeFormat.
 *
 * @module calendarBoundaries
 */

import { getLocalizedParts } from './dateFormatter.js';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export const WEEK_START_DAY = 0; // Sunday for forex

export function nextYear(d)    { return new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1)); }
export function nextQuarter(d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1)); }
export function nextMonth(d)   { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); }
export function nextWeek(d)    { return new Date(d.getTime() + MS_PER_WEEK); }
export function nextDay(d)     { return new Date(d.getTime() + MS_PER_DAY); }
export function nextHour(d)    { return new Date(d.getTime() + MS_PER_HOUR); }

export const BOUNDARY_STEP = {
  YEAR: nextYear, QUARTER: nextQuarter, MONTH: nextMonth,
  WEEK: nextWeek, DAY: nextDay, HOUR: nextHour,
};

export function alignToBoundary(fromTs, boundaryType) {
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

export const RANK = { YEAR: 1, QUARTER: 2, MONTH: 3, WEEK: 4, DAY: 5, HOUR: 6 };

/**
 * Format a boundary tick label in the given timezone.
 * @param {number} ts - UTC epoch timestamp
 * @param {number} rank - RANK enum value
 * @param {number|null} prevTs - previous emitted timestamp for context
 * @param {string} timezone - IANA timezone string (default 'UTC')
 */
export function formatBoundaryLabel(ts, rank, prevTs, timezone = 'UTC') {
  const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const p = getLocalizedParts(ts, timezone);
  const prev = prevTs != null ? getLocalizedParts(prevTs, timezone) : null;
  const pad2 = n => String(n).padStart(2, '0');

  switch (rank) {
    case RANK.YEAR:
      return p.year;
    case RANK.QUARTER: {
      const q = Math.floor((p.month - 1) / 3) + 1;
      const label = `Q${q}`;
      if (!prev || prev.year !== p.year) return `${label} ${p.year}`;
      return label;
    }
    case RANK.MONTH: {
      const label = SHORT_MONTHS[p.month - 1];
      if (!prev || prev.year !== p.year) return `${label} ${p.year}`;
      return label;
    }
    case RANK.WEEK: {
      const dayLabel = p.dayPad;
      const monthLabel = `${dayLabel} ${SHORT_MONTHS[p.month - 1]}`;
      if (!prev || prev.year !== p.year) return `${monthLabel} ${p.year}`;
      if (prev.month !== p.month) return monthLabel;
      return dayLabel;
    }
    case RANK.DAY: {
      const label = p.dayPad;
      if (!prev || prev.month !== p.month || prev.year !== p.year) {
        return `${label} ${SHORT_MONTHS[p.month - 1]}`;
      }
      return label;
    }
    case RANK.HOUR: {
      const timeLabel = `${p.hour}:${p.minute}`;
      if (!prev || prev.year !== p.year || prev.month !== p.month || prev.day !== p.day) {
        return `${p.dayPad} ${timeLabel}`;
      }
      return timeLabel;
    }
    default:
      return '';
  }
}
