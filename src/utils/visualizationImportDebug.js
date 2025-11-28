/**
 * 🎯 VISUALIZATION IMPORT DEBUG SYSTEM
 *
 * Comprehensive step-by-step debugging for the visualization rendering pipeline.
 * Provides full visibility into direct import system with validation, performance monitoring,
 * and error detection for trading applications.
 */

// Development-only performance optimization
const isDevelopment = process.env.NODE_ENV === 'development';

// 📊 Visualization Registry - Central tracking system
class VisualizationRegistry {
  constructor() {
    this.visualizations = new Map();
    this.importStatus = new Map();
    this.validationResults = new Map();
    this.performanceMetrics = new Map();
    this.errorLog = [];
    this.globalImportId = 0;
  }

  // Generate unique tracking ID for operations
  generateOperationId(prefix = 'VIZ') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const operationId = `${prefix}_${timestamp}_${random}_${this.globalImportId++}`;
    return operationId;
  }

  // Track visualization import with comprehensive logging
  trackImport(name, importResult, operationId) {
    const importStartTime = performance.now();
    const importData = {
      name,
      operationId,
      timestamp: importStartTime,
      success: false,
      error: null,
      functionValid: false,
      functionType: null,
      importPath: null,
      loadTime: 0
    };

    try {
      if (importResult && typeof importResult === 'function') {
        // Successfully imported function
        importData.success = true;
        importData.functionValid = true;
        importData.functionType = 'function';
        this.visualizations.set(name, importResult);

        console.log(`✅ [VIZ_IMPORT:${operationId}] Successfully imported visualization function: ${name}`, {
          functionName: importResult.name || 'anonymous',
          functionLength: importResult.length,
          isValidFunction: typeof importResult === 'function'
        });
      } else if (importResult && typeof importResult === 'object' && importResult.default) {
        // ES6 module with default export
        if (typeof importResult.default === 'function') {
          importData.success = true;
          importData.functionValid = true;
          importData.functionType = 'es6-default';
          this.visualizations.set(name, importResult.default);

          console.log(`✅ [VIZ_IMPORT:${operationId}] Successfully imported ES6 default function: ${name}`, {
            functionName: importResult.default.name || 'anonymous',
            functionLength: importResult.default.length,
            isValidFunction: typeof importResult.default === 'function'
          });
        } else {
          throw new Error(`ES6 default export is not a function: ${typeof importResult.default}`);
        }
      } else {
        // Invalid import result
        throw new Error(`Invalid import result type: ${typeof importResult}`);
      }
    } catch (error) {
      importData.error = error.message;
      this.errorLog.push({
        operationId,
        name,
        error: error.message,
        timestamp: importStartTime,
        type: 'import_error'
      });

      console.error(`❌ [VIZ_IMPORT:${operationId}] Failed to import visualization: ${name}`, {
        error: error.message,
        importResultType: typeof importResult,
        hasDefault: importResult?.default !== undefined,
        defaultValueType: importResult?.default ? typeof importResult.default : 'N/A'
      });
    }

    importData.loadTime = performance.now() - importStartTime;
    this.importStatus.set(name, importData);
    this.performanceMetrics.set(name, {
      importTime: importData.loadTime,
      validationTime: 0,
      totalCalls: 0,
      totalCallTime: 0
    });

    return importData;
  }

  // Validate visualization function signature and behavior
  validateFunction(name, operationId) {
    const validationStartTime = performance.now();
    const validationData = {
      operationId,
      name,
      timestamp: validationStartTime,
      isValid: false,
      signature: null,
      parameterValidation: null,
      callTestResult: null,
      validationTime: 0,
      errors: []
    };

    try {
      const visualizationFunction = this.visualizations.get(name);
      if (!visualizationFunction) {
        throw new Error(`Visualization function not found in registry: ${name}`);
      }

      // Test 1: Function signature validation
      const signatureValidation = this.validateFunctionSignature(visualizationFunction, name);
      validationData.signature = signatureValidation;

      if (!signatureValidation.isValid) {
        throw new Error(`Function signature validation failed: ${signatureValidation.errors.join(', ')}`);
      }

      // Test 2: Parameter validation
      const parameterValidation = this.validateParameterRequirements(visualizationFunction, name);
      validationData.parameterValidation = parameterValidation;

      if (!parameterValidation.isValid) {
        throw new Error(`Parameter validation failed: ${parameterValidation.errors.join(', ')}`);
      }

      // Test 3: Basic function call test with mock data
      const callTestResult = this.testFunctionCall(visualizationFunction, name, operationId);
      validationData.callTestResult = callTestResult;

      if (!callTestResult.success) {
        throw new Error(`Function call test failed: ${callTestResult.error}`);
      }

      validationData.isValid = true;

      console.log(`✅ [VIZ_VALIDATE:${operationId}] Validation successful for: ${name}`, {
        signature: signatureValidation,
        parameters: parameterValidation,
        callTest: callTestResult
      });

    } catch (error) {
      validationData.errors.push(error.message);
      this.errorLog.push({
        operationId,
        name,
        error: error.message,
        timestamp: validationStartTime,
        type: 'validation_error'
      });

      console.error(`❌ [VIZ_VALIDATE:${operationId}] Validation failed for: ${name}`, {
        error: error.message,
        validationData
      });
    }

    validationData.validationTime = performance.now() - validationStartTime;

    // Update performance metrics
    if (this.performanceMetrics.has(name)) {
      const metrics = this.performanceMetrics.get(name);
      metrics.validationTime = validationData.validationTime;
      this.performanceMetrics.set(name, metrics);
    }

    this.validationResults.set(name, validationData);
    return validationData;
  }

  // Validate function signature matches expected patterns
  validateFunctionSignature(func, name) {
    const validation = {
      isValid: false,
      errors: [],
      details: {}
    };

    try {
      // Check function type
      if (typeof func !== 'function') {
        validation.errors.push(`Not a function: ${typeof func}`);
        return validation;
      }

      // Check function length (expected parameters)
      const expectedParams = this.getExpectedParameterCount(name);
      if (expectedParams !== null && func.length !== expectedParams) {
        validation.errors.push(`Parameter count mismatch: expected ${expectedParams}, got ${func.length}`);
      }

      // Check function name (should be descriptive)
      if (!func.name || func.name.length < 3) {
        validation.errors.push(`Function name too short or missing: ${func.name}`);
      }

      validation.details = {
        name: func.name,
        length: func.length,
        expectedParams,
        isAsync: func.constructor.name === 'AsyncFunction'
      };

      validation.isValid = validation.errors.length === 0;

    } catch (error) {
      validation.errors.push(`Signature validation error: ${error.message}`);
    }

    return validation;
  }

  // Get expected parameter count for visualization functions
  getExpectedParameterCount(name) {
    const paramCounts = {
      'drawMarketProfile': 5,        // (ctx, renderingContext, config, state, yScale)
      'drawDayRangeMeter': 5,        // (ctx, renderingContext, config, state, yScale)
      'drawPriceFloat': 5,           // (ctx, renderingContext, config, state, yScale)
      'drawPriceDisplay': 5,         // (ctx, renderingContext, config, state, yScale)
      'drawVolatilityOrb': 5,        // (ctx, renderingContext, config, state, yScale)
      'drawVolatilityMetric': 4,     // (ctx, renderingContext, config, state)
      'drawPriceMarkers': 6          // (ctx, renderingContext, config, state, yScale, markers)
    };

    return paramCounts[name] || null;
  }

  // Validate parameter requirements for visualization functions
  validateParameterRequirements(func, name) {
    const validation = {
      isValid: false,
      errors: [],
      details: {}
    };

    try {
      // Most visualization functions require similar parameter patterns
      const requiredParams = this.getRequiredParameters(name);
      validation.details = {
        requiredParams,
        functionLength: func.length,
        parameterMatch: func.length >= requiredParams.length
      };

      if (func.length < requiredParams.length) {
        validation.errors.push(`Insufficient parameters: need ${requiredParams.length}, got ${func.length}`);
      }

      validation.isValid = validation.errors.length === 0;

    } catch (error) {
      validation.errors.push(`Parameter validation error: ${error.message}`);
    }

    return validation;
  }

  // Get required parameters for visualization functions
  getRequiredParameters(name) {
    const baseParams = ['ctx', 'renderingContext', 'config', 'state'];
    const yScaleParams = ['ctx', 'renderingContext', 'config', 'state', 'yScale'];
    const markerParams = ['ctx', 'renderingContext', 'config', 'state', 'yScale', 'markers'];

    if (name === 'drawPriceMarkers') {
      return markerParams;
    } else if (name === 'drawVolatilityMetric') {
      return baseParams; // No yScale parameter
    } else {
      return yScaleParams;
    }
  }

  // Test basic function call with mock data
  testFunctionCall(func, name, operationId) {
    const testResult = {
      success: false,
      error: null,
      executionTime: 0,
      details: {}
    };

    const testStartTime = performance.now();

    try {
      // Create mock test data
      const mockData = this.createMockTestData(name);

      // Test function call with try-catch to handle runtime errors
      const result = func(...mockData);

      testResult.executionTime = performance.now() - testStartTime;
      testResult.details = {
        hasReturn: result !== undefined,
        returnType: typeof result,
        executionTime: testResult.executionTime
      };

      testResult.success = true;

      console.log(`🧪 [VIZ_TEST:${operationId}] Function call test successful for: ${name}`, {
        executionTime: testResult.executionTime,
        hasReturn: testResult.details.hasReturn,
        returnType: testResult.details.returnType
      });

    } catch (error) {
      testResult.error = error.message;
      testResult.executionTime = performance.now() - testStartTime;

      console.warn(`⚠️ [VIZ_TEST:${operationId}] Function call test failed for: ${name}`, {
        error: error.message,
        executionTime: testResult.executionTime
      });
    }

    return testResult;
  }

  // Create mock test data for function validation
  createMockTestData(name) {
    // Mock canvas context
    const mockCtx = {
      save: () => {},
      restore: () => {},
      clearRect: () => {},
      fillRect: () => {},
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillText: () => {},
      strokeText: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      arc: () => {},
      scale: () => {},
      setTransform: () => {}
    };

    // Mock rendering context
    const mockRenderingContext = {
      containerSize: { width: 220, height: 120 },
      contentArea: { width: 220, height: 120 },
      adrAxisX: 110,
      visualizationsContentWidth: 220,
      meterHeight: 120,
      adrAxisXPosition: 110
    };

    // Mock config
    const mockConfig = {
      containerSize: { width: 220, height: 120 },
      adrAxisPosition: 0.5
    };

    // Mock state
    const mockState = {
      ready: true,
      midPrice: 1.2345,
      visualLow: 1.2300,
      visualHigh: 1.2400,
      projectedAdrHigh: 1.2450,
      projectedAdrLow: 1.2250,
      todaysHigh: 1.2420,
      todaysLow: 1.2320
    };

    // Mock yScale
    const mockYScale = (price) => {
      return 60 - (price - 1.2345) * 10000; // Simple linear transformation
    };

    // Mock markers for price markers function
    const mockMarkers = [
      { price: 1.2350, type: 'support', color: '#10b981' },
      { price: 1.2380, type: 'resistance', color: '#ef4444' }
    ];

    // Return appropriate parameters based on function
    if (name === 'drawPriceMarkers') {
      return [mockCtx, mockRenderingContext, mockConfig, mockState, mockYScale, mockMarkers];
    } else if (name === 'drawVolatilityMetric') {
      return [mockCtx, mockRenderingContext, mockConfig, mockState];
    } else {
      return [mockCtx, mockRenderingContext, mockConfig, mockState, mockYScale];
    }
  }

  // Get visualization function with status check
  getVisualization(name) {
    const status = this.importStatus.get(name);
    const validation = this.validationResults.get(name);

    if (!status || !status.success) {
      console.warn(`⚠️ [VIZ_GET] Visualization not imported: ${name}`, { status });
      return null;
    }

    if (!validation || !validation.isValid) {
      console.warn(`⚠️ [VIZ_GET] Visualization not validated: ${name}`, { validation });
      return null;
    }

    const visualization = this.visualizations.get(name);
    if (!visualization) {
      console.error(`❌ [VIZ_GET] Visualization function missing from registry: ${name}`);
      return null;
    }

    // Update performance metrics
    const metrics = this.performanceMetrics.get(name);
    if (metrics) {
      metrics.totalCalls++;
      this.performanceMetrics.set(name, metrics);
    }

    return visualization;
  }

  // Get comprehensive status report
  getStatusReport() {
    const report = {
      timestamp: Date.now(),
      totalVisualizations: this.visualizations.size,
      importedCount: 0,
      validatedCount: 0,
      errorCount: this.errorLog.length,
      performanceMetrics: {},
      errors: this.errorLog.slice(-10), // Last 10 errors
      visualizations: {}
    };

    for (const [name, status] of this.importStatus) {
      report.visualizations[name] = {
        imported: status.success,
        validated: this.validationResults.get(name)?.isValid || false,
        importTime: status.loadTime,
        validationTime: this.validationResults.get(name)?.validationTime || 0,
        totalCalls: this.performanceMetrics.get(name)?.totalCalls || 0
      };

      if (status.success) report.importedCount++;
      if (this.validationResults.get(name)?.isValid) report.validatedCount++;
    }

    report.performanceMetrics = Object.fromEntries(this.performanceMetrics);

    return report;
  }

  // Log detailed status for debugging
  logDetailedStatus() {
    const report = this.getStatusReport();

    console.group('🔍 [VIZ_DEBUG] Visualization Import System Status Report');
    console.log('📊 Summary:', {
      total: report.totalVisualizations,
      imported: report.importedCount,
      validated: report.validatedCount,
      errors: report.errorCount
    });

    if (report.errors.length > 0) {
      console.group('❌ Recent Errors:');
      report.errors.forEach(error => {
        console.log(`${error.timestamp} - ${error.name}: ${error.error} (${error.type})`);
      });
      console.groupEnd();
    }

    console.group('📋 Visualization Status:');
    Object.entries(report.visualizations).forEach(([name, status]) => {
      const statusIcon = status.imported && status.validated ? '✅' : status.imported ? '⚠️' : '❌';
      console.log(`${statusIcon} ${name}:`, {
        imported: status.imported,
        validated: status.validated,
        importTime: `${status.importTime.toFixed(2)}ms`,
        validationTime: `${status.validationTime.toFixed(2)}ms`,
        calls: status.totalCalls
      });
    });
    console.groupEnd();

    console.groupEnd();
  }
}

