/**
 * Base Indicator Class
 * Provides foundation for all visualization indicators
 */
export class BaseIndicator {
  constructor(ctx, settings = {}) {
    this.ctx = ctx;
    this.settings = { ...this.defaultSettings, ...settings };
    this.visible = true;
    this.cache = new Map();
    this.lastRenderTime = 0;
    this.animationFrame = null;
    
    // Performance monitoring
    this.renderCount = 0;
    this.totalRenderTime = 0;
    this.averageRenderTime = 0;
  }
  
  get defaultSettings() {
    return {
      enabled: true,
      opacity: 1.0,
      zIndex: 0,
      animationSpeed: 'medium',
      showDebugInfo: false
    };
  }
  
  /**
   * Initialize the indicator
   * Called once when indicator is created
   */
  initialize() {
    this.setupEventListeners();
    this.validateSettings();
  }
  
  /**
   * Setup event listeners for the indicator
   */
  setupEventListeners() {
    // Override in subclasses
  }
  
  /**
   * Validate indicator settings
   */
  validateSettings() {
    // Override in subclasses for specific validation
  }
  
  /**
   * Main render method
   * @param {Object} data - Market data for rendering
   * @param {Object} canvas - Canvas information
   */
  render(data, canvas) {
    if (!this.visible || !this.settings.enabled) return;
    
    const startTime = performance.now();
    
    // Check cache first
    const cacheKey = this.generateCacheKey(data);
    if (this.cache.has(cacheKey)) {
      const cachedResult = this.cache.get(cacheKey);
      this.drawCachedResult(cachedResult);
      return;
    }
    
    // Clear canvas area for this indicator
    this.clearCanvas(canvas);
    
    // Save context state
    this.ctx.save();
    
    // Apply indicator-specific transformations
    this.applyTransformations(canvas);
    
    // Render the indicator
    const result = this.doRender(data, canvas);
    
    // Restore context state
    this.ctx.restore();
    
    // Cache the result
    this.cacheResult(cacheKey, result);
    
    // Update performance metrics
    const renderTime = performance.now() - startTime;
    this.updatePerformanceMetrics(renderTime);
    
    // Draw debug info if enabled
    if (this.settings.showDebugInfo) {
      this.drawDebugInfo(data, canvas, renderTime);
    }
  }
  
  /**
   * Override this method in subclasses to implement actual rendering
   * @param {Object} data - Market data
   * @param {Object} canvas - Canvas information
   * @returns {Object} Render result for caching
   */
  doRender(data, canvas) {
    throw new Error('doRender method must be implemented in subclass');
  }
  
