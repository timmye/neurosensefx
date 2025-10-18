/**
 * ConnectionManager - Centralized data flow management for NeuroSense FX
 * Handles WebSocket connections, symbol subscriptions, and data distribution to canvases
 */

import { writable, get } from 'svelte/store';
import { symbolStore } from './symbolStore.js';
import { dataSourceMode, wsStatus, availableSymbols, subscribe, unsubscribe } from './wsClient.js';
import { createLogger } from '../utils/debugLogger.js';

const logger = createLogger('ConnectionManager');

// Connection state for UI components
export const connectionState = writable({
  status: 'disconnected', // disconnected, connecting, connected, error
  activeSubscriptions: new Set(),
  lastError: null,
  retryCount: 0
});

class ConnectionManager {
  constructor() {
    // Track which canvases are subscribed to which symbols
    this.canvasSubscriptions = new Map(); // canvasId -> symbol
    this.symbolCanvases = new Map(); // symbol -> Set of canvasIds
    
    // Cache for symbol data to avoid duplicate requests
    this.symbolDataCache = new Map(); // symbol -> symbol data
    
    // Track subscription requests to prevent duplicates
    this.pendingSubscriptions = new Set(); // symbols being requested
    
    // Initialize connection monitoring
    this.initializeConnectionMonitoring();
  }
  
  /**
   * Subscribe a canvas to a symbol
   * @param {string} canvasId - Unique canvas identifier
   * @param {string} symbol - Symbol to subscribe to
   * @returns {Promise<Object>} - Symbol data for the canvas
   */
  async subscribeCanvas(canvasId, symbol) {
    logger.debug('Subscribing canvas to symbol', { canvasId, symbol });
    console.log(`[CONNECTION_DEBUG] subscribeCanvas called with canvasId: ${canvasId}, symbol: ${symbol}`);
    
    // Track the subscription
    this.canvasSubscriptions.set(canvasId, symbol);
    
    if (!this.symbolCanvases.has(symbol)) {
      this.symbolCanvases.set(symbol, new Set());
    }
    this.symbolCanvases.get(symbol).add(canvasId);
    
    // Get or fetch symbol data
    console.log(`[CONNECTION_DEBUG] Getting symbol data for ${symbol}`);
    const symbolData = await this.getSymbolData(symbol);
    console.log(`[CONNECTION_DEBUG] Received symbol data:`, symbolData);
    
    // Update connection state
    connectionState.update(state => ({
      ...state,
      activeSubscriptions: new Set(this.symbolCanvases.keys())
    }));
    
    return symbolData;
  }
  
  /**
   * Unsubscribe a canvas from a symbol
   * @param {string} canvasId - Canvas identifier
   */
  unsubscribeCanvas(canvasId) {
    const symbol = this.canvasSubscriptions.get(canvasId);
    if (!symbol) return;
    
    logger.debug('Unsubscribing canvas from symbol', { canvasId, symbol });
    
    // Remove canvas from symbol tracking
    this.canvasSubscriptions.delete(canvasId);
    
    const canvasSet = this.symbolCanvases.get(symbol);
    if (canvasSet) {
      canvasSet.delete(canvasId);
      
      // If no more canvases need this symbol, unsubscribe from WebSocket
      if (canvasSet.size === 0) {
        this.symbolCanvases.delete(symbol);
        if (get(dataSourceMode) === 'live') {
          unsubscribe(symbol);
        }
      }
    }
    
    // Update connection state
    connectionState.update(state => ({
      ...state,
      activeSubscriptions: new Set(this.symbolCanvases.keys())
    }));
  }
  
