/**
 * Infrastructure Test
 * Verifies that the testing infrastructure is properly set up
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDataFactory } from '../data/testDataFactory.js';
import { getApiTestHelper } from '../integration/apiTestHelper.js';
import { 
  createMockStore, 
  createMockWebSocket, 
  createMockCanvas,
  tick,
  waitForCondition
} from '../utils.js';

describe('Testing Infrastructure', () => {
  let apiHelper;

  beforeEach(() => {
    apiHelper = getApiTestHelper();
  });

  afterEach(() => {
    apiHelper.cleanup();
  });

  describe('TestDataFactory', () => {
    it('should create mock symbol data', () => {
      const symbolData = TestDataFactory.createMockSymbolData('EURUSD');
      
      expect(symbolData).toHaveProperty('symbol', 'EURUSD');
      expect(symbolData).toHaveProperty('bid');
      expect(symbolData).toHaveProperty('ask');
      expect(symbolData).toHaveProperty('timestamp');
      expect(symbolData).toHaveProperty('volume');
      expect(symbolData.bid).toBeLessThan(symbolData.ask);
    });

    it('should create mock workspace data', () => {
      const workspace = TestDataFactory.createMockWorkspace('Test Workspace');
      
      expect(workspace).toHaveProperty('id');
      expect(workspace).toHaveProperty('name', 'Test Workspace');
      expect(workspace).toHaveProperty('layout');
      expect(workspace).toHaveProperty('globalSettings');
      expect(workspace.layout).toHaveProperty('canvases');
      expect(Array.isArray(workspace.layout.canvases)).toBe(true);
    });

    it('should create mock performance metrics', () => {
      const metrics = TestDataFactory.createMockPerformanceMetrics();
      
      expect(metrics).toHaveProperty('fps');
      expect(metrics).toHaveProperty('renderTime');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('activeCanvases');
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics.fps).toBeGreaterThan(0);
      expect(metrics.fps).toBeLessThan(120);
    });

    it('should create test scenarios', () => {
      const scenarios = TestDataFactory.createTestScenarios();
      
      expect(scenarios).toHaveProperty('normal');
      expect(scenarios).toHaveProperty('highLoad');
      expect(scenarios).toHaveProperty('error');
      expect(scenarios).toHaveProperty('networkIssues');
      
      expect(scenarios.normal.workspace).toBeDefined();
      expect(scenarios.normal.symbols).toBeDefined();
      expect(scenarios.normal.tickData).toBeDefined();
    });
  });

  describe('Test Utilities', () => {
    it('should create mock store', () => {
      const store = createMockStore('initial value');
      
      expect(store).toBeDefined();
      expect(store.mock).toBeDefined();
      expect(store.mock.setValue).toBeDefined();
      expect(store.mock.updateValue).toBeDefined();
    });

    it('should create mock WebSocket', () => {
      const ws = createMockWebSocket();
      
      expect(ws).toBeDefined();
      expect(ws.close).toBeDefined();
      expect(ws.send).toBeDefined();
      expect(ws.addEventListener).toBeDefined();
      expect(ws.removeEventListener).toBeDefined();
      expect(ws.triggerEvent).toBeDefined();
    });

    it('should create mock canvas', () => {
      const { canvas, ctx } = createMockCanvas();
      
      expect(canvas).toBeDefined();
      expect(ctx).toBeDefined();
      expect(canvas.width).toBe(220);
      expect(canvas.height).toBe(120);
      expect(ctx.fillRect).toBeDefined();
      expect(ctx.clearRect).toBeDefined();
      expect(ctx.getContext).toBeDefined();
    });

    it('should handle async utilities', async () => {
      let resolved = false;
      
      tick().then(() => {
        resolved = true;
      });
      
      await waitForCondition(() => resolved);
      expect(resolved).toBe(true);
    });
  });

  describe('API Test Helper', () => {
    it('should setup mock fetch', () => {
      const mockFetch = apiHelper.setupMockFetch();
      
      expect(mockFetch).toBeDefined();
      expect(typeof mockFetch).toBe('function');
    });

    it('should track request history', async () => {
      apiHelper.setupMockFetch();
      
      // Make a mock API call
      await fetch('/api/test');
      
      const history = apiHelper.getRequestHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toHaveProperty('url');
      expect(history[0]).toHaveProperty('method');
      expect(history[0]).toHaveProperty('timestamp');
    });

    it('should create test canvas', async () => {
      const { canvas, ctx } = await apiHelper.createTestCanvas();
      
      expect(canvas).toBeDefined();
      expect(ctx).toBeDefined();
      expect(canvas.width).toBe(220);
      expect(canvas.height).toBe(120);
      expect(ctx.drawingCommands).toBeDefined();
      expect(Array.isArray(ctx.drawingCommands)).toBe(true);
    });

    it('should create mock WebSocket', () => {
      const ws = apiHelper.createMockWebSocket('ws://localhost:8080');
      
      expect(ws).toBeDefined();
      expect(ws.url).toBe('ws://localhost:8080');
      expect(ws.readyState).toBe(WebSocket.CONNECTING);
    });

    it('should assert API calls', async () => {
      apiHelper.setupMockFetch();
      
      await fetch('/api/workspace', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' })
      });
      
      expect(() => {
        apiHelper.assertApiCall('POST', '/api/workspace', { name: 'Test' });
      }).not.toThrow();
    });

    it('should clear request history', async () => {
      apiHelper.setupMockFetch();
      
      await fetch('/api/test');
      expect(apiHelper.getRequestHistory()).toHaveLength(1);
      
      apiHelper.clearRequestHistory();
      expect(apiHelper.getRequestHistory()).toHaveLength(0);
    });
  });

  describe('Global Test Utilities', () => {
    it('should have global mock functions', () => {
      expect(global.createMockEvent).toBeDefined();
      expect(global.createMockCustomEvent).toBeDefined();
      expect(global.createMockKeyboardEvent).toBeDefined();
      expect(global.createMockMouseEvent).toBeDefined();
      expect(global.createMockSymbolData).toBeDefined();
      expect(global.createMockWorkspace).toBeDefined();
      expect(global.createMockCanvas).toBeDefined();
      expect(global.waitFor).toBeDefined();
      expect(global.cleanupMocks).toBeDefined();
    });

    it('should create mock events', () => {
      const event = global.createMockEvent('click');
      expect(event).toBeInstanceOf(Event);
      expect(event.type).toBe('click');
    });

    it('should create mock custom events', () => {
      const event = global.createMockCustomEvent('custom', { detail: 'test' });
      expect(event).toBeInstanceOf(CustomEvent);
      expect(event.type).toBe('custom');
      expect(event.detail).toBe('test');
    });

    it('should create mock keyboard events', () => {
      const event = global.createMockKeyboardEvent('keydown', 'Enter');
      expect(event).toBeInstanceOf(KeyboardEvent);
      expect(event.type).toBe('keydown');
      expect(event.key).toBe('Enter');
    });

    it('should create mock mouse events', () => {
      const event = global.createMockMouseEvent('click', { clientX: 100, clientY: 200 });
      expect(event).toBeInstanceOf(MouseEvent);
      expect(event.type).toBe('click');
      expect(event.clientX).toBe(100);
      expect(event.clientY).toBe(200);
    });

    it('should create global mock data', () => {
      const symbolData = global.createMockSymbolData('GBPUSD');
      expect(symbolData).toHaveProperty('symbol', 'GBPUSD');
      
      const workspace = global.createMockWorkspace('Global Test');
      expect(workspace).toHaveProperty('name', 'Global Test');
      
      const canvas = global.createMockCanvas(300, 200);
      expect(canvas.width).toBe(300);
      expect(canvas.height).toBe(200);
    });

    it('should handle wait utility', async () => {
      const start = Date.now();
      await global.waitFor(100);
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Mock Implementation Verification', () => {
    it('should have mocked WebSocket', () => {
      expect(global.WebSocket).toBeDefined();
      expect(typeof global.WebSocket).toBe('function');
      
      const ws = new WebSocket('ws://test');
      expect(typeof ws.close).toBe('function');
      expect(typeof ws.send).toBe('function');
    });

    it('should have mocked fetch', () => {
      expect(global.fetch).toBeDefined();
      expect(typeof global.fetch).toBe('function');
    });

    it('should have mocked localStorage', () => {
      expect(global.localStorage).toBeDefined();
      expect(typeof global.localStorage.getItem).toBe('function');
      expect(typeof global.localStorage.setItem).toBe('function');
    });

    it('should have mocked performance API', () => {
      expect(global.performance).toBeDefined();
      expect(typeof global.performance.now).toBe('function');
      expect(typeof global.performance.mark).toBe('function');
    });

    it('should have mocked canvas context', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      expect(ctx).toBeDefined();
      expect(typeof ctx.fillRect).toBe('function');
      expect(typeof ctx.strokeRect).toBe('function');
    });
  });

  describe('Test Environment', () => {
    it('should have proper test globals', () => {
      expect(describe).toBeDefined();
      expect(it).toBeDefined();
      expect(expect).toBeDefined();
      expect(beforeEach).toBeDefined();
      expect(afterEach).toBeDefined();
    });

    it('should have Testing Library globals', () => {
      expect(global.config).toBeDefined();
      expect(typeof global.config.defaultHidden).toBe('boolean');
    });

    it('should have Vitest globals', () => {
      expect(global.vi).toBeDefined();
      expect(typeof global.vi.fn).toBe('function');
      expect(typeof global.vi.mock).toBe('function');
    });
  });
});
