/**
 * Enhanced UI State Store
 * Manages all UI-related state with validation and persistence
 */

import { writable, derived } from 'svelte/store';
import { stateValidator } from '../utils/stateValidation.js';
import { statePersistence, STORAGE_KEYS } from '../utils/statePersistence.js';
import { withValidation } from '../utils/stateValidation.js';

// Create default UI state
function createDefaultUIState() {
  return {
    selectedSymbol: null,
    selectedCanvas: null,
    activePanel: 'connection',
    sidebarCollapsed: false,
    sidebarWidth: 300,
    toolbarVisible: true,
    statusBarVisible: true,
    gridVisible: true,
    snapToGrid: true,
    hoverState: {
      canvasId: null,
      element: null,
      position: null,
      timestamp: null
    },
    dragState: {
      isDragging: false,
      canvasId: null,
      startPosition: null,
      currentPosition: null,
      dragType: null
    },
    modalState: {
      isOpen: false,
      type: null,
      data: null
    },
    notificationState: {
      notifications: [],
      queue: []
    },
    themeState: {
      currentTheme: 'dark',
      systemTheme: 'dark',
      autoSwitch: false
    },
    layoutState: {
      breakpoint: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true
    }
  };
}

// Initialize UI state store with default state
const initialState = createDefaultUIState();
const { subscribe, set, update } = writable(initialState);

