// =============================================================================
// MARKET PROFILE VISUALIZATION ENGINE
// =============================================================================
// Clean slate implementation based on DESIGN_MARKETPROFILE.md specifications
// Cognitive architecture with neuroscience-based visual processing
// Supports volume distribution and delta pressure analysis
// Implements silhouette, bar-based, and hybrid rendering approaches

import {
  configureCanvasContext,
  boundsUtils,
  configureTextForDPR
} from '../../utils/canvasSizing.js';

/**
 * Market Profile Visualization Engine
 * Implements cognitive design foundation for pre-attentive market structure analysis
 */
export function drawMarketProfile(ctx, renderingContext, config, state, y) {
  // Early exit for performance optimization
  if (!config.showMarketProfile) {
    return;
  }

  // Input validation with graceful fallback
  if (!state.marketProfile || !state.marketProfile.levels || !Array.isArray(state.marketProfile.levels)) {
    return;
  }

  const { levels } = state.marketProfile;
  if (levels.length === 0) {
    return;
  }

  // Canvas context is already configured at container level
  // No need to call configureCanvasContext here

  // Safe context management for rendering stability
  ctx.save();

  try {
    // Pre-compute values for performance
    const processedData = processMarketProfileData(levels, y, config);
    if (processedData.processedLevels.length === 0) {
      return;
    }

    // Apply cognitive design foundation based on rendering style
    switch (config.renderingStyle) {
      case 'silhouette':
        renderSilhouetteProfile(ctx, renderingContext, config, processedData);
        break;
      case 'barBased':
        renderBarBasedProfile(ctx, renderingContext, config, processedData);
        break;
      case 'hybrid':
        renderHybridProfile(ctx, renderingContext, config, processedData);
        break;
      default:
        // Fallback to silhouette for cognitive efficiency
        renderSilhouetteProfile(ctx, renderingContext, config, processedData);
    }

    // Render point of control marker if enabled
    if (config.showMaxMarker) {
      renderPointOfControlMarker(ctx, renderingContext, config, processedData);
    }

  } catch (error) {
    console.error('[MARKET_PROFILE] Rendering error:', error);
    // Graceful fallback - don't crash the entire rendering pipeline
  } finally {
    ctx.restore();
  }
}

/**
 * Process raw market profile data for efficient rendering
 * Implements single-pass processing with memory optimization
 */
function processMarketProfileData(levels, yScale, config) {
  // Filter and sort levels based on configuration
  let filteredLevels = [...levels];

  // Apply distribution depth filtering
  if (config.distributionDepthMode === 'percentage' && config.distributionPercentage < 100) {
    const totalVolume = filteredLevels.reduce((sum, level) => sum + level.volume, 0);
    const targetVolume = totalVolume * (config.distributionPercentage / 100);

    // Sort by volume descending and take top percentage
    filteredLevels.sort((a, b) => b.volume - a.volume);
    let accumulatedVolume = 0;
    const result = [];

    for (const level of filteredLevels) {
      result.push(level);
      accumulatedVolume += level.volume;
      if (accumulatedVolume >= targetVolume) break;
    }

    filteredLevels = result;
    // Restore original price order
    filteredLevels.sort((a, b) => a.price - b.price);
  }

  // Apply delta threshold filtering
  if (config.deltaThreshold > 0) {
    filteredLevels = filteredLevels.filter(level => {
      const delta = level.buy - level.sell;
      return Math.abs(delta) >= config.deltaThreshold;
    });
  }

  // Pre-calculate positions and values for rendering efficiency
  const processedLevels = filteredLevels.map(level => {
    const delta = level.buy - level.sell;
    let displayValue;

    // Select display value based on analysis type
    switch (config.analysisType) {
      case 'deltaPressure':
        displayValue = delta;
        break;
      case 'volumeDistribution':
      default:
        displayValue = level.volume;
        break;
    }

    return {
      price: level.price,
      priceY: yScale(level.price),
      volume: level.volume,
      buy: level.buy,
      sell: level.sell,
      delta: delta,
      displayValue: displayValue,
      isPositive: delta > 0 || (delta === 0 && level.buy >= level.sell)
    };
  });

  // Find maximum value for scaling
  const maxDisplayValue = Math.max(
    ...processedLevels.map(level => Math.abs(level.displayValue))
  );

  return {
    processedLevels,
    maxDisplayValue,
    totalLevels: processedLevels.length
  };
}