// Global registry instance
export const visualizationRegistry = new VisualizationRegistry();

/**
 * Centralized visualization loader with comprehensive debugging
 */
export class VisualizationLoader {
  constructor() {
    this.operationHistory = [];
  }

  // Load and validate a single visualization
  async loadVisualization(name, importPromise) {
    const operationId = visualizationRegistry.generateOperationId('LOAD');
    const operationStartTime = performance.now();

    console.log(`🔄 [VIZ_LOAD:${operationId}] Starting visualization load: ${name}`);

    try {
      // Import the visualization
      const importResult = await importPromise;

      // Track import
      const importStatus = visualizationRegistry.trackImport(name, importResult, operationId);

      if (importStatus.success) {
        // Validate the imported function
        const validationStatus = visualizationRegistry.validateFunction(name, operationId);

        const operationData = {
          operationId,
          name,
          success: importStatus.success && validationStatus.isValid,
          importTime: importStatus.loadTime,
          validationTime: validationStatus.validationTime,
          totalTime: performance.now() - operationStartTime,
          timestamp: operationStartTime
        };

        this.operationHistory.push(operationData);

        console.log(`✅ [VIZ_LOAD:${operationId}] Successfully loaded and validated: ${name}`, {
          importTime: `${importStatus.loadTime.toFixed(2)}ms`,
          validationTime: `${validationStatus.validationTime.toFixed(2)}ms`,
          totalTime: `${operationData.totalTime.toFixed(2)}ms`
        });

        return operationData;
      } else {
        throw new Error(importStatus.error || 'Import failed');
      }

    } catch (error) {
      const operationData = {
        operationId,
        name,
        success: false,
        error: error.message,
        totalTime: performance.now() - operationStartTime,
        timestamp: operationStartTime
      };

      this.operationHistory.push(operationData);

      console.error(`❌ [VIZ_LOAD:${operationId}] Failed to load visualization: ${name}`, {
        error: error.message,
        totalTime: `${operationData.totalTime.toFixed(2)}ms`
      });

      return operationData;
    }
  }

