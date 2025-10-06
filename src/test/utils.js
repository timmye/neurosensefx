/**
 * Test Utilities and Helpers
 * Common utilities for testing NeuroSense FX components
 */

import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import { writable, readable, derived } from 'svelte/store';
import { vi } from 'vitest';

/**
 * Create a mock store with initial value
 */
export const createMockStore = (initialValue) => {
  const store = writable(initialValue);
  store.mock = {
    setValue: vi.fn((value) => store.set(value)),
    updateValue: vi.fn((updater) => store.update(updater))
  };
  return store;
};

/**
 * Create a mock WebSocket connection
 */
export const createMockWebSocket = () => {
  const listeners = new Map();
  const ws = {
    close: vi.fn(),
    send: vi.fn(),
    addEventListener: vi.fn((event, callback) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(callback);
    }),
    removeEventListener: vi.fn((event, callback) => {
      if (listeners.has(event)) {
        listeners.get(event).delete(callback);
      }
    }),
    readyState: WebSocket.OPEN,
    OPEN: WebSocket.OPEN,
    CONNECTING: WebSocket.CONNECTING,
    CLOSING: WebSocket.CLOSING,
    CLOSED: WebSocket.CLOSED,
    
    // Helper for testing
    triggerEvent: (event, data) => {
      if (listeners.has(event)) {
        listeners.get(event).forEach(callback => callback(data));
      }
    }
  };
  return ws;
};

/**
 * Create a mock Canvas element
 */
export const createMockCanvas = (width = 220, height = 120) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Array(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Array(4) })),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
    transform: vi.fn(),
    resetTransform: vi.fn(),
    rect: vi.fn()
  };
  
  canvas.getContext = vi.fn(() => ctx);
  return { canvas, ctx };
};

/**
 * Render Svelte component with store context
 */
export const renderWithStore = (Component, props = {}, stores = {}) => {
  const storeContext = new Map();
  
  // Add stores to context
  Object.entries(stores).forEach(([key, store]) => {
    storeContext.set(key, store);
  });
  
  // Mock setContext for the component
  const originalSetContext = global.setContext;
  global.setContext = vi.fn((key, value) => {
    storeContext.set(key, value);
  });
  
  const result = render(Component, props);
  
  // Restore original setContext
  global.setContext = originalSetContext;
  
  return {
    ...result,
    storeContext,
    getStore: (key) => storeContext.get(key)
  };
};

/**
 * Create mock performance data
 */
export const createMockPerformanceData = () => ({
  fps: 60,
  renderTime: 16,
  memoryUsage: 50 * 1024 * 1024,
  activeCanvases: 3,
  activeSubscriptions: 5,
  cacheHitRate: 85,
  dataProcessingTime: 2,
  networkLatency: 50,
  errorCount: 0,
  warningCount: 1
});

/**
 * Create mock symbol data
 */
export const createMockSymbolData = (overrides = {}) => ({
  symbol: 'EURUSD',
  bid: 1.1234,
  ask: 1.1236,
  timestamp: Date.now(),
  volume: 1000000,
  ...overrides
});

/**
 * Create mock workspace data
 */
export const createMockWorkspace = (overrides = {}) => ({
  id: `workspace_${Date.now()}`,
  name: 'Test Workspace',
  description: 'Test workspace description',
  createdAt: new Date(),
  updatedAt: new Date(),
  layout: {
    canvases: [
      {
        id: `canvas_${Date.now()}`,
        symbol: 'EURUSD',
        position: { x: 0, y: 0 },
        size: { width: 220, height: 120 },
        settings: {},
        indicators: ['priceFloat', 'marketProfile'],
        isVisible: true,
        zIndex: 1
      }
    ],
    gridSettings: {
      columns: 4,
      rows: 3,
      gap: 10,
      padding: 20
    },
    viewSettings: {
      zoom: 1,
      panX: 0,
      panY: 0
    }
  },
  globalSettings: {
    density: 'high',
    theme: 'dark',
    autoSave: true,
    autoSaveInterval: 30000
  },
  symbolSubscriptions: ['EURUSD', 'GBPUSD'],
  visualizationSettings: {},
  ...overrides
});

/**
 * Create mock market data package
 */
export const createMockMarketDataPackage = (symbol = 'EURUSD') => ({
  symbol,
  digits: 5,
  adr: 0.00850,
  todaysOpen: 1.25000,
  todaysHigh: 1.25150,
  todaysLow: 1.24750,
  projectedAdrHigh: 1.25425,
  projectedAdrLow: 1.24575,
  initialPrice: 1.25000,
  initialMarketProfile: Array.from({ length: 100 }, (_, i) => ({
    open: 1.25000 + (Math.random() - 0.5) * 0.0005,
    close: 1.25000 + (Math.random() - 0.5) * 0.0005,
    high: 1.25000 + Math.random() * 0.001,
    low: 1.25000 - Math.random() * 0.001,
    timestamp: Date.now() - (100 - i) * 60 * 1000,
    volume: Math.floor(Math.random() * 1000)
  }))
});

