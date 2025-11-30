// Visualization Registry - Crystal Clarity compliant
// Simple registry for 6+ visualizations

const registry = new Map();
const DEFAULT_TYPE = 'dayRange';

export function register(type, renderer) {
  if (typeof renderer === 'function') {
    registry.set(type, renderer);
    console.log('[REGISTRY] Registered:', type);
  }
}

export function get(type) {
  return registry.get(type) || registry.get(DEFAULT_TYPE);
}

export function list() {
  return Array.from(registry.keys());
}

export function getDefault() {
  return registry.get(DEFAULT_TYPE);
}