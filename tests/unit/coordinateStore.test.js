/**
 * Unit Tests for Coordinate Store Utilities
 *
 * Tests pure coordinate transformation functions without canvas mocks
 * Focuses on mathematical accuracy and edge case handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { coordinateActions, initialCoordinateState } from '../../src/stores/coordinateStore.js';

// Mock canvas sizing utilities for testing
const mockCanvasSizing = {
  REFERENCE_CANVAS: { width: 220, height: 120 },
  getDevicePixelRatio: () => 1
};

describe('Coordinate Store Utilities', () => {
  beforeEach(() => {
    // Reset coordinate store before each test
    coordinateActions.reset();

    // Mock device pixel ratio
    global.window = { devicePixelRatio: 1 };
  });

  afterEach(() => {
    // Clean up after each test
    coordinateActions.reset();
  });

  describe('Coordinate Transformation Functions', () => {
    describe('createPriceToPixelTransform', () => {
      it('should create a valid price-to-pixel transformation function', () => {
        const state = {
          bounds: { x: [0, 220], y: [0, 120] },
          priceRange: { min: 1.0000, max: 1.1000 }
        };

        const transform = coordinateActions.createPriceToPixelTransform(state);

        expect(typeof transform).toBe('function');

        // Test middle price maps to middle Y coordinate (inverted)
        const middlePrice = (state.priceRange.min + state.priceRange.max) / 2;
        const middleY = transform(middlePrice);
        expect(middleY).toBe(60); // Center of 120px height

        // Test bounds
        expect(transform(state.priceRange.min)).toBe(120); // Bottom
        expect(transform(state.priceRange.max)).toBe(0);   // Top
      });

      it('should handle different price ranges correctly', () => {
        const testCases = [
          {
            priceRange: { min: 100.0, max: 200.0 },
            bounds: { x: [0, 300], y: [0, 150] }
          },
          {
            priceRange: { min: 1.0500, max: 1.0600 },
            bounds: { x: [0, 220], y: [0, 120] }
          },
          {
            priceRange: { min: 0.6500, max: 0.6600 },
            bounds: { x: [0, 220], y: [0, 120] }
          }
        ];

        testCases.forEach(({ priceRange, bounds }) => {
          const state = { bounds, priceRange };
          const transform = coordinateActions.createPriceToPixelTransform(state);

          // Test that transformation is monotonic (higher price = lower Y)
          const lowY = transform(priceRange.min);
          const highY = transform(priceRange.max);

          expect(lowY).toBeGreaterThan(highY);
          expect(typeof lowY).toBe('number');
          expect(typeof highY).toBe('number');
          expect(Number.isInteger(lowY)).toBe(true);
          expect(Number.isInteger(highY)).toBe(true);
        });
      });
    });

    describe('createPixelToPriceTransform', () => {
      it('should create a valid pixel-to-price transformation function', () => {
        const state = {
          bounds: { x: [0, 220], y: [0, 120] },
          priceRange: { min: 1.0000, max: 1.1000 }
        };

        const transform = coordinateActions.createPixelToPriceTransform(state);

        expect(typeof transform).toBe('function');

        // Test middle Y coordinate maps to middle price
        const middleY = 60; // Center of 120px height
        const middlePrice = transform(middleY);
        const expectedMiddle = (state.priceRange.min + state.priceRange.max) / 2;
        expect(Math.abs(middlePrice - expectedMiddle)).toBeLessThan(0.0001);

        // Test bounds
        expect(transform(120)).toBeCloseTo(state.priceRange.min, 4); // Bottom
        expect(transform(0)).toBeCloseTo(state.priceRange.max, 4);   // Top
      });

      it('should be inverse of price-to-pixel transform', () => {
        const state = {
          bounds: { x: [0, 220], y: [0, 120] },
          priceRange: { min: 1.0500, max: 1.0600 }
        };

        const priceToPixel = coordinateActions.createPriceToPixelTransform(state);
        const pixelToPrice = coordinateActions.createPixelToPriceTransform(state);

        // Test round-trip transformation
        const testPrices = [1.0510, 1.0535, 1.0580, 1.0595];

        testPrices.forEach(price => {
          const pixel = priceToPixel(price);
          const backToPrice = pixelToPrice(pixel);
          expect(Math.abs(price - backToPrice)).toBeLessThan(0.0001);
        });
      });
    });
  });

  describe('Bounds and Constraint Functions', () => {
    describe('isInBounds', () => {
      it('should correctly check if coordinates are within bounds', () => {
        // First, set up some bounds by calling updateBounds
        coordinateActions.updateBounds({ x: [0, 100], y: [0, 50] });

        // Test cases for point-in-rectangle
        const testCases = [
          { x: 50, y: 25, expected: true },   // Center point
          { x: 0, y: 0, expected: true },     // Bottom-left corner
          { x: 100, y: 50, expected: true },  // Top-right corner
          { x: -1, y: 25, expected: false },  // Outside left
          { x: 101, y: 25, expected: false }, // Outside right
          { x: 50, y: -1, expected: false },  // Outside bottom
          { x: 50, y: 51, expected: false }   // Outside top
        ];

        testCases.forEach(({ x, y, expected }) => {
          const result = coordinateActions.isInBounds(x, y);
          expect(result).toBe(expected);
        });
      });
    });

    describe('clampToBounds', () => {
      it('should clamp coordinates to bounds', () => {
        // Set up bounds
        coordinateActions.updateBounds({ x: [10, 90], y: [20, 80] });

        // Test cases for clamping
        const testCases = [
          { x: 50, y: 50, expected: { x: 50, y: 50 } },   // Inside bounds
          { x: 0, y: 50, expected: { x: 10, y: 50 } },   // Left of bounds
          { x: 100, y: 50, expected: { x: 90, y: 50 } },  // Right of bounds
          { x: 50, y: 0, expected: { x: 50, y: 20 } },   // Below bounds
          { x: 50, y: 100, expected: { x: 50, y: 80 } }, // Above bounds
          { x: -5, y: -10, expected: { x: 10, y: 20 } }, // Outside both
        ];

        testCases.forEach(({ x, y, expected }) => {
          const result = coordinateActions.clampToBounds(x, y);
          expect(result).toEqual(expected);
        });
      });
    });
  });

  describe('Price Range Management', () => {
    describe('updatePriceRange', () => {
      it('should update price range with buffer', () => {
        const priceData = {
          midPrice: 1.0550,
          projectedAdrHigh: 1.0650,
          projectedAdrLow: 1.0450,
          todaysHigh: 1.0620,
          todaysLow: 1.0480
        };

        coordinateActions.updatePriceRange(priceData);

        const systemInfo = coordinateActions.getSystemInfo();
        const { priceRange } = systemInfo;

        // Should include buffer (10% of ADR on each side)
        const adrValue = priceData.projectedAdrHigh - priceData.projectedAdrLow;
        const buffer = adrValue * 0.1;

        expect(priceRange.min).toBeCloseTo(priceData.projectedAdrLow - buffer, 4);
        expect(priceRange.max).toBeCloseTo(priceData.projectedAdrHigh + buffer, 4);
        expect(priceRange.center).toBe(priceData.midPrice);
        expect(priceRange.adr).toBeCloseTo(adrValue, 4);
      });

      it('should handle insufficient data gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Test with missing data
        coordinateActions.updatePriceRange({
          midPrice: 1.0550
          // Missing ADR data
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Insufficient price data')
        );

        consoleSpy.mockRestore();
      });
    });
  });

  describe('Coordinate Transform Utilities', () => {
    describe('transform', () => {
      beforeEach(() => {
        // Set up price range for transformation tests
        coordinateActions.updatePriceRange({
          midPrice: 1.0550,
          projectedAdrHigh: 1.0650,
          projectedAdrLow: 1.0450
        });

        coordinateActions.updateBounds({ x: [0, 220], y: [0, 120] });
      });

      it('should transform price to normalized coordinates', () => {
        const systemInfo = coordinateActions.getSystemInfo();
        const { priceRange } = systemInfo;

        // Test price to normalized
        const midPriceNormalized = coordinateActions.transform(priceRange.center, 'price', 'normalized');
        expect(midPriceNormalized).toBeCloseTo(0.5, 4); // Center should be 0.5

        const minPriceNormalized = coordinateActions.transform(priceRange.min, 'price', 'normalized');
        expect(minPriceNormalized).toBeCloseTo(0, 4);

        const maxPriceNormalized = coordinateActions.transform(priceRange.max, 'price', 'normalized');
        expect(maxPriceNormalized).toBeCloseTo(1, 4);
      });

      it('should transform normalized to price coordinates', () => {
        const systemInfo = coordinateActions.getSystemInfo();
        const { priceRange } = systemInfo;

        // Test normalized to price
        const midPriceFromNormalized = coordinateActions.transform(0.5, 'normalized', 'price');
        expect(midPriceFromNormalized).toBeCloseTo(priceRange.center, 4);

        const minPriceFromNormalized = coordinateActions.transform(0, 'normalized', 'price');
        expect(minPriceFromNormalized).toBeCloseTo(priceRange.min, 4);

        const maxPriceFromNormalized = coordinateActions.transform(1, 'normalized', 'price');
        expect(maxPriceFromNormalized).toBeCloseTo(priceRange.max, 4);
      });

      it('should handle unknown transformations gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = coordinateActions.transform(1.0550, 'unknown', 'unknown');
        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown transformation')
        );

        consoleSpy.mockRestore();
      });

      it('should handle transformations without price range', () => {
        coordinateActions.reset();

        const result = coordinateActions.transform(1.0550, 'price', 'pixel');
        expect(result).toBeNull();
      });
    });
  });

  describe('DPR (Device Pixel Ratio) Management', () => {
    it('should update DPR when changed', () => {
      // Mock different DPR
      global.window.devicePixelRatio = 2;

      coordinateActions.updateDPR();

      const systemInfo = coordinateActions.getSystemInfo();
      expect(systemInfo.dpr).toBe(2);
    });

    it('should not update when DPR is unchanged', () => {
      const originalInfo = coordinateActions.getSystemInfo();
      const originalDPR = originalInfo.dpr;

      coordinateActions.updateDPR();

      const newInfo = coordinateActions.getSystemInfo();
      expect(newInfo.dpr).toBe(originalDPR);
    });
  });

  describe('System Information and State', () => {
    it('should provide accurate system information', () => {
      coordinateActions.updateBounds({ x: [10, 210], y: [5, 115] });
      coordinateActions.updatePriceRange({
        midPrice: 1.0550,
        projectedAdrHigh: 1.0650,
        projectedAdrLow: 1.0450
      });

      const systemInfo = coordinateActions.getSystemInfo();

      expect(systemInfo).toHaveProperty('system', 'cartesian');
      expect(systemInfo).toHaveProperty('bounds');
      expect(systemInfo).toHaveProperty('dpr');
      expect(systemInfo).toHaveProperty('priceRange');
      expect(systemInfo).toHaveProperty('hasValidPriceRange', true);

      expect(systemInfo.bounds.x).toEqual([10, 210]);
      expect(systemInfo.bounds.y).toEqual([5, 115]);
      expect(systemInfo.priceRange.center).toBe(1.0550);
    });

    it('should reset to initial state', () => {
      // Modify the state
      coordinateActions.updateBounds({ x: [50, 150], y: [25, 75] });
      coordinateActions.updatePriceRange({
        midPrice: 1.1000,
        projectedAdrHigh: 1.1100,
        projectedAdrLow: 1.0900
      });

      // Reset
      coordinateActions.reset();

      const systemInfo = coordinateActions.getSystemInfo();
      expect(systemInfo.bounds).toEqual(initialCoordinateState.bounds);
      expect(systemInfo.priceRange.min).toBeNull();
      expect(systemInfo.priceRange.max).toBeNull();
      expect(systemInfo.hasValidPriceRange).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle zero price ranges', () => {
      coordinateActions.updatePriceRange({
        midPrice: 1.0550,
        projectedAdrHigh: 1.0550, // Same as low
        projectedAdrLow: 1.0550   // Same as high
      });

      const systemInfo = coordinateActions.getSystemInfo();
      expect(systemInfo.hasValidPriceRange).toBe(true);
      expect(systemInfo.priceRange.adr).toBe(0);
    });

    it('should handle negative prices', () => {
      coordinateActions.updatePriceRange({
        midPrice: -100,
        projectedAdrHigh: -90,
        projectedAdrLow: -110
      });

      const systemInfo = coordinateActions.getSystemInfo();
      expect(systemInfo.hasValidPriceRange).toBe(true);
      expect(systemInfo.priceRange.min).toBe(-110);
      expect(systemInfo.priceRange.max).toBe(-90);
    });

    it('should handle very small price ranges', () => {
      coordinateActions.updatePriceRange({
        midPrice: 1.055001,
        projectedAdrHigh: 1.055002,
        projectedAdrLow: 1.055000
      });

      const transform = coordinateActions.createPriceToPixelTransform({
        bounds: { x: [0, 220], y: [0, 120] },
        priceRange: coordinateActions.getSystemInfo().priceRange
      });

      expect(typeof transform).toBe('function');

      // Should still produce valid pixel coordinates
      const minY = transform(coordinateActions.getSystemInfo().priceRange.min);
      const maxY = transform(coordinateActions.getSystemInfo().priceRange.max);

      expect([minY, maxY]).every(val => typeof val === 'number' && Number.isInteger(val));
    });
  });
});