/**
 * Silhouette Rendering - Shape-based processing for instant market structure recognition
 * Implements cognitive design foundation leveraging brain's superior shape recognition
 * Creates separate outlines for left (negative/down) and right (positive/up) sides
 */
function renderSilhouetteProfile(ctx, renderingContext, config, data) {
  const { processedLevels, maxDisplayValue } = data;
  const { contentArea, adrAxisX } = renderingContext;

  // Set global properties
  ctx.globalAlpha = config.marketProfileOpacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Separate levels by side for proper silhouette rendering
  const leftSideLevels = [];
  const rightSideLevels = [];

  processedLevels.forEach(level => {
    if (level.displayValue === 0) return;

    const normalizedWidth = (Math.abs(level.displayValue) / maxDisplayValue) * (config.barWidthRatio / 100);
    const barWidth = Math.max(config.barMinWidth, normalizedWidth * contentArea.width);

    let leftX, rightX;

    switch (config.positioning) {
      case 'left':
        // All levels extend to the left
        leftSideLevels.push({ ...level, leftX: adrAxisX - barWidth, rightX: adrAxisX });
        break;
      case 'right':
        // All levels extend to the right
        rightSideLevels.push({ ...level, leftX: adrAxisX, rightX: adrAxisX + barWidth });
        break;
      case 'separate':
        // Negative to left, positive to right
        if (level.isPositive) {
          rightSideLevels.push({ ...level, leftX: adrAxisX, rightX: adrAxisX + barWidth });
        } else {
          leftSideLevels.push({ ...level, leftX: adrAxisX - barWidth, rightX: adrAxisX });
        }
        break;
      default:
        // Default to right positioning
        rightSideLevels.push({ ...level, leftX: adrAxisX, rightX: adrAxisX + barWidth });
        break;
    }
  });

  // Render left side silhouette (negative/down = red)
  if (leftSideLevels.length > 0) {
    renderSideSilhouette(ctx, leftSideLevels, config.marketProfileDownColor, config);
  }

  // Render right side silhouette (positive/up = green)
  if (rightSideLevels.length > 0) {
    renderSideSilhouette(ctx, rightSideLevels, config.marketProfileUpColor, config);
  }

  ctx.restore();
}

/**
 * Render silhouette for one side (left or right) with proper color
 */
function renderSideSilhouette(ctx, sideLevels, color, config) {
  if (sideLevels.length === 0) return;

  // Sort levels by Y coordinate (top to bottom)
  const sortedLevels = [...sideLevels].sort((a, b) => a.priceY - b.priceY);

  // Build outline points for this side
  const outlinePoints = [];

  // Start from top
  outlinePoints.push({ x: sortedLevels[0].leftX, y: sortedLevels[0].priceY });

  // Trace down the left edge (or inner edge for right side)
  sortedLevels.forEach(level => {
    outlinePoints.push({ x: level.leftX, y: level.priceY });
  });

  // Connect to bottom edge
  const lastLevel = sortedLevels[sortedLevels.length - 1];
  outlinePoints.push({ x: lastLevel.rightX, y: lastLevel.priceY });

  // Trace up the right edge (or outer edge for right side)
  for (let i = sortedLevels.length - 1; i >= 0; i--) {
    outlinePoints.push({ x: sortedLevels[i].rightX, y: sortedLevels[i].priceY });
  }

  // Close path
  outlinePoints.push({ x: sortedLevels[0].rightX, y: sortedLevels[0].priceY });

  // Draw the silhouette
  if (outlinePoints.length >= 4) {
    ctx.beginPath();
    ctx.moveTo(outlinePoints[0].x, outlinePoints[0].y);

    for (let i = 1; i < outlinePoints.length; i++) {
      ctx.lineTo(outlinePoints[i].x, outlinePoints[i].y);
    }

    ctx.closePath();

    // Apply fill if enabled
    if (config.silhouetteFill) {
      ctx.fillStyle = color;
      ctx.globalAlpha = config.silhouetteFillOpacity;
      ctx.fill();
    }

    // Restore opacity for outline
    ctx.globalAlpha = config.marketProfileOpacity;

    // Draw outline if enabled
    if (config.silhouetteOutline) {
      ctx.strokeStyle = config.silhouetteOutlineColor;
      ctx.lineWidth = config.silhouetteOutlineWidth;
      ctx.stroke();
    }
  }
}