  /**
   * Apply transformations before rendering
   * @param {Object} canvas - Canvas information
   */
  applyTransformations(canvas) {
    this.ctx.globalAlpha = this.settings.opacity;
    
    // Apply any indicator-specific transformations
    if (this.settings.rotation) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      this.ctx.translate(centerX, centerY);
      this.ctx.rotate(this.settings.rotation);
      this.ctx.translate(-centerX, -centerY);
    }
  }
  
  /**
   * Clear the canvas area for this indicator
   * @param {Object} canvas - Canvas information
   */
  clearCanvas(canvas) {
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  /**
   * Generate cache key based on data and settings
   * @param {Object} data - Market data
   * @returns {string} Cache key
   */
  generateCacheKey(data) {
    const relevantData = this.extractRelevantData(data);
    return JSON.stringify({
      data: relevantData,
      settings: this.settings,
      timestamp: Date.now()
    });
  }
  
  /**
   * Extract only the data needed for rendering
   * Override in subclasses to optimize caching
   * @param {Object} data - Full market data
   * @returns {Object} Relevant data for caching
   */
  extractRelevantData(data) {
    return {
      price: data.currentPrice,
      timestamp: data.lastTickTime
    };
  }
  
  /**
   * Cache render result
   * @param {string} key - Cache key
   * @param {Object} result - Render result
   */
  cacheResult(key, result) {
    // Limit cache size
    if (this.cache.size >= 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, result);
  }
  
  /**
   * Draw cached result
   * @param {Object} cachedResult - Cached render result
   */
  drawCachedResult(cachedResult) {
    if (cachedResult?.imageData) {
      this.ctx.putImageData(cachedResult.imageData, 0, 0);
    }
  }
  
  /**
   * Update performance metrics
   * @param {number} renderTime - Time taken to render
   */
  updatePerformanceMetrics(renderTime) {
    this.renderCount++;
    this.totalRenderTime += renderTime;
    this.averageRenderTime = this.totalRenderTime / this.renderCount;
    this.lastRenderTime = renderTime;
  }
  
  /**
   * Draw debug information
   * @param {Object} data - Market data
   * @param {Object} canvas - Canvas information
   * @param {number} renderTime - Render time in milliseconds
   */
  drawDebugInfo(data, canvas, renderTime) {
    this.ctx.save();
    this.ctx.fillStyle = '#ff0000';
    this.ctx.font = '10px monospace';
    this.ctx.globalAlpha = 0.8;
    
    const debugInfo = [
      `${this.constructor.name}`,
      `Render: ${renderTime.toFixed(2)}ms`,
      `Avg: ${this.averageRenderTime.toFixed(2)}ms`,
      `Cache: ${this.cache.size}/100`,
      `Price: ${data.currentPrice}`
    ];
    
    debugInfo.forEach((line, index) => {
      this.ctx.fillText(line, 5, 15 + (index * 12));
    });
    
    this.ctx.restore();
  }
  
  /**
   * Update indicator settings
   * @param {Object} newSettings - New settings to apply
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.validateSettings();
    this.clearCache();
  }
  
  /**
   * Show the indicator
   */
  show() {
    this.visible = true;
  }
  
  /**
   * Hide the indicator
   */
  hide() {
    this.visible = false;
  }
  
  /**
   * Toggle indicator visibility
   */
  toggle() {
    this.visible = !this.visible;
  }
  
  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
  
  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return {
      renderCount: this.renderCount,
      averageRenderTime: this.averageRenderTime,
      lastRenderTime: this.lastRenderTime,
      cacheSize: this.cache.size,
      cacheHitRate: this.cache.size > 0 ? (this.cache.size / this.renderCount) : 0
    };
  }
  
  /**
   * Check if indicator needs to be re-rendered
   * @param {Object} data - Current market data
   * @param {Object} previousData - Previous market data
   * @returns {boolean} Whether re-rendering is needed
   */
  needsRerender(data, previousData) {
    if (!previousData) return true;
    
    // Check if relevant data has changed
    const currentRelevant = this.extractRelevantData(data);
    const previousRelevant = this.extractRelevantData(previousData);
    
    return JSON.stringify(currentRelevant) !== JSON.stringify(previousRelevant);
  }
  
  /**
   * Handle canvas resize
   * @param {Object} newCanvas - New canvas dimensions
   */
  handleResize(newCanvas) {
    this.clearCache();
    // Override in subclasses for specific resize handling
  }
  
  /**
   * Destroy the indicator and clean up resources
   */
  destroy() {
    this.clearCache();
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    // Remove event listeners
    this.removeEventListeners();
  }
  
  /**
   * Remove event listeners
   */
  removeEventListeners() {
    // Override in subclasses
  }
  
  /**
   * Get indicator metadata
   * @returns {Object} Indicator metadata
   */
  getMetadata() {
    return {
      name: this.constructor.name,
      type: this.constructor.type || 'base',
      version: this.constructor.version || '1.0.0',
      description: this.constructor.description || 'Base indicator class',
      defaultSettings: this.defaultSettings,
      currentSettings: this.settings,
      visible: this.visible,
      performance: this.getPerformanceMetrics()
    };
  }
  
  /**
   * Export indicator configuration
   * @returns {Object} Exportable configuration
   */
  export() {
    return {
      type: this.constructor.type,
      settings: this.settings,
      visible: this.visible
    };
  }
  
  /**
   * Import indicator configuration
   * @param {Object} config - Configuration to import
   */
  import(config) {
    if (config.type !== this.constructor.type) {
      throw new Error(`Invalid indicator type: ${config.type}`);
    }
    
    this.updateSettings(config.settings);
    this.visible = config.visible !== false;
  }
  
  /**
   * Validate that the context is valid
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @throws {Error} If context is invalid
   */
  validateContext(ctx) {
    if (!ctx) {
      throw new Error('Canvas context is required');
    }
    
    if (!(ctx instanceof CanvasRenderingContext2D)) {
      throw new Error('Invalid canvas context type');
    }
  }
  
  /**
   * Create a gradient for the indicator
   * @param {string} type - Gradient type ('linear' or 'radial')
   * @param {Array} colors - Array of color stops
   * @param {Object} bounds - Gradient bounds
   * @returns {CanvasGradient} Created gradient
   */
  createGradient(type, colors, bounds) {
    let gradient;
    
    if (type === 'linear') {
      gradient = this.ctx.createLinearGradient(
        bounds.x0, bounds.y0, bounds.x1, bounds.y1
      );
    } else if (type === 'radial') {
      gradient = this.ctx.createRadialGradient(
        bounds.x0, bounds.y0, bounds.r0,
        bounds.x1, bounds.y1, bounds.r1
      );
    } else {
      throw new Error(`Invalid gradient type: ${type}`);
    }
    
    colors.forEach(stop => {
      gradient.addColorStop(stop.offset, stop.color);
    });
    
    return gradient;
  }
  
  /**
   * Draw text with proper formatting
   * @param {string} text - Text to draw
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} options - Text options
   */
  drawText(text, x, y, options = {}) {
    const {
      font = '12px sans-serif',
      color = '#ffffff',
      align = 'left',
      baseline = 'top',
      shadow = false,
      shadowColor = 'rgba(0,0,0,0.5)',
      shadowBlur = 2,
      shadowOffsetX = 1,
      shadowOffsetY = 1
    } = options;
    
    this.ctx.save();
    
    this.ctx.font = font;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    
    if (shadow) {
      this.ctx.shadowColor = shadowColor;
      this.ctx.shadowBlur = shadowBlur;
      this.ctx.shadowOffsetX = shadowOffsetX;
      this.ctx.shadowOffsetY = shadowOffsetY;
    }
    
    this.ctx.fillText(text, x, y);
    
    this.ctx.restore();
  }
  
  /**
   * Draw a circle
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Circle radius
   * @param {Object} options - Drawing options
   */
  drawCircle(x, y, radius, options = {}) {
    const {
      fill = true,
      stroke = false,
      fillColor = '#ffffff',
      strokeColor = '#000000',
      lineWidth = 1,
      shadow = false,
      shadowColor = 'rgba(0,0,0,0.3)',
      shadowBlur = 4
    } = options;
    
    this.ctx.save();
    
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    
    if (shadow) {
      this.ctx.shadowColor = shadowColor;
      this.ctx.shadowBlur = shadowBlur;
    }
    
    if (fill) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }
    
    if (stroke) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }
  
  /**
   * Draw a rectangle
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Rectangle width
   * @param {number} height - Rectangle height
   * @param {Object} options - Drawing options
   */
  drawRectangle(x, y, width, height, options = {}) {
    const {
      fill = true,
      stroke = false,
      fillColor = '#ffffff',
      strokeColor = '#000000',
      lineWidth = 1,
      radius = 0,
      shadow = false,
      shadowColor = 'rgba(0,0,0,0.3)',
      shadowBlur = 4
    } = options;
    
    this.ctx.save();
    
    if (shadow) {
      this.ctx.shadowColor = shadowColor;
      this.ctx.shadowBlur = shadowBlur;
    }
    
    this.ctx.beginPath();
    
    if (radius > 0) {
      // Draw rounded rectangle
      this.ctx.moveTo(x + radius, y);
      this.ctx.lineTo(x + width - radius, y);
      this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      this.ctx.lineTo(x + width, y + height - radius);
      this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      this.ctx.lineTo(x + radius, y + height);
      this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      this.ctx.lineTo(x, y + radius);
      this.ctx.quadraticCurveTo(x, y, x + radius, y);
    } else {
      // Draw regular rectangle
      this.ctx.rect(x, y, width, height);
    }
    
    if (fill) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }
    
    if (stroke) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }
}

// Static properties for indicator metadata
BaseIndicator.type = 'base';
BaseIndicator.version = '1.0.0';
BaseIndicator.description = 'Base indicator class providing common functionality';

export default BaseIndicator;
