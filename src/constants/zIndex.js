/**
 * Z-Index hierarchy for all floating elements in NeuroSense FX
 * Ensures consistent layering across all floating panels and elements
 */

export const Z_INDEX_LEVELS = {
  BACKGROUND: 1,              // Workspace container
  FLOATING_BASE: 1000,        // Base for floating panels layer
  SYMBOL_PALETTE: 1001,       // FloatingSymbolPalette
  DEBUG_PANEL: 1002,          // FloatingDebugPanel
  SYSTEM_PANEL: 1003,         // FloatingSystemPanel
  ADR_PANEL: 1004,            // FloatingMultiSymbolADR
  FLOATING_CANVAS_BASE: 2000, // Base for floating canvases
  DRAGGING: 9999,             // Any element being dragged
  CONTEXT_MENU: 10000         // CanvasContextMenu (always on top)
};

/**
 * Get z-index for a specific floating element type
 * @param {string} elementType - The type of floating element
 * @returns {number} The z-index value
 */
export function getZIndex(elementType) {
  return Z_INDEX_LEVELS[elementType] || Z_INDEX_LEVELS.FLOATING_BASE;
}

/**
 * Get z-index for a floating canvas with dynamic layering
 * @param {number} canvasIndex - The index of the canvas (for layering)
 * @returns {number} The z-index value
 */
export function getCanvasZIndex(canvasIndex = 0) {
  return Z_INDEX_LEVELS.FLOATING_CANVAS_BASE + canvasIndex;
}

/**
 * Get z-index for dragging state (highest priority)
 * @returns {number} The dragging z-index value
 */
export function getDraggingZIndex() {
  return Z_INDEX_LEVELS.DRAGGING;
}