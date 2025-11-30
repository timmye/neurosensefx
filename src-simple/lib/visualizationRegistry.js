// Visualization Registry System - Crystal Clarity compliant
// Enables adding 6+ visualizations without code duplication

const registry = new Map();
const DEFAULT_TYPE = 'dayRange';

function register(type, renderer) {
  if (!type || !renderer) {
    console.warn('[REGISTRY] Invalid registration:', { type, renderer });
    return false;
  }

  if (!isValidRenderer(renderer)) {
    console.warn('[REGISTRY] Invalid renderer:', type);
    return false;
  }

  registry.set(type, renderer);
  console.log('[REGISTRY] Registered:', type);
  return true;
}

function get(type) {
  const renderer = registry.get(type);
  if (!renderer) {
    console.warn('[REGISTRY] Not found:', type, 'falling back to default');
    return registry.get(DEFAULT_TYPE);
  }
  return renderer;
}

function list() {
  return Array.from(registry.keys());
}

function health() {
  return {
    count: registry.size,
    types: list(),
    hasDefault: registry.has(DEFAULT_TYPE),
    healthy: registry.size > 0 && registry.has(DEFAULT_TYPE)
  };
}

function getDefault() {
  return registry.get(DEFAULT_TYPE);
}

function registerBatch(registrations) {
  if (!Array.isArray(registrations)) {
    console.warn('[REGISTRY] Invalid batch:', registrations);
    return 0;
  }

  let successCount = 0;
  registrations.forEach(({ type, renderer }) => {
    if (register(type, renderer)) {
      successCount++;
    }
  });

  console.log('[REGISTRY] Batch registered:', successCount, '/', registrations.length);
  return successCount;
}

function isValidRenderer(renderer) {
  return typeof renderer === 'function';
}

function isRegistered(type) {
  return registry.has(type);
}

function reset() {
  registry.clear();
  console.log('[REGISTRY] Reset complete');
}

export {
  register,
  get,
  list,
  health,
  getDefault,
  registerBatch,
  isValidRenderer,
  isRegistered,
  reset
};