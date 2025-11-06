import { boundsUtils } from '../../utils/canvasSizing.js';

export function drawMarketProfile(ctx, renderingContext, config, state, y) {
  // Guard clauses for safety (FOUNDATION PATTERN)
  if (!ctx || !renderingContext || !config || !state || !y) {
    console.warn('[MarketProfile] Missing required parameters, skipping render');
    return;
  }

  // Extract rendering context from the unified infrastructure
  const { contentArea, adrAxisX } = renderingContext;
  
  // Extract essential data - use existing worker structure
  const { 
    marketProfile,
    visualHigh, 
    visualLow 
  } = state;

  // Guard for essential data - use worker's structure
  if (!marketProfile || !marketProfile.levels || !Array.isArray(marketProfile.levels) || visualHigh === undefined || visualLow === undefined) {
    console.warn('[MarketProfile] Missing required data fields, skipping render');
    console.warn('[MarketProfile] - marketProfile:', marketProfile);
    console.warn('[MarketProfile] - marketProfile.levels:', marketProfile?.levels);
    console.warn('[MarketProfile] - visualHigh:', visualHigh);
    console.warn('[MarketProfile] - visualLow:', visualLow);
    return;
  }

  // === FOUNDATION LAYER IMPLEMENTATION ===
  // 1. Calculate render data with bounds checking and percentage conversion
  const renderData = validateRenderData(contentArea, adrAxisX, config);

  // ✅ FORENSIC FIX: Handle validation errors gracefully
  if (!renderData.shouldRender) {
    console.error('[MarketProfile] RENDERING CHAIN - Validation failed:', renderData.error);
    ctx.restore();
    return;
  }

  // 2. Configure render context for crisp rendering
  configureRenderContext(ctx);

  // 3. ALWAYS process market profile data (trader requirement) - use worker's structure
  const profileData = processMarketProfileLevels(marketProfile.levels, visualHigh, visualLow, config, y);

  // 4. Apply bounds checking ONLY to enhancements (foundation pattern)
  addEnhancements(ctx, renderData, profileData, config, state, contentArea, y);

  // 5. Restore context state (FOUNDATION PATTERN)
  ctx.restore();
}

/**
 * Calculate responsive width based on mode and available space
 */
function calculateResponsiveWidth(config, contentArea, adrAxisX, mode) {
  const minBarWidth = config.marketProfileMinWidth || 5; // Minimum bar width constraint
  
  switch (mode) {
    case 'combinedRight':
      // Fill from ADR axis to right edge
      const rightWidth = contentArea.width - adrAxisX;
      return Math.max(minBarWidth, rightWidth);
      
    case 'combinedLeft':
      // Fill from left edge to ADR axis
      const leftWidth = adrAxisX;
      return Math.max(minBarWidth, leftWidth);
      
    case 'separate':
      // Use smaller of left/right available spaces
      const leftSpace = adrAxisX;
      const rightSpace = contentArea.width - adrAxisX;
      const availableSpace = Math.min(leftSpace, rightSpace);
      return Math.max(minBarWidth, availableSpace);
      
    default:
      // Fallback to legacy fixed percentage
      const fallbackWidth = contentArea.width * (config.marketProfileWidthRatio / 100);
      return fallbackWidth;
  }
}

/**
 * Validate render data and apply percentage-to-decimal conversion
 */
