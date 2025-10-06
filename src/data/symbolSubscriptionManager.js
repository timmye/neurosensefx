/**
 * Symbol Subscription Manager
 * Handles efficient subscription batching, rate limiting, and cleanup
 */

import { writable, derived } from 'svelte/store';
import { wsManager } from './websocketManager.js';

// Subscription state management
export const subscriptionState = writable({
  activeSubscriptions: new Set(),
  pendingSubscriptions: new Set(),
  failedSubscriptions: new Set(),
  lastBatchTime: null,
  batchQueue: []
});

export const subscriptionMetrics = writable({
  totalSubscriptions: 0,
  successfulSubscriptions: 0,
  failedSubscriptions: 0,
  averageSubscriptionTime: 0,
  rateLimitHits: 0,
  lastSubscriptionTime: null
});

// Derived stores for convenience
export const activeSubscriptionCount = derived(
  subscriptionState,
  $state => $state.activeSubscriptions.size
);

export const hasPendingSubscriptions = derived(
  subscriptionState,
  $state => $state.pendingSubscriptions.size > 0
);

class SubscriptionManager {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 10;
    this.batchDelay = options.batchDelay || 100; // ms
    this.maxConcurrentRequests = options.maxConcurrentRequests || 3;
    this.rateLimitDelay = options.rateLimitDelay || 1000; // ms
    this.subscriptionTimeout = options.subscriptionTimeout || 10000; // ms
    this.maxRetries = options.maxRetries || 3;
    this.retryBackoffMultiplier = options.retryBackoffMultiplier || 2;
    
    // Subscription tracking
    this.subscriptions = new Map(); // symbol -> subscription info
    this.batchQueue = [];
    this.batchTimer = null;
    this.activeRequests = new Set();
    this.rateLimitTimer = null;
    this.lastRequestTime = 0;
    
    // Performance tracking
    this.subscriptionTimes = [];
    this.retryCounters = new Map(); // symbol -> retry count
    
