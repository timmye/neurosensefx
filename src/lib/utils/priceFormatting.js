/**
 * NeuroSense FX Optimized Price Formatting System
 *
 * Consolidates all price formatting with performance optimizations:
 * - Centralized asset classification with intelligent caching
 * - Optimized string manipulation and memory allocation
 * - Smart cache management with frequency-based eviction
 * - Object pooling for intermediate results
 * - Precomputed thresholds for faster classification
 *
 * Project Philosophy: Simple, Performant, Maintainable
 */

class PriceFormattingEngine {
  constructor() {
    // Performance-optimized caching with frequency tracking
    this.classificationCache = new Map();
    this.formatCache = new Map();
    this.textMetricsCache = new Map();

    // Object pools for memory efficiency
    this.formatResultPool = new FormatResultPool();

    // Cache configuration - optimized sizes based on usage patterns
    this.maxCacheSize = {
      classification: 100,
      format: 500,
      textMetrics: 200
    };

    // Precomputed thresholds for faster classification (avoid Math.log10 calls)
    this.thresholds = {
      HIGH_VALUE_CRYPTO: 1e5,      // 100,000 (BTCUSD territory)
      HIGH_VALUE_COMMODITY: 1e3,   // 1,000 (XAUUSD territory)
      FX_JPY_MIN: 100,             // 100 (JPY pairs start)
      FX_JPY_MAX: 999              // 999 (JPY pairs end)
    };

    // Performance metrics
    this.performanceStats = {
      cacheHits: 0,
      cacheMisses: 0,
      classificationCacheHits: 0,
      classificationCacheMisses: 0
    };
  }

  /**
   * Main price formatting function - optimized for performance
   * Returns structured formatting data for advanced components
   */
  formatPrice(price, digits = 5, config = {}) {
    // Input validation - handle invalid prices gracefully
    if (!isFinite(price)) {
      return {
        text: { bigFigure: 'N/A', pips: '', pipette: '' },
        sizing: { bigFigureRatio: 0.6, pipsRatio: 1.0, pipetteRatio: 0.4 },
        classification: { type: 'INVALID', magnitude: 0, description: 'Invalid price value' }
      };
    }

    // Validate digits parameter
    const safeDigits = Math.max(0, Math.min(10, digits || 5));

    // Fast path: check format cache first
    const cacheKey = this.generateCacheKey(price, safeDigits, config);
    const cached = this.formatCache.get(cacheKey);
    if (cached) {
      cached.accessCount = (cached.accessCount || 0) + 1;
      this.performanceStats.cacheHits++;
      return cached.data;
    }

    this.performanceStats.cacheMisses++;

    // Get or compute classification
    const classification = this.getClassification(price, safeDigits);

    // Use object pool for result to avoid allocations
    const result = this.formatResultPool.acquire();

    try {
      // Optimized formatting based on classification
      this.formatByClassification(result, price, safeDigits, classification, config);

      // Clone result for return (pool objects are reused)
      const formattedResult = {
        text: { ...result.text },
        sizing: { ...result.sizing },
        classification
      };

      // Cache the result with frequency tracking
      this.setCacheWithEviction(this.formatCache, cacheKey, {
        data: formattedResult,
        accessCount: 1,
        lastAccess: Date.now()
      });

      return formattedResult;
    } finally {
      this.formatResultPool.release(result);
    }
  }

  /**
   * Simplified price formatting for hover indicators and clean display
   * Returns formatted string without pipettes
   */
  formatPriceSimple(price, digits) {
    // Input validation
    if (!isFinite(price)) {
      return 'N/A';
    }

    const result = this.formatPrice(price, digits, { showPipetteDigit: false });
    if (!result) return 'N/A';

    // Check if bigFigure already contains a decimal point
    const hasDecimalPoint = result.text.bigFigure.includes('.');

    // Build clean string without pipettes
    if (hasDecimalPoint) {
      // bigFigure already has decimal point, just append pips
      return result.text.bigFigure + (result.text.pips || '');
    } else {
      // bigFigure doesn't have decimal point, add one before pips
      return result.text.bigFigure + (result.text.pips ? '.' + result.text.pips : '');
    }
  }

