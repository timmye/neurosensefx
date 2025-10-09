/**
 * Data Caching Layer
 * Provides in-memory caching with persistence and intelligent cache invalidation
 */

import { writable, derived } from 'svelte/store';
import { TickSchema, SymbolDataPackageSchema, HistoricalBarSchema } from './schema.js';

// Cache state management
export const cacheState = writable({
  memoryUsage: 0,
  cacheHits: 0,
  cacheMisses: 0,
  evictionCount: 0,
  lastCleanup: null,
  totalItems: 0
});

export const cacheMetrics = writable({
  hitRate: 0,
  averageRetrievalTime: 0,
  memoryEfficiency: 0,
  oldestItem: null,
  newestItem: null
});

// Derived stores for convenience
export const cacheHitRate = derived(
  [cacheState],
  ([$state]) => {
    const total = $state.cacheHits + $state.cacheMisses;
    return total > 0 ? ($state.cacheHits / total) * 100 : 0;
  }
);

class CacheManager {
  constructor(options = {}) {
    // Cache configuration
    this.maxMemoryUsage = options.maxMemoryUsage || 50 * 1024 * 1024; // 50MB
    this.maxItems = options.maxItems || 10000;
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
    this.persistenceEnabled = options.persistence !== false;
    this.compressionEnabled = options.compression || false;
    
    // Cache storage
    this.cache = new Map(); // key -> cache entry
    this.indexes = new Map(); // index type -> Map(index value -> Set of keys)
    this.metadata = new Map(); // key -> metadata
    
    // Performance tracking
    this.accessTimes = new Map(); // key -> last access time
    this.retrievalTimes = [];
    this.currentMemoryUsage = 0;
    
    // Internal state
    this.cleanupTimer = null;
    this.isCleaningUp = false;
    
    // Initialize
    this.initialize();
  }

  /**
   * Initialize cache manager
   */
  async initialize() {
    // Load persisted data if enabled
    if (this.persistenceEnabled) {
      await this.loadPersistedData();
    }
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    console.log('[CacheManager] Initialized with configuration:', {
      maxMemoryUsage: this.maxMemoryUsage,
      maxItems: this.maxItems,
      defaultTTL: this.defaultTTL,
      persistenceEnabled: this.persistenceEnabled
    });
  }

  /**
   * Store data in cache
   */
  async set(key, data, options = {}) {
    const startTime = performance.now();
    
    try {
      const ttl = options.ttl || this.defaultTTL;
      const priority = options.priority || 'normal';
      const tags = options.tags || [];
      const compress = this.compressionEnabled && (options.compress !== false);
      
      // Validate data if schema provided
      if (options.schema) {
        const result = options.schema.safeParse(data);
        if (!result.success) {
          throw new Error(`Invalid data schema: ${result.error}`);
        }
        data = result.data;
      }
      
      // Serialize data
      const serializedData = this.serialize(data, compress);
      const dataSize = this.calculateSize(serializedData);
      
      // Check if we need to make space
      await this.ensureCapacity(dataSize);
      
      // Remove existing entry if it exists
      if (this.cache.has(key)) {
        this.remove(key);
      }
      
      // Create cache entry
      const entry = {
        key,
        data: serializedData,
        compressed: compress,
        size: dataSize,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttl,
        accessCount: 0,
        priority,
        tags,
        version: this.metadata.get(key)?.version || 0
      };
      
      // Store entry
      this.cache.set(key, entry);
      this.accessTimes.set(key, Date.now());
      this.currentMemoryUsage += dataSize;
      
      // Update indexes
      this.updateIndexes(key, entry);
      
      // Persist if enabled
      if (this.persistenceEnabled && options.persist !== false) {
        await this.persistEntry(key, entry);
      }
      
      // Update metrics
      this.updateMetrics();
      
      console.debug(`[CacheManager] Stored ${key} (${dataSize} bytes)`);
      
      return true;
      
    } catch (error) {
      console.error(`[CacheManager] Failed to store ${key}:`, error);
      return false;
    }
  }

  /**
   * Retrieve data from cache
   */
  async get(key, options = {}) {
    const startTime = performance.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.recordMiss();
        return null;
      }
      
      // Check expiration
      if (Date.now() > entry.expiresAt) {
        this.remove(key);
        this.recordMiss();
        return null;
      }
      
      // Update access information
      entry.accessCount++;
      this.accessTimes.set(key, Date.now());
      
      // Deserialize data
      const data = this.deserialize(entry.data, entry.compressed);
      
      // Validate if schema provided
      if (options.schema) {
        const result = options.schema.safeParse(data);
        if (!result.success) {
          console.warn(`[CacheManager] Cached data validation failed for ${key}:`, result.error);
          this.remove(key);
          this.recordMiss();
          return null;
        }
      }
      