    // Event handlers
    this.eventHandlers = new Map();
  }

  /**
   * Subscribe to a symbol with intelligent batching
   */
  async subscribe(symbol, options = {}) {
    const startTime = performance.now();
    
    try {
      // Check if already subscribed
      if (this.subscriptions.has(symbol) && 
          this.subscriptions.get(symbol).status === 'active') {
        console.log(`[SubscriptionManager] Already subscribed to ${symbol}`);
        return this.subscriptions.get(symbol);
      }

      // Add to pending subscriptions
      subscriptionState.update(state => ({
        ...state,
        pendingSubscriptions: new Set([...state.pendingSubscriptions, symbol])
      }));

      // Create subscription record
      const subscription = {
        symbol,
        status: 'pending',
        createdAt: Date.now(),
        options,
        retryCount: 0
      };
      
      this.subscriptions.set(symbol, subscription);
      
      // Add to batch queue
      this.addToBatchQueue(symbol, options);
      
      // Wait for subscription to complete
      const result = await this.waitForSubscription(symbol);
      
      // Update metrics
      this.updateSubscriptionMetrics(startTime, true);
      
      return result;
      
    } catch (error) {
      console.error(`[SubscriptionManager] Failed to subscribe to ${symbol}:`, error);
      this.updateSubscriptionMetrics(startTime, false);
      throw error;
    }
  }

  /**
   * Subscribe to multiple symbols
   */
  async subscribeMultiple(symbols, options = {}) {
    const results = [];
    
    // Process in batches to respect rate limits
    for (let i = 0; i < symbols.length; i += this.batchSize) {
      const batch = symbols.slice(i, i + this.batchSize);
      const batchPromises = batch.map(symbol => 
        this.subscribe(symbol, options).catch(error => ({ symbol, error }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Rate limiting delay between batches
      if (i + this.batchSize < symbols.length) {
        await this.delay(this.rateLimitDelay);
      }
    }
    
    return results;
  }

  /**
   * Unsubscribe from a symbol
   */
  async unsubscribe(symbol) {
    try {
      const subscription = this.subscriptions.get(symbol);
      if (!subscription) {
        console.log(`[SubscriptionManager] No subscription found for ${symbol}`);
        return null;
      }

      // Remove from batch queue if pending
      this.removeFromBatchQueue(symbol);
      
      // Send unsubscribe request if active
      if (subscription.status === 'active' && wsManager.isConnected()) {
        const message = {
          type: 'unsubscribe',
          symbols: [symbol]
        };
        
        wsManager.send(message);
      }

      // Update subscription state
      subscription.status = 'unsubscribed';
      subscription.unsubscribedAt = Date.now();
      
      // Update state stores
      subscriptionState.update(state => ({
        ...state,
        activeSubscriptions: new Set([...state.activeSubscriptions].filter(s => s !== symbol)),
        pendingSubscriptions: new Set([...state.pendingSubscriptions].filter(s => s !== symbol))
      }));

      // Clean up retry counter
      this.retryCounters.delete(symbol);
      
      console.log(`[SubscriptionManager] Unsubscribed from ${symbol}`);
      return subscription;
      
    } catch (error) {
      console.error(`[SubscriptionManager] Failed to unsubscribe from ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from all symbols
   */
  async unsubscribeAll() {
    const activeSymbols = Array.from(this.subscriptions.keys())
      .filter(symbol => this.subscriptions.get(symbol).status === 'active');
    
    const results = await Promise.allSettled(
      activeSymbols.map(symbol => this.unsubscribe(symbol))
    );
    
    return results;
  }

  /**
   * Add symbol to batch queue
   */
  addToBatchQueue(symbol, options) {
    this.batchQueue.push({ symbol, options, timestamp: Date.now() });
    
    // Schedule batch processing
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.batchDelay);
    }
  }

  /**
   * Remove symbol from batch queue
   */
  removeFromBatchQueue(symbol) {
    this.batchQueue = this.batchQueue.filter(item => item.symbol !== symbol);
  }

  /**
   * Process batch of subscriptions
   */
  async processBatch() {
    if (this.batchQueue.length === 0) {
      this.batchTimer = null;
      return;
    }

    // Check rate limiting
    if (this.isRateLimited()) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.rateLimitDelay);
      return;
    }

    // Check concurrent request limit
    if (this.activeRequests.size >= this.maxConcurrentRequests) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, 100);
      return;
    }

    // Get batch to process
    const batch = this.batchQueue.splice(0, this.batchSize);
    this.batchTimer = null;

    // Process batch
    const requestPromise = this.sendBatchRequest(batch);
    this.activeRequests.add(requestPromise);

    try {
      await requestPromise;
    } catch (error) {
      console.error('[SubscriptionManager] Batch request failed:', error);
    } finally {
      this.activeRequests.delete(requestPromise);
    }

    // Process next batch if queue is not empty
    if (this.batchQueue.length > 0) {
      this.processBatch();
    }
  }

  /**
   * Send batch subscription request
   */
  async sendBatchRequest(batch) {
    if (!wsManager.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    const symbols = batch.map(item => item.symbol);
    const requestId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const message = {
      type: 'subscribe_multiple',
      symbols,
      requestId,
      adrLookbackDays: 14
    };

    // Update request tracking
    this.lastRequestTime = Date.now();
    subscriptionState.update(state => ({
      ...state,
      lastBatchTime: this.lastRequestTime,
      batchQueue: [...this.batchQueue]
    }));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Subscription request timeout'));
      }, this.subscriptionTimeout);

      // Set up response handler
      const handleResponse = (data) => {
        if (data.requestId === requestId) {
          clearTimeout(timeout);
          wsManager.off('message', handleResponse);
          
          if (data.type === 'subscription_success') {
            this.handleBatchSuccess(data.symbols || symbols);
            resolve(data);
          } else if (data.type === 'subscription_error') {
            this.handleBatchError(data.symbols || symbols, data.error);
            reject(new Error(data.error || 'Subscription failed'));
          } else {
            // Unexpected response format
            this.handleBatchSuccess(symbols);
            resolve(data);
          }
        }
      };

      wsManager.on('message', handleResponse);
      wsManager.send(message);
    });
  }

  /**
   * Handle successful batch subscription
   */
  handleBatchSuccess(symbols) {
    const now = Date.now();
    
    symbols.forEach(symbol => {
      const subscription = this.subscriptions.get(symbol);
      if (subscription) {
        subscription.status = 'active';
        subscription.activatedAt = now;
        
        subscriptionState.update(state => ({
          ...state,
          activeSubscriptions: new Set([...state.activeSubscriptions, symbol]),
          pendingSubscriptions: new Set([...state.pendingSubscriptions].filter(s => s !== symbol))
        }));
        
        subscriptionMetrics.update(metrics => ({
          ...metrics,
          successfulSubscriptions: metrics.successfulSubscriptions + 1,
          lastSubscriptionTime: now
        }));
      }
    });
    
    this.emit('batchSuccess', symbols);
  }

  /**
   * Handle failed batch subscription
   */
  handleBatchError(symbols, error) {
    symbols.forEach(symbol => {
      const subscription = this.subscriptions.get(symbol);
      if (subscription) {
        subscription.status = 'failed';
        subscription.error = error;
        subscription.failedAt = Date.now();
        
        // Schedule retry if within limits
        this.scheduleRetry(symbol);
      }
    });
    
    subscriptionMetrics.update(metrics => ({
      ...metrics,
      failedSubscriptions: metrics.failedSubscriptions + symbols.length
    }));
    
    this.emit('batchError', { symbols, error });
  }

  /**
   * Schedule retry for failed subscription
   */
  async scheduleRetry(symbol) {
    const subscription = this.subscriptions.get(symbol);
    if (!subscription) return;

    const retryCount = this.retryCounters.get(symbol) || 0;
    
    if (retryCount >= this.maxRetries) {
      console.error(`[SubscriptionManager] Max retries exceeded for ${symbol}`);
      subscriptionState.update(state => ({
        ...state,
        failedSubscriptions: new Set([...state.failedSubscriptions, symbol]),
        pendingSubscriptions: new Set([...state.pendingSubscriptions].filter(s => s !== symbol))
      }));
      return;
    }

    const retryDelay = this.rateLimitDelay * Math.pow(this.retryBackoffMultiplier, retryCount);
    this.retryCounters.set(symbol, retryCount + 1);

    console.log(`[SubscriptionManager] Scheduling retry ${retryCount + 1} for ${symbol} in ${retryDelay}ms`);

    setTimeout(async () => {
      try {
        await this.subscribe(symbol, subscription.options);
        this.retryCounters.delete(symbol);
      } catch (error) {
        console.error(`[SubscriptionManager] Retry failed for ${symbol}:`, error);
      }
    }, retryDelay);
  }

  /**
   * Wait for subscription to complete
   */
  async waitForSubscription(symbol, timeout = this.subscriptionTimeout) {
    return new Promise((resolve, reject) => {
      const checkSubscription = () => {
        const subscription = this.subscriptions.get(symbol);
        if (!subscription) {
          reject(new Error('Subscription not found'));
          return;
        }

        if (subscription.status === 'active') {
          resolve(subscription);
          return;
        }

        if (subscription.status === 'failed') {
          reject(new Error(subscription.error || 'Subscription failed'));
          return;
        }

        // Check timeout
        if (Date.now() - subscription.createdAt > timeout) {
          reject(new Error('Subscription timeout'));
          return;
        }

        // Continue waiting
        setTimeout(checkSubscription, 100);
      };

      checkSubscription();
    });
  }

  /**
   * Check if rate limited
   */
  isRateLimited() {
    const now = Date.now();
    return (now - this.lastRequestTime) < this.rateLimitDelay;
  }

  /**
   * Update subscription metrics
   */
  updateSubscriptionMetrics(startTime, success) {
    const processingTime = performance.now() - startTime;
    this.subscriptionTimes.push(processingTime);
    
    // Keep only recent measurements
    if (this.subscriptionTimes.length > 100) {
      this.subscriptionTimes.shift();
    }

    subscriptionMetrics.update(metrics => ({
      ...metrics,
      totalSubscriptions: metrics.totalSubscriptions + 1,
      averageSubscriptionTime: this.subscriptionTimes.reduce((a, b) => a + b, 0) / this.subscriptionTimes.length
    }));

    if (this.isRateLimited()) {
      subscriptionMetrics.update(metrics => ({
        ...metrics,
        rateLimitHits: metrics.rateLimitHits + 1
      }));
    }
  }

  /**
   * Get subscription status
   */
  getSubscriptionStatus(symbol) {
    return this.subscriptions.get(symbol) || null;
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions() {
    return Array.from(this.subscriptions.entries())
      .filter(([_, subscription]) => subscription.status === 'active')
      .map(([symbol, subscription]) => ({ symbol, ...subscription }));
  }

  /**
   * Get subscription statistics
   */
  getStats() {
    const total = this.subscriptions.size;
    const active = Array.from(this.subscriptions.values())
      .filter(sub => sub.status === 'active').length;
    const pending = Array.from(this.subscriptions.values())
      .filter(sub => sub.status === 'pending').length;
    const failed = Array.from(this.subscriptions.values())
      .filter(sub => sub.status === 'failed').length;

    return {
      total,
      active,
      pending,
      failed,
      queuedInBatch: this.batchQueue.length,
      activeRequests: this.activeRequests.size,
      averageSubscriptionTime: this.subscriptionTimes.length > 0 
        ? this.subscriptionTimes.reduce((a, b) => a + b, 0) / this.subscriptionTimes.length 
        : 0
    };
  }

  /**
   * Clean up old subscriptions
   */
  cleanup(maxAge = 3600000) { // 1 hour default
    const now = Date.now();
    const toRemove = [];

    for (const [symbol, subscription] of this.subscriptions.entries()) {
      if (subscription.status === 'failed' && 
          (now - subscription.failedAt) > maxAge) {
        toRemove.push(symbol);
      } else if (subscription.status === 'unsubscribed' && 
                 (now - subscription.unsubscribedAt) > maxAge) {
        toRemove.push(symbol);
      }
    }

    toRemove.forEach(symbol => {
      this.subscriptions.delete(symbol);
      this.retryCounters.delete(symbol);
    });

    if (toRemove.length > 0) {
      console.log(`[SubscriptionManager] Cleaned up ${toRemove.length} old subscriptions`);
    }

    return toRemove.length;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Event emitter methods
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, ...args) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[SubscriptionManager] Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * Clear all subscriptions and reset state
   */
  async clear() {
    await this.unsubscribeAll();
    
    this.subscriptions.clear();
    this.batchQueue = [];
    this.retryCounters.clear();
    this.subscriptionTimes = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    subscriptionState.set({
      activeSubscriptions: new Set(),
      pendingSubscriptions: new Set(),
      failedSubscriptions: new Set(),
      lastBatchTime: null,
      batchQueue: []
    });
    
    subscriptionMetrics.set({
      totalSubscriptions: 0,
      successfulSubscriptions: 0,
      failedSubscriptions: 0,
      averageSubscriptionTime: 0,
      rateLimitHits: 0,
      lastSubscriptionTime: null
    });
  }
}

// Create singleton instance
export const subscriptionManager = new SubscriptionManager();

// Export for testing
export { SubscriptionManager };