  /**
   * Compact formatting for tight spaces (markers, labels)
   * Returns minimal formatted string
   */
  formatPriceCompact(price, digits) {
    // Input validation - comprehensive check
    if (!isFinite(price)) {
      return 'N/A';
    }

    const safeDigits = digits || 5;
    const classification = this.getClassification(price, digits);

    switch (classification.type) {
      case 'FX_JPY_STYLE':
        const priceStr = price.toFixed(safeDigits);
        const parts = priceStr.split('.');
        return `${parts[0]}.${parts[1].substring(0, 2)}`;

      case 'FX_STANDARD':
        if (safeDigits === 5) {
          // Show 4 decimal places for FX standard (remove pipette)
          const stdPriceStr = price.toFixed(safeDigits);
          const stdParts = stdPriceStr.split('.');
          return `${stdParts[0]}.${stdParts[1].substring(0, 4)}`;
        }
        break;

      case 'HIGH_VALUE_COMMODITY':
        // Show 2 decimal places or integer for high values
        if (price >= 1000) {
          return Math.floor(price).toString();
        }
        return price.toFixed(2);

      case 'HIGH_VALUE_CRYPTO':
        // No decimals for very high values
        if (price >= 10000) {
          return Math.floor(price).toString();
        }
        break;
    }

    // Fallback to standard formatting
    return price.toFixed(safeDigits);
  }

  /**
   * Label formatting optimized for markers with consistent sizing
   */
  formatPriceLabel(price, digits) {
    // Use compact formatting as base
    const formatted = this.formatPriceCompact(price, digits);

    // Truncate if too long for marker display
    if (formatted.length > 12) {
      // For very long numbers, use scientific notation or abbreviation
      if (price >= 1000000) {
        return (price / 1000000).toFixed(1) + 'M';
      } else if (price >= 1000) {
        return (price / 1000).toFixed(1) + 'K';
      }
    }

    return formatted;
  }

  /**
   * Optimized classification with caching and precomputed thresholds
   */
  getClassification(price, digits) {
    // Input validation - handle edge cases
    if (!isFinite(price)) {
      return { type: 'STANDARD_DECIMAL', magnitude: 0, description: 'Invalid price value' };
    }

    if (price === 0) {
      return { type: 'STANDARD_DECIMAL', magnitude: 0, description: 'Zero value' };
    }

    const magnitude = Math.floor(Math.log10(Math.abs(price)));
    const safeDigits = String(digits || 5);
    const cacheKey = `${magnitude}_${safeDigits}`;

    const cached = this.classificationCache.get(cacheKey);
    if (cached) {
      cached.accessCount = (cached.accessCount || 0) + 1;
      this.performanceStats.classificationCacheHits++;
      return cached.data;
    }

    this.performanceStats.classificationCacheMisses++;

    let classification;

    // Optimized classification using actual price comparison with thresholds
    const absPrice = Math.abs(price);

    if (absPrice >= this.thresholds.HIGH_VALUE_CRYPTO) {
      classification = {
        type: 'HIGH_VALUE_CRYPTO',
        magnitude,
        description: 'Crypto-style high-value pricing'
      };
    } else if (absPrice >= this.thresholds.HIGH_VALUE_COMMODITY) {
      classification = {
        type: 'HIGH_VALUE_COMMODITY',
        magnitude,
        description: 'Commodity-style high-value pricing'
      };
    } else if (this.isJPYStylePair(magnitude, digits)) {
      classification = {
        type: 'FX_JPY_STYLE',
        magnitude,
        description: 'JPY-style FX pricing'
      };
    } else if (digits === 5 || digits === 3) {
      classification = {
        type: 'FX_STANDARD',
        magnitude,
        description: 'Standard FX pricing'
      };
    } else {
      classification = {
        type: 'STANDARD_DECIMAL',
        magnitude,
        description: 'Standard decimal pricing'
      };
    }

    // Cache classification result
    this.setCacheWithEviction(this.classificationCache, cacheKey, {
      data: classification,
      accessCount: 1,
      lastAccess: Date.now()
    });

    return classification;
  }

