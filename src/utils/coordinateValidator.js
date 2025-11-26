/**
 * Coordinate Validator - Centralized YScale Validation System
 *
 * Provides comprehensive validation for YScale coordinate consistency across all visualization components.
 * Ensures ADR alignment and trading-grade precision for container-canvas-visualization coordination.
 *
 * Key Features:
 * - ADR ±50% bounds validation with 2px trading precision tolerance
 * - Unified coordinate validation for all 7 visualization components
 * - Performance-optimized validation with sub-100ms transaction targets
 * - Comprehensive diagnostic logging for troubleshooting
 */

/**
 * Centralized YScale and ADR alignment validation for NeuroSense FX visualizations
 */

// Cache fallback state to avoid repeated corruption detection
let useDateFallback = false;
let lastCorruptionCheck = 0;
const CORRUPTION_CHECK_INTERVAL = 1000; // Check every 1 second max

/**
 * HMR-safe Performance API fallback for robust timing measurements
 * This function is hardened against Hot Module Replacement race conditions
 */
function getPerformanceTime() {
    try {
      // If we've recently detected corruption, use Date.now() to avoid repeated failures
      const now = Date.now();
      if (useDateFallback && (now - lastCorruptionCheck) < CORRUPTION_CHECK_INTERVAL) {
        return now;
      }

      // Attempt to use performance.now() with comprehensive safety checks
      if (typeof performance !== 'undefined' &&
          performance &&
          typeof performance.now === 'function') {

        // CRITICAL: Try the actual call to detect HMR corruption
        // This is the key - typeof checks aren't enough during HMR races
        try {
          const perfResult = performance.now();

          // Validate the result is a finite number
          if (typeof perfResult === 'number' && isFinite(perfResult) && perfResult >= 0) {
            // Performance API working correctly, reset corruption flag
            useDateFallback = false;
            lastCorruptionCheck = now;
            return perfResult;
          } else {
            // Performance returned invalid result, assume corruption
            useDateFallback = true;
            lastCorruptionCheck = now;
            return Date.now();
          }
        } catch (perfError) {
          // CRITICAL: This is where "performance.now is not a function" occurs
          // despite typeof checks passing - classic HMR corruption signature
          useDateFallback = true;
          lastCorruptionCheck = now;
          return Date.now();
        }
      }

      // Performance API not available, use Date.now() fallback
      useDateFallback = true;
      lastCorruptionCheck = now;
      return Date.now();

    } catch (criticalError) {
      // Ultimate safety net - any unexpected error uses Date.now()
      useDateFallback = true;
      lastCorruptionCheck = Date.now();
      return Date.now();
    }
  }

