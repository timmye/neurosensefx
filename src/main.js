import App from './App.svelte';
import { initializeWsClient } from './data/wsClient.js';
import { displayStore, displayActions } from './stores/displayStore.js';
import { displayStateStore } from './stores/displayStateStore.js';

// ✅ LAZY LOADING: Lazy load memory management in production
let initializeMemoryTracking, globalMemoryTracker;

if (__DEV__) {
  // Load memory management immediately in development
  const memoryModule = await import('./utils/memoryManagementUtils.js');
  initializeMemoryTracking = memoryModule.initializeMemoryTracking;
  globalMemoryTracker = memoryModule.globalMemoryTracker;
} else {
  // Lazy load memory management in production
  import('./utils/memoryManagementUtils.js').then(module => {
    initializeMemoryTracking = module.initializeMemoryTracking;
    globalMemoryTracker = module.globalMemoryTracker;

    // Initialize memory tracking after module loads
    if (initializeMemoryTracking) {
      initializeMemoryTracking();
      // Make memory tracker available globally after initialization
      if (typeof window !== 'undefined') {
        window.memoryTracker = globalMemoryTracker;
      }
    }
  });
}

const app = new App({
  target: document.getElementById('app'),
  props: {}
});

initializeWsClient();

// ✅ MEMORY MANAGEMENT: Initialize memory tracking immediately in development
if (__DEV__ && initializeMemoryTracking) {
  initializeMemoryTracking();
}

// ✅ EXPOSE: Make store and actions globally available for components
window.displayStore = displayStore;
window.displayActions = displayActions;
window.displayStateStore = displayStateStore;

// ✅ EXPOSE: Make memory tracker available in development
if (__DEV__ && globalMemoryTracker) {
  window.memoryTracker = globalMemoryTracker;
}

// ✅ PRODUCTION OPTIMIZATIONS: Initialize production optimizations
if (__PROD__) {
  import('./utils/productionOptimizations.js').then(({ initializeProductionOptimizations }) => {
    initializeProductionOptimizations();
  });
}

console.log(`[MAIN] Application initialized in ${__DEV__ ? 'development' : 'production'} mode`);

export default app;
