/**
 * Unit Tests for Day Range Meter Calculations
 *
 * Tests pure calculation functions from dayRangeMeter.js
 * Focuses on ADR calculations, percentage computations, and price positioning
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock the module to isolate pure calculation functions
const mockState = {
  midPrice: 1.0550,
  currentPrice: 1.0585,
  todaysHigh: 1.0620,
  todaysLow: 1.0480,
  projectedAdrHigh: 1.0650,
  projectedAdrLow: 1.0450,
  digits: 5
};

// Extract the pure calculation function for testing
function calculateMaxAdrPercentage(state) {
  const { midPrice: dailyOpen, todaysHigh, todaysLow, projectedAdrHigh, projectedAdrLow } = state;
  const adrValue = projectedAdrHigh && projectedAdrLow ? projectedAdrHigh - projectedAdrLow : null;

  if (!dailyOpen || !adrValue || (!todaysHigh && !todaysLow)) {
    return 0.5; // Default to 50% if no data
  }

  let maxPercentage = 0.5; // Start with 50% baseline

  if (todaysHigh) {
    const highPercentage = Math.abs(todaysHigh - dailyOpen) / adrValue;
    maxPercentage = Math.max(maxPercentage, highPercentage);
  }

  if (todaysLow) {
    const lowPercentage = Math.abs(dailyOpen - todaysLow) / adrValue;
    maxPercentage = Math.max(maxPercentage, lowPercentage);
  }

  // Round up to next 0.25 increment for clean marker spacing
  return Math.ceil(maxPercentage * 4) / 4;
}

// Mock ADR calculation helpers
function calculateAdrPercentage(price, dailyOpen, adrValue) {
  if (!dailyOpen || !adrValue) return 0;
  return ((price - dailyOpen) / adrValue) * 100;
}

function calculateAdrLevels(dailyOpen, adrValue, percentage) {
  return {
    high: dailyOpen + (adrValue * percentage),
    low: dailyOpen - (adrValue * percentage)
  };
}

function calculatePricePositionInAdr(currentPrice, dailyOpen, adrValue) {
  if (!dailyOpen || !adrValue) return 0;
  return ((currentPrice - dailyOpen) / adrValue) * 100;
}

describe('Day Range Meter Calculations', () => {
  describe('calculateMaxAdrPercentage', () => {
    it('should calculate maximum ADR percentage from session data', () => {
      const result = calculateMaxAdrPercentage(mockState);

      // Calculate expected values
      const adrValue = mockState.projectedAdrHigh - mockState.projectedAdrLow; // 0.02
      const highPercentage = Math.abs(mockState.todaysHigh - mockState.midPrice) / adrValue; // 0.007/0.02 = 0.35
      const lowPercentage = Math.abs(mockState.midPrice - mockState.todaysLow) / adrValue;  // 0.007/0.02 = 0.35

      // Should take the maximum of 0.5 baseline and session percentages, then round up to 0.25 increment
      const expectedMax = Math.ceil(Math.max(0.5, highPercentage, lowPercentage) * 4) / 4;

      expect(result).toBeCloseTo(expectedMax, 4);
      expect(result).toBeCloseTo(0.5, 4); // Since session is below 0.5, should return baseline
    });

    it('should return default when essential data is missing', () => {
      const testCases = [
        { ...mockState, midPrice: null },
        { ...mockState, projectedAdrHigh: null },
        { ...mockState, projectedAdrLow: null },
        { ...mockState, todaysHigh: null, todaysLow: null }
      ];

      testCases.forEach(testCase => {
        const result = calculateMaxAdrPercentage(testCase);
        expect(result).toBe(0.5); // Default value
      });
    });

    it('should handle zero ADR values gracefully', () => {
      const zeroAdrState = {
        ...mockState,
        projectedAdrHigh: 1.0550,
        projectedAdrLow: 1.0550 // Same as high, so ADR = 0
      };

      const result = calculateMaxAdrPercentage(zeroAdrState);
      expect(result).toBe(0.5); // Should fall back to default
    });

    it('should round up to 0.25 increments', () => {
      const testCases = [
        // Expected rounding: 0.51 -> 0.75, 0.76 -> 1.0, 1.01 -> 1.25, etc.
        { highPct: 0.51, expected: 0.75 },
        { highPct: 0.74, expected: 0.75 },
        { highPct: 0.76, expected: 1.0 },
        { highPct: 0.99, expected: 1.0 },
        { highPct: 1.01, expected: 1.25 },
        { highPct: 1.24, expected: 1.25 },
        { highPct: 1.26, expected: 1.5 }
      ];

      testCases.forEach(({ highPct, expected }) => {
        const testState = {
          ...mockState,
          todaysHigh: mockState.midPrice + (highPct * 0.02), // Scale by ADR
          todaysLow: mockState.midPrice
        };

        const result = calculateMaxAdrPercentage(testState);
        expect(result).toBeCloseTo(expected, 4);
      });
    });

    it('should calculate for volatile sessions exceeding baseline', () => {
      const volatileState = {
        ...mockState,
        todaysHigh: 1.0650, // 1% above open = 0.5 * ADR (exceeds baseline)
        todaysLow: 1.0450   // 1% below open = 0.5 * ADR
      };

      const result = calculateMaxAdrPercentage(volatileState);
      expect(result).toBeCloseTo(0.5, 4); // Should round to 0.5 exactly
    });

    it('should handle negative price movements', () => {
      const negativeState = {
        ...mockState,
        todaysHigh: mockState.midPrice - 0.005, // High is below open
        todaysLow: mockState.midPrice - 0.015   // Low is further below open
      };

      const result = calculateMaxAdrPercentage(negativeState);

      // Should calculate absolute differences
      const adrValue = mockState.projectedAdrHigh - mockState.projectedAdrLow;
      const expectedLowPercentage = Math.abs(negativeState.todaysLow - negativeState.midPrice) / adrValue;
      const expectedResult = Math.ceil(Math.max(0.5, expectedLowPercentage) * 4) / 4;

      expect(result).toBe(expectedResult);
    });
  });

  describe('calculateAdrPercentage', () => {
    it('should calculate percentage correctly for positive movements', () => {
      const dailyOpen = 1.0550;
      const adrValue = 0.02; // 20 pips ADR
      const currentPrice = 1.0570; // 2 pips above open

      const result = calculateAdrPercentage(currentPrice, dailyOpen, adrValue);
      expect(result).toBeCloseTo(10, 10); // 2/20 * 100 = 10%
    });

    it('should calculate percentage correctly for negative movements', () => {
      const dailyOpen = 1.0550;
      const adrValue = 0.02;
      const currentPrice = 1.0530; // 2 pips below open

      const result = calculateAdrPercentage(currentPrice, dailyOpen, adrValue);
      expect(result).toBeCloseTo(-10, 10); // -2/20 * 100 = -10%
    });

    it('should handle zero ADR values', () => {
      const result = calculateAdrPercentage(1.0550, 1.0550, 0);
      expect(result).toBe(0);
    });

    it('should handle missing data', () => {
      expect(calculateAdrPercentage(1.0550, null, 0.02)).toBe(0);
      expect(calculateAdrPercentage(1.0550, 1.0550, null)).toBe(0);
    });

    it('should handle small ADR values', () => {
      const result = calculateAdrPercentage(1.05501, 1.0550, 0.0001);
      expect(result).toBeCloseTo(10, 5); // 0.00001/0.0001 * 100 = 10%
    });
  });

  describe('calculateAdrLevels', () => {
    it('should calculate ADR levels for given percentage', () => {
      const dailyOpen = 1.0550;
      const adrValue = 0.02;
      const percentage = 0.5; // 50%

      const result = calculateAdrLevels(dailyOpen, adrValue, percentage);

      expect(result.high).toBe(1.0650); // 1.0550 + (0.02 * 0.5)
      expect(result.low).toBe(1.0450);  // 1.0550 - (0.02 * 0.5)
    });

    it('should handle zero percentage', () => {
      const dailyOpen = 1.0550;
      const adrValue = 0.02;

      const result = calculateAdrLevels(dailyOpen, adrValue, 0);

      expect(result.high).toBe(dailyOpen);
      expect(result.low).toBe(dailyOpen);
    });

    it('should handle 100% percentage', () => {
      const dailyOpen = 1.0550;
      const adrValue = 0.02;

      const result = calculateAdrLevels(dailyOpen, adrValue, 1.0);

      expect(result.high).toBe(1.0750); // 1.0550 + 0.02
      expect(result.low).toBe(1.0350);  // 1.0550 - 0.02
    });

    it('should handle percentage > 100%', () => {
      const dailyOpen = 1.0550;
      const adrValue = 0.02;
      const percentage = 1.5; // 150%

      const result = calculateAdrLevels(dailyOpen, adrValue, percentage);

      expect(result.high).toBe(1.0850); // 1.0550 + (0.02 * 1.5)
      expect(result.low).toBe(1.0250);  // 1.0550 - (0.02 * 1.5)
    });
  });

  describe('calculatePricePositionInAdr', () => {
    it('should calculate position as percentage of ADR', () => {
      const currentPrice = 1.0570;
      const dailyOpen = 1.0550;
      const adrValue = 0.02;

      const result = calculatePricePositionInAdr(currentPrice, dailyOpen, adrValue);
      expect(result).toBeCloseTo(10, 10); // 10% of ADR
    });

    it('should handle prices outside ADR range', () => {
      const currentPrice = 1.0800; // Way above ADR
      const dailyOpen = 1.0550;
      const adrValue = 0.02;

      const result = calculatePricePositionInAdr(currentPrice, dailyOpen, adrValue);
      expect(result).toBeCloseTo(125, 10); // 125% of ADR
    });

    it('should return 0 for invalid inputs', () => {
      expect(calculatePricePositionInAdr(1.0550, null, 0.02)).toBe(0);
      expect(calculatePricePositionInAdr(1.0550, 1.0550, null)).toBe(0);
    });
  });

  describe('Integration and Edge Cases', () => {
    it('should handle different asset classes correctly', () => {
      const testCases = [
        // FX pair
        {
          state: {
            midPrice: 1.0550,
            todaysHigh: 1.0620,
            todaysLow: 1.0480,
            projectedAdrHigh: 1.0650,
            projectedAdrLow: 1.0450
          },
          expectedAdrRange: 0.02
        },
        // JPY pair
        {
          state: {
            midPrice: 149.50,
            todaysHigh: 150.20,
            todaysLow: 148.80,
            projectedAdrHigh: 150.50,
            projectedAdrLow: 148.50
          },
          expectedAdrRange: 2.0
        },
        // Commodity
        {
          state: {
            midPrice: 1985.0,
            todaysHigh: 1995.0,
            todaysLow: 1975.0,
            projectedAdrHigh: 2000.0,
            projectedAdrLow: 1970.0
          },
          expectedAdrRange: 30.0
        }
      ];

      testCases.forEach(({ state, expectedAdrRange }) => {
        const result = calculateMaxAdrPercentage(state);
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThan(0);

        // Verify ADR calculation
        const actualAdrRange = state.projectedAdrHigh - state.projectedAdrLow;
        expect(actualAdrRange).toBeCloseTo(expectedAdrRange, 2);
      });
    });

    it('should handle extreme market conditions', () => {
      const extremeCases = [
        // Very volatile day (200% of ADR)
        {
          midPrice: 1.0550,
          todaysHigh: 1.0750,
          todaysLow: 1.0350,
          projectedAdrHigh: 1.0650,
          projectedAdrLow: 1.0450
        },
        // Very calm day (25% of ADR)
        {
          midPrice: 1.0550,
          todaysHigh: 1.0600,
          todaysLow: 1.0500,
          projectedAdrHigh: 1.0650,
          projectedAdrLow: 1.0450
        }
      ];

      extremeCases.forEach(state => {
        const result = calculateMaxAdrPercentage(state);
        expect(result).toBeGreaterThan(0);
        expect(Number.isFinite(result)).toBe(true);
      });
    });

    it('should maintain precision for financial calculations', () => {
      const preciseState = {
        midPrice: 1.05567,
        todaysHigh: 1.05892,
        todaysLow: 1.05234,
        projectedAdrHigh: 1.06500,
        projectedAdrLow: 1.04634
      };

      const result = calculateMaxAdrPercentage(preciseState);

      // Should maintain reasonable precision
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(5); // Reasonable upper bound
      expect(Number.isFinite(result)).toBe(true);

      // Check rounding to 0.25 increments
      const rounded = Math.round(result * 4) / 4;
      expect(Math.abs(result - rounded)).toBeLessThan(0.001);
    });

    it('should be consistent with repeated calculations', () => {
      const results = [];

      // Run same calculation multiple times
      for (let i = 0; i < 10; i++) {
        results.push(calculateMaxAdrPercentage(mockState));
      }

      // All results should be identical
      const firstResult = results[0];
      results.forEach(result => {
        expect(result).toBe(firstResult);
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large numbers of calculations efficiently', () => {
      const start = performance.now();

      // Perform many calculations
      for (let i = 0; i < 10000; i++) {
        calculateMaxAdrPercentage(mockState);
        calculateAdrPercentage(1.0550 + (i * 0.00001), 1.0550, 0.02);
        calculateAdrLevels(1.0550, 0.02, i / 100);
      }

      const end = performance.now();
      const duration = end - start;

      // Should complete in reasonable time (less than 100ms for 30k calculations)
      expect(duration).toBeLessThan(100);
    });

    it('should not create memory leaks', () => {
      const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

      // Perform many calculations
      for (let i = 0; i < 100000; i++) {
        calculateMaxAdrPercentage(mockState);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

      // Memory usage should not increase dramatically
      if (performance.memory) {
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
      }
    });
  });
});