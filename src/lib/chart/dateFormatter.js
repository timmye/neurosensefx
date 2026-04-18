/**
 * Shared timezone-aware date formatting utilities.
 * Caches Intl.DateTimeFormat instances per timezone to avoid GC pressure.
 */

// Cache Intl.DateTimeFormat instances per timezone
const formatterCache = new Map();

/**
 * Get a cached Intl.DateTimeFormat for the given timezone.
 * @param {string} tz - IANA timezone string
 * @returns {Intl.DateTimeFormat}
 */
export function getFormatter(tz) {
  if (formatterCache.has(tz)) return formatterCache.get(tz);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  formatterCache.set(tz, fmt);
  return fmt;
}

/**
 * Format a timestamp into localized date/time parts using Intl.DateTimeFormat.
 * @param {number} timestamp - UTC epoch timestamp
 * @param {string} tz - IANA timezone string
 * @returns {{ year: string, month: string, day: string, hour: string, minute: string, monthPad: string, dayPad: string }}
 */
export function getLocalizedParts(timestamp, tz) {
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