function validateRenderData(contentArea, adrAxisX, config) {
  // Critical percentage-to-decimal conversion with type safety (FOUNDATION PATTERN)
  const widthRatio = parseFloat(config.marketProfileWidthRatio) || 15;
  const xOffsetRaw = parseFloat(config.marketProfileXOffset) || 0;
  
  // ✅ CRITICAL FIX: marketProfileOpacity is already decimal (0.7), don't divide by 100!
  const opacity = Math.max(0.1, parseFloat(config.marketProfileOpacity) || 0.8); // Already decimal, no conversion needed
  
  const xOffsetPercentage = xOffsetRaw / 100;
  
  // ✅ FORENSIC FIX: Validate calculated values
  if (isNaN(widthRatio) || isNaN(opacity) || isNaN(xOffsetPercentage)) {
    console.error('[MarketProfile] FORENSIC - Invalid calculated values:', { widthRatio, opacity, xOffsetPercentage });
    return { shouldRender: false, error: 'Invalid percentage calculations' };
  }

  // NEW: Responsive width calculation
  const mode = config.marketProfileView || 'combinedRight';
  const widthMode = config.marketProfileWidthMode || 'responsive';
  
  let maxBarWidth;
  if (widthMode === 'responsive') {
    // Use responsive width calculation
    maxBarWidth = calculateResponsiveWidth(config, contentArea, adrAxisX, mode);
  } else {
    // Legacy fixed percentage mode
    maxBarWidth = contentArea.width * (widthRatio / 100);
  }
  
  const xOffset = contentArea.width * xOffsetPercentage;

  // ✅ FORENSIC FIX: Validate final calculations
  if (isNaN(maxBarWidth) || isNaN(xOffset)) {
    console.error('[MarketProfile] FORENSIC - Invalid final calculations:', { maxBarWidth, xOffset });
    return { shouldRender: false, error: 'Invalid final calculations' };
  }

  // Configure profile mode positioning
  const profileMode = configureProfileMode(config, contentArea, adrAxisX, maxBarWidth, xOffset);

  return {
    shouldRender: true, // Always render if data is valid
    maxBarWidth,
    opacity,
    ...profileMode
  };
}

/**
 * Configure canvas context for crisp rendering
 * Uses proven DPR-aware patterns from dayRangeMeter.js
 */
function configureRenderContext(ctx) {
  ctx.save();
  
  // Sub-pixel alignment for crisp 1px lines
  ctx.translate(0.5, 0.5);
  
  // Disable anti-aliasing for sharp rendering
  ctx.imageSmoothingEnabled = false;
}

/**
 * Configure profile display mode with intelligent positioning
 */
function configureProfileMode(config, contentArea, adrAxisX, maxBarWidth, xOffset) {
  const mode = config.marketProfileView || 'combinedRight';
  
  switch (mode) {
    case 'separate':
      // Separate: down (sell) on left of axis, up (buy) on right of axis
      return { 
        leftStartX: adrAxisX - xOffset,             // Left edge of axis for sell
        rightStartX: adrAxisX + xOffset,            // Right edge of axis for buy
        direction: 'separate',
        renderLeft: true,
        renderRight: true
      };
      
    case 'combinedLeft':
      // Combined Left: both buy+sell on left side of axis
      return { 
        leftStartX: adrAxisX - xOffset,              // Right edge at axis
        rightStartX: adrAxisX - xOffset,             // Same position
        direction: 'combinedLeft',
        renderLeft: true,
        renderRight: true
      };
      
    case 'combinedRight':
    default:
      // Combined Right: both buy+sell on right side of axis
      return { 
        leftStartX: adrAxisX + xOffset,              // Right of axis
        rightStartX: adrAxisX + xOffset,             // Same right position
        direction: 'combinedRight',
        renderLeft: true,
        renderRight: true
      };
  }
}

/**
 * Process market profile levels - use worker's existing structure
 * Foundation pattern: leverage existing data processing
 */
