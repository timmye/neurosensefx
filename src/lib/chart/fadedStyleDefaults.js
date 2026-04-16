/**
 * Faded defaults for KLineChart overlay nested style keys.
 *
 * When a drawing stores {} (no explicit colors), fadeStyles({}) returns {},
 * so the overlay renders at full opacity using chart defaults.
 * These faded defaults ensure ALL color properties have a faded value.
 *
 * Based on chartThemeLight.js overlay defaults:
 *   line/arc: color #48752c
 *   rect/polygon/circle: color rgba(72,117,44,0.12), borderColor #48752c
 *   point: color #48752c, borderColor rgba(72,117,44,0.35)
 *   text: color #FFFFFF, backgroundColor #48752c, borderColor #48752c
 *
 * @module fadedStyleDefaults
 */

import { fadeStyles } from './styleUtils.js';

const FADED_LINE = { color: 'rgba(72, 117, 44, 0.5)' };

const FADED_TEXT = {
  color: 'rgba(255, 255, 255, 0.5)',
  backgroundColor: 'rgba(72, 117, 44, 0.5)',
  borderColor: 'rgba(72, 117, 44, 0.5)',
};

const FADED_POINT = {
  color: 'rgba(72, 117, 44, 0.5)',
  borderColor: 'rgba(72, 117, 44, 0.175)',
};

const FADED_SHAPE = {
  color: 'rgba(72, 117, 44, 0.06)',
  borderColor: 'rgba(72, 117, 44, 0.5)',
};

const FADED_DEFAULTS = {
  line: FADED_LINE,
  text: FADED_TEXT,
  rectText: FADED_TEXT,
  rect: FADED_SHAPE,
  polygon: FADED_SHAPE,
  circle: FADED_SHAPE,
  arc: FADED_LINE,
  point: FADED_POINT,
};

/**
 * Return a styles object with faded colors, ensuring all nested style keys
 * have faded values even when the input styles is empty or missing colors.
 * @param {object} styles — the drawing's stored styles (may be {})
 * @param {number} factor — opacity multiplier (0–1)
 * @returns {object} styles with faded colors for all known keys
 */
export function getFadedStyles(styles, factor) {
  const faded = styles ? fadeStyles(styles, factor) : {};
  const result = {};
  for (const key of Object.keys(FADED_DEFAULTS)) {
    result[key] = { ...FADED_DEFAULTS[key], ...(faded[key] || {}) };
  }
  for (const key of Object.keys(faded)) {
    if (!(key in result)) result[key] = faded[key];
  }
  return result;
}
