// Organism Components for NeuroSense FX
// These components combine molecules and atoms to create complex, feature-complete UI sections

export { default as ConnectionStatusPanel } from './panels/ConnectionStatusPanel.svelte';
export { default as ServiceStatusPanel } from './panels/ServiceStatusPanel.svelte';
export { default as WorkspaceSettingsPanel } from './panels/WorkspaceSettingsPanel.svelte';
export { default as CanvasSettingsPanel } from './panels/CanvasSettingsPanel.svelte';
export { default as VisualizationSettingsPanel } from './panels/VisualizationSettingsPanel.svelte';
export { default as SymbolSelector } from './SymbolSelector.svelte';
export { default as FormGroup } from './FormGroup.svelte';
export { default as DataTable } from './DataTable.svelte';
export { default as Tabs } from './Tabs.svelte';
export { default as Modal } from './Modal.svelte';
export { default as Panel } from './Panel.svelte';

// Component metadata for programmatic access
export const ORGANISM_COMPONENTS = {
  ConnectionStatusPanel: {
    name: 'ConnectionStatusPanel',
    description: 'Comprehensive connection status panel with real-time monitoring and controls',
    category: 'panels',
    props: {
      compact: { type: 'boolean', default: false, description: 'Show compact version' },
      showDetails: { type: 'boolean', default: true, description: 'Show detailed connection information' },
      showHistory: { type: 'boolean', default: false, description: 'Show connection history timeline' },
      autoRefresh: { type: 'boolean', default: true, description: 'Enable automatic data refresh' },
      refreshInterval: { type: 'number', default: 1000, description: 'Refresh interval in milliseconds' }
    },
    features: [
      'real-time-monitoring',
      'service-health-tracking',
      'performance-metrics',
      'subscription-status',
      'connection-history',
      'manual-reconnect',
      'error-handling',
      'responsive-design',
      'accessibility',
      'keyboard-navigation'
    ],
    events: [
      'reconnect',
      'connectionClick',
      'serviceClick',
      'toggleDetails',
      'refresh'
    ],
    dependencies: [
      'ConnectionIndicator',
      'StatusBadge',
      'Button'
    ]
  }
};

// Component categories for organization
export const ORGANISM_CATEGORIES = {
  panels: ['ConnectionStatusPanel']
};

// Utility functions for component management
export function getOrganismComponentByName(name) {
  return ORGANISM_COMPONENTS[name];
}

export function getOrganismsByCategory(category) {
  const componentNames = ORGANISM_CATEGORIES[category] || [];
  return componentNames.map(name => ORGANISM_COMPONENTS[name]).filter(Boolean);
}

export function getAllOrganismComponents() {
  return Object.values(ORGANISM_COMPONENTS);
}

export function getOrganismCategories() {
  return Object.keys(ORGANISM_CATEGORIES);
}

// Default export with all components
export default {
  ConnectionStatusPanel,
  metadata: ORGANISM_COMPONENTS,
  categories: ORGANISM_CATEGORIES,
  utils: {
    getOrganismComponentByName,
    getOrganismsByCategory,
    getAllOrganismComponents,
    getOrganismCategories
  }
};