function processMarketProfileLevels(marketProfileLevels, visualHigh, visualLow, config, y) {
  const priceRange = visualHigh - visualLow;
  
  // Find maximum volume for scaling
  let maxVolume = 0;
  marketProfileLevels.forEach((level, index) => {
    maxVolume = Math.max(maxVolume, level.volume || 0);
  });
  
  // Apply depth filtering if configured
  let filteredLevels = marketProfileLevels;
  if (config.distributionDepthMode === 'percentage' && config.distributionPercentage < 100) {
    // ✅ CRITICAL FIX: Convert to number and validate
    const distributionPercent = parseFloat(config.distributionPercentage) || 50;
    
    if (isNaN(distributionPercent) || distributionPercent < 0 || distributionPercent > 100) {
      console.error('[MarketProfile] FORENSIC - Invalid distribution percentage:', distributionPercent);
      // Fallback to showing all levels if invalid percentage
      filteredLevels = marketProfileLevels;
    } else {
      // ✅ FIXED: distributionPercentage is already a percentage (50%), so division by 100 is correct
      const volumeThreshold = maxVolume * (distributionPercent / 100);
      filteredLevels = marketProfileLevels.filter(level => (level.volume || 0) >= volumeThreshold);
    }
  } else if (config.distributionDepthMode === 'all') {
    // Show all levels when mode is 'all'
    filteredLevels = marketProfileLevels;
  }
  
  // Pre-calculate Y positions for performance (FOUNDATION PATTERN)
  const levelsWithPositions = filteredLevels.map(level => {
    const priceY = y(level.price);
    return {
      ...level,
      priceY
    };
  });
  
  return {
    levels: levelsWithPositions,
    maxVolume,
    priceRange
  };
}

/**
 * Apply enhancements with bounds checking (foundation pattern)
 */
function addEnhancements(ctx, renderData, profileData, config, state, contentArea, y) {
  // Core profile bars always render (trader requirement)
  drawProfileBars(ctx, renderData, profileData, config);

  // Apply bounds checking ONLY to enhancements (foundation pattern)
  if (config.showMaxMarker && profileData.levels.length > 0) {
    // Find maximum volume level
    const maxVolumeLevel = profileData.levels.reduce((max, level) => 
      (level.volume || 0) > (max.volume || 0) ? level : max
    );
    
    // Check if max marker is within canvas bounds (use pre-calculated Y position)
    if (boundsUtils.isYInBounds(maxVolumeLevel.priceY, config, { canvasArea: contentArea })) {
      drawMaxVolumeMarker(ctx, maxVolumeLevel, renderData, config);
    }
  }
}

/**
 * Draw profile bars with foundation integration
 */
function drawProfileBars(ctx, renderData, profileData, config) {
  const { leftStartX, rightStartX, direction, maxBarWidth, opacity } = renderData;
  const { levels, maxVolume } = profileData;
  
  let barsDrawn = 0;
  levels.forEach((level, index) => {
    if (!level.volume || level.volume === 0) {
      return; // Skip empty levels
    }
    
    // Use pre-calculated Y position for performance
    const bucketY = level.priceY;
    const barWidth = (level.volume / maxVolume) * maxBarWidth;
    
    // Draw based on mode
    switch (direction) {
      case 'separate':
        drawLeftBars(ctx, leftStartX, bucketY, level.buy || 0, level.sell || 0, barWidth, config, opacity);
        drawRightBars(ctx, rightStartX, bucketY, level.buy || 0, level.sell || 0, barWidth, config, opacity, 'separate');
        break;
        
      case 'combinedLeft':
        drawLeftBars(ctx, leftStartX, bucketY, level.buy || 0, level.sell || 0, barWidth, config, opacity, 'combined');
        break;
        
      case 'combinedRight':
      default:
        drawRightBars(ctx, rightStartX, bucketY, level.buy || 0, level.sell || 0, barWidth, config, opacity, 'combined');
        break;
    }
    
    barsDrawn++;
  });
}

/**
 * Draw left-side profile bars (for separate mode - SELL ONLY, for combined left mode - BUY+SELL)
 */