  /**
   * Safe substring operation to prevent bounds errors
   */
  safeSubstring(str, start, end) {
    if (!str || typeof str !== 'string') {
      return '';
    }

    const safeStart = Math.max(0, start);
    const safeEnd = Math.min(str.length, end);

    if (safeStart >= safeEnd) {
      return '';
    }

    return str.substring(safeStart, safeEnd);
  }

  /**
   * Helper method to determine if a price/digits combination represents a JPY-style pair
   * Refined JPY detection to exclude large figure formats (XAUUSD, BTCUSD, indices)
   */
  isJPYStylePair(magnitude, digits) {
    // JPY pairs are typically in the 100-999 range (magnitude 2-3) with 2-3 decimal places
    // Exclude high-value instruments (magnitude >= 4) which are commodities, crypto, or indices
    if (magnitude >= 4) {
      return false; // Exclude BTCUSD (magnitude 4+), high-value commodities, indices
    }

    // Standard JPY pairs: 100-999 range with 2-3 decimal places
    if (magnitude >= 2 && magnitude <= 3 && (digits === 2 || digits === 3)) {
      return true;
    }

    // Edge cases: some brokers may show JPY pairs with 1 decimal place or slightly different precision
    if (magnitude >= 2 && magnitude <= 3 && digits <= 3) {
      return true;
    }

    // Very tight range for potential edge cases (USDJPY ~150, EURJPY ~145, GBPJPY ~185)
    // But exclude anything that looks like a high-value instrument
    if (magnitude === 2 && digits >= 1 && digits <= 3) {
      return true;
    }

    return false;
  }

  /**
   * Optimized cache key generation (avoid expensive JSON.stringify)
   * Uses fixed precision and proper separation to prevent collisions
   */
  generateCacheKey(price, digits, options) {
    // Use numeric operations for performance
    const {
      bigFigureRatio = 0.6,
      pipsRatio = 1.0,
      pipetteRatio = 0.4
    } = options;

    // Use fixed precision for price to prevent floating-point representation issues
    const priceStr = price.toFixed(10); // High precision for accurate cache keys
    const digitsStr = String(digits);
    const bigFigRatioStr = bigFigureRatio.toFixed(3);
    const pipsRatioStr = pipsRatio.toFixed(3);
    const pipetteRatioStr = pipetteRatio.toFixed(3);

    // Create robust string key with separators
    return `${priceStr}_${digitsStr}_${bigFigRatioStr}_${pipsRatioStr}_${pipetteRatioStr}`;
  }

  /**
   * Smart cache eviction with frequency tracking (more efficient than simple LRU)
   */
  setCacheWithEviction(cache, key, value) {
    if (cache.size >= this.getMaxCacheSize(cache)) {
      // Find least frequently used item
      let lfuKey = cache.keys().next().value;
      let lfuCount = Infinity;

      for (const [k, v] of cache.entries()) {
        const count = v.accessCount || 0;
        if (count < lfuCount) {
          lfuCount = count;
          lfuKey = k;
        }
      }

      cache.delete(lfuKey);
    }

    cache.set(key, value);
  }

  /**
   * Get max cache size based on cache type
   */
  getMaxCacheSize(cache) {
    if (cache === this.classificationCache) return this.maxCacheSize.classification;
    if (cache === this.formatCache) return this.maxCacheSize.format;
    if (cache === this.textMetricsCache) return this.maxCacheSize.textMetrics;
    return 100;
  }

  /**
   * Optimized text measurement with caching
   */
  getTextMetrics(ctx, text, font) {
    const key = `${text}|${font}`;

    const cached = this.textMetricsCache.get(key);
    if (cached) {
      cached.accessCount = (cached.accessCount || 0) + 1;
      return cached.metrics;
    }

    // Measure text efficiently
    const originalFont = ctx.font;
    ctx.font = font;
    const metrics = ctx.measureText(text);
    ctx.font = originalFont;

    // Cache with frequency tracking
    this.setCacheWithEviction(this.textMetricsCache, key, {
      metrics,
      accessCount: 1,
      lastAccess: Date.now()
    });

    return metrics;
  }