  // Batch load multiple visualizations
  async loadVisualizations(visualizationConfigs) {
    const batchId = visualizationRegistry.generateOperationId('BATCH');
    const batchStartTime = performance.now();

    console.log(`🔄 [VIZ_BATCH:${batchId}] Starting batch load of ${visualizationConfigs.length} visualizations`);

    const results = await Promise.allSettled(
      visualizationConfigs.map(({ name, importPromise }) =>
        this.loadVisualization(name, importPromise)
      )
    );

    const batchData = {
      batchId,
      total: visualizationConfigs.length,
      successful: results.filter(r => r.value?.success).length,
      failed: results.filter(r => !r.value?.success).length,
      totalTime: performance.now() - batchStartTime,
      timestamp: batchStartTime,
      results: results.map(r => r.value || r.reason)
    };

    console.log(`📊 [VIZ_BATCH:${batchId}] Batch load completed`, {
      successful: batchData.successful,
      failed: batchData.failed,
      totalTime: `${batchData.totalTime.toFixed(2)}ms`
    });

    return batchData;
  }
}

// Global loader instance
export const visualizationLoader = new VisualizationLoader();

// Development-only debug utilities (no performance impact in production)
export const debugUtils = isDevelopment ? {
  // Enable comprehensive logging
  enableDebugLogging: () => {
    console.log('🔧 [VIZ_DEBUG] Debug logging enabled for visualization imports');
    visualizationRegistry.logDetailedStatus();
  },

  // Get real-time status
  getCurrentStatus: () => visualizationRegistry.getStatusReport(),

  // Validate all loaded visualizations
  validateAll: () => {
    const results = [];
    for (const [name] of visualizationRegistry.visualizations) {
      const operationId = visualizationRegistry.generateOperationId('REVALIDATE');
      const result = visualizationRegistry.validateFunction(name, operationId);
      results.push({ name, ...result });
    }
    return results;
  },

  // Test all visualizations with mock data
  testAll: () => {
    const results = [];
    for (const [name, func] of visualizationRegistry.visualizations) {
      const operationId = visualizationRegistry.generateOperationId('TEST');
      const testResult = visualizationRegistry.testFunctionCall(func, name, operationId);
      results.push({ name, ...testResult });
    }
    return results;
  }
} : {};

/**
 * Initialize the enhanced import system
 * Call this early in the application lifecycle
 */
export function initializeVisualizationDebugSystem() {
  console.log('🚀 [VIZ_DEBUG] Initializing Visualization Import Debug System');

  if (isDevelopment) {
    // Log status every 30 seconds in development
    setInterval(() => {
      visualizationRegistry.logDetailedStatus();
    }, 30000);
  }
}

export default {
  visualizationRegistry,
  visualizationLoader,
  debugUtils,
  initializeVisualizationDebugSystem
};