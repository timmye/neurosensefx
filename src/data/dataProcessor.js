/**
 * Data Processing Pipeline
 * Handles real-time data normalization, aggregation, and performance monitoring
 */

import { writable, derived } from 'svelte/store';
import { TickSchema, ProcessedTickSchema, HistoricalBarSchema } from './schema.js';

// Performance monitoring stores
export const processingMetrics = writable({
  ticksProcessed: 0,
  ticksPerSecond: 0,
  averageProcessingTime: 0,
  errorCount: 0,
  lastProcessedTime: null
});

// Data quality metrics
export const dataQualityMetrics = writable({
  gaps: [],
  duplicateTicks: 0,
  outOfSequenceTicks: 0,
  priceAnomalies: 0,
  lastQualityCheck: null
});

class DataProcessor {
  constructor(options = {}) {
    this.bufferSize = options.bufferSize || 1000;
    this.aggregationWindow = options.aggregationWindow || 60000; // 1 minute
    this.performanceMonitoring = options.performanceMonitoring !== false;
    this.dataValidation = options.dataValidation !== false;
    
    // Data buffers
    this.tickBuffer = new Map(); // symbol -> array of ticks
    this.aggregatedData = new Map(); // symbol -> aggregated data
    this.lastTickPerSymbol = new Map(); // symbol -> last tick
    
    // Performance tracking
    this.processingTimes = [];
    this.tickCount = 0;
    this.lastSecondTime = Date.now();
    this.lastSecondTickCount = 0;
    
    // Data quality tracking
    this.qualityChecks = {
      expectedSymbols: new Set(),
      symbolSequences: new Map(), // symbol -> expected sequence
      lastTimestamps: new Map() // symbol -> last timestamp
    };
  }

  /**
   * Process incoming tick data
   */
  processTick(rawTick) {
    const startTime = performance.now();
    
    try {
      // Validate input data
      const validatedTick = this.validateTick(rawTick);
      if (!validatedTick) {
        this.updateErrorCount();
        return null;
      }

      // Check for data quality issues
      this.performQualityCheck(validatedTick);
      
      // Create processed tick with calculated values
      const processedTick = this.createProcessedTick(validatedTick);
      
      // Update buffers
      this.updateBuffers(validatedTick.symbol, processedTick);
      
      // Update aggregation
      this.updateAggregation(validatedTick.symbol, processedTick);
      
      // Update performance metrics
      this.updatePerformanceMetrics(startTime);
      
      // Update tick count
      this.tickCount++;
      
      return processedTick;
      
    } catch (error) {
      console.error('[DataProcessor] Error processing tick:', error);
      this.updateErrorCount();
      return null;
    }
  }

  /**
   * Validate incoming tick data
   */
  validateTick(rawTick) {
    const result = TickSchema.safeParse(rawTick);
    if (!result.success) {
      console.error('[DataProcessor] Invalid tick data:', result.error);
      return null;
    }

    const tick = result.data;
    
    // Additional validation checks
    if (tick.bid <= 0 || tick.ask <= 0) {
      console.error('[DataProcessor] Invalid price values:', tick);
      return null;
    }

    if (tick.bid >= tick.ask) {
      console.error('[DataProcessor] Bid price must be less than ask price:', tick);
      return null;
    }

    const now = Date.now();
    const maxAge = 60000; // 1 minute max age
    
    if (tick.timestamp < (now - maxAge)) {
      console.warn('[DataProcessor] Old tick received:', tick);
    }

    return tick;
  }

  /**
   * Perform data quality checks
   */
  performQualityCheck(tick) {
    const symbol = tick.symbol;
    const lastTimestamp = this.qualityChecks.lastTimestamps.get(symbol);
    const lastTick = this.lastTickPerSymbol.get(symbol);
    
    // Check for gaps in data
    if (lastTimestamp && (tick.timestamp - lastTimestamp) > 5000) {
      const gap = {
        symbol,
        startTime: lastTimestamp,
        endTime: tick.timestamp,
        duration: tick.timestamp - lastTimestamp
      };
      
      dataQualityMetrics.update(metrics => ({
        ...metrics,
        gaps: [...metrics.gaps.slice(-9), gap] // Keep last 10 gaps
      }));
    }

    // Check for duplicate ticks
    if (lastTick && 
        lastTick.bid === tick.bid && 
        lastTick.ask === tick.ask &&
        lastTick.timestamp === tick.timestamp) {
      dataQualityMetrics.update(metrics => ({
        ...metrics,
        duplicateTicks: metrics.duplicateTicks + 1
      }));
    }

    // Check for out of sequence ticks
    if (lastTimestamp && tick.timestamp < lastTimestamp) {
      dataQualityMetrics.update(metrics => ({
        ...metrics,
        outOfSequenceTicks: metrics.outOfSequenceTicks + 1
      }));
    }

    // Check for price anomalies (sudden large movements)
    if (lastTick) {
      const priceChange = Math.abs(tick.bid - lastTick.bid);
      const percentChange = priceChange / lastTick.bid;
      
      if (percentChange > 0.01) { // 1% change threshold
        dataQualityMetrics.update(metrics => ({
          ...metrics,
          priceAnomalies: metrics.priceAnomalies + 1
        }));
      }
    }

    // Update tracking
    this.qualityChecks.lastTimestamps.set(symbol, tick.timestamp);
    this.qualityChecks.lastQualityCheck = Date.now();
  }

