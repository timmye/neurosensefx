import { writable, derived } from 'svelte/store';

/**
 * Global workspace management store
 * Handles floating canvases, drag state, and workspace-level operations
 */

// Initial workspace state
const initialWorkspaceState = {
  canvases: new Map(), // canvasId -> canvasData
  activeCanvas: null,
  showGrid: false,
  dragState: {
    isDragging: false,
    canvasId: null,
    offset: { x: 0, y: 0 }
  }
};

export const workspaceState = writable(initialWorkspaceState);

// Derived stores for common queries
export const activeCanvas = derived(
  workspaceState,
  $workspaceState => {
    if (!$workspaceState.activeCanvas) return null;
    return $workspaceState.canvases.get($workspaceState.activeCanvas);
  }
);

export const canvasCount = derived(
  workspaceState,
  $workspaceState => $workspaceState.canvases.size
);

export const isDragging = derived(
  workspaceState,
  $workspaceState => $workspaceState.dragState.isDragging
);

// Canvas data structure
export function createCanvasData(symbol, position = { x: 100, y: 100 }) {
  const id = `canvas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id,
    symbol,
    position,
    config: null, // Will be set when canvas is initialized
    state: null,  // Will be set when canvas is initialized
    isActive: false,
    isDragging: false,
    createdAt: Date.now()
  };
}

// Workspace actions
export const workspaceActions = {
  /**
   * Add a new canvas to the workspace
   */
  addCanvas(canvasData) {
    workspaceState.update(state => {
      const newCanvases = new Map(state.canvases);
      newCanvases.set(canvasData.id, canvasData);
      
      return {
        ...state,
        canvases: newCanvases,
        activeCanvas: canvasData.id
      };
    });
  },

  /**
   * Remove a canvas from the workspace
   */
  removeCanvas(canvasId) {
    workspaceState.update(state => {
      const newCanvases = new Map(state.canvases);
      newCanvases.delete(canvasId);
      
      const newActiveCanvas = state.activeCanvas === canvasId 
        ? (newCanvases.size > 0 ? newCanvases.keys().next().value : null)
        : state.activeCanvas;
      
      return {
        ...state,
        canvases: newCanvases,
        activeCanvas: newActiveCanvas
      };
    });
  },

  /**
   * Update canvas properties
   */
  updateCanvas(canvasId, updates) {
    workspaceState.update(state => {
      const newCanvases = new Map(state.canvases);
      const existingCanvas = newCanvases.get(canvasId);
      
      if (existingCanvas) {
        newCanvases.set(canvasId, {
          ...existingCanvas,
          ...updates
        });
      }
      
      return {
        ...state,
        canvases: newCanvases
      };
    });
  },

  /**
   * Set the active canvas
   */
  setActiveCanvas(canvasId) {
    workspaceState.update(state => ({
      ...state,
      activeCanvas: canvasId
    }));
  },

  /**
   * Start dragging a canvas
   */
  startDrag(canvasId, offset) {
    workspaceState.update(state => ({
      ...state,
      dragState: {
        isDragging: true,
        canvasId,
        offset
      }
    }));
  },

  /**
   * Update canvas position during drag
   */
  updateDragPosition(newPosition) {
    workspaceState.update(state => {
      if (!state.dragState.isDragging || !state.dragState.canvasId) {
        return state;
      }
      
      const newCanvases = new Map(state.canvases);
      const existingCanvas = newCanvases.get(state.dragState.canvasId);
      
      if (existingCanvas) {
        newCanvases.set(state.dragState.canvasId, {
          ...existingCanvas,
          position: newPosition
        });
      }
      
      return {
        ...state,
        canvases: newCanvases
      };
    });
  },

  /**
   * End dragging
   */
  endDrag() {
    workspaceState.update(state => ({
      ...state,
      dragState: {
        isDragging: false,
        canvasId: null,
        offset: { x: 0, y: 0 }
      }
    }));
  },

  /**
   * Toggle grid display
   */
  toggleGrid() {
    workspaceState.update(state => ({
      ...state,
      showGrid: !state.showGrid
    }));
  },

  /**
   * Clear all canvases
   */
  clearWorkspace() {
    workspaceState.set(initialWorkspaceState);
  },

  /**
   * Get all canvases as an array
   */
  getAllCanvases() {
    let canvases = [];
    workspaceState.subscribe(state => {
      canvases = Array.from(state.canvases.values());
    })();
    return canvases;
  }
};

// Utility functions
export function getCanvasById(canvasId) {
  let canvas = null;
  workspaceState.subscribe(state => {
    canvas = state.canvases.get(canvasId);
  })();
  return canvas;
}

export function getCanvasesBySymbol(symbol) {
  let canvases = [];
  workspaceState.subscribe(state => {
    canvases = Array.from(state.canvases.values())
      .filter(canvas => canvas.symbol === symbol);
  })();
  return canvases;
}
