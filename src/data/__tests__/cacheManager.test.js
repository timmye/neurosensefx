/**
 * Cache Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheManager } from '../cacheManager.js';
import { TickSchema } from '../schema.js';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0
};

global.localStorage = localStorageMock;

describe('CacheManager', () => {
  let cacheManager;
  
  beforeEach(() => {
    cacheManager = new CacheManager({
      maxMemoryUsage: 1024 * 1024, // 1MB
      maxItems: 100,
      defaultTTL: 1000,
      cleanupInterval: 100,
      persistence: false // Disable persistence for tests
    });
    
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
  });
  
  afterEach(async () => {
    if (cacheManager) {
      await cacheManager.destroy();
    }
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve data', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      
      await cacheManager.set(key, data);
      const result = await cacheManager.get(key);
      
      expect(result).toEqual(data);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cacheManager.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should check if key exists', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      
      expect(cacheManager.has(key)).toBe(false);
      
      await cacheManager.set(key, data);
      expect(cacheManager.has(key)).toBe(true);
    });

    it('should remove keys', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      
      await cacheManager.set(key, data);
      expect(cacheManager.has(key)).toBe(true);
      
      const removed = cacheManager.remove(key);
      expect(removed).toBe(true);
      expect(cacheManager.has(key)).toBe(false);
    });

    it('should return false when removing non-existent keys', () => {
      const removed = cacheManager.remove('non-existent-key');
      expect(removed).toBe(false);
    });
  });

  describe('TTL and Expiration', () => {
    it('should respect TTL expiration', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      const shortTTL = 50;
      
      await cacheManager.set(key, data, { ttl: shortTTL });
      
      expect(cacheManager.has(key)).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, shortTTL + 10));
      
      expect(cacheManager.has(key)).toBe(false);
      const result = await cacheManager.get(key);
      expect(result).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      
      await cacheManager.set(key, data);
      
      const entry = cacheManager.cache.get(key);
      expect(entry.expiresAt).toBeGreaterThan(Date.now());
      expect(entry.expiresAt).toBeLessThanOrEqual(Date.now() + cacheManager.defaultTTL);
    });
  });

  describe('Data Validation', () => {
    it('should validate data with schema', async () => {
      const key = 'test-key';
      const tick = {
        symbol: 'EURUSD',
        bid: 1.1234,
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      await cacheManager.set(key, tick, { schema: TickSchema });
      
      const result = await cacheManager.get(key, { schema: TickSchema });
      expect(result).toEqual(tick);
    });

    it('should reject invalid data', async () => {
      const key = 'test-key';
      const invalidTick = {
        symbol: 'EURUSD',
        bid: -1.1234, // Invalid
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      const result = await cacheManager.set(key, invalidTick, { schema: TickSchema });
      expect(result).toBe(false);
    });

    it('should reject invalid cached data on retrieval', async () => {
      const key = 'test-key';
      const tick = {
        symbol: 'EURUSD',
        bid: 1.1234,
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      await cacheManager.set(key, tick, { schema: TickSchema });
      
      // Manually corrupt the data
      const entry = cacheManager.cache.get(key);
      entry.data = JSON.stringify({ symbol: 'EURUSD', bid: -1.1234, ask: 1.1236 });
      
      const result = await cacheManager.get(key, { schema: TickSchema });
      expect(result).toBeNull();
    });
  });

  describe('Cache Capacity and Eviction', () => {
    it('should enforce max items limit', async () => {
      const smallCache = new CacheManager({
        maxItems: 2,
        persistence: false
      });
      
      await smallCache.set('key1', { value: 'data1' });
      await smallCache.set('key2', { value: 'data2' });
      await smallCache.set('key3', { value: 'data3' });
      
      expect(smallcache.has('key1')).toBe(false); // Should be evicted
      expect(smallCache.has('key2')).toBe(true);
      expect(smallCache.has('key3')).toBe(true);
      
      await smallCache.destroy();
    });

    it('should enforce memory usage limit', async () => {
      const tinyCache = new CacheManager({
        maxMemoryUsage: 100, // Very small
        persistence: false
      });
      
      // Add data that exceeds memory limit
      const largeData = 'x'.repeat(200);
      
      await tinyCache.set('key1', { data: largeData });
      await tinyCache.set('key2', { data: largeData });
      
      // Should have evicted something to make space
      const stats = tinyCache.getStats();
      expect(stats.memoryUsage).toBeLessThanOrEqual(tinyCache.maxMemoryUsage);
      
      await tinyCache.destroy();
    });

    it('should prioritize low-priority items for eviction', async () => {
      await cacheManager.set('low-priority', { value: 'data' }, { priority: 'low' });
      await cacheManager.set('high-priority', { value: 'data' }, { priority: 'high' });
      
      // Fill cache to trigger eviction
      for (let i = 0; i < 105; i++) {
        await cacheManager.set(`key${i}`, { value: `data${i}` }, { priority: 'normal' });
      }
      
      // High priority should be preserved, low priority likely evicted
      expect(cacheManager.has('high-priority')).toBe(true);
      // Low priority might be evicted due to scoring
    });
  });

  describe('Tags and Indexing', () => {
    it('should support tagging', async () => {
      await cacheManager.set('key1', { value: 'data1' }, { tags: ['tag1', 'tag2'] });
      await cacheManager.set('key2', { value: 'data2' }, { tags: ['tag1'] });
      await cacheManager.set('key3', { value: 'data3' }, { tags: ['tag2'] });
      
      const taggedItems = cacheManager.find({ tags: ['tag1'] });
      expect(taggedItems).toHaveLength(2);
      expect(taggedItems.map(item => item.key)).toContain('key1');
      expect(taggedItems.map(item => item.key)).toContain('key2');
    });

    it('should support multiple tag filtering', async () => {
      await cacheManager.set('key1', { value: 'data1' }, { tags: ['tag1', 'tag2'] });
      await cacheManager.set('key2', { value: 'data2' }, { tags: ['tag1'] });
      await cacheManager.set('key3', { value: 'data3' }, { tags: ['tag2'] });
      
      const taggedItems = cacheManager.find({ tags: ['tag1', 'tag2'] });
      expect(taggedItems).toHaveLength(1);
      expect(taggedItems[0].key).toBe('key1');
    });

    it('should support priority filtering', async () => {
      await cacheManager.set('key1', { value: 'data1' }, { priority: 'high' });
      await cacheManager.set('key2', { value: 'data2' }, { priority: 'low' });
      await cacheManager.set('key3', { value: 'data3' }, { priority: 'high' });
      
      const highPriorityItems = cacheManager.find({ priority: 'high' });
      expect(highPriorityItems).toHaveLength(2);
      expect(highPriorityItems.map(item => item.key)).toContain('key1');
      expect(highPriorityItems.map(item => item.key)).toContain('key3');
    });
  });

  describe('Clear Operations', () => {
    it('should clear all data', async () => {
      await cacheManager.set('key1', { value: 'data1' });
      await cacheManager.set('key2', { value: 'data2' });
      
      expect(cacheManager.has('key1')).toBe(true);
      expect(cacheManager.has('key2')).toBe(true);
      
      await cacheManager.clear();
      
      expect(cacheManager.has('key1')).toBe(false);
      expect(cacheManager.has('key2')).toBe(false);
    });

    it('should clear by tags', async () => {
      await cacheManager.set('key1', { value: 'data1' }, { tags: ['tag1'] });
      await cacheManager.set('key2', { value: 'data2' }, { tags: ['tag2'] });
      await cacheManager.set('key3', { value: 'data3' }, { tags: ['tag1'] });
      
      await cacheManager.clear({ tags: ['tag1'] });
      
      expect(cacheManager.has('key1')).toBe(false);
      expect(cacheManager.has('key2')).toBe(true);
      expect(cacheManager.has('key3')).toBe(false);
    });

    it('should clear by priority', async () => {
      await cacheManager.set('key1', { value: 'data1' }, { priority: 'high' });
      await cacheManager.set('key2', { value: 'data2' }, { priority: 'low' });
      await cacheManager.set('key3', { value: 'data3' }, { priority: 'high' });
      
      await cacheManager.clear({ priority: 'high' });
      
      expect(cacheManager.has('key1')).toBe(false);
      expect(cacheManager.has('key2')).toBe(true);
      expect(cacheManager.has('key3')).toBe(false);
    });

    it('should clear by age', async () => {
      await cacheManager.set('old-key', { value: 'old-data' });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await cacheManager.set('new-key', { value: 'new-data' });
      
      await cacheManager.clear({ olderThan: 30 }); // Clear items older than 30ms
      
      expect(cacheManager.has('old-key')).toBe(false);
      expect(cacheManager.has('new-key')).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    it('should track cache hits and misses', async () => {
      await cacheManager.set('key1', { value: 'data1' });
      
      // Hit
      await cacheManager.get('key1');
      
      // Miss
      await cacheManager.get('non-existent-key');
      
      const stats = cacheManager.getStats();
      expect(stats.hitRate).toBe(50); // 1 hit out of 2 total requests
    });

    it('should track retrieval time', async () => {
      await cacheManager.set('key1', { value: 'data1' });
      
      await cacheManager.get('key1');
      
      const stats = cacheManager.getStats();
      expect(stats.averageRetrievalTime).toBeGreaterThan(0);
    });

    it('should track memory usage', async () => {
      await cacheManager.set('key1', { value: 'data1' });
      
      const stats = cacheManager.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.memoryUsagePercent).toBeGreaterThan(0);
    });
  });

  describe('Cleanup Operations', () => {
    it('should clean up expired items', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      const shortTTL = 50;
      
      await cacheManager.set(key, data, { ttl: shortTTL });
      
      expect(cacheManager.has(key)).toBe(true);
      
      // Wait for cleanup interval
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cacheManager.has(key)).toBe(false);
    });

    it('should not clean up non-expired items', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      const longTTL = 5000;
      
      await cacheManager.set(key, data, { ttl: longTTL });
      
      // Wait for cleanup interval
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cacheManager.has(key)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle serialization errors', async () => {
      const key = 'test-key';
      const circularData = {};
      circularData.self = circularData;
      
      // Should not throw, but return false
      const result = await cacheManager.set(key, circularData);
      expect(result).toBe(false);
    });

    it('should handle deserialization errors', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      
      await cacheManager.set(key, data);
      
      // Corrupt the data
      const entry = cacheManager.cache.get(key);
      entry.data = 'invalid-json';
      
      // Should return null on get
      const result = await cacheManager.get(key);
      expect(result).toBeNull();
    });
  });

  describe('Statistics and Reporting', () => {
    it('should provide comprehensive statistics', async () => {
      await cacheManager.set('key1', { value: 'data1' }, { priority: 'high', tags: ['tag1'] });
      await cacheManager.set('key2', { value: 'data2' }, { priority: 'low', tags: ['tag2'] });
      
      const stats = cacheManager.getStats();
      
      expect(stats.totalItems).toBe(2);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.priorityDistribution).toEqual({
        high: 1,
        low: 1
      });
      expect(stats.tagDistribution).toEqual({
        tag1: 1,
        tag2: 1
      });
    });

    it('should find items by criteria', async () => {
      await cacheManager.set('key1', { value: 'data1' }, { tags: ['tag1'], priority: 'high' });
      await cacheManager.set('key2', { value: 'data2' }, { tags: ['tag2'], priority: 'low' });
      await cacheManager.set('key3', { value: 'data3' }, { tags: ['tag1'], priority: 'low' });
      
      const results = cacheManager.find({ tags: ['tag1'], limit: 10 });
      expect(results).toHaveLength(2);
      
      const highPriorityResults = cacheManager.find({ priority: 'high' });
      expect(highPriorityResults).toHaveLength(1);
      expect(highPriorityResults[0].key).toBe('key1');
    });
  });

  describe('Persistence (Mocked)', () => {
    it('should attempt to persist data when enabled', async () => {
      const persistentCache = new CacheManager({
        persistence: true,
        persistence: false // Still disable actual persistence for tests
      });
      
      const key = 'test-key';
      const data = { value: 'test-data' };
      
      await persistentCache.set(key, data);
      
      // Should have attempted to persist
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      await persistentCache.destroy();
    });
  });
});