// Enhanced store with UI operations
export const uiStateStore = {
  subscribe,
  
  /**
   * Set UI state with validation
   */
  set: (uiState) => {
    const validated = stateValidator.validateUI(uiState);
    set(validated);
    return validated;
  },
  
  /**
   * Update UI state with validation
   */
  update: (updater) => {
    update(withValidation('ui', updater));
  },
  
  /**
   * Reset UI state to default
   */
  reset: () => {
    const defaultState = createDefaultUIState();
    set(defaultState);
    return defaultState;
  },
  
  /**
   * Set selected symbol
   */
  setSelectedSymbol: (symbol) => {
    update(state => ({
      ...state,
      selectedSymbol: symbol
    }));
  },
  
  /**
   * Set selected canvas
   */
  setSelectedCanvas: (canvasId) => {
    update(state => ({
      ...state,
      selectedCanvas: canvasId
    }));
  },
  
  /**
   * Set active panel
   */
  setActivePanel: (panel) => {
    update(state => ({
      ...state,
      activePanel: panel
    }));
  },
  
  /**
   * Toggle sidebar collapsed state
   */
  toggleSidebar: () => {
    update(state => ({
      ...state,
      sidebarCollapsed: !state.sidebarCollapsed
    }));
  },
  
  /**
   * Set sidebar collapsed state
   */
  setSidebarCollapsed: (collapsed) => {
    update(state => ({
      ...state,
      sidebarCollapsed: collapsed
    }));
  },
  
  /**
   * Set sidebar width
   */
  setSidebarWidth: (width) => {
    update(state => ({
      ...state,
      sidebarWidth: Math.max(200, Math.min(500, width))
    }));
  },
  
  /**
   * Toggle toolbar visibility
   */
  toggleToolbar: () => {
    update(state => ({
      ...state,
      toolbarVisible: !state.toolbarVisible
    }));
  },
  
  /**
   * Toggle status bar visibility
   */
  toggleStatusBar: () => {
    update(state => ({
      ...state,
      statusBarVisible: !state.statusBarVisible
    }));
  },
  
  /**
   * Toggle grid visibility
   */
  toggleGrid: () => {
    update(state => ({
      ...state,
      gridVisible: !state.gridVisible
    }));
  },
  
  /**
   * Toggle snap to grid
   */
  toggleSnapToGrid: () => {
    update(state => ({
      ...state,
      snapToGrid: !state.snapToGrid
    }));
  },
  
  /**
   * Update hover state
   */
  setHoverState: (hoverState) => {
    update(state => ({
      ...state,
      hoverState: {
        ...state.hoverState,
        ...hoverState,
        timestamp: Date.now()
      }
    }));
  },
  
  /**
   * Clear hover state
   */
  clearHoverState: () => {
    update(state => ({
      ...state,
      hoverState: {
        canvasId: null,
        element: null,
        position: null,
        timestamp: null
      }
    }));
  },
  
  /**
   * Update drag state
   */
  setDragState: (dragState) => {
    update(state => ({
      ...state,
      dragState: {
        ...state.dragState,
        ...dragState
      }
    }));
  },
  
  /**
   * Start dragging
   */
  startDrag: (canvasId, startPosition, dragType = 'move') => {
    update(state => ({
      ...state,
      dragState: {
        isDragging: true,
        canvasId,
        startPosition,
        currentPosition: startPosition,
        dragType
      }
    }));
  },
  
  /**
   * Update drag position
   */
  updateDragPosition: (position) => {
    update(state => ({
      ...state,
      dragState: {
        ...state.dragState,
        currentPosition: position
      }
    }));
  },
  
  /**
   * End dragging
   */
  endDrag: () => {
    update(state => ({
      ...state,
      dragState: {
        isDragging: false,
        canvasId: null,
        startPosition: null,
        currentPosition: null,
        dragType: null
      }
    }));
  },
  
  /**
   * Open modal
   */
  openModal: (type, data = null) => {
    update(state => ({
      ...state,
      modalState: {
        isOpen: true,
        type,
        data
      }
    }));
  },
  
  /**
   * Close modal
   */
  closeModal: () => {
    update(state => ({
      ...state,
      modalState: {
        isOpen: false,
        type: null,
        data: null
      }
    }));
  },
  
  /**
   * Add notification
   */
  addNotification: (notification) => {
    const newNotification = {
      id: `notification_${Date.now()}`,
      type: 'info',
      title: '',
      message: '',
      duration: 5000,
      persistent: false,
      timestamp: Date.now(),
      ...notification
    };
    
    update(state => ({
      ...state,
      notificationState: {
        ...state.notificationState,
        notifications: [...state.notificationState.notifications, newNotification]
      }
    }));
    
    // Auto-remove non-persistent notifications
    if (!newNotification.persistent && newNotification.duration > 0) {
      setTimeout(() => {
        uiStateStore.removeNotification(newNotification.id);
      }, newNotification.duration);
    }
    
    return newNotification.id;
  },
  
  /**
   * Remove notification
   */
  removeNotification: (notificationId) => {
    update(state => ({
      ...state,
      notificationState: {
        ...state.notificationState,
        notifications: state.notificationState.notifications.filter(
          n => n.id !== notificationId
        )
      }
    }));
  },
  
  /**
   * Clear all notifications
   */
  clearNotifications: () => {
    update(state => ({
      ...state,
      notificationState: {
        ...state.notificationState,
        notifications: []
      }
    }));
  },
  
  /**
   * Update theme
   */
  setTheme: (theme) => {
    update(state => ({
      ...state,
      themeState: {
        ...state.themeState,
        currentTheme: theme
      }
    }));
  },
  
  /**
   * Set system theme
   */
  setSystemTheme: (theme) => {
    update(state => ({
      ...state,
      themeState: {
        ...state.themeState,
        systemTheme: theme
      }
    }));
  },
  
  /**
   * Toggle auto theme switching
   */
  toggleAutoTheme: () => {
    update(state => ({
      ...state,
      themeState: {
        ...state.themeState,
        autoSwitch: !state.themeState.autoSwitch
      }
    }));
  },
  
  /**
   * Update layout state
   */
  setLayoutState: (layoutState) => {
    update(state => ({
      ...state,
      layoutState: {
        ...state.layoutState,
        ...layoutState
      }
    }));
  },
  
  /**
   * Update breakpoint
   */
  setBreakpoint: (breakpoint) => {
    const isMobile = breakpoint === 'mobile';
    const isTablet = breakpoint === 'tablet';
    const isDesktop = breakpoint === 'desktop';
    
    update(state => ({
      ...state,
      layoutState: {
        ...state.layoutState,
        breakpoint,
        isMobile,
        isTablet,
        isDesktop
      }
    }));
  },
  
  /**
   * Save UI state to persistence
   */
  save: async () => {
    let currentState;
    subscribe(state => currentState = state)();
    
    try {
      const success = await statePersistence.saveState(
        STORAGE_KEYS.UI_STATE,
        currentState,
        { validate: true }
      );
      
      if (success) {
        console.log('[uiStateStore] UI state saved successfully');
      }
      
      return success;
    } catch (error) {
      console.error('[uiStateStore] Failed to save UI state:', error);
      return false;
    }
  },
  
  /**
   * Load UI state from persistence
   */
  load: async () => {
    try {
      const loadedState = await statePersistence.loadState(
        STORAGE_KEYS.UI_STATE,
        { validate: true }
      );
      
      if (loadedState) {
        set(loadedState);
        console.log('[uiStateStore] UI state loaded successfully');
        return loadedState;
      }
      
      return null;
    } catch (error) {
      console.error('[uiStateStore] Failed to load UI state:', error);
      return null;
    }
  }
};