/**
 * Build profile outline by finding the outermost edges of all levels
 * Creates a continuous outline that represents the true market profile shape
 * (Kept for backward compatibility, but not used in new implementation)
 */
function buildProfileOutline(processedLevels, maxDisplayValue, config, contentArea, adrAxisX) {
  if (processedLevels.length === 0) return [];

  // Sort levels by Y coordinate (top to bottom)
  const sortedLevels = [...processedLevels].sort((a, b) => a.priceY - b.priceY);

  // Calculate bar widths for all levels
  const levelBars = sortedLevels.map(level => {
    const normalizedWidth = (Math.abs(level.displayValue) / maxDisplayValue) * (config.barWidthRatio / 100);
    const barWidth = Math.max(config.barMinWidth, normalizedWidth * contentArea.width);

    let leftX, rightX;

    switch (config.positioning) {
      case 'left':
        // All bars extend to the left of the axis
        leftX = adrAxisX - barWidth;
        rightX = adrAxisX;
        break;
      case 'right':
        // All bars extend to the right of the axis
        leftX = adrAxisX;
        rightX = adrAxisX + barWidth;
        break;
      case 'separate':
        // Negative/selling pressure to left, positive/buying to right
        if (level.isPositive) {
          leftX = adrAxisX;
          rightX = adrAxisX + barWidth;
        } else {
          leftX = adrAxisX - barWidth;
          rightX = adrAxisX;
        }
        break;
      default:
        // Default to right positioning
        leftX = adrAxisX;
        rightX = adrAxisX + barWidth;
        break;
    }

    return {
      y: level.priceY,
      leftX,
      rightX,
      width: rightX - leftX,
      isPositive: level.isPositive,
      displayValue: level.displayValue
    };
  });

  // Filter out zero-width bars
  const validBars = levelBars.filter(bar => bar.displayValue !== 0 && bar.width > 0);
  if (validBars.length === 0) return [];

  // Create continuous outline points
  const outlinePoints = [];

  // Start from top-left corner
  outlinePoints.push({ x: validBars[0].leftX, y: validBars[0].y });

  // Trace down the left edge
  validBars.forEach(bar => {
    outlinePoints.push({ x: bar.leftX, y: bar.y });
  });

  // Connect to bottom-right corner
  const lastBar = validBars[validBars.length - 1];
  outlinePoints.push({ x: lastBar.rightX, y: lastBar.y });

  // Trace up the right edge
  for (let i = validBars.length - 1; i >= 0; i--) {
    outlinePoints.push({ x: validBars[i].rightX, y: validBars[i].y });
  }

  // Close the path back to start
  outlinePoints.push({ x: validBars[0].rightX, y: validBars[0].y });

  return outlinePoints;
}

/**
 * Render continuous silhouette outline with proper color handling
 */
