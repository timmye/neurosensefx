/**
 * Smart time axis label formatting for KLineChart.
 * Adapts label format to the current window tier (intraday, daily, weekly, etc.).
 */

import { getWindowTier } from './chartConfig.js';

const shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad2(n) {
  return String(n).padStart(2, '0');
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
 * @returns {function} formatDate(dateTimeFormat, timestamp, format, type)
 */
export function createAxisFormatter(getWindow) {
  return function formatAxisLabel(dateTimeFormat, timestamp, format, type) {
    const d = new Date(timestamp);
    const year = d.getUTCFullYear(), month = d.getUTCMonth(), day = d.getUTCDate();
    const hour = d.getUTCHours(), minute = d.getUTCMinutes();

    // Crosshair/tooltip (type !== 2): always ISO format
    if (type !== 2) return `${year}-${pad2(month+1)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`;

    // Transition detection — pure date strings for KLineChart comparison
    if (format === 'YYYY') return `${year}`;
    if (format === 'YYYY-MM') return `${year}-${pad2(month+1)}`;
    if (format === 'MM-DD') return `${pad2(day)}-${pad2(month+1)}`;
    if (format === 'YYYY-MM-DD HH:mm') return `${year}-${pad2(month+1)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`;

    // Primary display — tier-based formatting
    const tier = getWindowTier(getWindow());
    switch (tier) {
      case 'INTRADAY':  return `${pad2(hour)}:${pad2(minute)}`;
      case 'DAILY':     return `${pad2(day)}-${pad2(month+1)}`;
      case 'WEEKLY':    return `${pad2(day)}-${pad2(month+1)}`;
      case 'MONTHLY':   return shortMonths[month];
      case 'QUARTERLY': return `${shortMonths[month]} ${year}`;
      case 'YEARLY':    return `${year}`;
      default:          return `${year}-${pad2(month+1)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`;
    }
  };
}
