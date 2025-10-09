/**
 * API Integration Test Helper
 * Provides utilities for testing real API integrations and WebSocket connections
 */

import { vi } from 'vitest';
import { TestDataFactory } from '../data/testDataFactory.js';

/**
 * Helper class for API integration testing
 */
export class ApiTestHelper {
  constructor() {
    this.testServer = null;
    this.mockWebSocket = null;
    this.activeConnections = new Set();
    this.requestHistory = [];
    this.responseQueue = new Map();
  }

  /**
   * Setup test WebSocket server for integration testing
   */
  async setupTestWebSocket() {
    // Create a mock WebSocket server that simulates real backend behavior
    const mockServer = {
      connections: new Set(),
      
      // Simulate server accepting connections
      acceptConnection: (ws) => {
        this.activeConnections.add(ws);
        
        // Simulate connection established
        setTimeout(() => {
          ws.readyState = WebSocket.OPEN;
          ws.triggerEvent('open', { type: 'open' });
        }, 10);
        
        // Simulate periodic data updates
        this.startDataSimulation(ws);
      },
      
      // Simulate server sending data
      broadcast: (data) => {
        this.activeConnections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.triggerEvent('message', { data: JSON.stringify(data) });
          }
        });
      },
      
      // Close all connections
      closeAll: () => {
        this.activeConnections.forEach(ws => {
          ws.readyState = WebSocket.CLOSED;
          ws.triggerEvent('close', { code: 1000, reason: 'Normal closure' });
        });
        this.activeConnections.clear();
      }
    };
    
    this.testServer = mockServer;
    return mockServer;
  }

  /**
   * Start simulating real-time data updates
   */
  startDataSimulation(ws) {
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY'];
    let interval;
    
    const sendUpdate = () => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(interval);
        return;
      }
      
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const tickData = TestDataFactory.createMockTickData(symbol);
      
      ws.triggerEvent('message', {
        data: JSON.stringify({
          type: 'tick',
          data: tickData,
          timestamp: Date.now()
        })
      });
    };
    
    // Send initial data
    setTimeout(() => {
      symbols.forEach(symbol => {
        const symbolData = TestDataFactory.createMockSymbolDataPackage(symbol);
        ws.triggerEvent('message', {
          data: JSON.stringify({
            type: 'symbolData',
            data: symbolData,
            timestamp: Date.now()
          })
        });
      });
      
      // Start periodic updates
      interval = setInterval(sendUpdate, 1000 + Math.random() * 2000);
    }, 100);
  }

  /**
   * Create test canvas elements for testing
   */
  async createTestCanvas(canvasConfig = {}) {
    const canvas = document.createElement('canvas');
    const config = {
      width: 220,
      height: 120,
      ...canvasConfig
    };
    
    canvas.width = config.width;
    canvas.height = config.height;
    canvas.style.width = `${config.width}px`;
    canvas.style.height = `${config.height}px`;
    
    // Mock canvas context with realistic behavior
    const ctx = {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(() => {
        // Return realistic image data
        const data = new Uint8ClampedArray(config.width * config.height * 4);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.random() * 255;     // R
          data[i + 1] = Math.random() * 255; // G
          data[i + 2] = Math.random() * 255; // B
          data[i + 3] = 255;                 // A
        }
        return { data };
      }),
      putImageData: vi.fn(),
      createImageData: vi.fn(() => ({ 
        data: new Uint8ClampedArray(config.width * config.height * 4) 
      })),
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
      measureText: vi.fn(() => ({ width: 50 })),
      transform: vi.fn(),
      resetTransform: vi.fn(),
      rect: vi.fn(),
      
      // Store drawing commands for verification
      drawingCommands: [],
      
      _trackCommand(command, ...args) {
        this.drawingCommands.push({ command, args, timestamp: Date.now() });
      }
    };
    
    // Override methods to track calls
    Object.keys(ctx).forEach(method => {
      if (typeof ctx[method] === 'function') {
        const original = ctx[method];
        ctx[method] = (...args) => {
          ctx._trackCommand(method, ...args);
          return original(...args);
        };
      }
    });
    
    canvas.getContext = vi.fn(() => ctx);
    
    // Append to document for realistic testing
    document.body.appendChild(canvas);
    
    return { canvas, ctx };
  }

  /**
   * Mock fetch with realistic API responses
   */
  setupMockFetch() {
    const originalFetch = global.fetch;
    
    const mockFetch = vi.fn(async (url, options = {}) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.requestHistory.push({
        id: requestId,
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
        timestamp: Date.now()
      });
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 40));
      
      // Route to appropriate handler
      let response;
      
      if (url.includes('/api/symbols')) {
        response = await this.handleSymbolsRequest(url, options);
      } else if (url.includes('/api/workspace')) {
        response = await this.handleWorkspaceRequest(url, options);
      } else if (url.includes('/api/performance')) {
        response = await this.handlePerformanceRequest(url, options);
      } else if (url.includes('/api/export')) {
        response = await this.handleExportRequest(url, options);
      } else if (url.includes('/api/import')) {
        response = await this.handleImportRequest(url, options);
      } else {
        response = {
          status: 404,
          statusText: 'Not Found',
          data: { error: 'Endpoint not found' }
        };
      }
      
      this.requestHistory = this.requestHistory.map(req => 
        req.id === requestId ? { ...req, response } : req
      );
      
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers || {}),
        json: async () => response.data,
        text: async () => JSON.stringify(response.data),
        blob: async () => new Blob([JSON.stringify(response.data)])
      };
    });
    
    global.fetch = mockFetch;
    return mockFetch;
  }

  /**
   * Handle symbols API requests
   */
  async handleSymbolsRequest(url, options) {
    if (options.method === 'GET') {
      const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'];
      const data = symbols.map(symbol => TestDataFactory.createMockSymbolDataPackage(symbol));
      
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        data
      };
    }
    
    return { status: 405, statusText: 'Method Not Allowed' };
  }

  /**
   * Handle workspace API requests
   */
  async handleWorkspaceRequest(url, options) {
    if (options.method === 'GET') {
      const workspace = TestDataFactory.createMockWorkspace();
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        data: workspace
      };
    } else if (options.method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      const workspace = TestDataFactory.createMockWorkspace(body.name, body);
      return {
        status: 201,
        statusText: 'Created',
        headers: { 'Content-Type': 'application/json' },
        data: workspace
      };
    } else if (options.method === 'PUT') {
      const body = JSON.parse(options.body || '{}');
      const workspace = TestDataFactory.createMockWorkspace(body.name, body);
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        data: workspace
      };
    }
    
    return { status: 405, statusText: 'Method Not Allowed' };
  }

  /**
   * Handle performance API requests
   */
  async handlePerformanceRequest(url, options) {
    const metrics = TestDataFactory.createMockPerformanceMetrics();
    return {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
      data: metrics
    };
  }

  /**
   * Handle export API requests
   */
  async handleExportRequest(url, options) {
    const workspace = TestDataFactory.createMockWorkspace();
    const exportData = {
      workspace,
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        format: 'json'
      }
    };
    
    return {
      status: 200,
      statusText: 'OK',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="workspace.json"'
      },
      data: exportData
    };
  }

  /**
   * Handle import API requests
   */
  async handleImportRequest(url, options) {
    // Simulate file processing delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const body = options.body;
    let importData;
    
    if (body instanceof FormData) {
      const file = body.get('file');
      importData = JSON.parse(await file.text());
    } else {
      importData = JSON.parse(body);
    }
    
    // Validate and process import data
    const workspace = TestDataFactory.createMockWorkspace(
      importData.workspace?.name || 'Imported Workspace',
      importData.workspace
    );
    
    return {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
      data: {
        success: true,
        workspace,
        importedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Create realistic WebSocket mock
   */
  createMockWebSocket(url) {
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
          this.triggerEvent('close', { code, reason, wasClean: true });
          this.activeConnections.delete(ws);
        }, 10);
      }),
      
      send: vi.fn((data) => {
        if (readyState !== WebSocket.OPEN) {
          throw new Error('WebSocket is not open');
        }
        
        // Simulate server processing
        setTimeout(() => {
          try {
            const message = JSON.parse(data);
            this.handleMessage(message, ws);
          } catch (e) {
            // Invalid JSON, ignore
          }
        }, 5);
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
      },
      
      // Helper method for testing
      _setReadyState: (state) => {
        readyState = state;
        Object.defineProperty(ws, 'readyState', { value: state, writable: true });
      }
    };
    
    // Simulate connection
    if (this.testServer) {
      this.testServer.acceptConnection(ws);
    } else {
      setTimeout(() => {
        ws._setReadyState(WebSocket.OPEN);
        ws.triggerEvent('open', { type: 'open' });
      }, 10);
    }
    
    return ws;
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(message, ws) {
    switch (message.type) {
      case 'subscribe':
        // Simulate subscription confirmation
        ws.triggerEvent('message', {
          data: JSON.stringify({
            type: 'subscription',
            status: 'confirmed',
            symbol: message.symbol,
            timestamp: Date.now()
          })
        });
        break;
        
      case 'unsubscribe':
        // Simulate unsubscription confirmation
        ws.triggerEvent('message', {
          data: JSON.stringify({
            type: 'unsubscription',
            status: 'confirmed',
            symbol: message.symbol,
            timestamp: Date.now()
          })
        });
        break;
        
      default:
        // Echo back unknown messages
        ws.triggerEvent('message', {
          data: JSON.stringify({
            type: 'error',
            message: 'Unknown message type',
            originalMessage: message,
            timestamp: Date.now()
          })
        });
    }
  }

  /**
   * Get request history for verification
   */
  getRequestHistory() {
    return this.requestHistory;
  }

  /**
   * Clear request history
   */
  clearRequestHistory() {
    this.requestHistory = [];
  }

  /**
   * Assert specific API call was made
   */
  assertApiCall(method, url, body = null) {
    const call = this.requestHistory.find(req => 
      req.method === method && 
      req.url.includes(url) && 
      (body === null || JSON.stringify(req.body) === JSON.stringify(body))
    );
    
    if (!call) {
      throw new Error(`Expected ${method} call to ${url} not found`);
    }
    
    return call;
  }

  /**
   * Cleanup test resources
   */
  cleanup() {
    if (this.testServer) {
      this.testServer.closeAll();
      this.testServer = null;
    }
    
    this.activeConnections.clear();
    this.requestHistory = [];
    this.responseQueue.clear();
    
    // Remove test canvases from DOM
    const testCanvases = document.querySelectorAll('canvas[data-test="true"]');
    testCanvases.forEach(canvas => canvas.remove());
    
    // Restore original fetch if it was mocked
    if (global.fetch !== originalFetch) {
      global.fetch = originalFetch;
    }
  }
}

// Singleton instance for testing
let apiTestHelperInstance = null;

export const getApiTestHelper = () => {
  if (!apiTestHelperInstance) {
    apiTestHelperInstance = new ApiTestHelper();
  }
  return apiTestHelperInstance;
};

export default ApiTestHelper;
