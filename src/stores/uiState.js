import { writable, derived } from 'svelte/store';

/**
 * UI interaction state store
 * Handles hover states, context menus, and other UI-level interactions
 */


// Hover state for canvas interactions
export const hoverState = writable({
  x: 0,
  y: 0,
  price: 0,
  active: false
});

// Initial UI state
const initialUIState = {
  activeCanvas: null,
  hoveredCanvas: null,
  contextMenuOpen: false,
  menuPosition: { x: 0, y: 0 },
  floatingSymbolPaletteOpen: true,    // Changed from false
  floatingSymbolPalettePosition: { x: 400, y: 20 }, // Top center
  floatingDebugPanelOpen: true,       // Changed from false
  floatingDebugPanelPosition: { x: 680, y: 200 }, // Middle right
  floatingSystemPanelOpen: true,      // Changed from false
  floatingSystemPanelPosition: { x: 680, y: 20 }, // Top right
  floatingADRPanelOpen: true,         // Changed from false
  floatingADRPanelPosition: { x: 20, y: 20 }, // Top left
  addDisplayMenuOpen: false,
  addDisplayMenuPosition: { x: 0, y: 0 },
  keyboardShortcuts: {
    enabled: true,
    helpVisible: false
  }
};

export const uiState = writable(initialUIState);

// Derived stores for common UI queries
export const isAnyMenuOpen = derived(
  uiState,
  $uiState => $uiState.contextMenuOpen || $uiState.floatingSymbolPaletteOpen || $uiState.floatingDebugPanelOpen || $uiState.floatingSystemPanelOpen || $uiState.floatingADRPanelOpen
);

export const activeCanvasId = derived(
  uiState,
  $uiState => $uiState.activeCanvas
);

export const hoveredCanvasId = derived(
  uiState,
  $uiState => $uiState.hoveredCanvas
);

