/**
 * Production Runtime Optimizations
 *
 * Performance optimizations and caching strategies for production deployment
 */

// Global performance state
let performanceInitialized = false;
let cachedResources = new Map();
let requestCache = new Map();

/**
 * Initialize production performance optimizations
 */
export function initializeProductionOptimizations() {
  if (performanceInitialized || __DEV__) {
    return;
  }

  performanceInitialized = true;

  console.log('[PROD_OPT] Initializing production optimizations...');

  // Enable efficient resource loading
  optimizeResourceLoading();

  // Setup request caching
  setupRequestCaching();

  // Optimize rendering performance
  optimizeRendering();

  // Setup memory management
  setupMemoryManagement();

  // Initialize performance monitoring
  initializePerformanceMonitoring();

  console.log('[PROD_OPT] Production optimizations initialized');
}

/**
 * Optimize resource loading with better caching
 */
function optimizeResourceLoading() {
  if ('serviceWorker' in navigator) {
    // Register service worker for caching (if enabled)
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed, continue without it
    });
  }

  // Preload critical resources
  preloadCriticalResources();

  // Setup resource hints for better loading
  setupResourceHints();
}

/**
 * Preload critical resources
 */
function preloadCriticalResources() {
  const criticalResources = [
    // Critical visualization modules will be preloaded by lazy loading system
  ];

  criticalResources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource;
    link.as = 'script';
    document.head.appendChild(link);
  });
}

/**
 * Setup resource hints (DNS prefetch, preconnect, etc.)
 */
function setupResourceHints() {
  // Preconnect to important origins
  const origins = [
    location.origin,
    // Add API origins here
  ];

  origins.forEach(origin => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    document.head.appendChild(link);
  });
}

/**
 * Setup intelligent request caching
 */
function setupRequestCaching() {
  // Cache API responses with intelligent TTL
  const originalFetch = window.fetch;

  window.fetch = async function(url, options = {}) {
    const cacheKey = `${url}:${JSON.stringify(options)}`;

    // Check cache first for GET requests
    if (options.method === 'GET' || !options.method) {
      const cached = requestCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return Promise.resolve(cached.response.clone());
      }
    }

    // Make request
    const response = await originalFetch(url, options);

    // Cache successful GET responses
    if ((options.method === 'GET' || !options.method) && response.ok) {
      const ttl = getCacheTTL(url);
      if (ttl > 0) {
        const clonedResponse = response.clone();
        requestCache.set(cacheKey, {
          response: clonedResponse,
          timestamp: Date.now(),
          ttl
        });
      }
    }

    return response;
  };

  // Clean up expired cache entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of requestCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        requestCache.delete(key);
      }
    }
  }, 60000); // Clean up every minute
}

/**
 * Get cache TTL based on URL pattern
 */
function getCacheTTL(url) {
  if (url.includes('/api/symbols')) {
    return 300000; // 5 minutes for symbol data
  }
  if (url.includes('/api/price')) {
    return 1000; // 1 second for real-time price data
  }
  if (url.includes('/api/market')) {
    return 5000; // 5 seconds for market data
  }
  return 0; // Don't cache other requests by default
}

/**
 * Optimize rendering for trading platform
 */
function optimizeRendering() {
  // Enable passive event listeners for better scrolling performance
  const originalAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function(type, listener, options) {
    const optimizedOptions = options || {};

    // Use passive listeners for wheel and touch events
    if (type === 'wheel' || type === 'touchstart' || type === 'touchmove') {
      optimizedOptions.passive = true;
    }

    return originalAddEventListener.call(this, type, listener, optimizedOptions);
  };

  // Optimize canvas rendering
  optimizeCanvasRendering();

  // Enable RAF-based updates
  enableRAFUpdates();
}

/**
 * Optimize canvas rendering for trading visualizations
 */
function optimizeCanvasRendering() {
  // Track canvas elements for optimization
  const canvases = new WeakSet();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeName === 'CANVAS') {
          optimizeCanvas(node);
          canvases.add(node);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  function optimizeCanvas(canvas) {
    // Enable hardware acceleration
    canvas.style.willChange = 'transform';
    canvas.style.transform = 'translateZ(0)';

    // Optimize pixel ratio for performance
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Use appropriate image quality for performance
      ctx.imageSmoothingQuality = 'high';
    }
  }
}

/**
 * Enable requestAnimationFrame-based updates
 */
function enableRAFUpdates() {
  let rafId = null;
  const updates = new Set();

  function scheduleUpdate() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      const currentUpdates = Array.from(updates);
      updates.clear();
      rafId = null;

      currentUpdates.forEach(update => {
        try {
          update();
        } catch (error) {
          console.error('[PROD_OPT] Update failed:', error);
        }
      });
    });
  }

  // Export optimized update function
  window.scheduleUpdate = scheduleUpdate;
  window.addUpdate = (update) => updates.add(update);
  window.removeUpdate = (update) => updates.delete(update);
}

/**
 * Setup memory management for production
 */
function setupMemoryManagement() {
  // Implement garbage collection hints
  if ('gc' in window) {
    // Schedule periodic garbage collection in production
    setInterval(() => {
      try {
        window.gc();
      } catch (e) {
        // Ignore if gc is not available
      }
    }, 300000); // Every 5 minutes
  }

  // Cleanup unused references
  window.addEventListener('beforeunload', () => {
    // Clean up caches
    requestCache.clear();
    cachedResources.clear();
  });

  // Memory pressure handling
  if ('memory' in performance) {
    setInterval(() => {
      const memory = performance.memory;
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

      if (usageRatio > 0.8) {
        console.warn('[PROD_OPT] High memory usage detected:', {
          used: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
          limit: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB',
          ratio: (usageRatio * 100).toFixed(1) + '%'
        });

        // Clear caches under memory pressure
        requestCache.clear();
        cachedResources.clear();

        // Request garbage collection
        if ('gc' in window) {
          try {
            window.gc();
          } catch (e) {
            // Ignore if gc is not available
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }
}

/**
 * Initialize production performance monitoring
 */
function initializePerformanceMonitoring() {
  // Monitor critical metrics
  const metrics = {
    fcp: 0, // First Contentful Paint
    lcp: 0, // Largest Contentful Paint
    fid: 0, // First Input Delay
    cls: 0  // Cumulative Layout Shift
  };

  // Measure FCP
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          metrics.fcp = entry.startTime;
        }
        if (entry.entryType === 'largest-contentful-paint') {
          metrics.lcp = entry.startTime;
        }
        if (entry.entryType === 'first-input') {
          metrics.fid = entry.processingStart - entry.startTime;
        }
        if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
          metrics.cls += entry.value;
        }
      });
    });

    observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
  }

  // Report metrics periodically
  setInterval(() => {
    if (Object.values(metrics).some(value => value > 0)) {
      console.log('[PROD_OPT] Performance metrics:', {
        FCP: metrics.fcp.toFixed(2) + 'ms',
        LCP: metrics.lcp.toFixed(2) + 'ms',
        FID: metrics.fid.toFixed(2) + 'ms',
        CLS: metrics.cls.toFixed(3)
      });
    }
  }, 30000); // Report every 30 seconds
}

/**
 * Get optimization statistics
 */
export function getOptimizationStats() {
  return {
    performanceInitialized,
    cachedRequests: requestCache.size,
    cachedResources: cachedResources.size,
    memoryUsage: performance.memory ? {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit
    } : null
  };
}

/**
 * Clear all caches (useful for testing)
 */
export function clearCaches() {
  requestCache.clear();
  cachedResources.clear();
}