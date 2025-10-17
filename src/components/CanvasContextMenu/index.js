/**
 * CanvasContextMenu Module Index
 * Exports all utilities, components, and types for the enhanced CanvasContextMenu
 */

// Parameter grouping utilities
export {
  quickActionsGroup,
  priceDisplayGroup,
  marketProfileGroup,
  volatilityGroup,
  layoutSizingGroup,
  advancedGroup,
  parameterGroups,
  getAllParameters,
  getParameterGroup,
  getParameterMetadata,
  getParametersByType,
  getParameterCountByGroup,
  validateParameterCoverage
} from './utils/parameterGroups.js';

// Search utilities
export {
  fuzzyMatch,
  searchParameters,
  filterByGroup,
  filterByControlType,
  getParameterSuggestions,
  getSearchStats,
  advancedSearch,
  createSearchIndex,
  searchIndex
} from './utils/searchUtils.js';

// Import highlightMatch directly from the source
export { highlightMatch } from '../utils/fuzzySearch.js';

// Keyboard shortcuts utilities
export {
  defaultShortcuts,
  normalizeKeyCombo,
  parseKeyEvent,
  matchesShortcut,
  findMatchingShortcut,
  createShortcutHandler,
  getShortcutList,
  getGroupedShortcuts,
  validateShortcuts,
  createShortcutsManager
} from './utils/keyboardShortcuts.js';

// Validation utilities
export {
  validateParameterGroups
} from './utils/parameterValidation.js';

// Tab components
export { default as QuickActionsTab } from './tabs/QuickActionsTab.svelte';
export { default as PriceDisplayTab } from './tabs/PriceDisplayTab.svelte';
export { default as MarketProfileTab } from './tabs/MarketProfileTab.svelte';
export { default as VolatilityTab } from './tabs/VolatilityTab.svelte';
export { default as LayoutSizingTab } from './tabs/LayoutSizingTab.svelte';
export { default as AdvancedTab } from './tabs/AdvancedTab.svelte';

// Control components
export { default as ToggleControl } from './controls/ToggleControl.svelte';
export { default as RangeControl } from './controls/RangeControl.svelte';
export { default as ColorControl } from './controls/ColorControl.svelte';
export { default as SelectControl } from './controls/SelectControl.svelte';

// Constants
export const TAB_IDS = {
  QUICK_ACTIONS: 'quickActions',
  PRICE_DISPLAY: 'priceDisplay',
  MARKET_PROFILE: 'marketProfile',
  VOLATILITY: 'volatility',
 _LAYOUT_SIZING: 'layoutSizing',
  ADVANCED: 'advanced'
};

export const CONTROL_TYPES = {
  TOGGLE: 'toggle',
  RANGE: 'range',
  COLOR: 'color',
  SELECT: 'select'
};

// Helper function to get tab component by ID
export const getTabComponent = (tabId) => {
  const tabComponents = {
    [TAB_IDS.QUICK_ACTIONS]: () => import('./tabs/QuickActionsTab.svelte'),
    [TAB_IDS.PRICE_DISPLAY]: () => import('./tabs/PriceDisplayTab.svelte'),
    [TAB_IDS.MARKET_PROFILE]: () => import('./tabs/MarketProfileTab.svelte'),
    [TAB_IDS.VOLATILITY]: () => import('./tabs/VolatilityTab.svelte'),
    [TAB_IDS._LAYOUT_SIZING]: () => import('./tabs/LayoutSizingTab.svelte'),
    [TAB_IDS.ADVANCED]: () => import('./tabs/AdvancedTab.svelte')
  };
  
  return tabComponents[tabId];
};

// Helper function to get control component by type
export const getControlComponent = (controlType) => {
  const controlComponents = {
    [CONTROL_TYPES.TOGGLE]: () => import('./controls/ToggleControl.svelte'),
    [CONTROL_TYPES.RANGE]: () => import('./controls/RangeControl.svelte'),
    [CONTROL_TYPES.COLOR]: () => import('./controls/ColorControl.svelte'),
    [CONTROL_TYPES.SELECT]: () => import('./controls/SelectControl.svelte')
  };
  
  return controlComponents[controlType];
};