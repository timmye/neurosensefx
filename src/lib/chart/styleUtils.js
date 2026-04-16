/**
 * Pure utility functions for chart styling — no external dependencies.
 */

import { getFadedStyles } from './fadedStyleDefaults.js';

export { getFadedStyles };

/**
 * Convert hex/rgb/rgba color string to rgba with reduced alpha.
 * @param {string} color
 * @param {number} factor — multiplier applied to the original alpha (0–1)
 * @returns {string} rgba string, or the original if format is unrecognized
 */
export function fadeColor(color, factor) {
  if (typeof color !== 'string') return color;

  const trimmed = color.trim();

  // #RRGGBB
  const hexMatch = trimmed.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hexMatch) {
    const r = parseInt(hexMatch[1], 16);
    const g = parseInt(hexMatch[2], 16);
    const b = parseInt(hexMatch[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${factor})`;
  }

  // rgb(r, g, b)
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    return `rgba(${r}, ${g}, ${b}, ${factor})`;
  }

  // rgba(r, g, b, a)
  const rgbaMatch = trimmed.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]);
    const g = Number(rgbaMatch[2]);
    const b = Number(rgbaMatch[3]);
    const a = Math.max(0, Math.min(1, Number(rgbaMatch[4]) * factor));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return color;
}

function isColorLike(str) {
  return /^#/.test(str) || /^rgba?\(/i.test(str);
}

/**
 * Recursively reduce opacity on all color properties in a KLineChart styles object.
 * Deep-clones first — never mutates the input.
 * @param {object} styles
 * @param {number} factor — multiplier applied to every color's alpha
 * @returns {object} cloned styles with faded colors
 */
export function fadeStyles(styles, factor) {
  const result = {};

  for (const key of Object.keys(styles)) {
    const value = styles[key];

    if (typeof value === 'string' && isColorLike(value)) {
      result[key] = fadeColor(value, factor);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = fadeStyles(value, factor);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Prefix a resolution badge on text-based extendData.
 * @param {*} extendData — string, { text }, or anything else
 * @param {string} resolution — e.g. 'W', '4H'
 * @returns {*} extendData with badge prefixed where applicable
 */
export function withOriginBadge(extendData, resolution) {
  if (typeof extendData === 'string') {
    const badge = `[${resolution}] `;
    return extendData.startsWith(badge) ? extendData : `${badge}${extendData}`;
  }

  if (extendData !== null && typeof extendData === 'object' && typeof extendData.text === 'string') {
    const badge = `[${resolution}] `;
    const text = extendData.text;
    return {
      ...extendData,
      text: text.startsWith(badge) ? text : `${badge}${text}`,
    };
  }

  return extendData;
}

/**
 * Return true for overlay types that only need a price coordinate
 * (no meaningful timestamp dependency).
 * @param {string} overlayType
 * @returns {boolean}
 */
export function isPriceOnlyOverlay(overlayType) {
  return (
    overlayType === 'horizontalRayLine' ||
    overlayType === 'simpleTag' ||
    overlayType === 'rulerPriceLine' ||
    overlayType === 'fibonacciLine'
  );
}
