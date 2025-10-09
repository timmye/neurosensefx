/**
 * Unified Store Entry Point
 * Provides centralized access to all state management stores
 */

// Basic stores (from Chunk 1.3 specifications)
export { connectionStore, isConnected } from './connectionStore.js';
export { symbolStore, selectedSymbolData } from '../data/symbolStore.js';
export { uiStateStore } from './uiStateStore.js';

// Core stores
export { workspaceStore, canvases, visibleCanvases, gridSettings, viewSettings, globalSettings, symbolSubscriptions, visualizationSettings, canvasCount, activeCanvasCount, workspaceInfo, getCanvasById, getCanvasesBySymbol } from './workspaceStore.js';

// Legacy stores (enhanced)
export { default as configStore } from './configStore.js';
export { default as markerStore } from './markerStore.js';

// Enhanced UI state store
export { selectedSymbol, selectedCanvas, activePanel, sidebarCollapsed, sidebarWidth, toolbarVisible, statusBarVisible, gridVisible, snapToGrid, hoverState, dragState } from './enhancedUIState.js';

// Performance monitoring store
export { performanceStore, performanceMetrics, performanceAlerts, performanceThresholds, isPerformanceHealthy } from './performanceStore.js';

// Data layer integration store
export { dataIntegrationStore, dataSyncStatus, dataQualityMetrics, dataConnectionStatus } from './dataIntegrationStore.js';

// Store utilities
export { storeManager, createPersistentStore, createDerivedStore, createComputedStore } from './storeUtils.js';

// Store composition
export { applicationStore, appState, appInfo, isAppHealthy } from './applicationStore.js';

// Re-export legacy stores for compatibility
export { vizConfig } from './configStore.js';
export { selectedSymbol as legacySelectedSymbol, hoverState as legacyHoverState } from './uiState.js';
export { vizState } from './symbolStateStore.js';

// Default export with all stores
export default {
  // Core stores
  workspaceStore,
  configStore,
  markerStore,
  uiStateStore,
  performanceStore,
  dataIntegrationStore,
  applicationStore,
  
  // Derived stores
  canvases,
  visibleCanvases,
  gridSettings,
  viewSettings,
  globalSettings,
  symbolSubscriptions,
  visualizationSettings,
  canvasCount,
  activeCanvasCount,
  workspaceInfo,
  selectedSymbol,
  selectedCanvas,
  activePanel,
  sidebarCollapsed,
  sidebarWidth,
  toolbarVisible,
  statusBarVisible,
  gridVisible,
  snapToGrid,
  hoverState,
  dragState,
  performanceMetrics,
  performanceAlerts,
  performanceThresholds,
  isPerformanceHealthy,
  dataSyncStatus,
  dataQualityMetrics,
  dataConnectionStatus,
  appState,
  appInfo,
  isAppHealthy,
  
  // Utilities
  storeManager,
  createPersistentStore,
  createDerivedStore,
  createComputedStore,
  
  // Legacy compatibility
  vizConfig,
  legacySelectedSymbol,
  legacyHoverState,
  vizState,
  
  // Helper functions
  getCanvasById,
  getCanvasesBySymbol
};
