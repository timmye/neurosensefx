/**
 * Browser Console Logger Utility
 *
 * Pure Playwright-native console logging for LLM developer visibility.
 * Zero custom infrastructure - just enhances the existing fixture approach.
 *
 * Philosophy: "Simple, Performant, Maintainable"
 * - Simple: Drop-in utility with clear interface
 * - Performant: Minimal overhead, native Playwright events
 * - Maintainable: Clear error classification and filtering
 */

export function addBrowserConsoleLogging(page, options = {}) {
  const {
    enableNetworkLogging = true,
    enableErrorLogging = true,
    enableConsoleLogging = true,
    filterPatterns = [],
    logLevels = ['log', 'info', 'warn', 'error', 'debug']
  } = options;

  console.log('[LOGGER] 🚀 Initializing enhanced browser console logging...');

  // Enhanced console logging with classification
  if (enableConsoleLogging) {
    page.on('console', msg => {
      const type = msg.type().toUpperCase();
      const text = msg.text();

      // Skip if not in allowed log levels
      if (!logLevels.includes(msg.type())) return;

      // Apply filter patterns if provided
      if (filterPatterns.length > 0) {
        const matchesFilter = filterPatterns.some(pattern =>
          text.toLowerCase().includes(pattern.toLowerCase())
        );
        if (!matchesFilter) return;
      }

      // Enhanced classification with emojis for LLM visibility
      const classifiedMessage = classifyConsoleMessage(type, text);
      console.log(classifiedMessage);
    });
  }

  // Enhanced page error logging with stack traces
  if (enableErrorLogging) {
    page.on('pageerror', error => {
      const errorClassification = classifyError(error);
      console.error(errorClassification.message);

      if (error.stack && options.includeStackTraces !== false) {
        console.error(`[BROWSER ERROR STACK] ${error.stack}`);
      }
    });
  }

  // Network request/response logging
  if (enableNetworkLogging) {
    page.on('request', request => {
      const classification = classifyRequest(request);
      console.log(classification);
    });

    page.on('response', response => {
      const classification = classifyResponse(response);
      console.log(classification);
    });
  }

  console.log('[LOGGER] ✅ Browser console logging initialized');
}

/**
 * Classify console messages for better LLM comprehension
 */
function classifyConsoleMessage(type, text) {
  // Network-related logs
  if (text.includes('REQUEST') || text.includes('WebSocket')) {
    return `[🌐 BROWSER ${type}] ${text}`;
  }

  // Keyboard interaction logs
  if (text.includes('[KEYBOARD-DEBUG]') || text.includes('⌨️')) {
    return `[⌨️ BROWSER ${type}] ${text}`;
  }

  // Error logs
  if (text.includes('ERROR') || text.includes('❌') || type === 'ERROR') {
    return `[❌ BROWSER ${type}] ${text}`;
  }

  // Success/achievement logs
  if (text.includes('✅') || text.includes('🎉') || text.includes('SUCCESS')) {
    return `[✅ BROWSER ${type}] ${text}`;
  }

  // Warning logs
  if (text.includes('⚠️') || text.includes('WARNING') || type === 'WARN') {
    return `[⚠️ BROWSER ${type}] ${text}`;
  }

  // Information/debug logs
  if (text.includes('💡') || text.includes('🔍') || type === 'DEBUG') {
    return `[💡 BROWSER ${type}] ${text}`;
  }

  // Default classification
  return `[📝 BROWSER ${type}] ${text}`;
}

/**
 * Classify JavaScript errors by type and severity
 */