  /**
   * Get symbol data from cache or fetch from server
   * @param {string} symbol - Symbol to get data for
   * @returns {Promise<Object>} - Symbol data
   */
  async getSymbolData(symbol) {
    console.log(`[CONNECTION_DEBUG] getSymbolData called for symbol: ${symbol}`);
    console.log(`[CONNECTION_DEBUG] dataSourceMode: ${get(dataSourceMode)}, wsStatus: ${get(wsStatus)}`);
    
    // Check cache first
    if (this.symbolDataCache.has(symbol)) {
      logger.debug('Returning cached symbol data', { symbol });
      console.log(`[CONNECTION_DEBUG] Returning cached data for ${symbol}`);
      return this.symbolDataCache.get(symbol);
    }
    
    // Check if already being requested
    if (this.pendingSubscriptions.has(symbol)) {
      logger.debug('Symbol already being requested, waiting', { symbol });
      console.log(`[CONNECTION_DEBUG] Symbol ${symbol} already being requested, waiting`);
      return this.waitForSymbolData(symbol);
    }
    
    // Fetch new data
    logger.debug('Fetching new symbol data', { symbol });
    this.pendingSubscriptions.add(symbol);
    
    try {
      if (get(dataSourceMode) === 'live') {
        console.log(`[CONNECTION_DEBUG] Live mode detected for ${symbol}`);
        // Ensure WebSocket is connected before subscribing
        if (get(wsStatus) !== 'connected') {
          console.log(`[CONNECTION_DEBUG] WebSocket not connected, waiting for connection`);
          // Wait for connection to be established
          await this.waitForConnection();
        }
        
        console.log(`[CONNECTION_DEBUG] Subscribing to ${symbol}`);
        // Subscribe to live data
        subscribe(symbol);
        
        console.log(`[CONNECTION_DEBUG] Waiting for symbol data for ${symbol}`);
        // Wait for symbol data to be received
        const data = await this.waitForSymbolData(symbol);
        console.log(`[CONNECTION_DEBUG] Received symbol data for ${symbol}:`, data);
        this.symbolDataCache.set(symbol, data);
        return data;
      } else {
        console.log(`[CONNECTION_DEBUG] Simulated mode detected for ${symbol}`);
        // For simulated mode, symbol should already be in symbolStore
        const symbolStoreValue = get(symbolStore);
        const data = symbolStoreValue[symbol];
        
        if (data) {
          console.log(`[CONNECTION_DEBUG] Found simulated data for ${symbol}:`, data);
          this.symbolDataCache.set(symbol, data);
          return data;
        } else {
          console.log(`[CONNECTION_DEBUG] No simulated data found for ${symbol}`);
          throw new Error(`Symbol ${symbol} not available in simulated mode`);
        }
      }
    } catch (error) {
      logger.error('Failed to get symbol data', { symbol, error });
      console.log(`[CONNECTION_DEBUG] Error getting symbol data for ${symbol}:`, error);
      throw error;
    } finally {
      this.pendingSubscriptions.delete(symbol);
    }
  }
  
  /**
   * Wait for symbol data to be received
   * @param {string} symbol - Symbol to wait for
   * @returns {Promise<Object>} - Symbol data
   */
  waitForSymbolData(symbol) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${symbol} data`));
      }, 10000); // 10 second timeout
      
      const unsubscribe = symbolStore.subscribe(symbols => {
        const data = symbols[symbol];
        if (data && data.state && data.config) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(data);
        }
      });
    });
  }
  
  /**
   * Initialize connection monitoring
   */
  initializeConnectionMonitoring() {
    // Monitor WebSocket status
    const unsubscribeWsStatus = wsStatus.subscribe(status => {
      connectionState.update(state => ({
        ...state,
        status
      }));
    });
    
    // Monitor data source mode changes
    const unsubscribeDataSourceMode = dataSourceMode.subscribe(mode => {
      logger.debug('Data source mode changed', { mode });
      this.handleDataSourceModeChange(mode);
    });
    
    // Clean up on component destruction
    return () => {
      unsubscribeWsStatus();
      unsubscribeDataSourceMode();
    };
  }
  
  /**
   * Handle data source mode changes
   * @param {string} mode - New data source mode
   */
  handleDataSourceModeChange(mode) {
    logger.debug('Handling data source mode change', { mode });
    
    // Clear cache when switching modes
    this.symbolDataCache.clear();
    this.pendingSubscriptions.clear();
    
    // Re-subscribe to all active symbols if switching to live mode
    if (mode === 'live') {
      this.symbolCanvases.forEach((canvasSet, symbol) => {
        if (canvasSet.size > 0) {
          subscribe(symbol);
        }
      });
    }
  }
  
  /**
   * Get all active subscriptions
   * @returns {Set<string>} - Set of active symbols
   */
  getActiveSubscriptions() {
    return new Set(this.symbolCanvases.keys());
  }
  
  /**
   * Get canvases subscribed to a symbol
   * @param {string} symbol - Symbol to check
   * @returns {Set<string>} - Set of canvas IDs
   */
  getCanvasesForSymbol(symbol) {
    return this.symbolCanvases.get(symbol) || new Set();
  }
  
  /**
   * Get symbol for a canvas
   * @param {string} canvasId - Canvas ID
   * @returns {string|null} - Symbol or null
   */
  getSymbolForCanvas(canvasId) {
    return this.canvasSubscriptions.get(canvasId) || null;
  }
  
  /**
   * Wait for WebSocket connection to be established
   * @returns {Promise<void>}
   */
  waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for WebSocket connection'));
      }, 10000); // 10 second timeout
      
      const unsubscribe = wsStatus.subscribe(status => {
        if (status === 'connected') {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        } else if (status === 'error') {
          clearTimeout(timeout);
          unsubscribe();
          reject(new Error('WebSocket connection error'));
        }
      });
    });
  }
  
  /**
   * Clear all subscriptions and cache
   */
  clearAll() {
    logger.debug('Clearing all subscriptions and cache');
    
    this.canvasSubscriptions.clear();
    this.symbolCanvases.clear();
    this.symbolDataCache.clear();
    this.pendingSubscriptions.clear();
    
    connectionState.update(state => ({
      ...state,
      activeSubscriptions: new Set()
    }));
  }
}

// Create and export singleton instance
export const connectionManager = new ConnectionManager();
export default connectionManager;