export class CoordinateValidator {
  /**
   * Validates ADR alignment for trading-critical accuracy
   * Ensures daily open price (ADR 0) centers correctly and ±50% bounds are properly positioned
   *
   * @param {Function} yScale - The YScale transformation function
   * @param {Object} state - Market data state with price information
   * @param {Object} contentArea - Canvas content area dimensions
   * @param {string} displayId - Display identifier for logging
   * @returns {Object} Validation results with pass/fail status and detailed metrics
   */
  static validateADRAlignment(yScale, state, contentArea, displayId) {
    // Validate inputs
    if (!yScale || typeof yScale !== 'function') {
      return {
        isValid: false,
        error: 'YScale function is not available or not a function',
        testResults: [],
        maxDeviation: Infinity
      };
    }

    if (!state || !state.midPrice || !state.projectedAdrHigh || !state.projectedAdrLow) {
      return {
        isValid: false,
        error: 'Required market data (midPrice, projectedAdrHigh, projectedAdrLow) is missing',
        testResults: [],
        maxDeviation: Infinity
      };
    }

    if (!contentArea || !contentArea.width || !contentArea.height) {
      return {
        isValid: false,
        error: 'Content area dimensions are invalid',
        testResults: [],
        maxDeviation: Infinity
      };
    }

    const { midPrice, projectedAdrHigh, projectedAdrLow } = state;
    const adrValue = projectedAdrHigh - projectedAdrLow;

    // Define critical ADR alignment tests with trading precision requirements
    const tests = [
      {
        name: 'ADR 0 (Daily Open)',
        price: midPrice,
        expectedY: contentArea.height / 2,
        tolerance: 2.0, // 2px tolerance for trading precision
        description: 'Daily open should center exactly at canvas vertical center'
      },
      {
        name: 'ADR +50%',
        price: midPrice + (adrValue * 0.5),
        expectedY: contentArea.height * 0.25,
        tolerance: 2.0,
        description: 'Upper ADR bound should be at 25% of canvas height from top'
      },
      {
        name: 'ADR -50%',
        price: midPrice - (adrValue * 0.5),
        expectedY: contentArea.height * 0.75,
        tolerance: 2.0,
        description: 'Lower ADR bound should be at 75% of canvas height from top'
      }
    ];

    // Execute alignment tests
    const testResults = tests.map(test => {
      try {
        const actualY = yScale(test.price);
        const deviation = Math.abs(actualY - test.expectedY);
        const passed = deviation <= test.tolerance;
        const percentageError = (deviation / contentArea.height) * 100;

        return {
          ...test,
          actualY,
          deviation,
          percentageError,
          passed,
          within1px: deviation <= 1.0, // Extra precision for high-end trading
          within5px: deviation <= 5.0  // Acceptable range for trading
        };
      } catch (error) {
        return {
          ...test,
          actualY: null,
          deviation: Infinity,
          percentageError: Infinity,
          passed: false,
          error: error.message
        };
      }
    });

    // Evaluate overall validation results
    const allPassed = testResults.every(result => result.passed);
    const maxDeviation = Math.max(...testResults.map(r => r.deviation));
    const avgDeviation = testResults.reduce((sum, r) => sum + r.deviation, 0) / testResults.length;
    const withinTradingPrecision = testResults.every(r => r.deviation <= 1.0);

    // Log detailed results for debugging (development only)
    if (import.meta.env.DEV && (!allPassed || maxDeviation > 1.0)) {
      console.warn(`[ADR_ALIGNMENT:${displayId}] Alignment issues detected:`, {
        timestamp: getPerformanceTime(),
        contentArea: { width: contentArea.width, height: contentArea.height },
        marketData: {
          midPrice,
          adrValue,
          projectedAdrHigh,
          projectedAdrLow
        },
        testResults: testResults.map(r => ({
          name: r.name,
          passed: r.passed,
          actualY: r.actualY,
          expectedY: r.expectedY,
          deviation: r.deviation.toFixed(2),
          percentageError: r.percentageError.toFixed(3)
        })),
        summary: {
          allPassed,
          maxDeviation: maxDeviation.toFixed(2),
          avgDeviation: avgDeviation.toFixed(2),
          withinTradingPrecision
        }
      });
    }

    return {
      isValid: allPassed,
      testResults,
      maxDeviation,
      avgDeviation,
      withinTradingPrecision,
      summary: {
        testsPassed: testResults.filter(r => r.passed).length,
        totalTests: testResults.length,
        maxDeviationPx: maxDeviation,
        avgDeviationPx: avgDeviation
      }
    };
  }

  /**
   * Validates coordinate system consistency for any visualization component
   * Provides comprehensive validation including ADR alignment and basic coordinate checks
   *
   * @param {string} visualizationName - Name of the visualization component
   * @param {Function} yScale - The YScale transformation function
   * @param {Object} state - Market data state
   * @param {Object} contentArea - Canvas content area dimensions
   * @param {string} displayId - Display identifier for logging
   * @returns {Object} Comprehensive validation results
   */
  static validateVisualizationCoordinateSystem(visualizationName, yScale, state, contentArea, displayId) {
    // Skip expensive validation in production - only run in development
    if (!import.meta.env.DEV) {
      return {
        isValid: true,
        validationDuration: 0,
        validations: {},
        adrAlignmentStatus: null
      };
    }

    const validationStartTime = getPerformanceTime();

    // Basic coordinate system validations
    const validations = {
      yScaleFunctional: {
        passed: yScale && typeof yScale === 'function',
        description: 'YScale is a valid function'
      },
      contentAreaValid: {
        passed: contentArea && contentArea.width > 0 && contentArea.height > 0,
        description: 'Content area has valid dimensions',
        details: contentArea ? { width: contentArea.width, height: contentArea.height } : null
      },
      marketDataValid: {
        passed: state && state.midPrice && state.visualLow && state.visualHigh,
        description: 'Essential market data is available',
        details: state ? {
          hasMidPrice: !!state.midPrice,
          hasVisualLow: !!state.visualLow,
          hasVisualHigh: !!state.visualHigh
        } : null
      }
    };

    // Run ADR alignment if basic validations pass
    let adrAlignment = null;
    if (validations.yScaleFunctional.passed && validations.marketDataValid.passed && validations.contentAreaValid.passed) {
      adrAlignment = this.validateADRAlignment(yScale, state, contentArea, displayId);
    }

    // Determine overall validation status
    const basicValidationsPassed = Object.values(validations).every(v => v.passed);
    const adrAlignmentPassed = adrAlignment ? adrAlignment.isValid : true;
    const allValid = basicValidationsPassed && adrAlignmentPassed;

    const validationDuration = getPerformanceTime() - validationStartTime;

    // Create comprehensive validation report
    const validationResult = {
      visualizationName,
      displayId,
      timestamp: Date.now(),
      validationDuration,
      validations,
      adrAlignment,
      isValid: allValid,
      summary: {
        basicValidationsPassed,
        adrAlignmentPassed,
        totalValidationTime: validationDuration,
        meetsPerformanceTarget: validationDuration < 1.0 // Validation should complete in < 1ms
      }
    };

    // Log validation failures for debugging (development only)
    if (import.meta.env.DEV && !allValid) {
      console.warn(`[COORDINATE_VALIDATION:${displayId}] ${visualizationName} validation failed:`, {
        timestamp: validationResult.timestamp,
        duration: `${validationDuration.toFixed(2)}ms`,
        failedValidations: Object.entries(validations)
          .filter(([_, v]) => !v.passed)
          .map(([name, v]) => ({ name, reason: v.description })),
        adrAlignmentStatus: adrAlignment ? {
          passed: adrAlignment.isValid,
          maxDeviation: adrAlignment.maxDeviation
        } : 'Not executed due to basic validation failures'
      });
    }

    return validationResult;
  }