  /**
   * Format price based on classification using optimized string operations
   */
  formatByClassification(result, price, digits, classification, config) {
    try {
      const safeDigits = Math.max(0, Math.min(10, digits || 5));

      // Validate inputs
      if (!classification || !classification.type) {
        throw new Error('Invalid classification provided');
      }

      const priceStr = price.toFixed(safeDigits);
      const parts = priceStr.split('.');

      // Validate split result
      if (!parts || parts.length === 0) {
        throw new Error('Failed to parse price string');
      }

      const integerPart = parts[0] || '0';
      const decimalPart = parts[1] || '';

      let bigFigure = integerPart;
      let pips = '';
      let pipette = '';

    switch (classification.type) {
      case 'HIGH_VALUE_CRYPTO':
        if (integerPart.length >= 6) {
          const bigFigEnd = integerPart.length - 3;
          bigFigure = integerPart.substring(0, bigFigEnd);
          pips = integerPart.substring(bigFigEnd, bigFigEnd + 2);
          pipette = integerPart.substring(bigFigEnd + 2, bigFigEnd + 3);
        } else {
          bigFigure = integerPart;
        }
        break;

      case 'HIGH_VALUE_COMMODITY':
        if (integerPart.length >= 4) {
          const bigFigEnd = integerPart.length - 2;
          bigFigure = integerPart.substring(0, bigFigEnd);
          pips = integerPart.substring(bigFigEnd, bigFigEnd + 2);
          pipette = decimalPart.substring(0, 1); // Take first decimal as pipette
        } else {
          bigFigure = integerPart;
          pips = decimalPart.substring(0, 2);
          pipette = decimalPart.substring(2, 3); // Take third decimal as pipette
        }
        break;

      case 'FX_JPY_STYLE':
        bigFigure = integerPart;
        pips = decimalPart.substring(0, 2);
        pipette = '';
        break;

      case 'FX_STANDARD':
        const pipsIndexStd = digits - 3;
        bigFigure = integerPart + '.' + decimalPart.substring(0, pipsIndexStd);
        pips = decimalPart.substring(pipsIndexStd, pipsIndexStd + 2);
        pipette = decimalPart.substring(pipsIndexStd + 2);
        break;

      case 'STANDARD_DECIMAL':
      default:
        if (digits > 0) {
          const lastTwoDigits = decimalPart.slice(-2);
          const beforeLastTwo = decimalPart.slice(0, -2);
          bigFigure = integerPart + (beforeLastTwo ? '.' + beforeLastTwo : '');
          pips = lastTwoDigits;
        } else {
          bigFigure = integerPart;
        }
        break;
    }

    // Configure sizing ratios
    const bigFigureRatio = config.bigFigureFontSizeRatio ?? 0.6;
    const pipsRatio = config.pipFontSizeRatio ?? 1.0;
    const pipetteRatio = config.pipetteFontSizeRatio ?? 0.4;

    // Validate and set result object with fallback values
    result.text.bigFigure = bigFigure || '0';
    result.text.pips = pips || '';
    result.text.pipette = pipette || '';
    result.sizing.bigFigureRatio = typeof bigFigureRatio === 'number' ? bigFigureRatio : 0.6;
    result.sizing.pipsRatio = typeof pipsRatio === 'number' ? pipsRatio : 1.0;
    result.sizing.pipetteRatio = typeof pipetteRatio === 'number' ? pipetteRatio : 0.4;

    } catch (error) {
      console.error('[PriceFormatting] Error in formatByClassification:', error);

      // Fallback to safe default formatting
      result.text.bigFigure = price.toString();
      result.text.pips = '';
      result.text.pipette = '';
      result.sizing.bigFigureRatio = 0.6;
      result.sizing.pipsRatio = 1.0;
      result.sizing.pipetteRatio = 0.4;
    }
  }

