/**
 * Bulk Operations and Batch Processing Utilities for NeuroSense FX
 * Provides efficient batch processing for large datasets and operations
 */

/**
 * Base Bulk Operations Handler
 */
export class BulkOperations {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 100;
    this.maxConcurrency = options.maxConcurrency || 5;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.progressCallback = options.onProgress || null;
  }

  /**
   * Process items in batches
   */
  async processBatches(items, processor, options = {}) {
    const {
      batchSize = this.batchSize,
      maxConcurrency = this.maxConcurrency,
      retryAttempts = this.retryAttempts,
      onProgress = this.progressCallback
    } = options;

    const batches = this.createBatches(items, batchSize);
    const results = [];
    let completed = 0;
    let errors = [];

    // Process batches with concurrency control
    const semaphore = new Semaphore(maxConcurrency);
    
    const batchPromises = batches.map(async (batch, batchIndex) => {
      await semaphore.acquire();
      
      try {
        const batchResults = await this.processBatchWithRetry(
          batch, 
          processor, 
          retryAttempts
        );
        
        completed += batch.length;
        
        if (onProgress) {
          onProgress({
            completed,
            total: items.length,
            batchIndex,
            batchCount: batches.length,
            progress: (completed / items.length) * 100
          });
        }
        
        return batchResults;
      } catch (error) {
        errors.push({
          batchIndex,
          error: error.message,
          batchSize: batch.length
        });
        return [];
      } finally {
        semaphore.release();
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    return {
      success: errors.length === 0,
      results: batchResults.flat(),
      errors,
      summary: {
        totalItems: items.length,
        processedItems: completed,
        successfulBatches: batchResults.length - errors.length,
        failedBatches: errors.length,
        successRate: (completed / items.length) * 100
      }
    };
  }

  /**
   * Create batches from items array
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process single batch with retry logic
   */
  async processBatchWithRetry(batch, processor, retryAttempts) {
    let lastError;
    
    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        return await processor(batch);
      } catch (error) {
        lastError = error;
        
        if (attempt < retryAttempts) {
          await this.delay(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Utility function for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Semaphore for concurrency control
 */
class Semaphore {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
    this.currentCount = 0;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.currentCount < this.maxConcurrency) {
        this.currentCount++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    this.currentCount--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.currentCount++;
      next();
    }
  }
}

/**
 * Bulk Canvas Operations
 */
export class BulkCanvasOperations extends BulkOperations {
  /**
   * Bulk create canvases
   */
  async bulkCreateCanvases(canvasConfigs, workspaceStore) {
    const processor = async (batch) => {
      const results = [];
      for (const config of batch) {
        const canvasId = workspaceStore.addCanvas(config);
        results.push({ canvasId, config, success: true });
      }
      return results;
    };

    return this.processBatches(canvasConfigs, processor);
  }

  /**
   * Bulk update canvases
   */
  async bulkUpdateCanvases(updates, workspaceStore) {
    const processor = async (batch) => {
      const results = [];
      for (const update of batch) {
        workspaceStore.updateCanvas(update.canvasId, update.updates);
        results.push({ canvasId: update.canvasId, updates: update.updates, success: true });
      }
      return results;
    };

    return this.processBatches(updates, processor);
  }

  /**
   * Bulk delete canvases
   */
  async bulkDeleteCanvases(canvasIds, workspaceStore) {
    const processor = async (batch) => {
      const results = [];
      for (const canvasId of batch) {
        workspaceStore.removeCanvas(canvasId);
        results.push({ canvasId, success: true });
      }
      return results;
    };

    return this.processBatches(canvasIds, processor);
  }

  /**
   * Bulk reposition canvases using layout algorithm
   */
  async bulkRepositionCanvases(canvasIds, layoutAlgorithm, workspaceStore) {
    // Get current canvases
    let workspace;
    workspaceStore.subscribe(w => workspace = w)();
    
    const canvases = workspace.layout.canvases.filter(canvas => 
      canvasIds.includes(canvas.id)
    );

    // Apply layout algorithm
    const repositionedCanvases = layoutAlgorithm.arrangeCanvases(canvases);

    // Create updates
    const updates = repositionedCanvases.map(canvas => ({
      canvasId: canvas.id,
      updates: {
        position: canvas.position,
        size: canvas.size
      }
    }));

    return this.bulkUpdateCanvases(updates, workspaceStore);
  }
}

/**
 * Bulk Symbol Operations
 */
export class BulkSymbolOperations extends BulkOperations {
  /**
   * Bulk subscribe to symbols
   */
  async bulkSubscribeToSymbols(symbols, symbolStore) {
    const processor = async (batch) => {
      const results = [];
      for (const symbol of batch) {
        try {
          await symbolStore.subscribe(symbol);
          results.push({ symbol, success: true });
        } catch (error) {
          results.push({ symbol, success: false, error: error.message });
        }
      }
      return results;
    };

    return this.processBatches(symbols, processor);
  }

  /**
   * Bulk unsubscribe from symbols
   */
  async bulkUnsubscribeFromSymbols(symbols, symbolStore) {
    const processor = async (batch) => {
      const results = [];
      for (const symbol of batch) {
        try {
          await symbolStore.unsubscribe(symbol);
          results.push({ symbol, success: true });
        } catch (error) {
          results.push({ symbol, success: false, error: error.message });
        }
      }
      return results;
    };

    return this.processBatches(symbols, processor);
  }

  /**
   * Bulk update symbol data
   */
  async bulkUpdateSymbolData(updates, symbolStore) {
    const processor = async (batch) => {
      const results = [];
      for (const update of batch) {
        try {
          symbolStore.updateSymbolData(update.symbol, update.data);
          results.push({ symbol: update.symbol, success: true });
        } catch (error) {
          results.push({ symbol: update.symbol, success: false, error: error.message });
        }
      }
      return results;
    };

    return this.processBatches(updates, processor);
  }
}

/**
 * Bulk Indicator Operations
 */
export class BulkIndicatorOperations extends BulkOperations {
  /**
   * Bulk add indicators to canvases
   */
  async bulkAddIndicators(indicatorConfigs, workspaceStore) {
    const processor = async (batch) => {
      const results = [];
      for (const config of batch) {
        try {
          const canvas = workspaceStore.getCanvas(config.canvasId);
          if (canvas) {
            const updatedIndicators = [...(canvas.indicators || []), config.indicator];
            workspaceStore.updateCanvas(config.canvasId, { indicators: updatedIndicators });
            results.push({ canvasId: config.canvasId, indicator: config.indicator, success: true });
          } else {
            results.push({ canvasId: config.canvasId, indicator: config.indicator, success: false, error: 'Canvas not found' });
          }
        } catch (error) {
          results.push({ canvasId: config.canvasId, indicator: config.indicator, success: false, error: error.message });
        }
      }
      return results;
    };

    return this.processBatches(indicatorConfigs, processor);
  }

  /**
   * Bulk remove indicators from canvases
   */
  async bulkRemoveIndicators(indicatorRemovals, workspaceStore) {
    const processor = async (batch) => {
      const results = [];
      for (const removal of batch) {
        try {
          const canvas = workspaceStore.getCanvas(removal.canvasId);
          if (canvas) {
            const updatedIndicators = (canvas.indicators || []).filter(ind => ind !== removal.indicator);
            workspaceStore.updateCanvas(removal.canvasId, { indicators: updatedIndicators });
            results.push({ canvasId: removal.canvasId, indicator: removal.indicator, success: true });
          } else {
            results.push({ canvasId: removal.canvasId, indicator: removal.indicator, success: false, error: 'Canvas not found' });
          }
        } catch (error) {
          results.push({ canvasId: removal.canvasId, indicator: removal.indicator, success: false, error: error.message });
        }
      }
      return results;
    };

    return this.processBatches(indicatorRemovals, processor);
  }

  /**
   * Bulk update indicator settings
   */
  async bulkUpdateIndicatorSettings(settingUpdates, workspaceStore) {
    const processor = async (batch) => {
      const results = [];
      for (const update of batch) {
        try {
          const canvas = workspaceStore.getCanvas(update.canvasId);
          if (canvas) {
            const currentSettings = canvas.settings || {};
            const updatedSettings = {
              ...currentSettings,
              [update.indicator]: update.settings
            };
            workspaceStore.updateCanvas(update.canvasId, { settings: updatedSettings });
            results.push({ canvasId: update.canvasId, indicator: update.indicator, success: true });
          } else {
            results.push({ canvasId: update.canvasId, indicator: update.indicator, success: false, error: 'Canvas not found' });
          }
        } catch (error) {
          results.push({ canvasId: update.canvasId, indicator: update.indicator, success: false, error: error.message });
        }
      }
      return results;
    };

    return this.processBatches(settingUpdates, processor);
  }
}

/**
 * Bulk Data Import/Export Operations
 */
export class BulkDataOperations extends BulkOperations {
  constructor(dataImportExport, options = {}) {
    super(options);
    this.dataImportExport = dataImportExport;
  }

  /**
   * Bulk import multiple files
   */
  async bulkImportFiles(files, format = null, options = {}) {
    const processor = async (batch) => {
      const results = [];
      for (const file of batch) {
        try {
          const result = await this.dataImportExport.importFromFile(file, format);
          results.push({
            fileName: file.name,
            success: result.success,
            data: result.data,
            error: result.error,
            metadata: result.metadata
          });
        } catch (error) {
          results.push({
            fileName: file.name,
            success: false,
            error: error.message
          });
        }
      }
      return results;
    };

    return this.processBatches(Array.from(files), processor, options);
  }

  /**
   * Bulk export multiple data sets
   */
  async bulkExportData(dataSets, format, filenamePrefix, options = {}) {
    const processor = async (batch) => {
      const results = [];
      for (const dataSet of batch) {
        try {
          const filename = `${filenamePrefix}_${dataSet.name}_${Date.now()}`;
          const result = await this.dataImportExport.exportToFile(
            dataSet.data, 
            format, 
            filename, 
            options
          );
          results.push({
            name: dataSet.name,
            success: result.success,
            filename: result.filename,
            error: result.error,
            metadata: result.metadata
          });
        } catch (error) {
          results.push({
            name: dataSet.name,
            success: false,
            error: error.message
          });
        }
      }
      return results;
    };

    return this.processBatches(dataSets, processor, options);
  }
}

/**
 * Bulk Workspace Operations
 */
export class BulkWorkspaceOperations extends BulkOperations {
  /**
   * Bulk create workspaces from templates
   */
  async bulkCreateWorkspacesFromTemplates(templates, workspaceStore, options = {}) {
    const processor = async (batch) => {
      const results = [];
      for (const template of batch) {
        try {
          const workspaceId = workspaceStore.createWorkspace({
            name: template.name,
            description: template.description,
            layout: template.layout,
            globalSettings: template.globalSettings
          });
          
          // Add canvases from template
          if (template.canvases) {
            for (const canvasConfig of template.canvases) {
              workspaceStore.addCanvas(canvasConfig);
            }
          }
          
          results.push({
            templateName: template.name,
            workspaceId,
            success: true
          });
        } catch (error) {
          results.push({
            templateName: template.name,
            success: false,
            error: error.message
          });
        }
      }
      return results;
    };

    return this.processBatches(templates, processor, options);
  }

  /**
   * Bulk apply settings to multiple workspaces
   */
  async bulkApplyWorkspaceSettings(workspaceIds, settings, workspaceStore) {
    const processor = async (batch) => {
      const results = [];
      for (const workspaceId of batch) {
        try {
          workspaceStore.updateWorkspace(workspaceId, { globalSettings: settings });
          results.push({ workspaceId, success: true });
        } catch (error) {
          results.push({ workspaceId, success: false, error: error.message });
        }
      }
      return results;
    };

    return this.processBatches(workspaceIds, processor);
  }
}

/**
 * Progress Tracker for Bulk Operations
 */
export class BulkOperationProgress {
  constructor() {
    this.operations = new Map();
    this.listeners = [];
  }

  /**
   * Start tracking an operation
   */
  startOperation(operationId, totalItems, description = '') {
    this.operations.set(operationId, {
      id: operationId,
      description,
      totalItems,
      completedItems: 0,
      startTime: Date.now(),
      endTime: null,
      errors: [],
      status: 'running'
    });

    this.notifyListeners(operationId);
  }

  /**
   * Update operation progress
   */
  updateProgress(operationId, completedItems, error = null) {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    operation.completedItems = completedItems;
    
    if (error) {
      operation.errors.push(error);
    }

    if (completedItems >= operation.totalItems) {
      operation.endTime = Date.now();
      operation.status = operation.errors.length > 0 ? 'completed_with_errors' : 'completed';
    }

    this.notifyListeners(operationId);
  }

  /**
   * Complete operation
   */
  completeOperation(operationId, status = 'completed') {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    operation.endTime = Date.now();
    operation.status = status;
    operation.completedItems = operation.totalItems;

    this.notifyListeners(operationId);
  }

  /**
   * Get operation status
   */
  getOperation(operationId) {
    return this.operations.get(operationId);
  }

  /**
   * Get all operations
   */
  getAllOperations() {
    return Array.from(this.operations.values());
  }

  /**
   * Add progress listener
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove progress listener
   */
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners
   */
  notifyListeners(operationId) {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    this.listeners.forEach(callback => {
      try {
        callback(operation);
      } catch (error) {
        console.error('Progress listener error:', error);
      }
    });
  }

  /**
   * Calculate operation statistics
   */
  getOperationStats(operationId) {
    const operation = this.operations.get(operationId);
    if (!operation) return null;

    const duration = operation.endTime ? operation.endTime - operation.startTime : Date.now() - operation.startTime;
    const progress = (operation.completedItems / operation.totalItems) * 100;
    const itemsPerSecond = operation.completedItems / (duration / 1000);

    return {
      progress,
      duration,
      itemsPerSecond,
      estimatedTimeRemaining: operation.status === 'running' 
        ? ((operation.totalItems - operation.completedItems) / itemsPerSecond) * 1000 
        : 0
    };
  }
}

// Export all bulk operation classes
export {
  BulkOperations,
  BulkCanvasOperations,
  BulkSymbolOperations,
  BulkIndicatorOperations,
  BulkDataOperations,
  BulkWorkspaceOperations,
  BulkOperationProgress
};