  /**
   * Quick validation for performance-critical scenarios
   * Performs minimal checks to ensure basic coordinate functionality
   *
   * @param {Function} yScale - The YScale transformation function
   * @param {Object} contentArea - Canvas content area dimensions
   * @returns {Object} Quick validation results
   */
  static quickValidate(yScale, contentArea) {
    const quickChecks = {
      yScaleExists: !!yScale,
      yScaleIsFunction: typeof yScale === 'function',
      contentAreaExists: !!contentArea,
      contentAreaHasDimensions: contentArea && contentArea.width > 0 && contentArea.height > 0
    };

    const allPass = Object.values(quickChecks).every(Boolean);

    return {
      isValid: allPass,
      checks: quickChecks,
      passed: Object.entries(quickChecks).filter(([_, passed]) => passed).map(([name]) => name),
      failed: Object.entries(quickChecks).filter(([_, passed]) => !passed).map(([name]) => name)
    };
  }

  /**
   * Validates coordinate system synchronization across multiple components
   * Used to ensure all visualizations are using consistent coordinate systems
   *
   * @param {Array} validationResults - Array of validation results from multiple components
   * @returns {Object} Synchronization validation results
   */
  static validateSystemSynchronization(validationResults) {
    if (!Array.isArray(validationResults) || validationResults.length === 0) {
      return {
        isValid: false,
        error: 'No validation results provided',
        componentCount: 0
      };
    }

    const componentCount = validationResults.length;
    const validComponents = validationResults.filter(r => r.isValid).length;
    const allValid = validComponents === componentCount;

    // Check for consistent ADR alignment across components
    const adrAlignments = validationResults
      .filter(r => r.adrAlignment)
      .map(r => r.adrAlignment.maxDeviation);

    const maxSystemDeviation = adrAlignments.length > 0 ? Math.max(...adrAlignments) : 0;
    const avgSystemDeviation = adrAlignments.length > 0
      ? adrAlignments.reduce((sum, dev) => sum + dev, 0) / adrAlignments.length
      : 0;

    return {
      isValid: allValid && maxSystemDeviation <= 2.0,
      componentCount,
      validComponents,
      invalidComponents: componentCount - validComponents,
      synchronizationQuality: {
        allComponentsValid: allValid,
        maxSystemDeviation,
        avgSystemDeviation,
        withinTradingPrecision: maxSystemDeviation <= 1.0
      },
      failedComponents: validationResults
        .filter(r => !r.isValid)
        .map(r => ({
          name: r.visualizationName,
          displayId: r.displayId,
          reason: r.summary ? 'Basic validations failed' : 'ADR alignment failed'
        }))
    };
  }
}

/**
 * Convenience function for quick ADR validation
 * Ideal for performance-critical scenarios where full validation is too expensive
 */
export function quickADRAlignmentCheck(yScale, state, contentArea) {
  if (!yScale || !state?.midPrice || !contentArea?.height) {
    return { valid: false, reason: 'Missing required inputs' };
  }

  try {
    const dailyOpenY = yScale(state.midPrice);
    const expectedY = contentArea.height / 2;
    const deviation = Math.abs(dailyOpenY - expectedY);

    return {
      valid: deviation <= 2.0,
      deviation,
      within1px: deviation <= 1.0,
      actualY: dailyOpenY,
      expectedY
    };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

export default CoordinateValidator;