function renderContinuousSilhouette(ctx, outlinePoints, config) {
  if (outlinePoints.length < 4) return; // Need at least 4 points to create a shape

  // Begin path
  ctx.beginPath();

  // Move to first point
  ctx.moveTo(outlinePoints[0].x, outlinePoints[0].y);

  // Draw continuous outline
  for (let i = 1; i < outlinePoints.length; i++) {
    ctx.lineTo(outlinePoints[i].x, outlinePoints[i].y);
  }

  // Close path
  ctx.closePath();

  // Apply fill if enabled
  if (config.silhouetteFill) {
    // For continuous silhouette, use a neutral color based on analysis type
    let fillColor;
    if (config.analysisType === 'deltaPressure') {
      // Use a gradient or neutral color for delta pressure
      fillColor = '#6B7280'; // Gray for neutral
    } else {
      // Use a neutral blue for volume distribution
      fillColor = '#3B82F6'; // Blue for volume
    }

    ctx.fillStyle = fillColor;
    ctx.globalAlpha = config.silhouetteFillOpacity;
    ctx.fill();
  }

  // Restore opacity for outline
  ctx.globalAlpha = config.marketProfileOpacity;

  // Draw outline if enabled
  if (config.silhouetteOutline) {
    ctx.strokeStyle = config.silhouetteOutlineColor;
    ctx.lineWidth = config.silhouetteOutlineWidth;
    ctx.stroke();
  }
}

/**
 * Render individual silhouette shape for pre-attentive processing
 * (Kept for backward compatibility, but not used in new implementation)
 */
function renderSilhouetteShape(ctx, path, points, anchorX, color, config) {
  if (points.length === 0) return;

  // Sort points by Y coordinate (top to bottom)
  points.sort((a, b) => a.y - b.y);

  // Build silhouette path
  ctx.beginPath();

  // Start from top-left corner
  ctx.moveTo(points[0].x1, points[0].y);

  // Draw left edge
  points.forEach(point => {
    ctx.lineTo(point.x1, point.y);
  });

  // Draw bottom edge
  const lastPoint = points[points.length - 1];
  ctx.lineTo(lastPoint.x2, lastPoint.y);

  // Draw right edge (bottom to top)
  for (let i = points.length - 1; i >= 0; i--) {
    ctx.lineTo(points[i].x2, points[i].y);
  }

  // Close path for filled shape
  ctx.closePath();

  // Apply fill for size cognition if enabled
  ctx.fillStyle = color;
  if (config.silhouetteFill) {
    ctx.globalAlpha = config.silhouetteFillOpacity;
    ctx.fill();
  }

  // Restore opacity for outline
  ctx.globalAlpha = config.marketProfileOpacity;
}

/**
 * Bar-Based Rendering - Detailed analysis through discrete representation
 * Supports granular analysis of specific price points
 */
function renderBarBasedProfile(ctx, renderingContext, config, data) {
  const { processedLevels, maxDisplayValue } = data;
  const { contentArea, adrAxisX } = renderingContext;

  // Set rendering properties
  ctx.globalAlpha = config.marketProfileOpacity;
  ctx.lineCap = 'round';

  processedLevels.forEach(level => {
    if (level.displayValue === 0) return;

    const normalizedWidth = (Math.abs(level.displayValue) / maxDisplayValue) * (config.barWidthRatio / 100);
    const barWidth = Math.max(config.barMinWidth, normalizedWidth * contentArea.width);

    let x, width;
    const color = level.isPositive ? config.marketProfileUpColor : config.marketProfileDownColor;

    // Position based on configuration
    switch (config.positioning) {
      case 'left':
        x = adrAxisX - barWidth;
        width = barWidth;
        break;
      case 'right':
        x = adrAxisX;
        width = barWidth;
        break;
      case 'separate':
        if (level.isPositive) {
          x = adrAxisX - barWidth;
          width = barWidth;
        } else {
          x = adrAxisX;
          width = barWidth;
        }
        break;
      default:
        x = adrAxisX;
        width = barWidth;
    }

    // Render bar with bounds checking
    if (boundsUtils.isPointInBounds(x, level.priceY, { canvasArea: renderingContext.contentArea })) {
      ctx.fillStyle = color;
      ctx.fillRect(x, level.priceY, width, 1);

      // Add outline if enabled
      if (config.silhouetteOutline) {
        ctx.strokeStyle = config.silhouetteOutlineColor;
        ctx.lineWidth = config.silhouetteOutlineWidth;
        ctx.strokeRect(x, level.priceY, width, 1);
      }
    }
  });

  ctx.restore();
}