// UI actions
export const uiActions = {
  /**
   * Set the active canvas (focused canvas)
   */
  setActiveCanvas(canvasId) {
    uiState.update(state => ({
      ...state,
      activeCanvas: canvasId
    }));
  },

  /**
   * Set the hovered canvas
   */
  setHoveredCanvas(canvasId) {
    uiState.update(state => ({
      ...state,
      hoveredCanvas: canvasId
    }));
  },

  /**
   * Clear hover state
   */
  clearHover() {
    uiState.update(state => ({
      ...state,
      hoveredCanvas: null
    }));
  },

  /**
   * Show context menu for a canvas
   */
  showContextMenu(position, canvasId = null) {
    uiState.update(state => ({
      ...state,
      activeCanvas: canvasId,
      contextMenuOpen: true,
      menuPosition: position
    }));
  },

  /**
   * Hide context menu
   */
  hideContextMenu() {
    uiState.update(state => ({
      ...state,
      contextMenuOpen: false,
      menuPosition: { x: 0, y: 0 }
    }));
  },


  /**
   * Show floating symbol palette
   */
  showFloatingSymbolPalette(position) {
    uiState.update(state => ({
      ...state,
      floatingSymbolPaletteOpen: true,
      floatingSymbolPalettePosition: position,
      // Close context menu
      contextMenuOpen: false
    }));
  },

  /**
   * Hide floating symbol palette
   */
  hideFloatingSymbolPalette() {
    uiState.update(state => ({
      ...state,
      floatingSymbolPaletteOpen: false,
      floatingSymbolPalettePosition: { x: 100, y: 100 }
    }));
  },

  /**
   * Toggle floating symbol palette
   */
  toggleFloatingSymbolPalette() {
    uiState.update(state => ({
      ...state,
      floatingSymbolPaletteOpen: !state.floatingSymbolPaletteOpen,
      // Close context menu
      contextMenuOpen: false
    }));
  },

  /**
   * Show floating debug panel
   */
  showFloatingDebugPanel(position) {
    uiState.update(state => ({
      ...state,
      floatingDebugPanelOpen: true,
      floatingDebugPanelPosition: position,
      // Close context menu
      contextMenuOpen: false
    }));
  },

  /**
   * Hide floating debug panel
   */
  hideFloatingDebugPanel() {
    uiState.update(state => ({
      ...state,
      floatingDebugPanelOpen: false,
      floatingDebugPanelPosition: { x: 500, y: 100 }
    }));
  },

  /**
   * Toggle floating debug panel
   */
  toggleFloatingDebugPanel() {
    uiState.update(state => ({
      ...state,
      floatingDebugPanelOpen: !state.floatingDebugPanelOpen,
      // Close context menu
      contextMenuOpen: false
    }));
  },

  /**
   * Show floating system panel
   */
  showFloatingSystemPanel(position) {
    uiState.update(state => ({
      ...state,
      floatingSystemPanelOpen: true,
      floatingSystemPanelPosition: position,
      // Close context menu
      contextMenuOpen: false
    }));
  },

  /**
   * Hide floating system panel
   */
  hideFloatingSystemPanel() {
    uiState.update(state => ({
      ...state,
      floatingSystemPanelOpen: false,
      floatingSystemPanelPosition: { x: 300, y: 100 }
    }));
  },

  /**
   * Toggle floating system panel
   */
  toggleFloatingSystemPanel() {
    uiState.update(state => ({
      ...state,
      floatingSystemPanelOpen: !state.floatingSystemPanelOpen,
      // Close context menu
      contextMenuOpen: false
    }));
  },

  /**
   * Show floating ADR panel
   */
  showFloatingADRPanel(position) {
    uiState.update(state => ({
      ...state,
      floatingADRPanelOpen: true,
      floatingADRPanelPosition: position,
      // Close context menu
      contextMenuOpen: false
    }));
  },

  /**
   * Hide floating ADR panel
   */
  hideFloatingADRPanel() {
    uiState.update(state => ({
      ...state,
      floatingADRPanelOpen: false,
      floatingADRPanelPosition: { x: 100, y: 100 }
    }));
  },

  /**
   * Toggle floating ADR panel
   */
  toggleFloatingADRPanel() {
    uiState.update(state => ({
      ...state,
      floatingADRPanelOpen: !state.floatingADRPanelOpen,
      // Close context menu
      contextMenuOpen: false
    }));
  },

  /**
   * Hide all menus
   */
  hideAllMenus() {
    uiState.update(state => ({
      ...state,
      contextMenuOpen: false,
      menuPosition: { x: 0, y: 0 }
      // Don't reset floating panel open states - let users control these
      // Don't reset floating panel positions - let users control these
    }));
  },

  /**
   * Show add display menu
   */
  showAddDisplayMenu(position) {
    uiState.update(state => ({
      ...state,
      addDisplayMenuOpen: true,
      addDisplayMenuPosition: position,
      // Close context menu
      contextMenuOpen: false
    }));
  },

  /**
   * Hide add display menu
   */
  hideAddDisplayMenu() {
    uiState.update(state => ({
      ...state,
      addDisplayMenuOpen: false,
      addDisplayMenuPosition: { x: 0, y: 0 }
    }));
  },

  /**
   * Toggle keyboard shortcuts help
   */
  toggleKeyboardHelp() {
    uiState.update(state => ({
      ...state,
      keyboardShortcuts: {
        ...state.keyboardShortcuts,
        helpVisible: !state.keyboardShortcuts.helpVisible
      }
    }));
  },

  /**
   * Enable/disable keyboard shortcuts
   */
  setKeyboardShortcuts(enabled) {
    uiState.update(state => ({
      ...state,
      keyboardShortcuts: {
        ...state.keyboardShortcuts,
        enabled
      }
    }));
  },

  /**
   * Reset UI state to initial
   */
  reset() {
    uiState.set(initialUIState);
  },
  
  /**
   * Set the hovered canvas
   */
  setCanvasHovered(canvasId) {
    uiState.update(state => ({
      ...state,
      hoveredCanvas: canvasId
    }));
  },
  
  /**
   * Clear canvas hover state
   */
  clearCanvasHovered() {
    uiState.update(state => ({
      ...state,
      hoveredCanvas: null
    }));
  }
};

// Utility functions
export function isCanvasActive(canvasId) {
  let activeId = null;
  uiState.subscribe(state => {
    activeId = state.activeCanvas;
  })();
  return activeId === canvasId;
}

export function isCanvasHovered(canvasId) {
  let hoveredId = null;
  uiState.subscribe(state => {
    hoveredId = state.hoveredCanvas;
  })();
  return hoveredId === canvasId;
}

export function getMenuPosition() {
  let position = { x: 0, y: 0 };
  uiState.subscribe(state => {
    position = state.menuPosition;
  })();
  return position;
}


export function getFloatingSymbolPalettePosition() {
  let position = { x: 100, y: 100 };
  uiState.subscribe(state => {
    position = state.floatingSymbolPalettePosition;
  })();
  return position;
}

export function getFloatingDebugPanelPosition() {
  let position = { x: 500, y: 100 };
  uiState.subscribe(state => {
    position = state.floatingDebugPanelPosition;
  })();
  return position;
}

export function getFloatingSystemPanelPosition() {
  let position = { x: 300, y: 100 };
  uiState.subscribe(state => {
    position = state.floatingSystemPanelPosition;
  })();
  return position;
}

export function getFloatingADRPanelPosition() {
  let position = { x: 100, y: 100 };
  uiState.subscribe(state => {
    position = state.floatingADRPanelPosition;
  })();
  return position;
}
