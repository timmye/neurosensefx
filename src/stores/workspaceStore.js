/**
 * Workspace Management Store
 * Manages workspace state, canvas layout, and workspace operations
 */

import { writable, derived } from 'svelte/store';
import { stateValidator } from '../utils/stateValidation.js';
import { statePersistence, STORAGE_KEYS } from '../utils/statePersistence.js';
import { withValidation } from '../utils/stateValidation.js';

// Create default workspace
function createDefaultWorkspace() {
  const now = Date.now();
  return {
    id: `workspace_${now}`,
    name: 'Default Workspace',
    description: 'Default trading workspace',
    createdAt: now,
    updatedAt: now,
    layout: {
      canvases: [],
      gridSettings: {
        columns: 4,
        rows: 3,
        gap: 10,
        padding: 20
      },
      viewSettings: {
        zoom: 1,
        panX: 0,
        panY: 0
      }
    },
    globalSettings: {
      density: 'normal',
      theme: 'dark',
      autoSave: true,
      autoSaveInterval: 30000
    },
    symbolSubscriptions: [],
    visualizationSettings: {}
  };
}

// Initialize workspace store with default state
const initialState = createDefaultWorkspace();
const { subscribe, set, update } = writable(initialState);

// Enhanced store with workspace operations
export const workspaceStore = {
  subscribe,
  
  /**
   * Set workspace state with validation
   */
  set: (workspace) => {
    const validated = stateValidator.validateWorkspace(workspace);
    set(validated);
    return validated;
  },
  
  /**
   * Update workspace state with validation
   */
  update: (updater) => {
    update(withValidation('workspace', updater));
  },
  
  /**
   * Reset workspace to default
   */
  reset: () => {
    const defaultWorkspace = createDefaultWorkspace();
    set(defaultWorkspace);
    return defaultWorkspace;
  },
  
  /**
   * Create a new workspace
   */
  createWorkspace: (options = {}) => {
    const newWorkspace = {
      ...createDefaultWorkspace(),
      ...options,
      id: `workspace_${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const validated = stateValidator.validateWorkspace(newWorkspace);
    set(validated);
    return validated;
  },
  
  /**
   * Update workspace metadata
   */
  updateMetadata: (metadata) => {
    update(workspace => ({
      ...workspace,
      ...metadata,
      updatedAt: Date.now()
    }));
  },
  
  /**
   * Add a canvas to the workspace
   */
  addCanvas: (canvasConfig = {}) => {
    const canvas = {
      id: `canvas_${Date.now()}`,
      symbol: 'EURUSD',
      position: { x: 0, y: 0 },
      size: { width: 220, height: 120 },
      settings: {},
      indicators: [],
      isVisible: true,
      zIndex: 0,
      ...canvasConfig
    };
    
    update(workspace => ({
      ...workspace,
      layout: {
        ...workspace.layout,
        canvases: [...workspace.layout.canvases, canvas]
      },
      updatedAt: Date.now()
    }));
    
    return canvas.id;
  },
  
  /**
   * Update canvas configuration
   */
  updateCanvas: (canvasId, updates) => {
    update(workspace => ({
      ...workspace,
      layout: {
        ...workspace.layout,
        canvases: workspace.layout.canvases.map(canvas =>
          canvas.id === canvasId ? { ...canvas, ...updates } : canvas
        )
      },
      updatedAt: Date.now()
    }));
  },
  
  /**
   * Remove a canvas from the workspace
   */
  removeCanvas: (canvasId) => {
    update(workspace => ({
      ...workspace,
      layout: {
        ...workspace.layout,
        canvases: workspace.layout.canvases.filter(canvas => canvas.id !== canvasId)
      },
      updatedAt: Date.now()
    }));
  },
  
  /**
   * Move canvas to new position
   */
  moveCanvas: (canvasId, position) => {
    update(workspace => ({
      ...workspace,
      layout: {
        ...workspace.layout,
        canvases: workspace.layout.canvases.map(canvas =>
          canvas.id === canvasId ? { ...canvas, position } : canvas
        )
      },
      updatedAt: Date.now()
    }));
  },
  
  /**
   * Resize canvas
   */
  resizeCanvas: (canvasId, size) => {
    update(workspace => ({
      ...workspace,
      layout: {
        ...workspace.layout,
        canvases: workspace.layout.canvases.map(canvas =>
          canvas.id === canvasId ? { ...canvas, size } : canvas
        )
      },
      updatedAt: Date.now()
    }));
  },
  
  /**
   * Toggle canvas visibility
   */
  toggleCanvasVisibility: (canvasId) => {
    update(workspace => ({
      ...workspace,
      layout: {
        ...workspace.layout,
        canvases: workspace.layout.canvases.map(canvas =>
          canvas.id === canvasId ? { ...canvas, isVisible: !canvas.isVisible } : canvas
        )
      },
      updatedAt: Date.now()
    }));
  },
  
  /**
   * Set canvas z-index (for layering)
   */
  setCanvasZIndex: (canvasId, zIndex) => {
    update(workspace => ({
      ...workspace,
      layout: {
        ...workspace.layout,
        canvases: workspace.layout.canvases.map(canvas =>
          canvas.id === canvasId ? { ...canvas, zIndex } : canvas
        )
      },
      updatedAt: Date.now()
    }));
  },
  
  /**
   * Reorder canvases
   */
  reorderCanvases: (canvasIds) => {
    update(workspace => {
      const orderedCanvases = canvasIds.map(id =>
        workspace.layout.canvases.find(canvas => canvas.id === id)
      ).filter(Boolean);
      
      return {
        ...workspace,
        layout: {
          ...workspace.layout,
          canvases: orderedCanvases
        },
        updatedAt: Date.now()
      };
    });
  },
  
  /**
   * Update grid settings
   */
  updateGridSettings: (gridSettings) => {
    update(workspace => ({
      ...workspace,
      layout: {
        ...workspace.layout,
        gridSettings: { ...workspace.layout.gridSettings, ...gridSettings }
      },
      updatedAt: Date.now()
    }));
  },
  
  /**
   * Update view settings (zoom, pan)
   */
  updateViewSettings: (viewSettings) => {
    update(workspace => ({
      ...workspace,
      layout: {
        ...workspace.layout,
        viewSettings: { ...workspace.layout.viewSettings, ...viewSettings }
      },
      updatedAt: Date.now()
    }));
  },
  
  /**
   * Update global settings
   */
  updateGlobalSettings: (globalSettings) => {
    update(workspace => ({
      ...workspace,
      globalSettings: { ...workspace.globalSettings, ...globalSettings },
      updatedAt: Date.now()
    }));
  },
  
  /**
   * Add symbol subscription
   */
  addSymbolSubscription: (symbol) => {
    update(workspace => {
      const subscriptions = workspace.symbolSubscriptions.includes(symbol)
        ? workspace.symbolSubscriptions
        : [...workspace.symbolSubscriptions, symbol];
      
      return {
        ...workspace,
        symbolSubscriptions: subscriptions,
        updatedAt: Date.now()
      };
    });
  },
  
  /**
   * Remove symbol subscription
   */
  removeSymbolSubscription: (symbol) => {
    update(workspace => ({
      ...workspace,
      symbolSubscriptions: workspace.symbolSubscriptions.filter(s => s !== symbol),
      updatedAt: Date.now()
    }));
  },
  
  /**
   * Update visualization settings for a symbol
   */
  updateVisualizationSettings: (symbol, settings) => {
    update(workspace => ({
      ...workspace,
      visualizationSettings: {
        ...workspace.visualizationSettings,
        [symbol]: { ...workspace.visualizationSettings[symbol], ...settings }
      },
      updatedAt: Date.now()
    }));
  },
  
  /**
   * Auto-arrange canvases in grid
   */
  autoArrangeCanvases: () => {
    update(workspace => {
      const { gridSettings } = workspace.layout;
      const visibleCanvases = workspace.layout.canvases.filter(canvas => canvas.isVisible);
      
      const arrangedCanvases = visibleCanvases.map((canvas, index) => {
        const col = index % gridSettings.columns;
        const row = Math.floor(index / gridSettings.columns);
        
        return {
          ...canvas,
          position: {
            x: gridSettings.padding + col * (canvas.size.width + gridSettings.gap),
            y: gridSettings.padding + row * (canvas.size.height + gridSettings.gap)
          }
        };
      });
      
      return {
        ...workspace,
        layout: {
          ...workspace.layout,
          canvases: arrangedCanvases
        },
        updatedAt: Date.now()
      };
    });
  },
  
  /**
   * Save workspace to persistence
   */
  save: async () => {
    let currentState;
    subscribe(state => currentState = state)();
    
    try {
      const success = await statePersistence.saveState(
        STORAGE_KEYS.WORKSPACE,
        currentState,
        { validate: true }
      );
      
      if (success) {
        console.log('[workspaceStore] Workspace saved successfully');
      }
      
      return success;
    } catch (error) {
      console.error('[workspaceStore] Failed to save workspace:', error);
      return false;
    }
  },
  
  /**
   * Load workspace from persistence
   */
  load: async () => {
    try {
      const loadedState = await statePersistence.loadState(
        STORAGE_KEYS.WORKSPACE,
        { validate: true }
      );
      
      if (loadedState) {
        set(loadedState);
        console.log('[workspaceStore] Workspace loaded successfully');
        return loadedState;
      }
      
      return null;
    } catch (error) {
      console.error('[workspaceStore] Failed to load workspace:', error);
      return null;
    }
  },
  
  /**
   * Export workspace configuration
   */
  export: () => {
    let currentState;
    subscribe(state => currentState = state)();
    
    return JSON.stringify(currentState, null, 2);
  },
  
  /**
   * Import workspace configuration
   */
  import: (workspaceConfig) => {
    try {
      const config = typeof workspaceConfig === 'string' 
        ? JSON.parse(workspaceConfig) 
        : workspaceConfig;
      
      const validated = stateValidator.validateWorkspace({
        ...createDefaultWorkspace(),
        ...config,
        updatedAt: Date.now()
      });
      
      set(validated);
      console.log('[workspaceStore] Workspace imported successfully');
      return validated;
    } catch (error) {
      console.error('[workspaceStore] Failed to import workspace:', error);
      throw error;
    }
  }
};

// Derived stores for specific workspace aspects
export const canvases = derived(
  workspaceStore,
  $workspace => $workspace.layout.canvases
);

export const visibleCanvases = derived(
  canvases,
  $canvases => $canvases.filter(canvas => canvas.isVisible)
);

export const gridSettings = derived(
  workspaceStore,
  $workspace => $workspace.layout.gridSettings
);

export const viewSettings = derived(
  workspaceStore,
  $workspace => $workspace.layout.viewSettings
);

export const globalSettings = derived(
  workspaceStore,
  $workspace => $workspace.globalSettings
);

export const symbolSubscriptions = derived(
  workspaceStore,
  $workspace => $workspace.symbolSubscriptions
);

export const visualizationSettings = derived(
  workspaceStore,
  $workspace => $workspace.visualizationSettings
);

// Computed derived stores
export const canvasCount = derived(
  canvases,
  $canvases => $canvases.length
);

export const activeCanvasCount = derived(
  visibleCanvases,
  $visibleCanvases => $visibleCanvases.length
);

export const workspaceInfo = derived(
  workspaceStore,
  $workspace => ({
    id: $workspace.id,
    name: $workspace.name,
    description: $workspace.description,
    createdAt: $workspace.createdAt,
    updatedAt: $workspace.updatedAt,
    canvasCount: $workspace.layout.canvases.length,
    activeCanvasCount: $workspace.layout.canvases.filter(c => c.isVisible).length,
    subscriptionCount: $workspace.symbolSubscriptions.length
  })
);

// Canvas-specific derived stores
export const getCanvasById = (canvasId) => derived(
  canvases,
  $canvases => $canvases.find(canvas => canvas.id === canvasId)
);

export const getCanvasesBySymbol = (symbol) => derived(
  canvases,
  $canvases => $canvases.filter(canvas => canvas.symbol === symbol)
);

// Setup auto-save
workspaceStore.subscribe(async (state) => {
  if (state.globalSettings.autoSave) {
    // Debounce auto-save
    setTimeout(async () => {
      await workspaceStore.save();
    }, 1000);
  }
});

// Initialize workspace from persistence on startup
(async () => {
  try {
    const loaded = await workspaceStore.load();
    if (!loaded) {
      console.log('[workspaceStore] Using default workspace (no saved state found)');
    }
  } catch (error) {
    console.error('[workspaceStore] Failed to load saved workspace, using default:', error);
  }
})();

export default workspaceStore;
