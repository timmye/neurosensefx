/**
 * State Validation Utilities
 * Provides Zod schemas and validation functions for all state management
 */

import { z } from 'zod';

// Base schemas for common data types
const PositionSchema = z.object({
  x: z.number(),
  y: z.number()
});

const SizeSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive()
});

const TimestampSchema = z.number().positive().optional();

// Workspace state schema
export const WorkspaceStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  layout: z.object({
    canvases: z.array(z.object({
      id: z.string(),
      symbol: z.string(),
      position: PositionSchema,
      size: SizeSchema,
      settings: z.record(z.any()).optional(),
      indicators: z.array(z.string()).optional(),
      isVisible: z.boolean().default(true),
      zIndex: z.number().default(0)
    })),
    gridSettings: z.object({
      columns: z.number().positive().default(4),
      rows: z.number().positive().default(3),
      gap: z.number().nonNegative().default(10),
      padding: z.number().nonNegative().default(20)
    }),
    viewSettings: z.object({
      zoom: z.number().positive().default(1),
      panX: z.number().default(0),
      panY: z.number().default(0)
    })
  }),
  globalSettings: z.object({
    density: z.enum(['compact', 'normal', 'high']).default('normal'),
    theme: z.enum(['light', 'dark', 'auto']).default('dark'),
    autoSave: z.boolean().default(true),
    autoSaveInterval: z.number().positive().default(30000)
  }),
  symbolSubscriptions: z.array(z.string()).default([]),
  visualizationSettings: z.record(z.any()).default({})
});

// UI State schema
export const UIStateSchema = z.object({
  selectedSymbol: z.string().nullable().default(null),
  selectedCanvas: z.string().nullable().default(null),
  activePanel: z.string().default('connection'),
  sidebarCollapsed: z.boolean().default(false),
  sidebarWidth: z.number().positive().default(300),
  toolbarVisible: z.boolean().default(true),
  statusBarVisible: z.boolean().default(true),
  gridVisible: z.boolean().default(true),
  snapToGrid: z.boolean().default(true),
  hoverState: z.object({
    canvasId: z.string().nullable().default(null),
    element: z.string().nullable().default(null),
    position: PositionSchema.optional(),
    timestamp: TimestampSchema
  }).default({}),
  dragState: z.object({
    isDragging: z.boolean().default(false),
    canvasId: z.string().nullable().default(null),
    startPosition: PositionSchema.optional(),
    currentPosition: PositionSchema.optional(),
    dragType: z.enum(['move', 'resize', 'create']).nullable().default(null)
  }).default({})
});

// Performance state schema
export const PerformanceStateSchema = z.object({
  metrics: z.object({
    fps: z.number().nonNegative().default(0),
    renderTime: z.number().nonNegative().default(0),
    memoryUsage: z.number().nonNegative().default(0),
    activeCanvases: z.number().nonNegative().default(0),
    activeSubscriptions: z.number().nonNegative().default(0),
    cacheHitRate: z.number().nonNegative().default(0),
    dataProcessingTime: z.number().nonNegative().default(0)
  }),
  alerts: z.array(z.object({
    id: z.string(),
    type: z.enum(['warning', 'error', 'info']),
    message: z.string(),
    timestamp: TimestampSchema,
    acknowledged: z.boolean().default(false)
  })).default([]),
  thresholds: z.object({
    maxRenderTime: z.number().positive().default(16), // 60fps
    maxMemoryUsage: z.number().positive().default(500 * 1024 * 1024), // 500MB
    minFPS: z.number().positive().default(30),
    minCacheHitRate: z.number().nonNegative().default(80)
  })
});

// Application state schema (combined)
export const ApplicationStateSchema = z.object({
  workspace: WorkspaceStateSchema,
  ui: UIStateSchema,
  performance: PerformanceStateSchema,
  version: z.string().default('1.0.0'),
  lastSaved: TimestampSchema
});

// Validation functions
export class StateValidator {
  constructor() {
    this.schemas = {
      workspace: WorkspaceStateSchema,
      ui: UIStateSchema,
      performance: PerformanceStateSchema,
      application: ApplicationStateSchema
    };
  }

  /**
   * Validate workspace state
   */
  validateWorkspace(data) {
    try {
      return this.schemas.workspace.parse(data);
    } catch (error) {
      console.error('[StateValidator] Workspace validation failed:', error);
      throw new StateValidationError('Invalid workspace state', error.errors);
    }
  }

  /**
   * Validate UI state
   */
  validateUI(data) {
    try {
      return this.schemas.ui.parse(data);
    } catch (error) {
      console.error('[StateValidator] UI validation failed:', error);
      throw new StateValidationError('Invalid UI state', error.errors);
    }
  }