  /**
   * Get performance statistics for monitoring
   */
  getPerformanceStats() {
    const totalCacheRequests = this.performanceStats.cacheHits + this.performanceStats.cacheMisses;
    const totalClassificationRequests = this.performanceStats.classificationCacheHits + this.performanceStats.classificationCacheMisses;

    return {
      ...this.performanceStats,
      formatCacheHitRate: totalCacheRequests > 0 ? this.performanceStats.cacheHits / totalCacheRequests : 0,
      classificationCacheHitRate: totalClassificationRequests > 0 ? this.performanceStats.classificationCacheHits / totalClassificationRequests : 0,
      cacheSizes: {
        classification: this.classificationCache.size,
        format: this.formatCache.size,
        textMetrics: this.textMetricsCache.size
      }
    };
  }

  /**
   * Clear all caches (useful for testing or memory management)
   */
  clearAllCaches() {
    this.classificationCache.clear();
    this.formatCache.clear();
    this.textMetricsCache.clear();
    this.formatResultPool.clear();

    // Reset performance stats
    this.performanceStats = {
      cacheHits: 0,
      cacheMisses: 0,
      classificationCacheHits: 0,
      classificationCacheMisses: 0
    };
  }
}

/**
 * Object pool for format results to minimize memory allocations
 * Reuses objects to reduce garbage collection pressure
 */
class FormatResultPool {
  constructor(initialSize = 10) {
    this.pool = [];
    this.inUse = new Set();

    // Pre-allocate pool objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push({
        text: { bigFigure: '', pips: '', pipette: '' },
        sizing: { bigFigureRatio: 0, pipsRatio: 0, pipetteRatio: 0 }
      });
    }
  }

  acquire() {
    let obj = this.pool.pop() || {
      text: { bigFigure: '', pips: '', pipette: '' },
      sizing: { bigFigureRatio: 0, pipsRatio: 0, pipetteRatio: 0 }
    };

    this.inUse.add(obj);
    return obj;
  }

  release(obj) {
    if (this.inUse.has(obj)) {
      // Reset object state for reuse
      obj.text.bigFigure = '';
      obj.text.pips = '';
      obj.text.pipette = '';
      obj.sizing.bigFigureRatio = 0;
      obj.sizing.pipsRatio = 0;
      obj.sizing.pipetteRatio = 0;

      this.inUse.delete(obj);
      this.pool.push(obj);
    }
  }

  clear() {
    // Return all objects to pool
    this.inUse.clear();
    this.pool = [];

    // Re-allocate initial objects
    for (let i = 0; i < 10; i++) {
      this.pool.push({
        text: { bigFigure: '', pips: '', pipette: '' },
        sizing: { bigFigureRatio: 0, pipsRatio: 0, pipetteRatio: 0 }
      });
    }
  }
}

// Singleton instance for app-wide use
export const priceFormattingEngine = new PriceFormattingEngine();

/**
 * Convenience functions for backward compatibility and easy migration
 */

// Full formatting for detailed displays
export function formatPrice(price, digits, config) {
  return priceFormattingEngine.formatPrice(price, digits, config);
}

// Simple formatting for hover indicators (no pipettes)
export function formatPriceSimple(price, digits) {
  return priceFormattingEngine.formatPriceSimple(price, digits);
}

// Compact formatting for tight spaces
export function formatPriceCompact(price, digits) {
  return priceFormattingEngine.formatPriceCompact(price, digits);
}

// Label formatting optimized for markers
export function formatPriceLabel(price, digits) {
  return priceFormattingEngine.formatPriceLabel(price, digits);
}

// Cached text metrics utility
export function getTextMetricsCached(ctx, text, font) {
  return priceFormattingEngine.getTextMetrics(ctx, text, font);
}

// Performance monitoring
export function getPriceFormattingStats() {
  return priceFormattingEngine.getPerformanceStats();
}

// Cache management
export function clearPriceFormattingCache() {
  priceFormattingEngine.clearAllCaches();
}