      // Record hit
      this.recordHit();
      
      // Update performance metrics
      const retrievalTime = performance.now() - startTime;
      this.recordRetrievalTime(retrievalTime);
      
      console.debug(`[CacheManager] Retrieved ${key} (${retrievalTime.toFixed(2)}ms)`);
      
      return data;
      
    } catch (error) {
      console.error(`[CacheManager] Failed to retrieve ${key}:`, error);
      this.recordMiss();
      return null;
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.remove(key);
      return false;
    }
    
    return true;
  }

  /**
   * Remove entry from cache
   */
  remove(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Remove from cache
    this.cache.delete(key);
    this.accessTimes.delete(key);
    this.currentMemoryUsage -= entry.size;
    
    // Remove from indexes
    this.removeFromIndexes(key, entry);
    
    // Remove from persistence
    if (this.persistenceEnabled) {
      this.removePersistedEntry(key);
    }
    
    // Update metrics
    this.updateMetrics();
    
    console.debug(`[CacheManager] Removed ${key}`);
    return true;
  }

  /**
   * Clear all cache entries
   */
  async clear(options = {}) {
    const { tags, priority, olderThan } = options;
    
    if (tags) {
      // Clear by tags
      for (const tag of tags) {
        const tagIndex = this.indexes.get(`tag:${tag}`);
        if (tagIndex) {
          for (const key of tagIndex) {
            this.remove(key);
          }
        }
      }
    } else if (priority) {
      // Clear by priority
      for (const [key, entry] of this.cache.entries()) {
        if (entry.priority === priority) {
          this.remove(key);
        }
      }
    } else if (olderThan) {
      // Clear by age
      const cutoffTime = Date.now() - olderThan;
      for (const [key, entry] of this.cache.entries()) {
        if (entry.createdAt < cutoffTime) {
          this.remove(key);
        }
      }
    } else {
      // Clear all
      this.cache.clear();
      this.accessTimes.clear();
      this.indexes.clear();
      this.currentMemoryUsage = 0;
      
      if (this.persistenceEnabled) {
        await this.clearPersistedData();
      }
    }
    
    this.updateMetrics();
    console.log('[CacheManager] Cache cleared', options);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    const stats = {
      totalItems: entries.length,
      memoryUsage: this.currentMemoryUsage,
      memoryUsagePercent: (this.currentMemoryUsage / this.maxMemoryUsage) * 100,
      hitRate: this.calculateHitRate(),
      averageRetrievalTime: this.calculateAverageRetrievalTime(),
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.createdAt)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.createdAt)) : null,
      expiredItems: entries.filter(e => e.expiresAt < now).length,
      priorityDistribution: this.calculatePriorityDistribution(),
      tagDistribution: this.calculateTagDistribution()
    };
    
    return stats;
  }

  /**
   * Find entries by criteria
   */
  find(criteria = {}) {
    const { tags, priority, olderThan, newerThan, limit = 100 } = criteria;
    const results = [];
    
    for (const [key, entry] of this.cache.entries()) {
      // Check expiration
      if (Date.now() > entry.expiresAt) continue;
      
      // Check priority
      if (priority && entry.priority !== priority) continue;
      
      // Check age
      if (olderThan && entry.createdAt < (Date.now() - olderThan)) continue;
      if (newerThan && entry.createdAt > (Date.now() - newerThan)) continue;
      
      // Check tags
      if (tags && tags.length > 0) {
        const hasAllTags = tags.every(tag => entry.tags.includes(tag));
        if (!hasAllTags) continue;
      }
      
      results.push({
        key,
        size: entry.size,
        createdAt: entry.createdAt,
        accessCount: entry.accessCount,
        priority: entry.priority,
        tags: entry.tags
      });
      
      if (results.length >= limit) break;
    }
    
    return results;
  }

  /**
   * Ensure cache has capacity for new data
   */
  async ensureCapacity(requiredSize) {
    if (this.currentMemoryUsage + requiredSize <= this.maxMemoryUsage && 
        this.cache.size < this.maxItems) {
      return;
    }
    
    console.log('[CacheManager] Cache capacity exceeded, starting eviction');
    
    // Sort entries by priority and last access time
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      entry,
      score: this.calculateEvictionScore(entry)
    }));
    
    entries.sort((a, b) => a.score - b.score); // Lower score = higher eviction priority
    
    // Evict entries until we have enough space
    let evicted = 0;
    for (const { key, entry } of entries) {
      if (this.currentMemoryUsage + requiredSize <= this.maxMemoryUsage && 
          this.cache.size < this.maxItems) {
        break;
      }
      
      this.remove(key);
      evicted++;
      
      if (evicted >= 100) break; // Limit eviction batch size
    }
    
    if (evicted > 0) {
      cacheState.update(state => ({
        ...state,
        evictionCount: state.evictionCount + evicted
      }));
      
      console.log(`[CacheManager] Evicted ${evicted} entries`);
    }
  }

  /**
   * Calculate eviction score for an entry
   */
  calculateEvictionScore(entry) {
    const now = Date.now();
    const age = now - entry.createdAt;
    const timeSinceAccess = now - this.accessTimes.get(entry.key);
    
    // Priority weights
    const priorityWeights = {
      low: 1,
      normal: 2,
      high: 3,
      critical: 4
    };
    
    // Calculate score (lower = more likely to evict)
    const score = (
      priorityWeights[entry.priority] * 100 +
      (entry.accessCount * 10) +
      (timeSinceAccess / 1000) -
      (age / 1000)
    );
    
    return score;
  }

  /**
   * Update cache indexes
   */
  updateIndexes(key, entry) {
    // Tag indexes
    for (const tag of entry.tags) {
      if (!this.indexes.has(`tag:${tag}`)) {
        this.indexes.set(`tag:${tag}`, new Set());
      }
      this.indexes.get(`tag:${tag}`).add(key);
    }
    
    // Priority index
    if (!this.indexes.has(`priority:${entry.priority}`)) {
      this.indexes.set(`priority:${entry.priority}`, new Set());
    }
    this.indexes.get(`priority:${entry.priority}`).add(key);
  }

  /**
   * Remove from cache indexes
   */
  removeFromIndexes(key, entry) {
    // Tag indexes
    for (const tag of entry.tags) {
      const tagIndex = this.indexes.get(`tag:${tag}`);
      if (tagIndex) {
        tagIndex.delete(key);
        if (tagIndex.size === 0) {
          this.indexes.delete(`tag:${tag}`);
        }
      }
    }
    
    // Priority index
    const priorityIndex = this.indexes.get(`priority:${entry.priority}`);
    if (priorityIndex) {
      priorityIndex.delete(key);
      if (priorityIndex.size === 0) {
        this.indexes.delete(`priority:${entry.priority}`);
      }
    }
  }

  /**
   * Serialize data for storage
   */
  serialize(data, compress = false) {
    try {
      let serialized = JSON.stringify(data);
      
      if (compress && serialized.length > 1024) {
        // Simple compression simulation (in production, use proper compression)
        serialized = this.simpleCompress(serialized);
      }
      
      return serialized;
    } catch (error) {
      console.error('[CacheManager] Serialization failed:', error);
      throw error;
    }
  }

  /**
   * Deserialize data from storage
   */
  deserialize(data, compressed = false) {
    try {
      if (compressed) {
        data = this.simpleDecompress(data);
      }
      
      return JSON.parse(data);
    } catch (error) {
      console.error('[CacheManager] Deserialization failed:', error);
      throw error;
    }
  }

  /**
   * Simple compression (FUTURE: implement actual compression)
   * TODO: Implement real compression for cached data
   * Currently returns JSON string - no compression applied
   */
  compress(data) {
    // FUTURE_IMPLEMENTATION: Add real compression for cache data
    // Consider using compression library like pako or lz-string
    console.warn('[dataCache] Using placeholder compression - implement real compression for production');
    return JSON.stringify(data);
  }

  /**
   * Simple decompression (placeholder)
   */
  simpleDecompress(data) {
    // In production, use proper decompression
    return data;
  }

  /**
   * Calculate data size
   */
  calculateSize(data) {
    return new Blob([data]).size;
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Cleanup expired entries
   */
  async cleanup() {
    if (this.isCleaningUp) return;
    
    this.isCleaningUp = true;
    const startTime = performance.now();
    
    try {
      const now = Date.now();
      const expired = [];
      
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt < now) {
          expired.push(key);
        }
      }
      
      for (const key of expired) {
        this.remove(key);
      }
      
      const cleanupTime = performance.now() - startTime;
      
      if (expired.length > 0) {
        console.log(`[CacheManager] Cleaned up ${expired.length} expired entries (${cleanupTime.toFixed(2)}ms)`);
      }
      
      cacheState.update(state => ({
        ...state,
        lastCleanup: now
      }));
      
    } catch (error) {
      console.error('[CacheManager] Cleanup failed:', error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  /**
   * Record cache hit
   */
  recordHit() {
    cacheState.update(state => ({
      ...state,
      cacheHits: state.cacheHits + 1
    }));
  }

  /**
   * Record cache miss
   */
  recordMiss() {
    cacheState.update(state => ({
      ...state,
      cacheMisses: state.cacheMisses + 1
    }));
  }

  /**
   * Record retrieval time
   */
  recordRetrievalTime(time) {
    this.retrievalTimes.push(time);
    
    // Keep only recent measurements
    if (this.retrievalTimes.length > 1000) {
      this.retrievalTimes.shift();
    }
  }

  /**
   * Update cache metrics
   */
  updateMetrics() {
    const stats = this.getStats();
    
    cacheState.set({
      memoryUsage: this.currentMemoryUsage,
      cacheHits: cacheState.cacheHits || 0,
      cacheMisses: cacheState.cacheMisses || 0,
      evictionCount: cacheState.evictionCount || 0,
      lastCleanup: cacheState.lastCleanup || null,
      totalItems: stats.totalItems
    });
    
    cacheMetrics.set({
      hitRate: stats.hitRate,
      averageRetrievalTime: stats.averageRetrievalTime,
      memoryEfficiency: stats.memoryUsagePercent,
      oldestItem: stats.oldestEntry,
      newestItem: stats.newestEntry
    });
  }

  /**
   * Calculate hit rate
   */
  calculateHitRate() {
    const hits = cacheState.cacheHits || 0;
    const misses = cacheState.cacheMisses || 0;
    const total = hits + misses;
    
    return total > 0 ? (hits / total) * 100 : 0;
  }

  /**
   * Calculate average retrieval time
   */
  calculateAverageRetrievalTime() {
    if (this.retrievalTimes.length === 0) return 0;
    
    const sum = this.retrievalTimes.reduce((a, b) => a + b, 0);
    return sum / this.retrievalTimes.length;
  }

  /**
   * Calculate priority distribution
   */
  calculatePriorityDistribution() {
    const distribution = {};
    
    for (const entry of this.cache.values()) {
      distribution[entry.priority] = (distribution[entry.priority] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * Calculate tag distribution
   */
  calculateTagDistribution() {
    const distribution = {};
    
    for (const entry of this.cache.values()) {
      for (const tag of entry.tags) {
        distribution[tag] = (distribution[tag] || 0) + 1;
      }
    }
    
    return distribution;
  }

  /**
   * Persist cache entry to localStorage
   */
  async persistEntry(key, entry) {
    try {
      const persistData = {
        key,
        data: entry.data,
        compressed: entry.compressed,
        expiresAt: entry.expiresAt,
        priority: entry.priority,
        tags: entry.tags,
        version: entry.version
      };
      
      localStorage.setItem(`cache:${key}`, JSON.stringify(persistData));
    } catch (error) {
      console.warn(`[CacheManager] Failed to persist ${key}:`, error);
    }
  }

  /**
   * Remove persisted entry
   */
  removePersistedEntry(key) {
    try {
      localStorage.removeItem(`cache:${key}`);
    } catch (error) {
      console.warn(`[CacheManager] Failed to remove persisted ${key}:`, error);
    }
  }

  /**
   * Load persisted data
   */
  async loadPersistedData() {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('cache:'));
      let loaded = 0;
      
      for (const storageKey of keys) {
        try {
          const data = localStorage.getItem(storageKey);
          if (data) {
            const persistData = JSON.parse(data);
            
            // Check if still valid
            if (persistData.expiresAt > Date.now()) {
              const entry = {
                key: persistData.key,
                data: persistData.data,
                compressed: persistData.compressed,
                size: this.calculateSize(persistData.data),
                createdAt: Date.now(), // Reset creation time
                expiresAt: persistData.expiresAt,
                accessCount: 0,
                priority: persistData.priority,
                tags: persistData.tags || [],
                version: persistData.version || 0
              };
              
              this.cache.set(persistData.key, entry);
              this.accessTimes.set(persistData.key, Date.now());
              this.currentMemoryUsage += entry.size;
              this.updateIndexes(persistData.key, entry);
              
              loaded++;
            } else {
              // Remove expired persisted data
              localStorage.removeItem(storageKey);
            }
          }
        } catch (error) {
          console.warn(`[CacheManager] Failed to load ${storageKey}:`, error);
          localStorage.removeItem(storageKey);
        }
      }
      
      if (loaded > 0) {
        console.log(`[CacheManager] Loaded ${loaded} entries from persistence`);
      }
    } catch (error) {
      console.error('[CacheManager] Failed to load persisted data:', error);
    }
  }

  /**
   * Clear all persisted data
   */
  async clearPersistedData() {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('cache:'));
      
      for (const key of keys) {
        localStorage.removeItem(key);
      }
      
      console.log(`[CacheManager] Cleared ${keys.length} persisted entries`);
    } catch (error) {
      console.error('[CacheManager] Failed to clear persisted data:', error);
    }
  }

  /**
   * Destroy cache manager
   */
  async destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    await this.clear();
    
    console.log('[CacheManager] Destroyed');
  }
}

// Create singleton instance
export const cacheManager = new CacheManager();

// Export for testing
export { CacheManager };
