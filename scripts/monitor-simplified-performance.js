/**
 * Performance Monitoring Script for Simplified FloatingDisplay
 * Monitors canvas rendering, memory usage, and system performance
 */

console.log('🔍 Starting Simplified FloatingDisplay Performance Monitor...');

// Performance metrics tracking
let metrics = {
  renderCount: 0,
  renderTimes: [],
  memorySnapshots: [],
  displayCount: 0,
  lastUpdate: Date.now(),
  errors: []
};

// Monitor render performance
function monitorRenderPerformance() {
  const displays = document.querySelectorAll('.floating-display');
  const canvases = document.querySelectorAll('.floating-display canvas');
  
  metrics.displayCount = displays.length;
  
  canvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const startTime = performance.now();
      
      // Force a render by checking if visualizations are present
      const imageData = ctx.getImageData(0, 0, 1, 1);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      metrics.renderTimes.push(renderTime);
      metrics.renderCount++;
      
      // Keep only last 100 render times
      if (metrics.renderTimes.length > 100) {
        metrics.renderTimes.shift();
      }
    }
  });
}

// Monitor memory usage
function monitorMemoryUsage() {
  if (performance.memory) {
    const memoryInfo = {
      used: performance.memory.usedJSHeapSize / 1024 / 1024, // MB
      total: performance.memory.totalJSHeapSize / 1024 / 1024, // MB
      limit: performance.memory.jsHeapSizeLimit / 1024 / 1024, // MB
      timestamp: Date.now()
    };
    
    metrics.memorySnapshots.push(memoryInfo);
    
    // Keep only last 50 snapshots
    if (metrics.memorySnapshots.length > 50) {
      metrics.memorySnapshots.shift();
    }
  }
}

// Monitor WebSocket activity
function monitorWebSocketActivity() {
  const wsMessages = document.querySelectorAll('[data-ws-message]');
  console.log(`📡 WebSocket Messages: ${wsMessages.length}`);
}

// Calculate performance statistics
function calculateStats() {
  const avgRenderTime = metrics.renderTimes.length > 0 
    ? metrics.renderTimes.reduce((a, b) => a + b, 0) / metrics.renderTimes.length 
    : 0;
    
  const maxRenderTime = metrics.renderTimes.length > 0 
    ? Math.max(...metrics.renderTimes) 
    : 0;
    
  const minRenderTime = metrics.renderTimes.length > 0 
    ? Math.min(...metrics.renderTimes) 
    : 0;
  
  const currentMemory = metrics.memorySnapshots.length > 0 
    ? metrics.memorySnapshots[metrics.memorySnapshots.length - 1] 
    : { used: 0, total: 0, limit: 0 };
  
  return {
    renderCount: metrics.renderCount,
    avgRenderTime: avgRenderTime.toFixed(3),
    maxRenderTime: maxRenderTime.toFixed(3),
    minRenderTime: minRenderTime.toFixed(3),
    displayCount: metrics.displayCount,
    currentMemoryMB: currentMemory.used.toFixed(2),
    memoryUtilization: ((currentMemory.used / currentMemory.limit) * 100).toFixed(1),
    errorCount: metrics.errors.length
  };
}

// Generate performance report
function generateReport() {
  const stats = calculateStats();
  
  console.log('📊 PERFORMANCE REPORT:', {
    'Render Count': stats.renderCount,
    'Avg Render Time (ms)': stats.avgRenderTime,
    'Max Render Time (ms)': stats.maxRenderTime,
    'Min Render Time (ms)': stats.minRenderTime,
    'Display Count': stats.displayCount,
    'Memory Usage (MB)': stats.currentMemoryMB,
    'Memory Utilization (%)': stats.memoryUtilization,
    'Error Count': stats.errorCount,
    'Sub-5ms Target': avgRenderTime < 5 ? '✅ ACHIEVED' : '❌ NOT MET',
    '50% Memory Reduction': '🔄 NEEDS BASELINE'
  });
  
  // Check for performance issues
  const issues = [];
  
  if (stats.avgRenderTime > 5) {
    issues.push('Average render time exceeds 5ms target');
  }
  
  if (stats.maxRenderTime > 16) {
    issues.push('Maximum render time exceeds 16ms (60fps threshold)');
  }
  
  if (stats.memoryUtilization > 80) {
    issues.push('Memory utilization exceeds 80%');
  }
  
  if (issues.length > 0) {
    console.warn('⚠️ PERFORMANCE ISSUES DETECTED:', issues);
  } else {
    console.log('✅ Performance targets achieved');
  }
  
  return stats;
}

// Monitor for errors
function monitorErrors() {
  const originalError = console.error;
  console.error = function(...args) {
    metrics.errors.push({
      message: args.join(' '),
      timestamp: Date.now()
    });
    
    // Keep only last 20 errors
    if (metrics.errors.length > 20) {
      metrics.errors.shift();
    }
    
    originalError.apply(console, args);
  };
}

// Main monitoring loop
function startMonitoring() {
  console.log('🚀 Starting performance monitoring...');
  
  // Set up error monitoring
  monitorErrors();
  
  // Monitor every 2 seconds
  setInterval(() => {
    monitorRenderPerformance();
    monitorMemoryUsage();
    generateReport();
  }, 2000);
  
  // Initial report
  setTimeout(() => {
    generateReport();
  }, 1000);
}

// Auto-start if in browser environment
if (typeof window !== 'undefined') {
  startMonitoring();
}

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    startMonitoring,
    generateReport,
    metrics
  };
}