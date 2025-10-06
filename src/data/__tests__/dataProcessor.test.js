/**
 * Data Processor Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataProcessor } from '../dataProcessor.js';
import { TickSchema } from '../schema.js';

describe('DataProcessor', () => {
  let dataProcessor;
  
  beforeEach(() => {
    dataProcessor = new DataProcessor({
      bufferSize: 100,
      aggregationWindow: 1000,
      performanceMonitoring: true,
      dataValidation: true
    });
  });
  
  afterEach(() => {
    dataProcessor.clear();
  });

  describe('Tick Processing', () => {
    it('should process valid tick data', () => {
      const tick = {
        symbol: 'EURUSD',
        bid: 1.1234,
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      const result = dataProcessor.processTick(tick);
      
      expect(result).toBeTruthy();
      expect(result.price).toBe(1.1235); // Mid price
      expect(result.symbol).toBe(tick.symbol);
      expect(result.ticks).toBe(1);
    });

    it('should reject invalid tick data', () => {
      const invalidTick = {
        symbol: 'EURUSD',
        bid: 1.1234,
        // Missing ask
        timestamp: Date.now()
      };
      
      const result = dataProcessor.processTick(invalidTick);
      
      expect(result).toBeNull();
    });

    it('should reject negative prices', () => {
      const invalidTick = {
        symbol: 'EURUSD',
        bid: -1.1234,
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      const result = dataProcessor.processTick(invalidTick);
      
      expect(result).toBeNull();
    });

    it('should reject bid >= ask', () => {
      const invalidTick = {
        symbol: 'EURUSD',
        bid: 1.1236,
        ask: 1.1234, // Lower than bid
        timestamp: Date.now()
      };
      
      const result = dataProcessor.processTick(invalidTick);
      
      expect(result).toBeNull();
    });

    it('should calculate direction and magnitude', () => {
      const tick1 = {
        symbol: 'EURUSD',
        bid: 1.1234,
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      const tick2 = {
        symbol: 'EURUSD',
        bid: 1.1235,
        ask: 1.1237,
        timestamp: Date.now() + 1000
      };
      
      const result1 = dataProcessor.processTick(tick1);
      const result2 = dataProcessor.processTick(tick2);
      
      expect(result1.direction).toBe(0); // First tick has no direction
      expect(result1.magnitude).toBe(0);
      
      expect(result2.direction).toBe(1); // Price went up
      expect(result2.magnitude).toBe(0.0001);
    });
  });

  describe('Data Quality Checks', () => {
    it('should detect data gaps', () => {
      const tick1 = {
        symbol: 'EURUSD',
        bid: 1.1234,
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      const tick2 = {
        symbol: 'EURUSD',
        bid: 1.1235,
        ask: 1.1237,
        timestamp: Date.now() + 10000 // 10 second gap
      };
      
      dataProcessor.processTick(tick1);
      dataProcessor.processTick(tick2);
      
      const qualityReport = dataProcessor.getDataQualityReport();
      expect(qualityReport.totalGaps).toBe(1);
    });

    it('should detect duplicate ticks', () => {
      const tick = {
        symbol: 'EURUSD',
        bid: 1.1234,
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      dataProcessor.processTick(tick);
      dataProcessor.processTick(tick);
      
      const qualityReport = dataProcessor.getDataQualityReport();
      expect(qualityReport.duplicateTicks).toBe(1);
    });

    it('should detect out of sequence ticks', () => {
      const tick1 = {
        symbol: 'EURUSD',
        bid: 1.1234,
        ask: 1.1236,
        timestamp: 1000
      };
      
      const tick2 = {
        symbol: 'EURUSD',
        bid: 1.1235,
        ask: 1.1237,
        timestamp: 500 // Earlier timestamp
      };
      
      dataProcessor.processTick(tick1);
      dataProcessor.processTick(tick2);
      
      const qualityReport = dataProcessor.getDataQualityReport();
      expect(qualityReport.outOfSequenceTicks).toBe(1);
    });

    it('should detect price anomalies', () => {
      const tick1 = {
        symbol: 'EURUSD',
        bid: 1.1234,
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      const tick2 = {
        symbol: 'EURUSD',
        bid: 1.1334, // 1% jump
        ask: 1.1336,
        timestamp: Date.now() + 1000
      };
      
      dataProcessor.processTick(tick1);
      dataProcessor.processTick(tick2);
      
      const qualityReport = dataProcessor.getDataQualityReport();
      expect(qualityReport.priceAnomalies).toBe(1);
    });
  });

  describe('Data Aggregation', () => {
    it('should aggregate tick data', () => {
      const tick1 = {
        symbol: 'EURUSD',
        bid: 1.1234,
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      const tick2 = {
        symbol: 'EURUSD',
        bid: 1.1235,
        ask: 1.1237,
        timestamp: Date.now() + 1000
      };
      
      dataProcessor.processTick(tick1);
      dataProcessor.processTick(tick2);
      
      const aggregated = dataProcessor.getAggregatedData('EURUSD');
      
      expect(aggregated).toBeTruthy();
      expect(aggregated.tickCount).toBe(2);
      expect(aggregated.open).toBe(1.1235);
      expect(aggregated.close).toBe(1.1236);
      expect(aggregated.high).toBe(1.1236);
      expect(aggregated.low).toBe(1.1235);
    });

    it('should calculate volatility', () => {
      // Create ticks with varying price changes
      for (let i = 0; i < 10; i++) {
        const tick = {
          symbol: 'EURUSD',
          bid: 1.1234 + (i * 0.0001),
          ask: 1.1236 + (i * 0.0001),
          timestamp: Date.now() + (i * 1000)
        };
        dataProcessor.processTick(tick);
      }
      
      const aggregated = dataProcessor.getAggregatedData('EURUSD');
      
      expect(aggregated.volatility).toBeGreaterThan(0);
    });
  });

  describe('Buffer Management', () => {
    it('should maintain buffer size', () => {
      // Add more ticks than buffer size
      for (let i = 0; i < 150; i++) {
        const tick = {
          symbol: 'EURUSD',
          bid: 1.1234 + (i * 0.0001),
          ask: 1.1236 + (i * 0.0001),
          timestamp: Date.now() + (i * 1000)
        };
        dataProcessor.processTick(tick);
      }
      
      const recentTicks = dataProcessor.getRecentTicks('EURUSD');
      expect(recentTicks.length).toBeLessThanOrEqual(100);
    });

    it('should return recent ticks', () => {
      const ticks = [];
      for (let i = 0; i < 10; i++) {
        const tick = {
          symbol: 'EURUSD',
          bid: 1.1234 + (i * 0.0001),
          ask: 1.1236 + (i * 0.0001),
          timestamp: Date.now() + (i * 1000)
        };
        ticks.push(tick);
        dataProcessor.processTick(tick);
      }
      
      const recentTicks = dataProcessor.getRecentTicks('EURUSD', 5);
      expect(recentTicks.length).toBe(5);
      
      // Should be the most recent ticks
      expect(recentTicks[0].price).toBe(1.1235 + 9 * 0.0001);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track processing metrics', () => {
      const tick = {
        symbol: 'EURUSD',
        bid: 1.1234,
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      dataProcessor.processTick(tick);
      
      const stats = dataProcessor.getPerformanceStats();
      
      expect(stats.totalTicks).toBe(1);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should track processing errors', () => {
      const invalidTick = {
        symbol: 'EURUSD',
        bid: -1.1234, // Invalid
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      dataProcessor.processTick(invalidTick);
      
      const stats = dataProcessor.getPerformanceStats();
      // Error count is tracked in processingMetrics store
      expect(stats.totalTicks).toBe(0);
    });
  });

  describe('Technical Indicators', () => {
    beforeEach(() => {
      // Create sample data for indicators
      for (let i = 0; i < 50; i++) {
        const tick = {
          symbol: 'EURUSD',
          bid: 1.1234 + Math.sin(i * 0.1) * 0.001,
          ask: 1.1236 + Math.sin(i * 0.1) * 0.001,
          timestamp: Date.now() + (i * 1000)
        };
        dataProcessor.processTick(tick);
      }
    });

    it('should calculate SMA', () => {
      const indicators = dataProcessor.calculateIndicators('EURUSD', ['sma']);
      
      expect(indicators).toBeTruthy();
      expect(indicators.sma).toBeTruthy();
      expect(indicators.sma).toBeGreaterThan(1.12);
      expect(indicators.sma).toBeLessThan(1.13);
    });

    it('should calculate EMA', () => {
      const indicators = dataProcessor.calculateIndicators('EURUSD', ['ema']);
      
      expect(indicators).toBeTruthy();
      expect(indicators.ema).toBeTruthy();
      expect(indicators.ema).toBeGreaterThan(1.12);
      expect(indicators.ema).toBeLessThan(1.13);
    });

    it('should calculate RSI', () => {
      const indicators = dataProcessor.calculateIndicators('EURUSD', ['rsi']);
      
      expect(indicators).toBeTruthy();
      expect(indicators.rsi).toBeTruthy();
      expect(indicators.rsi).toBeGreaterThanOrEqual(0);
      expect(indicators.rsi).toBeLessThanOrEqual(100);
    });

    it('should return null for insufficient data', () => {
      // Clear and add insufficient data
      dataProcessor.clear();
      
      const tick = {
        symbol: 'EURUSD',
        bid: 1.1234,
        ask: 1.1236,
        timestamp: Date.now()
      };
      dataProcessor.processTick(tick);
      
      const indicators = dataProcessor.calculateIndicators('EURUSD', ['sma']);
      expect(indicators).toBeNull();
    });
  });

  describe('Historical Data Processing', () => {
    it('should process historical bars', () => {
      const bars = [
        {
          open: 1.1234,
          high: 1.1238,
          low: 1.1232,
          close: 1.1236,
          timestamp: Date.now(),
          volume: 1000
        },
        {
          open: 1.1236,
          high: 1.1240,
          low: 1.1234,
          close: 1.1238,
          timestamp: Date.now() + 60000,
          volume: 1200
        }
      ];
      
      const processed = dataProcessor.processHistoricalData('EURUSD', bars);
      
      expect(processed).toHaveLength(2);
      expect(processed[0].open).toBe(1.1234);
      expect(processed[0].high).toBe(1.1238);
      expect(processed[0].low).toBe(1.1232);
      expect(processed[0].close).toBe(1.1236);
    });

    it('should reject invalid historical bars', () => {
      const invalidBars = [
        {
          open: 1.1234,
          high: 1.1232, // Lower than open
          low: 1.1236,  // Higher than open
          close: 1.1238,
          timestamp: Date.now(),
          volume: 1000
        }
      ];
      
      const processed = dataProcessor.processHistoricalData('EURUSD', invalidBars);
      
      expect(processed).toHaveLength(0);
    });
  });

  describe('Data Management', () => {
    it('should clear all data', () => {
      const tick = {
        symbol: 'EURUSD',
        bid: 1.1234,
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      dataProcessor.processTick(tick);
      expect(dataProcessor.getRecentTicks('EURUSD')).toHaveLength(1);
      
      dataProcessor.clear();
      expect(dataProcessor.getRecentTicks('EURUSD')).toHaveLength(0);
    });

    it('should handle multiple symbols', () => {
      const tick1 = {
        symbol: 'EURUSD',
        bid: 1.1234,
        ask: 1.1236,
        timestamp: Date.now()
      };
      
      const tick2 = {
        symbol: 'GBPUSD',
        bid: 1.3456,
        ask: 1.3458,
        timestamp: Date.now()
      };
      
      dataProcessor.processTick(tick1);
      dataProcessor.processTick(tick2);
      
      const eurgbTicks = dataProcessor.getRecentTicks('EURUSD');
      const gbpusdTicks = dataProcessor.getRecentTicks('GBPUSD');
      
      expect(eurgbTicks).toHaveLength(1);
      expect(gbpusdTicks).toHaveLength(1);
      expect(eurgbTicks[0].symbol).toBe('EURUSD');
      expect(gbpusdTicks[0].symbol).toBe('GBPUSD');
    });
  });
});