  /**
   * Create processed tick with calculated values
   */
  createProcessedTick(tick) {
    const lastTick = this.lastTickPerSymbol.get(tick.symbol);
    const midPrice = (tick.bid + tick.ask) / 2;
    
    let direction = 0;
    let magnitude = 0;
    
    if (lastTick) {
      const lastMidPrice = (lastTick.bid + lastTick.ask) / 2;
      const priceChange = midPrice - lastMidPrice;
      direction = priceChange > 0 ? 1 : priceChange < 0 ? -1 : 0;
      magnitude = Math.abs(priceChange);
    }
    
    const processedTick = {
      price: midPrice,
      direction,
      magnitude,
      time: tick.timestamp,
      ticks: this.tickCount,
      originalTick: tick
    };

    // Validate processed tick
    const result = ProcessedTickSchema.safeParse(processedTick);
    if (!result.success) {
      console.error('[DataProcessor] Invalid processed tick:', result.error);
      return null;
    }

    return result.data;
  }

  /**
   * Update data buffers
   */
  updateBuffers(symbol, processedTick) {
    if (!this.tickBuffer.has(symbol)) {
      this.tickBuffer.set(symbol, []);
    }
    
    const buffer = this.tickBuffer.get(symbol);
    buffer.push(processedTick);
    
    // Maintain buffer size
    if (buffer.length > this.bufferSize) {
      buffer.shift();
    }
    
    this.lastTickPerSymbol.set(symbol, processedTick);
  }

  /**
   * Update aggregated data
   */
  updateAggregation(symbol, processedTick) {
    if (!this.aggregatedData.has(symbol)) {
      this.aggregatedData.set(symbol, {
        windowStart: processedTick.time,
        windowEnd: processedTick.time,
        tickCount: 0,
        volume: 0,
        high: processedTick.price,
        low: processedTick.price,
        open: processedTick.price,
        close: processedTick.price,
        priceChanges: [],
        volatility: 0
      });
    }
    
    const aggregated = this.aggregatedData.get(symbol);
    const now = Date.now();
    
    // Reset window if needed
    if (now - aggregated.windowStart > this.aggregationWindow) {
      aggregated.windowStart = now;
      aggregated.tickCount = 0;
      aggregated.priceChanges = [];
      aggregated.high = processedTick.price;
      aggregated.low = processedTick.price;
      aggregated.open = processedTick.price;
    }
    
    // Update aggregated values
    aggregated.tickCount++;
    aggregated.windowEnd = processedTick.time;
    aggregated.close = processedTick.price;
    aggregated.high = Math.max(aggregated.high, processedTick.price);
    aggregated.low = Math.min(aggregated.low, processedTick.price);
    
    // Track price changes for volatility calculation
    if (aggregated.priceChanges.length > 0) {
      const lastPrice = aggregated.priceChanges[aggregated.priceChanges.length - 1];
      const priceChange = processedTick.price - lastPrice;
      aggregated.priceChanges.push(priceChange);
      
      // Keep only recent changes
      if (aggregated.priceChanges.length > 100) {
        aggregated.priceChanges.shift();
      }
      
      // Calculate volatility (standard deviation of price changes)
      const mean = aggregated.priceChanges.reduce((a, b) => a + b, 0) / aggregated.priceChanges.length;
      const variance = aggregated.priceChanges.reduce((sum, change) => {
        return sum + Math.pow(change - mean, 2);
      }, 0) / aggregated.priceChanges.length;
      aggregated.volatility = Math.sqrt(variance);
    } else {
      aggregated.priceChanges.push(processedTick.price);
    }
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(startTime) {
    if (!this.performanceMonitoring) return;
    
    const processingTime = performance.now() - startTime;
    this.processingTimes.push(processingTime);
    
    // Keep only recent measurements
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }
    
    // Calculate ticks per second
    const now = Date.now();
    if (now - this.lastSecondTime >= 1000) {
      const ticksPerSecond = this.tickCount - this.lastSecondTickCount;
      
      processingMetrics.set({
        ticksProcessed: this.tickCount,
        ticksPerSecond,
        averageProcessingTime: this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length,
        errorCount: processingMetrics.errorCount || 0,
        lastProcessedTime: now
      });
      
      this.lastSecondTime = now;
      this.lastSecondTickCount = this.tickCount;
    }
  }