/**
 * Hybrid Rendering - Combination of silhouette for structure and bars for detail
 * Implements progressive disclosure architecture
 */
function renderHybridProfile(ctx, renderingContext, config, data) {
  const { processedLevels } = data;

  // Separate high-volume levels for detailed rendering
  const highVolumeThreshold = data.maxDisplayValue * 0.3; // Top 30% levels

  const silhouetteLevels = processedLevels.filter(level =>
    Math.abs(level.displayValue) < highVolumeThreshold
  );

  const detailLevels = processedLevels.filter(level =>
    Math.abs(level.displayValue) >= highVolumeThreshold
  );

  // Render silhouette background for structure cognition
  if (silhouetteLevels.length > 0) {
    const silhouetteData = {
      ...data,
      processedLevels: silhouetteLevels
    };
    renderSilhouetteProfile(ctx, renderingContext, config, silhouetteData);
  }

  // Render detailed bars for granular analysis
  if (detailLevels.length > 0) {
    const detailData = {
      ...data,
      processedLevels: detailLevels
    };
    renderBarBasedProfile(ctx, renderingContext, config, detailData);
  }
}

/**
 * Point of Control (POC) Marker - Highlights maximum activity level
 * Visual enhancement for immediate recognition of most significant price level
 */
function renderPointOfControlMarker(ctx, renderingContext, config, data) {
  const { processedLevels } = data;

  // Find level with maximum display value
  let pocLevel = null;
  let maxValue = 0;

  processedLevels.forEach(level => {
    if (Math.abs(level.displayValue) > maxValue) {
      maxValue = Math.abs(level.displayValue);
      pocLevel = level;
    }
  });

  if (!pocLevel || maxValue === 0) return;

  const { contentArea, adrAxisX } = renderingContext;

  // Calculate marker position
  const normalizedWidth = (maxValue / data.maxDisplayValue) * (config.barWidthRatio / 100);
  const barWidth = Math.max(config.barMinWidth, normalizedWidth * contentArea.width);

  let markerX;
  switch (config.positioning) {
    case 'left':
      markerX = adrAxisX - barWidth - 10;
      break;
    case 'right':
      markerX = adrAxisX + barWidth + 10;
      break;
    case 'separate':
      markerX = pocLevel.isPositive ?
        adrAxisX - barWidth - 10 :
        adrAxisX + barWidth + 10;
      break;
    default:
      markerX = adrAxisX + barWidth + 10;
  }

  // Render marker if within bounds
  if (boundsUtils.isPointInBounds(markerX, pocLevel.priceY, { canvasArea: renderingContext.contentArea })) {
    ctx.save();

    // Render marker dot
    ctx.fillStyle = pocLevel.isPositive ? config.marketProfileUpColor : config.marketProfileDownColor;
    ctx.beginPath();
    ctx.arc(markerX, pocLevel.priceY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Render max volume text if font size is reasonable
    if (config.marketProfileMarkerFontSize >= 8) {
      configureTextForDPR(ctx, config.marketProfileMarkerFontSize);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${pocLevel.volume}`,
        markerX + 8,
        pocLevel.priceY
      );
    }

    ctx.restore();
  }
}

/**
 * Performance optimization utilities
 */
export function clearMarketProfileCache() {
  // Clear any cached calculations when configuration changes
  // Implementation placeholder for future optimization
}

export function getMarketProfilePerformanceMetrics() {
  // Return performance metrics for debugging and optimization
  // Implementation placeholder for monitoring
  return {
    lastRenderTime: 0,
    averageRenderTime: 0,
    cacheHitRate: 0
  };
}

export default {
  drawMarketProfile,
  clearMarketProfileCache,
  getMarketProfilePerformanceMetrics
};