function classifyError(error) {
  const message = error.message;

  // Network errors
  if (message.includes('Network') || message.includes('fetch')) {
    return {
      message: `[🌐 BROWSER NETWORK ERROR] ${message}`,
      severity: 'high',
      category: 'network'
    };
  }

  // TypeScript/compilation errors
  if (message.includes('TypeScript') || message.includes('Compilation')) {
    return {
      message: `[🔧 BROWSER BUILD ERROR] ${message}`,
      severity: 'high',
      category: 'build'
    };
  }

  // Component lifecycle errors
  if (message.includes('component') || message.includes('Svelte')) {
    return {
      message: `[🧩 BROWSER COMPONENT ERROR] ${message}`,
      severity: 'medium',
      category: 'component'
    };
  }

  // Default error classification
  return {
    message: `[❌ BROWSER JAVASCRIPT ERROR] ${message}`,
    severity: 'high',
    category: 'javascript'
  };
}

/**
 * Classify network requests
 */
function classifyRequest(request) {
  const method = request.method();
  const url = request.url();

  // API requests
  if (url.includes('/api/') || url.includes('WebSocket')) {
    return `[🌐 BROWSER API REQUEST] ${method} ${url}`;
  }

  // Static assets
  if (url.includes('.js') || url.includes('.css') || url.includes('.png')) {
    return `[📦 BROWSER ASSET REQUEST] ${method} ${url}`;
  }

  // Default request classification
  return `[🌐 BROWSER REQUEST] ${method} ${url}`;
}

/**
 * Classify network responses with status indicators
 */
function classifyResponse(response) {
  const status = response.status();
  const url = response.url();

  // Success responses (2xx)
  if (status >= 200 && status < 300) {
    return `[✅ BROWSER RESPONSE] ${status} ${url}`;
  }

  // Client errors (4xx)
  if (status >= 400 && status < 500) {
    const severity = status === 404 ? '⚠️' : '❌';
    return `[${severity} BROWSER CLIENT ERROR] ${status} ${url}`;
  }

  // Server errors (5xx)
  if (status >= 500) {
    return `[🔥 BROWSER SERVER ERROR] ${status} ${url}`;
  }

  // Redirects and others
  if (status >= 300 && status < 400) {
    return `[🔄 BROWSER REDIRECT] ${status} ${url}`;
  }

  // Default response classification
  return `[📡 BROWSER RESPONSE] ${status} ${url}`;
}

/**
 * Utility function to create focused log collectors
 */
export function createLogCollector(page, patterns = []) {
  const logs = [];

  page.on('console', msg => {
    const text = msg.text();
    if (patterns.length === 0 || patterns.some(pattern => text.includes(pattern))) {
      logs.push({
        type: msg.type(),
        text: text,
        timestamp: new Date().toISOString()
      });
    }
  });

  return {
    getLogs: () => logs,
    getLogsByType: (type) => logs.filter(log => log.type === type),
    getLogsWithText: (searchText) => logs.filter(log => log.text.includes(searchText)),
    clearLogs: () => logs.length = 0
  };
}

/**
 * Utility function for performance monitoring
 */
export function addPerformanceMonitoring(page) {
  const metrics = [];

  page.on('metrics', msg => {
    metrics.push({
      timestamp: new Date().toISOString(),
      metrics: msg.metrics
    });
  });

  return {
    getMetrics: () => metrics,
    getLatestMetrics: () => metrics[metrics.length - 1] || null
  };
}

/**
 * Enhanced error analysis for debugging
 */
export function analyzeErrors(logs) {
  const errors = logs.filter(log =>
    log.type === 'error' ||
    log.text.includes('ERROR') ||
    log.text.includes('❌')
  );

  const categorizedErrors = {
    network: errors.filter(e => e.text.includes('Network') || e.text.includes('fetch')),
    javascript: errors.filter(e => e.text.includes('TypeError') || e.text.includes('ReferenceError')),
    component: errors.filter(e => e.text.includes('component') || e.text.includes('Svelte')),
    keyboard: errors.filter(e => e.text.includes('KEYBOARD') || e.text.includes('⌨️'))
  };

  return {
    total: errors.length,
    categories: categorizedErrors,
    summary: Object.keys(categorizedErrors).map(category => ({
      category,
      count: categorizedErrors[category].length,
      percentage: Math.round((categorizedErrors[category].length / errors.length) * 100) || 0
    }))
  };
}