  /**
   * Validate performance state
   */
  validatePerformance(data) {
    try {
      return this.schemas.performance.parse(data);
    } catch (error) {
      console.error('[StateValidator] Performance validation failed:', error);
      throw new StateValidationError('Invalid performance state', error.errors);
    }
  }

  /**
   * Validate complete application state
   */
  validateApplication(data) {
    try {
      return this.schemas.application.parse(data);
    } catch (error) {
      console.error('[StateValidator] Application validation failed:', error);
      throw new StateValidationError('Invalid application state', error.errors);
    }
  }

  /**
   * Partial validation for updates
   */
  validatePartial(schemaName, data) {
    const schema = this.schemas[schemaName];
    if (!schema) {
      throw new StateValidationError(`Unknown schema: ${schemaName}`);
    }

    try {
      return schema.partial().parse(data);
    } catch (error) {
      console.error(`[StateValidator] ${schemaName} partial validation failed:`, error);
      throw new StateValidationError(`Invalid ${schemaName} state`, error.errors);
    }
  }

  /**
   * Create default state
   */
  createDefaults() {
    const now = Date.now();
    
    return {
      workspace: {
        id: `workspace_${now}`,
        name: 'Default Workspace',
        description: 'Default trading workspace',
        createdAt: now,
        updatedAt: now,
        layout: {
          canvases: [],
          gridSettings: {
            columns: 4,
            rows: 3,
            gap: 10,
            padding: 20
          },
          viewSettings: {
            zoom: 1,
            panX: 0,
            panY: 0
          }
        },
        globalSettings: {
          density: 'normal',
          theme: 'dark',
          autoSave: true,
          autoSaveInterval: 30000
        },
        symbolSubscriptions: [],
        visualizationSettings: {}
      },
      ui: {
        selectedSymbol: null,
        selectedCanvas: null,
        activePanel: 'connection',
        sidebarCollapsed: false,
        sidebarWidth: 300,
        toolbarVisible: true,
        statusBarVisible: true,
        gridVisible: true,
        snapToGrid: true,
        hoverState: {},
        dragState: {}
      },
      performance: {
        metrics: {
          fps: 0,
          renderTime: 0,
          memoryUsage: 0,
          activeCanvases: 0,
          activeSubscriptions: 0,
          cacheHitRate: 0,
          dataProcessingTime: 0
        },
        alerts: [],
        thresholds: {
          maxRenderTime: 16,
          maxMemoryUsage: 500 * 1024 * 1024,
          minFPS: 30,
          minCacheHitRate: 80
        }
      },
      version: '1.0.0',
      lastSaved: now
    };
  }
}

// Custom error class for state validation
export class StateValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'StateValidationError';
    this.errors = errors;
  }
}

// Create singleton validator instance
export const stateValidator = new StateValidator();

// Validation middleware functions
export const withValidation = (schemaName, updateFn) => {
  return (state, ...args) => {
    try {
      const result = updateFn(state, ...args);
      stateValidator.validatePartial(schemaName, result);
      return result;
    } catch (error) {
      console.error(`[withValidation] Validation failed for ${schemaName}:`, error);
      // Return original state if validation fails
      return state;
    }
  };
};

// Performance monitoring validation
export const validatePerformanceThresholds = (metrics, thresholds) => {
  const alerts = [];

  if (metrics.fps < thresholds.minFPS) {
    alerts.push({
      id: `fps_${Date.now()}`,
      type: 'warning',
      message: `Low FPS: ${metrics.fps.toFixed(1)} (threshold: ${thresholds.minFPS})`,
      timestamp: Date.now()
    });
  }

  if (metrics.renderTime > thresholds.maxRenderTime) {
    alerts.push({
      id: `render_${Date.now()}`,
      type: 'warning',
      message: `High render time: ${metrics.renderTime.toFixed(2)}ms (threshold: ${thresholds.maxRenderTime}ms)`,
      timestamp: Date.now()
    });
  }

  if (metrics.memoryUsage > thresholds.maxMemoryUsage) {
    alerts.push({
      id: `memory_${Date.now()}`,
      type: 'error',
      message: `High memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB (threshold: ${(thresholds.maxMemoryUsage / 1024 / 1024).toFixed(1)}MB)`,
      timestamp: Date.now()
    });
  }

  if (metrics.cacheHitRate < thresholds.minCacheHitRate) {
    alerts.push({
      id: `cache_${Date.now()}`,
      type: 'warning',
      message: `Low cache hit rate: ${metrics.cacheHitRate.toFixed(1)}% (threshold: ${thresholds.minCacheHitRate}%)`,
      timestamp: Date.now()
    });
  }

  return alerts;
};

export default {
  StateValidator,
  stateValidator,
  StateValidationError,
  withValidation,
  validatePerformanceThresholds,
  schemas: {
    WorkspaceStateSchema,
    UIStateSchema,
    PerformanceStateSchema,
    ApplicationStateSchema
  }
};
