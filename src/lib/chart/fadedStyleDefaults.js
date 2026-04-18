/**
 * Faded defaults for KLineChart overlay nested style keys.
 *
 * When a drawing stores {} (no explicit colors), fadeStyles({}) returns {},
 * so the overlay renders at full opacity using chart defaults.
 * These faded defaults ensure ALL color properties have a faded value.
 *
 * Colors are computed at call-time from the current theme to ensure
 * overlays match the active light/dark palette.
 *
 * @module fadedStyleDefaults
 */

import { fadeStyles } from './styleUtils.js';
import { get } from 'svelte/store';
import { themeStore } from '../../stores/themeStore.js';

function makeFadedDefaults() {
  const isDark = get(themeStore) === 'dark';
  const base = isDark ? '38, 166, 154' : '72, 117, 44';
  return {
    line: { color: `rgba(${base}, 0.5)` },
    text: {
      color: 'rgba(255, 255, 255, 0.5)',
      backgroundColor: `rgba(${base}, 0.5)`,
      borderColor: `rgba(${base}, 0.5)`,
    },
    rectText: {
      color: 'rgba(255, 255, 255, 0.5)',
      backgroundColor: `rgba(${base}, 0.5)`,
      borderColor: `rgba(${base}, 0.5)`,
    },
    rect: {
      color: `rgba(${base}, 0.05)`,
      borderColor: `rgba(${base}, 0.5)`,
    },
    polygon: {
      color: `rgba(${base}, 0.05)`,
      borderColor: `rgba(${base}, 0.5)`,
    },
    circle: {
      color: `rgba(${base}, 0.05)`,
      borderColor: `rgba(${base}, 0.5)`,
    },
    arc: { color: `rgba(${base}, 0.5)` },
    point: {
      color: `rgba(${base}, 0.5)`,
      borderColor: `rgba(${base}, 0.175)`,
    },
  };
}

/**
 * Return a styles object with faded colors, ensuring all nested style keys
 * have faded values even when the input styles is empty or missing colors.
 * @param {object} styles — the drawing's stored styles (may be {})
 * @param {number} factor — opacity multiplier (0–1)
 * @returns {object} styles with faded colors for all known keys
 */
export function getFadedStyles(styles, factor) {
  const faded = styles ? fadeStyles(styles, factor) : {};
  const defaults = makeFadedDefaults();
  const result = {};
  for (const key of Object.keys(defaults)) {
    result[key] = { ...defaults[key], ...(faded[key] || {}) };
  }
  for (const key of Object.keys(faded)) {
    if (!(key in result)) result[key] = faded[key];
  }
  return result;
}