// Derived stores for specific UI aspects
export const selectedSymbol = derived(
  uiStateStore,
  $uiState => $uiState.selectedSymbol
);

export const selectedCanvas = derived(
  uiStateStore,
  $uiState => $uiState.selectedCanvas
);

export const activePanel = derived(
  uiStateStore,
  $uiState => $uiState.activePanel
);

export const sidebarCollapsed = derived(
  uiStateStore,
  $uiState => $uiState.sidebarCollapsed
);

export const sidebarWidth = derived(
  uiStateStore,
  $uiState => $uiState.sidebarWidth
);

export const toolbarVisible = derived(
  uiStateStore,
  $uiState => $uiState.toolbarVisible
);

export const statusBarVisible = derived(
  uiStateStore,
  $uiState => $uiState.statusBarVisible
);

export const gridVisible = derived(
  uiStateStore,
  $uiState => $uiState.gridVisible
);

export const snapToGrid = derived(
  uiStateStore,
  $uiState => $uiState.snapToGrid
);

export const hoverState = derived(
  uiStateStore,
  $uiState => $uiState.hoverState
);

export const dragState = derived(
  uiStateStore,
  $uiState => $uiState.dragState
);

export const modalState = derived(
  uiStateStore,
  $uiState => $uiState.modalState
);

export const notifications = derived(
  uiStateStore,
  $uiState => $uiState.notificationState.notifications
);

export const unreadNotifications = derived(
  notifications,
  $notifications => $notifications.filter(n => !n.read)
);

export const themeState = derived(
  uiStateStore,
  $uiState => $uiState.themeState
);

export const currentTheme = derived(
  themeState,
  $themeState => $themeState.currentTheme
);

export const layoutState = derived(
  uiStateStore,
  $uiState => $uiState.layoutState
);

export const isMobile = derived(
  layoutState,
  $layoutState => $layoutState.isMobile
);

export const isTablet = derived(
  layoutState,
  $layoutState => $layoutState.isTablet
);

export const isDesktop = derived(
  layoutState,
  $layoutState => $layoutState.isDesktop
);

// Computed derived stores
export const isDragging = derived(
  dragState,
  $dragState => $dragState.isDragging
);

export const hasActiveModal = derived(
  modalState,
  $modalState => $modalState.isOpen
);

export const notificationCount = derived(
  notifications,
  $notifications => $notifications.length
);

export const hasUnreadNotifications = derived(
  unreadNotifications,
  $unreadNotifications => $unreadNotifications.length > 0
);

// Responsive behavior
export const effectiveSidebarWidth = derived(
  [sidebarWidth, sidebarCollapsed, isMobile],
  ([$sidebarWidth, $sidebarCollapsed, $isMobile]) => {
    if ($isMobile) return 0;
    return $sidebarCollapsed ? 60 : $sidebarWidth;
  }
);

// Setup auto-save for UI state
uiStateStore.subscribe(async (state) => {
  // Debounce auto-save
  setTimeout(async () => {
    await uiStateStore.save();
  }, 2000);
});

// Initialize UI state from persistence on startup
(async () => {
  try {
    const loaded = await uiStateStore.load();
    if (!loaded) {
      console.log('[uiStateStore] Using default UI state (no saved state found)');
    }
  } catch (error) {
    console.error('[uiStateStore] Failed to load saved UI state, using default:', error);
  }
})();

// Detect system theme changes
if (typeof window !== 'undefined' && window.matchMedia) {
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleThemeChange = (e) => {
    uiStateStore.setSystemTheme(e.matches ? 'dark' : 'light');
  };
  
  // Set initial system theme
  handleThemeChange(darkModeQuery);
  
  // Listen for changes
  darkModeQuery.addEventListener('change', handleThemeChange);
}

export default uiStateStore;