function drawLeftBars(ctx, startX, bucketY, buyVolume, sellVolume, barWidth, config, opacity, mode = 'separate') {
  // Total volume for width calculation
  const totalVolume = buyVolume + sellVolume;
  const fullBarWidth = barWidth * (totalVolume / (totalVolume || 1));
  
  // Calculate widths based on mode
  let buyWidth = 0;
  let sellWidth = 0;
  
  if (mode === 'separate') {
    // Separate mode: only SELL volume on left side
    if (sellVolume > 0) {
      sellWidth = (sellVolume / totalVolume) * fullBarWidth;
      ctx.fillStyle = hexToRgba(config.marketProfileDownColor || '#EF4444', opacity); // Red for sell
      ctx.fillRect(startX - sellWidth, bucketY - 0.5, sellWidth, 1);
    }
    
    // Draw outline if enabled
    if (config.marketProfileOutline && config.marketProfileOutlineShowStroke && sellWidth > 0) {
      // ✅ FIXED: Use down color for sell bars, up color for buy bars
      ctx.strokeStyle = hexToRgba(config.marketProfileOutlineDownColor || '#4B5563', config.marketProfileOutlineOpacity || 1);
      ctx.lineWidth = config.marketProfileOutlineStrokeWidth || 1; // ✅ FIXED: Use config value
      ctx.strokeRect(startX - sellWidth, bucketY - 0.5, sellWidth, 1);
    }
  } else {
    // Combined left mode: both BUY and SELL extending left from axis
    if (buyVolume > 0) {
      buyWidth = (buyVolume / totalVolume) * fullBarWidth;
    }
    if (sellVolume > 0) {
      sellWidth = (sellVolume / totalVolume) * fullBarWidth;
    }
    
    // Draw sell volume (rightmost, closest to axis)
    if (sellWidth > 0) {
      ctx.fillStyle = hexToRgba(config.marketProfileDownColor || '#EF4444', opacity); // Red for sell
      ctx.fillRect(startX - sellWidth, bucketY - 0.5, sellWidth, 1);
    }
    
    // Draw buy volume (left of sell)
    if (buyWidth > 0) {
      ctx.fillStyle = hexToRgba(config.marketProfileUpColor || '#10B981', opacity); // Green for buy
      ctx.fillRect(startX - sellWidth - buyWidth, bucketY - 0.5, buyWidth, 1);
    }
    
    // Draw outline if enabled
    if (config.marketProfileOutline && config.marketProfileOutlineShowStroke) {
      // ✅ FIXED: Use proper outline color mapping for combined mode
      ctx.strokeStyle = hexToRgba(config.marketProfileOutlineUpColor || '#4B5563', config.marketProfileOutlineOpacity || 1);
      ctx.lineWidth = config.marketProfileOutlineStrokeWidth || 1; // ✅ FIXED: Use config value
      ctx.strokeRect(startX - sellWidth - buyWidth, bucketY - 0.5, sellWidth + buyWidth, 1);
    }
  }
}

/**
 * Draw right-side profile bars (for separate mode - BUY ONLY, for combined modes - BUY+SELL)
 */
