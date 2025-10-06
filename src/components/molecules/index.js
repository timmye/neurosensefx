// Molecular Components for NeuroSense FX
// These components combine atoms to create more complex UI elements

export { default as ConnectionIndicator } from './ConnectionIndicator.svelte';
export { default as StatusBadge } from './StatusBadge.svelte';

// Symbol-related molecules
export { default as SymbolCard } from './SymbolCard.svelte';
export { default as SymbolSearch } from './SymbolSearch.svelte';
export { default as SymbolCategory } from './SymbolCategory.svelte';
export { default as FormField } from './FormField.svelte';
export { default as DataCard } from './DataCard.svelte';
export { default as Accordion } from './Accordion.svelte';
export { default as ServiceHealthIndicator } from './ServiceHealthIndicator.svelte';
export { default as PerformanceMetrics } from './PerformanceMetrics.svelte';

// Workspace-related molecules
export { default as WorkspaceTemplate } from './WorkspaceTemplate.svelte';
export { default as WorkspaceImport } from './WorkspaceImport.svelte';

// Visualization-related molecules
export { default as IndicatorToggle } from './IndicatorToggle.svelte';
export { default as CanvasPreview } from './CanvasPreview.svelte';
export { default as ColorSchemeSelector } from './ColorSchemeSelector.svelte';
export { default as IndicatorSettings } from './IndicatorSettings.svelte';
export { default as GridSnapIndicator } from './GridSnapIndicator.svelte';
export { default as DragHandle } from './DragHandle.svelte';
export { default as ResizeHandle } from './ResizeHandle.svelte';
export { default as SelectionBox } from './SelectionBox.svelte';
export { default as ADRPulseIndicator } from './ADRPulseIndicator.svelte';
export { default as MarketFlashIndicator } from './MarketFlashIndicator.svelte';
export { default as MarketSimulationControls } from './MarketSimulationControls.svelte';

// Component metadata for programmatic access
export const MOLECULE_COMPONENTS = {
  ConnectionIndicator: {
    name: 'ConnectionIndicator',
    description: 'Real-time connection status indicator with quality metrics',
    category: 'status',
    props: {
      status: { 
        type: 'string', 
        default: 'disconnected', 
        required: false,
        options: ['connected', 'connecting', 'disconnected', 'error']
      },
      label: { type: 'string', default: '', required: false },
      showLabel: { type: 'boolean', default: true },
      size: { 
        type: 'string', 
        default: 'md', 
        options: ['sm', 'md', 'lg']
      },
      animated: { type: 'boolean', default: true },
      clickable: { type: 'boolean', default: false },
      connectionQuality: { 
        type: 'string', 
        default: null,
        options: ['excellent', 'good', 'fair', 'poor']
      },
      latency: { type: 'number', default: null },
      lastConnected: { type: 'date', default: null }
    },
    features: ['real-time-updates', 'accessibility', 'animations', 'keyboard-navigation'],
    events: ['click']
  },
  
  StatusBadge: {
    name: 'StatusBadge',
    description: 'Configurable status badge with multiple variants and animations',
    category: 'status',
    props: {
      status: { 
        type: 'string', 
        default: 'info', 
        required: false,
        options: ['success', 'info', 'warning', 'danger', 'neutral']
      },
      label: { type: 'string', default: '', required: false },
      description: { type: 'string', default: '', required: false },
      size: { 
        type: 'string', 
        default: 'md', 
        options: ['sm', 'md', 'lg']
      },
      variant: { 
        type: 'string', 
        default: 'solid', 
        options: ['solid', 'outline', 'subtle']
      },
      animated: { type: 'boolean', default: false },
      dismissible: { type: 'boolean', default: false },
      clickable: { type: 'boolean', default: false },
      icon: { type: 'string', default: null },
      count: { type: 'number', default: null },
      maxCount: { type: 'number', default: 99 }
    },
    features: ['animations', 'accessibility', 'keyboard-navigation', 'dismissibility'],
    events: ['click', 'dismiss']
  }
};

// Component categories for organization
export const MOLECULE_CATEGORIES = {
  status: ['ConnectionIndicator', 'StatusBadge']
};

// Utility functions for component management
export function getMoleculeComponentByName(name) {
  return MOLECULE_COMPONENTS[name];
}

export function getMoleculesByCategory(category) {
  const componentNames = MOLECULE_CATEGORIES[category] || [];
  return componentNames.map(name => MOLECULE_COMPONENTS[name]).filter(Boolean);
}

export function getAllMoleculeComponents() {
  return Object.values(MOLECULE_COMPONENTS);
}

export function getMoleculeCategories() {
  return Object.keys(MOLECULE_CATEGORIES);
}

// Default export with all components
export default {
  ConnectionIndicator,
  StatusBadge,
  metadata: MOLECULE_COMPONENTS,
  categories: MOLECULE_CATEGORIES,
  utils: {
    getMoleculeComponentByName,
    getMoleculesByCategory,
    getAllMoleculeComponents,
    getMoleculeCategories
  }
};
