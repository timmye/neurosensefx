/**
 * QuickRuler positioning utilities.
 *
 * @module rulerPosition
 */

/**
 * Compute pixel offset of a mouse event relative to a container.
 * @param {HTMLElement} container
 * @param {MouseEvent} e
 * @returns {{ x: number, y: number }}
 */
export function getPixelOffset(container, e) {
  const rect = container.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

/**
 * Compute CSS style string for the ruler data window tooltip,
 * keeping it within the container bounds.
 * @param {boolean} active
 * @param {HTMLElement|null} container
 * @param {{ x: number, y: number }} cursor
 * @param {string} bgColor
 * @param {string} textColor
 * @returns {string}
 */
export function computeDataWindowStyle(active, container, cursor, bgColor, textColor) {
  if (!active) return 'display: none;';
  const rect = container?.getBoundingClientRect();
  if (!rect) return 'display: none.';

  let left = cursor.x;
  let top = cursor.y;
  if (left + 160 > rect.width) left = cursor.x - 160;
  if (top + 120 > rect.height) top = cursor.y - 120;

  return `position: absolute; left: ${left}px; top: ${top}px; background: ${bgColor}; color: ${textColor}; font-size: 12px; padding: 4px 8px; border-radius: 3px; pointer-events: none; white-space: nowrap; opacity: 0.92; z-index: 5;`;
}