function drawRightBars(ctx, startX, bucketY, buyVolume, sellVolume, barWidth, config, opacity, mode = 'combined') {
  // Total volume for width calculation
  const totalVolume = buyVolume + sellVolume;
  const fullBarWidth = barWidth * (totalVolume / (totalVolume || 1));
  
  // Calculate widths based on mode
  let buyWidth = 0;
  let sellWidth = 0;
  
  if (mode === 'separate') {
    // Separate mode: only BUY volume on right side
    if (buyVolume > 0) {
      buyWidth = barWidth; // Full width for buy only
      ctx.fillStyle = hexToRgba(config.marketProfileUpColor || '#10B981', opacity); // Green for buy
      ctx.fillRect(startX, bucketY - 0.5, buyWidth, 1);
    }
    
    // Draw outline if enabled
    if (config.marketProfileOutline && config.marketProfileOutlineShowStroke && buyWidth > 0) {
      // ✅ FIXED: Use up color for buy bars, proper opacity and stroke width
      ctx.strokeStyle = hexToRgba(config.marketProfileOutlineUpColor || '#4B5563', config.marketProfileOutlineOpacity || 1);
      ctx.lineWidth = config.marketProfileOutlineStrokeWidth || 1; // ✅ FIXED: Use config value
      ctx.strokeRect(startX, bucketY - 0.5, buyWidth, 1);
    }
  } else {
    // Combined modes: both BUY and SELL on same side
    if (buyVolume > 0) {
      buyWidth = (buyVolume / totalVolume) * fullBarWidth;
    }
    if (sellVolume > 0) {
      sellWidth = (sellVolume / totalVolume) * fullBarWidth;
    }
    
    // Draw buy volume (leftmost)
    if (buyWidth > 0) {
      ctx.fillStyle = hexToRgba(config.marketProfileUpColor || '#10B981', opacity); // Green for buy
      ctx.fillRect(startX, bucketY - 0.5, buyWidth, 1);
    }
    
    // Draw sell volume (right of buy)
    if (sellWidth > 0) {
      ctx.fillStyle = hexToRgba(config.marketProfileDownColor || '#EF4444', opacity); // Red for sell
      ctx.fillRect(startX + buyWidth, bucketY - 0.5, sellWidth, 1);
    }
    
    // Draw outline if enabled
    if (config.marketProfileOutline && config.marketProfileOutlineShowStroke) {
      // ✅ FIXED: Use proper outline color and stroke width for combined right mode
      ctx.strokeStyle = hexToRgba(config.marketProfileOutlineUpColor || '#4B5563', config.marketProfileOutlineOpacity || 1);
      ctx.lineWidth = config.marketProfileOutlineStrokeWidth || 1; // ✅ FIXED: Use config value
      ctx.strokeRect(startX, bucketY - 0.5, fullBarWidth, 1);
    }
  }
}

/**
 * Draw maximum volume marker with foundation integration
 * ✅ FIXED: Use marketProfile-specific config, not priceFontSize
 * This is an enhancement that should only render ONCE at max volume level
 */
function drawMaxVolumeMarker(ctx, maxVolumeLevel, renderData, config) {
  const { leftStartX, rightStartX, direction, maxBarWidth } = renderData;
  
  ctx.save();
  
  // ✅ FIXED: Use marketProfile-specific font config, not priceFontSize
  const fontSize = Math.max(8, (config.marketProfileMarkerFontSize || 10));
  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const volumeText = `${(maxVolumeLevel.volume || 0).toFixed(0)}`;
  const textMetrics = ctx.measureText(volumeText);
  
  // Position text based on mode
  let textX;
  switch (direction) {
    case 'separate':
      // For separate mode, position to the right of buy bars (right side)
      textX = rightStartX + maxBarWidth + textMetrics.width / 2 + 5;
      break;
      
    case 'combinedLeft':
      // For combined left, position to the left of left bars
      textX = leftStartX - maxBarWidth - textMetrics.width / 2 - 5;
      break;
      
    case 'combinedRight':
    default:
      // For combined right, position to the right of right bars
      textX = rightStartX + maxBarWidth + textMetrics.width / 2 + 5;
      break;
  }
  
  // Use pre-calculated Y position
  const bucketY = maxVolumeLevel.priceY;
  
  // Draw text background
  const padding = 4;
  const bgX = textX - textMetrics.width / 2 - padding;
  const bgY = bucketY - fontSize / 2 - padding;
  const bgWidth = textMetrics.width + (padding * 2);
  const bgHeight = fontSize + (padding * 2);
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
  
  // Draw text
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(volumeText, textX, bucketY);
  
  ctx.restore();
}

/**
 * Safely converts a HEX color to an RGBA string (FOUNDATION UTILITY)
 */
function hexToRgba(hex, opacity) {
  if (!hex) return `rgba(0,0,0,${opacity})`;
  
  // ✅ CRITICAL FIX: opacity is already decimal (0.8), don't divide by 100 again
  const finalOpacity = opacity;

  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  
  return `rgba(${r},${g},${b},${finalOpacity})`;
}
