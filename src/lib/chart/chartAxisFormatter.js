/**
 * Smart time axis label formatting for KLineChart.
 * Adapts label format to the current window tier (intraday, daily, weekly, etc.).
 * Supports timezone-aware display via Intl.DateTimeFormat.
 */

import { getWindowTier } from './chartConfig.js';
import { getLocalizedParts } from './dateFormatter.js';

const shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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
