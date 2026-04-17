/**
 * Smart time axis label formatting for KLineChart.
 * Adapts label format to the current window tier (intraday, daily, weekly, etc.).
 * Supports timezone-aware display via Intl.DateTimeFormat.
 */

import { getWindowTier } from './chartConfig.js';

const shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Cache Intl.DateTimeFormat instances per timezone to avoid GC pressure on hot paths
const formatterCache = new Map();

function getFormatter(tz) {
  if (formatterCache.has(tz)) return formatterCache.get(tz);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  formatterCache.set(tz, fmt);
  return fmt;
}

function getLocalizedParts(timestamp, tz) {
  const parts = getFormatter(tz).formatToParts(new Date(timestamp));
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    year:   map.year,
    month:  String(Number(map.month)),   // strip leading zero for Number comparison
    day:    String(Number(map.day)),
    hour:   map.hour === '24' ? '00' : map.hour,  // midnight edge case
    minute: map.minute,
    monthPad: map.month,                 // zero-padded for display
    dayPad:   map.day,
  };
}

/**
 * Create a KLineChart formatDate override for tier-based time axis labels.
 *
 * KLineChart calls formatDate with format strings at different levels:
 *   'YYYY'            — year transition
 *   'YYYY-MM'         — month transition
 *   'MM-DD'           — day transition
 *   'YYYY-MM-DD HH:mm' — full datetime transition
 *   'HH:mm'           — primary within-period display (tier-adapted)
 *
 * @param {function} getWindow - returns current window string
 * @param {function} getTimezone - returns resolved IANA timezone string
 * @returns {function} formatDate(dateTimeFormat, timestamp, format, type)
 */
export function createAxisFormatter(getWindow, getTimezone) {
  return function formatAxisLabel(dateTimeFormat, timestamp, format, type) {
    const tz = getTimezone();
    const { year, month, day, hour, minute, monthPad, dayPad } = getLocalizedParts(timestamp, tz);

    // Crosshair/tooltip (type !== 2): always ISO format
    if (type !== 2) return `${year}-${monthPad}-${dayPad} ${hour}:${minute}`;

    // Transition detection — pure date strings for KLineChart comparison
    if (format === 'YYYY') return `${year}`;
    if (format === 'YYYY-MM') return `${year}-${monthPad}`;
    if (format === 'MM-DD') return `${dayPad}-${monthPad}`;
    if (format === 'YYYY-MM-DD HH:mm') return `${year}-${monthPad}-${dayPad} ${hour}:${minute}`;

    // Primary display — tier-based formatting
    const tier = getWindowTier(getWindow());
    const monthIdx = Number(month) - 1;
    switch (tier) {
      case 'INTRADAY':  return `${hour}:${minute}`;
      case 'DAILY':     return `${dayPad}-${monthPad}`;
      case 'WEEKLY':    return `${dayPad}-${monthPad}`;
      case 'MONTHLY':   return shortMonths[monthIdx];
      case 'QUARTERLY': return `${shortMonths[monthIdx]} ${year}`;
      case 'YEARLY':    return `${year}`;
      default:          return `${year}-${monthPad}-${dayPad} ${hour}:${minute}`;
    }
  };
}