/**
 * Wait for next tick
 */
export const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Wait for multiple ticks
 */
export const ticks = (count = 1) => {
  let promise = Promise.resolve();
  for (let i = 0; i < count; i++) {
    promise = promise.then(() => tick());
  }
  return promise;
};

/**
 * Wait for condition to be true
 */
export const waitForCondition = (condition, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkCondition = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Condition not met within timeout'));
      } else {
        setTimeout(checkCondition, 10);
      }
    };
    
    checkCondition();
  });
};

/**
 * Fire multiple events in sequence
 */
export const fireEvents = async (element, events) => {
  for (const [eventType, options] of events) {
    await fireEvent(element, eventType, options);
    await tick();
  }
};

/**
 * Create mock drag and drop events
 */
export const createMockDragEvents = () => ({
  dragStart: {
    type: 'dragstart',
    dataTransfer: {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: 'move'
    }
  },
  dragOver: {
    type: 'dragover',
    dataTransfer: {
      dropEffect: 'move'
    }
  },
  drop: {
    type: 'drop',
    dataTransfer: {
      getData: vi.fn(() => 'test-data'),
      dropEffect: 'move'
    }
  },
  dragEnd: {
    type: 'dragend',
    dataTransfer: {
      effectAllowed: 'move'
    }
  }
});

/**
 * Mock resize observer for testing
 */
export const createMockResizeObserver = () => {
  const callbacks = new Set();
  
  const observer = {
    observe: vi.fn((element) => {
      // Simulate resize after a short delay
      setTimeout(() => {
        callbacks.forEach(callback => {
          callback([{ 
            target: element,
            contentRect: {
              width: element.clientWidth || 100,
              height: element.clientHeight || 100,
              x: 0,
              y: 0,
              top: 0,
              left: 0,
              right: element.clientWidth || 100,
              bottom: element.clientHeight || 100
            }
          }]);
        });
      }, 10);
    }),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  };
  
  const mockResizeObserver = vi.fn((callback) => {
    callbacks.add(callback);
    return observer;
  });
  
  mockResizeObserver.observer = observer;
  return mockResizeObserver;
};

/**
 * Create mock intersection observer for testing
 */
export const createMockIntersectionObserver = (isIntersecting = true) => {
  const callbacks = new Set();
  
  const observer = {
    observe: vi.fn((element) => {
      setTimeout(() => {
        callbacks.forEach(callback => {
          callback([{
            target: element,
            isIntersecting,
            intersectionRatio: isIntersecting ? 1 : 0,
            boundingClientRect: {
              width: element.clientWidth || 100,
              height: element.clientHeight || 100
            }
          }]);
        });
      }, 10);
    }),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  };
  
  const mockIntersectionObserver = vi.fn((callback) => {
    callbacks.add(callback);
    return observer;
  });
  
  mockIntersectionObserver.observer = observer;
  return mockIntersectionObserver;
};

/**
 * Assert element has specific styles
 */
export const assertStyles = (element, expectedStyles) => {
  const computedStyles = window.getComputedStyle(element);
  
  Object.entries(expectedStyles).forEach(([property, value]) => {
    expect(computedStyles[property]).toBe(value);
  });
};

/**
 * Assert element has specific CSS classes
 */
export const assertClasses = (element, expectedClasses) => {
  const elementClasses = Array.from(element.classList);
  
  expectedClasses.forEach(className => {
    expect(elementClasses).toContain(className);
  });
};

/**
 * Create mock fetch response
 */
export const createMockFetchResponse = (data, options = {}) => {
  const {
    status = 200,
    statusText = 'OK',
    headers = {}
  } = options;
  
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Headers(headers),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    blob: () => Promise.resolve(new Blob([JSON.stringify(data)]))
  });
};

/**
 * Mock fetch with multiple responses
 */
export const createMockFetchSequence = (responses) => {
  let callCount = 0;
  
  return vi.fn(() => {
    const response = responses[Math.min(callCount, responses.length - 1)];
    callCount++;
    return typeof response === 'function' ? response() : response;
  });
};

export default {
  createMockStore,
  createMockWebSocket,
  createMockCanvas,
  renderWithStore,
  createMockPerformanceData,
  createMockSymbolData,
  createMockWorkspace,
  createMockMarketDataPackage,
  tick,
  ticks,
  waitForCondition,
  fireEvents,
  createMockDragEvents,
  createMockResizeObserver,
  createMockIntersectionObserver,
  assertStyles,
  assertClasses,
  createMockFetchResponse,
  createMockFetchSequence
};
