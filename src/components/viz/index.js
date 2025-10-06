// Basic Visualization Components for NeuroSense FX
// This file provides a centralized export point for all visualization components

// Core visualization components
export { default as PriceFloat } from './PriceFloat.svelte';
export { default as MarketProfile } from './MarketProfile.svelte';
export { default as VolatilityOrb } from './VolatilityOrb.svelte';
export { default as ADRAxis } from './ADRAxis.svelte';

// Legacy components (for backward compatibility)
export { default as Container } from './Container.svelte';
export { default as MultiSymbolADR } from './MultiSymbolADR.svelte';

// Component metadata for programmatic access
export const VISUALIZATION_COMPONENTS = {
  PriceFloat: {
    name: 'PriceFloat',
    description: 'Horizontal line showing current price position',
    category: 'price',
    props: {
      price: { type: 'number', default: 0, required: true },
      position: { type: 'number', default: 50, description: 'Percentage position in canvas (0-100)' },
      width: { type: 'number', default: 100 },
      height: { type: 'number', default: 4 },
      color: { type: 'string', default: 'var(--color-price-float, #a78bfa)' },
      glow: { type: 'boolean', default: true },
      directional: { type: 'boolean', default: false },
      previousPrice: { type: 'number', default: 0 },
      animated: { type: 'boolean', default: true },
      showLabel: { type: 'boolean', default: false },
      labelPosition: { type: 'string', default: 'right', options: ['left', 'right', 'top', 'bottom'] }
    },
    features: ['animations', 'directional-colors', 'accessibility', 'responsive']
  },
  
  MarketProfile: {
    name: 'MarketProfile',
    description: 'Price distribution visualization showing market activity at different price levels',
    category: 'distribution',
    props: {
      data: { type: 'array', default: [], required: true, description: 'Array of price data points' },
      width: { type: 'number', default: 200 },
      height: { type: 'number', default: 100 },
      viewMode: { type: 'string', default: 'separate', options: ['separate', 'combinedLeft', 'combinedRight'] },
      opacity: { type: 'number', default: 0.7 },
      outline: { type: 'boolean', default: false },
      outlineStroke: { type: 'number', default: 1 },
      outlineUpColor: { type: 'string', default: 'var(--color-bullish, #10b981)' },
      outlineDownColor: { type: 'string', default: 'var(--color-bearish, #ef4444)' },
      outlineOpacity: { type: 'number', default: 0.8 },
      upColor: { type: 'string', default: 'var(--color-bullish, #10b981)' },
      downColor: { type: 'string', default: 'var(--color-bearish, #ef4444)' },
      priceBucketMultiplier: { type: 'number', default: 1 },
      widthRatio: { type: 'number', default: 1.0 },
      animated: { type: 'boolean', default: true }
    },
    features: ['canvas-rendering', 'multiple-view-modes', 'data-processing', 'accessibility']
  },
  
  VolatilityOrb: {
    name: 'VolatilityOrb',
    description: 'Circular visualization representing market volatility with dynamic sizing and coloring',
    category: 'volatility',
    props: {
      volatility: { type: 'number', default: 0, required: true, description: 'Volatility value (0-1 or higher)' },
      baseWidth: { type: 'number', default: 200 },
      colorMode: { type: 'string', default: 'intensity', options: ['intensity', 'directional', 'single'] },
      showMetric: { type: 'boolean', default: true },
      metricPosition: { type: 'string', default: 'center', options: ['center', 'top', 'bottom'] },
      animated: { type: 'boolean', default: true },
      pulseAnimation: { type: 'boolean', default: true },
      direction: { type: 'string', default: 'neutral', options: ['up', 'down', 'neutral'] },
      singleColor: { type: 'string', default: 'var(--color-price-float, #a78bfa)' },
      maxVolatility: { type: 'number', default: 1.0 },
      minSize: { type: 'number', default: 20 },
      sensitivity: { type: 'number', default: 1.0 }
    },
    features: ['canvas-rendering', 'multiple-color-modes', 'pulse-animations', 'accessibility']
  },
  
  ADRAxis: {
    name: 'ADRAxis',
    description: 'Average Daily Range axis with boundary detection and proximity alerts',
    category: 'range',
    props: {
      currentPrice: { type: 'number', default: 0, required: true },
      adrHigh: { type: 'number', default: 0, required: true },
      adrLow: { type: 'number', default: 0, required: true },
      adrRange: { type: 'number', default: 0 },
      width: { type: 'number', default: 100 },
      height: { type: 'number', default: 200 },
      showPulse: { type: 'boolean', default: true },
      proximityThreshold: { type: 'number', default: 10, description: 'Percentage threshold for pulse effect' },
      lineColor: { type: 'string', default: 'var(--color-primary, #3b82f6)' },
      pulseColor: { type: 'string', default: 'var(--color-focus, #a78bfa)' },
      lineWidth: { type: 'number', default: 2 },
      animated: { type: 'boolean', default: true },
      showLabels: { type: 'boolean', default: true },
      showBoundaries: { type: 'boolean', default: true },
      boundaryStyle: { type: 'string', default: 'solid', options: ['solid', 'dashed', 'dotted'] }
    },
    features: ['boundary-detection', 'proximity-alerts', 'canvas-rendering', 'accessibility']
  }
};

// Component categories for organization
export const COMPONENT_CATEGORIES = {
  price: ['PriceFloat'],
  distribution: ['MarketProfile'],
  volatility: ['VolatilityOrb'],
  range: ['ADRAxis']
};

// Utility functions for component management
export function getComponentByName(name) {
  return VISUALIZATION_COMPONENTS[name];
}

export function getComponentsByCategory(category) {
  const componentNames = COMPONENT_CATEGORIES[category] || [];
  return componentNames.map(name => VISUALIZATION_COMPONENTS[name]).filter(Boolean);
}

export function getAllComponents() {
  return Object.values(VISUALIZATION_COMPONENTS);
}

export function getComponentCategories() {
  return Object.keys(COMPONENT_CATEGORIES);
}

// Default export with all components
export default {
  PriceFloat,
  MarketProfile,
  VolatilityOrb,
  ADRAxis,
  Container,
  MultiSymbolADR,
  metadata: VISUALIZATION_COMPONENTS,
  categories: COMPONENT_CATEGORIES,
  utils: {
    getComponentByName,
    getComponentsByCategory,
    getAllComponents,
    getComponentCategories
  }
};