  /**
   * Update error count
   */
  updateErrorCount() {
    processingMetrics.update(metrics => ({
      ...metrics,
      errorCount: metrics.errorCount + 1
    }));
  }

  /**
   * Get recent ticks for a symbol
   */
  getRecentTicks(symbol, count = 100) {
    const buffer = this.tickBuffer.get(symbol);
    if (!buffer) return [];
    
    return buffer.slice(-count);
  }

  /**
   * Get aggregated data for a symbol
   */
  getAggregatedData(symbol) {
    return this.aggregatedData.get(symbol) || null;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      totalTicks: this.tickCount,
      averageProcessingTime: this.processingTimes.length > 0 
        ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length 
        : 0,
      maxProcessingTime: Math.max(...this.processingTimes, 0),
      minProcessingTime: Math.min(...this.processingTimes, 0),
      bufferUtilization: Array.from(this.tickBuffer.values())
        .reduce((sum, buffer) => sum + buffer.length, 0) / (this.tickBuffer.size * this.bufferSize)
    };
  }

  /**
   * Get data quality report
   */
  getDataQualityReport() {
    const metrics = {};
    dataQualityMetrics.subscribe(m => metrics = m)();
    
    return {
      totalGaps: metrics.gaps.length,
      duplicateTicks: metrics.duplicateTicks,
      outOfSequenceTicks: metrics.outOfSequenceTicks,
      priceAnomalies: metrics.priceAnomalies,
      lastQualityCheck: metrics.lastQualityCheck,
      recentGaps: metrics.gaps.slice(-5)
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.tickBuffer.clear();
    this.aggregatedData.clear();
    this.lastTickPerSymbol.clear();
    this.processingTimes = [];
    this.tickCount = 0;
    
    processingMetrics.set({
      ticksProcessed: 0,
      ticksPerSecond: 0,
      averageProcessingTime: 0,
      errorCount: 0,
      lastProcessedTime: null
    });
    
    dataQualityMetrics.set({
      gaps: [],
      duplicateTicks: 0,
      outOfSequenceTicks: 0,
      priceAnomalies: 0,
      lastQualityCheck: null
    });
  }

  /**
   * Process historical bar data
   */
  processHistoricalData(symbol, bars) {
    const validatedBars = [];
    
    for (const bar of bars) {
      const result = HistoricalBarSchema.safeParse(bar);
      if (result.success) {
        validatedBars.push(result.data);
      } else {
        console.error('[DataProcessor] Invalid historical bar:', result.error);
      }
    }
    
    return validatedBars;
  }

  /**
   * Calculate technical indicators
   */
  calculateIndicators(symbol, indicators = ['sma', 'ema', 'rsi']) {
    const ticks = this.getRecentTicks(symbol, 200);
    if (ticks.length < 20) return null;
    
    const prices = ticks.map(tick => tick.price);
    const results = {};
    
    for (const indicator of indicators) {
      switch (indicator) {
        case 'sma':
          results.sma = this.calculateSMA(prices, 20);
          break;
        case 'ema':
          results.ema = this.calculateEMA(prices, 20);
          break;
        case 'rsi':
          results.rsi = this.calculateRSI(prices, 14);
          break;
      }
    }
    
    return results;
  }

  /**
   * Simple Moving Average
   */
  calculateSMA(prices, period) {
    if (prices.length < period) return null;
    
    const recent = prices.slice(-period);
    return recent.reduce((sum, price) => sum + price, 0) / period;
  }

  /**
   * Exponential Moving Average
   */
  calculateEMA(prices, period) {
    if (prices.length < period) return null;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  /**
   * Relative Strength Index
   */
  calculateRSI(prices, period) {
    if (prices.length < period + 1) return null;
    
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    
    const recent = changes.slice(-period);
    const gains = recent.filter(change => change > 0);
    const losses = recent.filter(change => change < 0).map(loss => Math.abs(loss));
    
    const avgGain = gains.length > 0 ? gains.reduce((sum, gain) => sum + gain, 0) / period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, loss) => sum + loss, 0) / period : 0;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
}

// Create singleton instance
export const dataProcessor = new DataProcessor();

// Export for testing
export { DataProcessor };
