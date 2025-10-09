/**
 * WebSocket Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketManager } from '../websocketManager.js';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen({ type: 'open' });
      }
    }, 10);
  }
  
  send(data) {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    // Echo message for testing
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: JSON.stringify({ type: 'echo', data }) });
      }
    }, 5);
  }
  
  close(code = 1000, reason = '') {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason, wasClean: true });
    }
  }
}

// Setup global WebSocket mock
global.WebSocket = MockWebSocket;

describe('WebSocketManager', () => {
  let wsManager;
  
  beforeEach(() => {
    wsManager = new WebSocketManager({
      reconnectDelay: 10,
      maxReconnectAttempts: 2,
      pingInterval: 100
    });
  });
  
  afterEach(async () => {
    if (wsManager) {
      wsManager.disconnect();
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      const connectPromise = wsManager.connect();
      
      expect(wsManager.isConnecting()).toBe(true);
      
      await connectPromise;
      
      expect(wsManager.isConnected()).toBe(true);
    });

    it('should handle connection errors', async () => {
      const errorManager = new WebSocketManager({
        url: 'ws://invalid-url'
      });
      
      await expect(errorManager.connect()).rejects.toThrow();
      expect(errorManager.hasError()).toBe(true);
    });

    it('should disconnect cleanly', async () => {
      await wsManager.connect();
      expect(wsManager.isConnected()).toBe(true);
      
      wsManager.disconnect();
      expect(wsManager.isConnected()).toBe(false);
    });

    it('should prevent multiple connections', async () => {
      const connectPromise1 = wsManager.connect();
      const connectPromise2 = wsManager.connect();
      
      await connectPromise1;
      await connectPromise2;
      
      expect(wsManager.isConnected()).toBe(true);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await wsManager.connect();
    });

    it('should send messages when connected', () => {
      const message = { type: 'test', data: 'hello' };
      
      expect(wsManager.send(message)).toBe(true);
    });

    it('should queue messages when disconnected', () => {
      wsManager.disconnect();
      const message = { type: 'test', data: 'hello' };
      
      expect(wsManager.send(message)).toBe(false);
      expect(wsManager.getStats().queuedMessages).toBe(1);
    });

    it('should handle incoming messages', (done) => {
      wsManager.on('message', (data) => {
        expect(data.type).toBe('echo');
        expect(data.data).toBe(JSON.stringify({ type: 'test', data: 'hello' }));
        done();
      });
      
      wsManager.send({ type: 'test', data: 'hello' });
    });

    it('should handle ping/pong messages', (done) => {
      const startTime = Date.now();
      
      wsManager.on('message', (data) => {
        if (data.type === 'pong') {
          expect(Date.now() - startTime).toBeGreaterThan(0);
          done();
        }
      });
      
      wsManager.send({ type: 'ping' });
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection on unexpected disconnect', async () => {
      const reconnectSpy = vi.spyOn(wsManager, 'scheduleReconnect');
      
      await wsManager.connect();
      
      // Simulate unexpected disconnect
      wsManager.ws.close(1006, 'Connection lost');
      
      expect(reconnectSpy).toHaveBeenCalled();
    });

    it('should respect max reconnect attempts', async () => {
      const errorManager = new WebSocketManager({
        url: 'ws://invalid-url',
        maxReconnectAttempts: 1,
        reconnectDelay: 10
      });
      
      const connectPromise = errorManager.connect();
      await expect(connectPromise).rejects.toThrow();
      
      // Wait for reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = errorManager.getStats();
      expect(stats.metrics.reconnectAttempts).toBe(1);
    });

    it('should not reconnect on manual disconnect', async () => {
      const reconnectSpy = vi.spyOn(wsManager, 'scheduleReconnect');
      
      await wsManager.connect();
      wsManager.disconnect();
      
      expect(reconnectSpy).not.toHaveBeenCalled();
    });
  });

  describe('Event System', () => {
    it('should emit and handle events', (done) => {
      wsManager.on('test-event', (data) => {
        expect(data).toBe('test-data');
        done();
      });
      
      wsManager.emit('test-event', 'test-data');
    });

    it('should handle once events', (done) => {
      let callCount = 0;
      
      wsManager.once('test-event', () => {
        callCount++;
      });
      
      wsManager.emit('test-event');
      wsManager.emit('test-event');
      
      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 10);
    });

    it('should remove event handlers', () => {
      const handler = vi.fn();
      
      wsManager.on('test-event', handler);
      wsManager.off('test-event', handler);
      wsManager.emit('test-event');
      
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle errors in event handlers', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      wsManager.on('test-event', () => {
        throw new Error('Handler error');
      });
      
      expect(() => wsManager.emit('test-event')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Metrics and Statistics', () => {
    it('should track connection metrics', async () => {
      await wsManager.connect();
      
      const stats = wsManager.getStats();
      
      expect(stats.connected).toBe(true);
      expect(stats.metrics.connectTime).toBeGreaterThan(0);
      expect(stats.metrics.totalReconnects).toBe(1); // Initial connection counts
    });

    it('should track uptime', async () => {
      await wsManager.connect();
      
      const initialStats = wsManager.getStats();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const laterStats = wsManager.getStats();
      expect(laterStats.metrics.connectionUptime).toBeGreaterThan(
        initialStats.metrics.connectionUptime
      );
    });

    it('should provide accurate statistics', () => {
      const stats = wsManager.getStats();
      
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('connected');
      expect(stats).toHaveProperty('url');
      expect(stats).toHaveProperty('metrics');
      expect(stats).toHaveProperty('queuedMessages');
    });
  });

  describe('Message Queue', () => {
    it('should queue messages when disconnected', () => {
      wsManager.disconnect();
      
      wsManager.send({ type: 'test1' });
      wsManager.send({ type: 'test2' });
      
      expect(wsManager.getStats().queuedMessages).toBe(2);
    });

    it('should flush queue on reconnect', async () => {
      wsManager.disconnect();
      wsManager.send({ type: 'test1' });
      
      await wsManager.connect();
      
      // Wait a bit for queue to flush
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(wsManager.getStats().queuedMessages).toBe(0);
    });
  });

  describe('Connection Timeout', () => {
    it('should timeout connection attempts', async () => {
      const timeoutManager = new WebSocketManager({
        connectionTimeout: 10,
        url: 'ws://timeout-test'
      });
      
      // Mock WebSocket that never connects
      global.WebSocket = class {
        constructor() {
          this.readyState = WebSocket.CONNECTING;
          this.onopen = null;
        }
      };
      
      await expect(timeoutManager.connect()).rejects.toThrow();
    });
  });
});
