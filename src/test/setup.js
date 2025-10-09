/**
 * Test Setup
 * Configures the testing environment for NeuroSense FX
 */

import { vi, beforeEach, afterEach } from 'vitest';
import { TestDataFactory } from './data/testDataFactory.js';

// Mock WebSocket API
global.WebSocket = vi.fn((url) => {
  const listeners = new Map();
  let readyState = WebSocket.CONNECTING;
  
  const ws = {
    url,
    readyState,
    CONNECTING: WebSocket.CONNECTING,
    OPEN: WebSocket.OPEN,
    CLOSING: WebSocket.CLOSING,
    CLOSED: WebSocket.CLOSED,
    
    close: vi.fn((code = 1000, reason = '') => {
      readyState = WebSocket.CLOSING;
      setTimeout(() => {
        readyState = WebSocket.CLOSED;
        ws.triggerEvent('close', { code, reason, wasClean: true });
      }, 10);
    }),
    
    send: vi.fn((data) => {
      if (readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket is not open');
      }
    }),
    
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
    
    triggerEvent: (event, data) => {
      if (listeners.has(event)) {
        listeners.get(event).forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('WebSocket event error:', error);
          }
        });
      }
    }
  };
  
  // Simulate connection
  setTimeout(() => {
    readyState = WebSocket.OPEN;
    ws.triggerEvent('open', { type: 'open' });
  }, 10);
  
  return ws;
});

// Mock fetch API
global.fetch = vi.fn(async (url, options = {}) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 10));
  
  // Default response
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => ({}),
    text: async () => '{}',
    blob: async () => new Blob(['{}'])
  };
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};
global.sessionStorage = sessionStorageMock;

// Mock performance API
global.performance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(() => []),
  getEntriesByType: vi.fn(() => []),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn()
};

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(callback, 16);
});

// Mock cancelAnimationFrame
global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id);
});

// Mock DOM APIs for Node environment
global.document = {
  createElement: vi.fn((tagName) => {
    if (tagName === 'canvas') {
      return {
        width: 220,
        height: 120,
        style: {},
        getContext: vi.fn(() => ({
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
        }))
      };
    }
    
    return {
      tagName: tagName.toUpperCase(),
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn()
    };
  }),
  
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  },
  
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

global.window = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  CustomEvent: vi.fn((type, detail) => ({ type, ...detail })),
  Event: vi.fn((type) => ({ type })),
  KeyboardEvent: vi.fn((type, options) => ({ type, ...options })),
  MouseEvent: vi.fn((type, options) => ({ type, ...options })),
  getComputedStyle: vi.fn(() => ({})),
  ResizeObserver: vi.fn(),
  IntersectionObserver: vi.fn()
};

global.Event = global.window.Event;
global.CustomEvent = global.window.CustomEvent;
global.KeyboardEvent = global.window.KeyboardEvent;
global.MouseEvent = global.window.MouseEvent;

// Global test utilities
global.createMockEvent = (type, options = {}) => {
  return new Event(type, options);
};

global.createMockCustomEvent = (type, detail = {}) => {
  return new CustomEvent(type, { detail });
};

global.createMockKeyboardEvent = (type, key, options = {}) => {
  return new KeyboardEvent(type, { key, ...options });
};

global.createMockMouseEvent = (type, options = {}) => {
  return new MouseEvent(type, options);
};

global.createMockSymbolData = (symbol, overrides = {}) => {
  return TestDataFactory.createMockSymbolData(symbol, overrides);
};

global.createMockWorkspace = (name, overrides = {}) => {
  return TestDataFactory.createMockWorkspace(name, overrides);
};

global.createMockCanvas = (width = 220, height = 120) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

global.waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

global.cleanupMocks = () => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
};

// Setup and teardown
beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  global.cleanupMocks();
});

// Testing Library configuration
global.config = {
  defaultHidden: false,
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000
};

// Export for use in tests
export { TestDataFactory };
