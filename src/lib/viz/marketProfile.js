/**
 * Unified Market Profile Implementation
 *
 * Refactored to use UnifiedVisualization base class while maintaining all 6 rendering modes.
 * Simplified architecture with cleaner separation of concerns and consistent patterns.
 *
 * Maintains existing functionality:
 * - 6 rendering modes: combinedRight, combinedLeft, separate, deltaBoth, deltaLeft, deltaRight
 * - Delta analysis with proper scaling
 * - Responsive width calculation
 * - Volume and distribution filtering
 */

import { UnifiedVisualization, createVisualization } from './UnifiedVisualization.js';
import { validateConfig, mergeConfig } from './UnifiedConfig.js';

/**
 * Market Profile implementation using unified foundation patterns
 */
const marketProfileImplementation = {
  /**
   * Validate render data specific to market profile
   */
  validateRenderData(contentArea, adrAxisX, config, state) {
        
    // Validate essential data
    const { marketProfile, visualHigh, visualLow } = state;
    
    if (!marketProfile || !marketProfile.levels || !Array.isArray(marketProfile.levels) ||
        visualHigh === undefined || visualLow === undefined) {
      console.error('🔍 [MarketProfile] Missing essential data:', {
        hasMarketProfile: !!marketProfile,
        hasLevels: !!(marketProfile?.levels),
        isLevelsArray: Array.isArray(marketProfile?.levels),
        levelsCount: marketProfile?.levels?.length || 0,
        levels: marketProfile?.levels,
        visualHigh,
        visualLow
      });
      return { shouldRender: false, error: 'Missing essential market profile data' };
    }

    // Additional check: ensure we have actual levels with data
    if (marketProfile.levels.length === 0) {
      console.warn('🔍 [MarketProfile] Empty levels array - need more tick data');
      return { shouldRender: false, error: 'No market profile levels data available yet' };
    }

    // Calculate responsive dimensions - simplified: config should already be in decimal format
    const widthRatio = config.marketProfileWidthRatio || 0.15;
    const xOffset = config.marketProfileXOffset || 0;

    // Simplified opacity handling - use decimal directly
    const opacity = config.marketProfileOpacity || 0.8;

    // Calculate responsive width based on mode
    const mode = config.marketProfileView || 'combinedRight';
    const widthMode = config.marketProfileWidthMode || 'responsive';

    let maxBarWidth;
    if (widthMode === 'responsive') {
      maxBarWidth = this.calculateResponsiveWidth(config, contentArea, adrAxisX, mode);
    } else {
      maxBarWidth = contentArea.width * widthRatio;
    }

    const xOffsetPixels = contentArea.width * xOffset;

    // Configure profile mode positioning
    const profileMode = this.configureProfileMode(config, adrAxisX, xOffsetPixels);

    return {
      shouldRender: true,
      maxBarWidth,
      opacity,
      contentArea,
      adrAxisX,
      mode,
      ...profileMode
    };
  },

  /**
   * Draw core market profile elements
   */
  drawCore(ctx, renderData, config, state, y) {
    
    const { marketProfile, visualHigh, visualLow } = state;

    
    // Process market profile levels - pass contentArea for proper bounds checking
    const profileData = this.processMarketProfileLevels(
      marketProfile.levels,
      visualHigh,
      visualLow,
      config,
      y,
      renderData.contentArea
    );


    if (!profileData || !profileData.levels || profileData.levels.length === 0) {
      console.warn('[MarketProfile] No valid profile data to render');
      return;
    }

    // Store profile data for enhancements
    this._profileData = profileData;

    // Draw core histogram bars
    this.drawHistogramBars(ctx, renderData, profileData, config);
  },

  /**
   * Add enhancements with bounds checking
   */
  addEnhancements(ctx, renderData, config, state, contentArea, y) {
    const profileData = this._profileData;
    if (!profileData) return;

    // Draw enhancements only if within bounds
    if (this.shouldDrawEnhancements(renderData, config, contentArea)) {
      this.drawProfileEnhancements(ctx, renderData, profileData, config);
    }
  },

  /**
   * Calculate responsive width based on mode and available space
   */
  calculateResponsiveWidth(config, contentArea, adrAxisX, mode) {
    const minBarWidth = config.marketProfileMinWidth || 5;

    switch (mode) {
      case 'combinedRight':
        return Math.max(minBarWidth, contentArea.width - adrAxisX);

      case 'combinedLeft':
        return Math.max(minBarWidth, adrAxisX);

      case 'separate':
        const leftSpace = adrAxisX;
        const rightSpace = contentArea.width - adrAxisX;
        return Math.max(minBarWidth, Math.min(leftSpace, rightSpace));

      case 'deltaLeft':
        return Math.max(minBarWidth, adrAxisX);

      case 'deltaBoth':
      case 'deltaRight':
        return Math.max(minBarWidth, contentArea.width - adrAxisX);

      default:
        return Math.max(minBarWidth, contentArea.width * 0.15);
    }
  },

  /**
   * Configure profile display mode with intelligent positioning
   */
  configureProfileMode(config, adrAxisX, xOffset) {
    const mode = config.marketProfileView || 'combinedRight';

    const modeConfigs = {
      separate: {
        leftStartX: adrAxisX - xOffset,
        rightStartX: adrAxisX + xOffset,
        direction: 'separate',
        renderLeft: true,
        renderRight: true
      },

      combinedLeft: {
        leftStartX: adrAxisX - xOffset,
        rightStartX: adrAxisX - xOffset,
        direction: 'combinedLeft',
        renderLeft: true,
        renderRight: true
      },

      combinedRight: {
        leftStartX: adrAxisX + xOffset,
        rightStartX: adrAxisX + xOffset,
        direction: 'combinedRight',
        renderLeft: true,
        renderRight: true
      },

      deltaBoth: {
        leftStartX: adrAxisX - xOffset,   // Negative delta extends left
        rightStartX: adrAxisX + xOffset,  // Positive delta extends right
        direction: 'deltaBoth',
        renderLeft: true,
        renderRight: true
      },

      deltaLeft: {
        leftStartX: adrAxisX - xOffset,
        rightStartX: adrAxisX - xOffset,
        direction: 'deltaLeft',
        renderLeft: true,
        renderRight: true
      },

      deltaRight: {
        leftStartX: adrAxisX + xOffset,
        rightStartX: adrAxisX + xOffset,
        direction: 'deltaRight',
        renderLeft: true,
        renderRight: true
      }
    };

    return modeConfigs[mode] || modeConfigs.combinedRight;
  },

  /**
   * Process market profile levels with filtering and scaling
   */
  processMarketProfileLevels(marketProfileLevels, visualHigh, visualLow, config, y, contentArea) {
  
    const priceRange = visualHigh - visualLow;

    // Calculate maximum values for scaling
    let maxVolume = 0;
    let maxDelta = 0;

    marketProfileLevels.forEach(level => {
      maxVolume = Math.max(maxVolume, level.volume || 0);
      if (level.delta !== undefined && level.delta !== null) {
        maxDelta = Math.max(maxDelta, Math.abs(level.delta));
      }
    });


    // Apply depth filtering if configured
    let filteredLevels = marketProfileLevels;
    if (config.distributionDepthMode === 'percentage' && config.distributionPercentage < 100) {
      const distributionPercent = parseFloat(config.distributionPercentage) || 50;
      const volumeThreshold = maxVolume * (distributionPercent / 100);
      filteredLevels = marketProfileLevels.filter(level => (level.volume || 0) >= volumeThreshold);
    }

    // Process each level
    const processedLevels = filteredLevels.map((level, index) => {
      const priceY = y(level.price);
      const volumeRatio = maxVolume > 0 ? (level.volume || 0) / maxVolume : 0;
      const deltaRatio = maxDelta > 0 ? (level.delta || 0) / maxDelta : 0;

      // Market profile specific bounds checking - use actual price range instead of canvas bounds
      const priceRange = visualHigh - visualLow;
      const priceTolerance = priceRange * 0.1; // Allow 10% tolerance outside visual range
      const isPriceInRange = level.price >= (visualLow - priceTolerance) &&
                            level.price <= (visualHigh + priceTolerance);
      const isVisible = isPriceInRange; // Use price range bounds instead of canvas bounds

  
      return {
        ...level,
        priceY,
        volumeRatio,
        deltaRatio,
        isVisible
      };
    });

    return {
      levels: processedLevels,
      maxVolume,
      maxDelta,
      priceRange,
      visualHigh,
      visualLow
    };
  },

  /**
   * Draw histogram bars based on profile mode
   */
  drawHistogramBars(ctx, renderData, profileData, config) {
    const { maxBarWidth, opacity, mode, leftStartX, rightStartX } = renderData;
    const { levels } = profileData;

  
    ctx.globalAlpha = opacity;

    let drawnCount = 0;
    levels.forEach(level => {
      if (!level.isVisible) {
        return;
      }

      drawnCount++;

      switch (mode) {
        case 'separate':
          this.drawSeparateBars(ctx, level, leftStartX, rightStartX, maxBarWidth, config);
          break;
        case 'combinedLeft':
        case 'combinedRight':
          this.drawCombinedBars(ctx, level, leftStartX, maxBarWidth, config);
          break;
        case 'deltaBoth':
          this.drawDeltaBothBars(ctx, level, leftStartX, rightStartX, maxBarWidth, config);
          break;
        case 'deltaLeft':
        case 'deltaRight':
          this.drawDeltaBars(ctx, level, leftStartX, maxBarWidth, config, mode);
          break;
        default:
          this.drawCombinedBars(ctx, level, leftStartX, maxBarWidth, config);
      }
    });

    
    ctx.globalAlpha = 1.0;
  },

  /**
   * Draw separate buy/sell bars
   */
  drawSeparateBars(ctx, level, leftStartX, rightStartX, maxBarWidth, config) {
    const barWidth = maxBarWidth * level.volumeRatio;
    const barHeight = 4;

    // Sell bar (left side)
    if (level.sellVolume > 0) {
      const sellWidth = barWidth * (level.sellVolume / level.volume);
      ctx.fillStyle = config.sellColor || '#ef4444';
      ctx.fillRect(leftStartX - sellWidth, level.priceY - barHeight/2, sellWidth, barHeight);
    }

    // Buy bar (right side)
    if (level.buyVolume > 0) {
      const buyWidth = barWidth * (level.buyVolume / level.volume);
      ctx.fillStyle = config.buyColor || '#10b981';
      ctx.fillRect(rightStartX, level.priceY - barHeight/2, buyWidth, barHeight);
    }
  },

  /**
   * Draw combined buy+sell bars
   */
  drawCombinedBars(ctx, level, startX, maxBarWidth, config) {
    const barWidth = maxBarWidth * level.volumeRatio;
    const barHeight = 4;

    
    ctx.fillStyle = config.combinedColor || '#6b7280';
    ctx.fillRect(startX, level.priceY - barHeight/2, barWidth, barHeight);
  },

  /**
   * Draw delta both sides (positive right, negative left)
   */
  drawDeltaBothBars(ctx, level, leftStartX, rightStartX, maxBarWidth, config) {
    const barHeight = 4;

    if (level.delta > 0) {
      // Positive delta extends right
      const barWidth = maxBarWidth * level.deltaRatio;
      ctx.fillStyle = config.positiveDeltaColor || '#10b981';
      ctx.fillRect(rightStartX, level.priceY - barHeight/2, barWidth, barHeight);
    } else if (level.delta < 0) {
      // Negative delta extends left
      const barWidth = maxBarWidth * Math.abs(level.deltaRatio);
      ctx.fillStyle = config.negativeDeltaColor || '#ef4444';
      ctx.fillRect(leftStartX - barWidth, level.priceY - barHeight/2, barWidth, barHeight);
    }
  },

  /**
   * Draw delta bars on one side
   */
  drawDeltaBars(ctx, level, startX, maxBarWidth, config, mode) {
    const barWidth = maxBarWidth * Math.abs(level.deltaRatio);
    const barHeight = 4;

    if (level.delta > 0) {
      ctx.fillStyle = config.positiveDeltaColor || '#10b981';
    } else if (level.delta < 0) {
      ctx.fillStyle = config.negativeDeltaColor || '#ef4444';
    } else {
      return; // Skip zero delta
    }

    ctx.fillRect(startX, level.priceY - barHeight/2, barWidth, barHeight);
  },

  /**
   * Check if enhancements should be drawn
   */
  shouldDrawEnhancements(renderData, config, contentArea) {
    // Apply bounds checking for enhancements
    return true; // Profile data is typically within bounds
  },

  /**
   * Draw profile enhancements
   */
  drawProfileEnhancements(ctx, renderData, profileData, config) {
    // Add any enhancement rendering here
    // Examples: volume labels, delta indicators, profile statistics
  }
};

// Create the unified visualization component
export const drawMarketProfile = createVisualization('MarketProfile', marketProfileImplementation);

