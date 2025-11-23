/**
 * NeuroSense FX Three-Layer Display Management System
 *
 * Manages z-index allocation for proper UI layering and focus states.
 * Three-tier hierarchy prevents visual conflicts and ensures predictable rendering.
 */

// === THREE-LAYER DISPLAY SYSTEM ===
// Layer 1: Trading displays (z-index: 1-999)
// Layer 2: UI panels (z-index: 1000-9999)
// Layer 3: Overlays (z-index: 10000+)

export const Z_INDEX_LEVELS = {
  // Layer 1: Trading Display Canvas Elements (z-index: 1-999)
  BACKGROUND: 1,              // Workspace container background

  // Layer 2: UI Panel System (z-index: 1000-9999)
  FLOATING_BASE: 1000,        // Base for floating panels layer
  SYMBOL_PALETTE: 1001,       // Symbol search panel
  DEBUG_PANEL: 1002,          // Development debug panel
  SYSTEM_PANEL: 1003,         // System status panel
  ADR_PANEL: 1004,            // ADR multi-symbol panel
  FLOATING_CANVAS_BASE: 2000, // Base for floating canvas displays

  // Layer 3: Overlay System (z-index: 10000+)
  DRAGGING: 9999,             // Any element being dragged (temporary)
  CONTEXT_MENU: 10000         // Context menu (always on top)
};

// === Z-INDEX ALLOCATION FUNCTIONS ===

/**
 * Get z-index for UI panel by type.
 * Returns layer 2 values (1000-9999) for panel hierarchy.
 *
 * Usage:
 *   getZIndex('SYMBOL_PALETTE')  // Returns 1001
 *   getZIndex('SYSTEM_PANEL')    // Returns 1003
 */
export function getZIndex(elementType) {
  return Z_INDEX_LEVELS[elementType] || Z_INDEX_LEVELS.FLOATING_BASE;
}

/**
 * Get z-index for trading canvas display.
 * Uses dynamic layering within layer 1 range.
 *
 * Usage:
 *   getCanvasZIndex(0)  // Returns 2000
 *   getCanvasZIndex(1)  // Returns 2001
 */
export function getCanvasZIndex(canvasIndex = 0) {
  return Z_INDEX_LEVELS.FLOATING_CANVAS_BASE + canvasIndex;
}

/**
 * Get temporary z-index for dragging state.
 * Elevates element to layer 3 for drag operations.
 *
 * Usage:
 *   getDraggingZIndex()  // Returns 9999
 */
export function getDraggingZIndex() {
  return Z_INDEX_LEVELS.DRAGGING;
}

// === LAYER MANAGEMENT STRATEGY ===
//
// Layer Allocation Patterns:
// • Layer 1 (1-999): Trading displays, market data canvases
// • Layer 2 (1000-9999): UI panels, system controls, palettes
// • Layer 3 (10000+): Context menus, dragging states, notifications
//
// Dynamic Focus Handling:
// • displayActions.bringToFront() manages z-index updates
// • Use getDraggingZIndex() during drag operations
// • Context menu always uses CONTEXT_MENU level
//
// Conflict Prevention:
// • Each element type has predefined z-index range
// • Dynamic allocation only within assigned layers
// • Temporary states (dragging) use reserved high values