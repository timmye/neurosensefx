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
  // ✅ DISPLAY CREATION LOGGING: Get display context for correlation
  const displayId = renderingContext?.displayId || 'unknown';
  const symbol = renderingContext?.symbol || 'unknown';
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
    // ✅ DISPLAY CREATION LOGGING: Enhanced error with display correlation
    console.error(`[MARKET_PROFILE:${displayId}] Rendering error for ${symbol}:`, error);
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
 * Calculate maximum bar width based on distance to canvas edges
 * Implements width-aware behavior: profile fills available space between ADR axis and nearest edge
 */
function getMaxBarWidth(contentArea, adrAxisX, positioning, barMinWidth) {
  switch (positioning) {
    case 'left':
      // Distance from left edge to ADR axis
      return Math.max(barMinWidth, adrAxisX);

    case 'right':
      // Distance from ADR axis to right edge
      return Math.max(barMinWidth, contentArea.width - adrAxisX);

    case 'separate':
    default:
      // Use smaller distance to either edge for balanced appearance
      const leftSpace = adrAxisX;
      const rightSpace = contentArea.width - adrAxisX;
      const availableSpace = Math.min(leftSpace, rightSpace);
      return Math.max(barMinWidth, availableSpace);
  }
}

/**
 * Get market profile color based on color mode configuration
 * Supports buy/sell, left/right positioning, and custom color modes
 */
function getMarketProfileColor(config, level, side) {
  switch (config.marketProfileColorMode) {
    case 'leftRight':
      return side === 'left' ? config.marketProfileLeftColor : config.marketProfileRightColor;
    case 'custom':
      return config.marketProfileCustomColor;
    case 'buySell':
    default:
      return level.isPositive ? config.marketProfileUpColor : config.marketProfileDownColor;
  }
}

/**
 * Apply glow effects to canvas context if enabled in configuration
 */
function applyGlowEffect(ctx, config) {
  if (config.marketProfileOutlineGlow) {
    ctx.shadowColor = config.marketProfileGlowColor;
    ctx.shadowBlur = config.marketProfileGlowSize * config.marketProfileGlowIntensity;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
}

/**
 * Remove glow effects from canvas context
 */
function removeGlowEffect(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * Silhouette Rendering with KNN Concave Hull - Shape-based processing for instant market structure recognition
 * Implements cognitive design foundation leveraging brain's superior shape recognition
 * Creates separate organic outlines for left (negative/down) and right (positive/up) sides
 */
function renderSilhouetteProfile(ctx, renderingContext, config, data) {
  const { processedLevels, maxDisplayValue } = data;
  const { contentArea, adrAxisX } = renderingContext;

  // Set global properties
  ctx.globalAlpha = config.marketProfileOpacity ?? 0.8; // Fallback for missing config
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Calculate width-aware maximum bar width
  const maxBarWidth = getMaxBarWidth(contentArea, adrAxisX, config.positioning, config.barMinWidth);

  // Process levels into edge points for KNN algorithm
  const leftSidePoints = [];
  const rightSidePoints = [];

  processedLevels.forEach(level => {
    if (level.displayValue === 0) return;

    // Width-aware calculation: bar width relative to available space, not fixed canvas width
    const normalizedWidth = Math.abs(level.displayValue) / maxDisplayValue;
    const barWidth = Math.max(config.barMinWidth, normalizedWidth * maxBarWidth);


    let leftX, rightX;

    // Default to 'separate' positioning if not specified
    const positioningMode = config.positioning ?? 'separate';

    switch (positioningMode) {
      case 'left':
        // All levels extend to the left - create edge points
        leftSidePoints.push({
          x: adrAxisX - barWidth,
          y: level.priceY,
          volume: level.volume,
          delta: level.delta
        });
        leftSidePoints.push({
          x: adrAxisX,
          y: level.priceY,
          volume: level.volume,
          delta: level.delta
        });
        break;
      case 'right':
        // All levels extend to the right - create edge points
        rightSidePoints.push({
          x: adrAxisX,
          y: level.priceY,
          volume: level.volume,
          delta: level.delta
        });
        rightSidePoints.push({
          x: adrAxisX + barWidth,
          y: level.priceY,
          volume: level.volume,
          delta: level.delta
        });
        break;
      case 'separate':
        // Negative to left, positive to right
        if (level.isPositive) {
          rightSidePoints.push({
            x: adrAxisX,
            y: level.priceY,
            volume: level.volume,
            delta: level.delta
          });
          rightSidePoints.push({
            x: adrAxisX + barWidth,
            y: level.priceY,
            volume: level.volume,
            delta: level.delta
          });
        } else {
          leftSidePoints.push({
            x: adrAxisX - barWidth,
            y: level.priceY,
            volume: level.volume,
            delta: level.delta
          });
          leftSidePoints.push({
            x: adrAxisX,
            y: level.priceY,
            volume: level.volume,
            delta: level.delta
          });
        }
        break;
      default:
        // Default to right positioning
        rightSidePoints.push({
          x: adrAxisX,
          y: level.priceY,
          volume: level.volume,
          delta: level.delta
        });
        rightSidePoints.push({
          x: adrAxisX + barWidth,
          y: level.priceY,
          volume: level.volume,
          delta: level.delta
        });
        break;
    }
  });

  // Render left side silhouette with color mode support
  if (leftSidePoints.length >= 3) {
    const leftColor = getMarketProfileColor(config, { isPositive: false }, 'left');
    renderMarketProfileSilhouette(ctx, leftSidePoints, leftColor, config);
  }

  // Render right side silhouette with color mode support
  if (rightSidePoints.length >= 3) {
    const rightColor = getMarketProfileColor(config, { isPositive: true }, 'right');
    renderMarketProfileSilhouette(ctx, rightSidePoints, rightColor, config);
  }

  ctx.restore();
}

/**
 * Render market profile silhouette with proper edge following
 */
function renderMarketProfileSilhouette(ctx, points, color, config) {
  if (points.length < 2) return;

  // Get silhouette configuration with defaults
  const smoothingFactor = config.silhouetteSmoothingIntensity ?? 0.3;
  const enableSmoothing = config.silhouetteSmoothing !== false;

  // Sort points by Y coordinate (top to bottom)
  const sortedPoints = [...points].sort((a, b) => a.y - b.y);

  // Create market profile silhouette by following the outer edge
  const silhouettePoints = createMarketProfileSilhouette(sortedPoints, enableSmoothing, smoothingFactor);

  if (silhouettePoints.length < 3) return;

  // Create gradient fill if configured
  let fillColor = color;
  if (config.silhouetteFillStyle === 'gradient') {
    fillColor = createSilhouetteGradient(ctx, silhouettePoints, color, config);
  }

  // Draw the filled silhouette
  ctx.beginPath();
  ctx.moveTo(silhouettePoints[0].x, silhouettePoints[0].y);

  for (let i = 1; i < silhouettePoints.length; i++) {
    ctx.lineTo(silhouettePoints[i].x, silhouettePoints[i].y);
  }

  ctx.closePath();

  // Apply fill
  if (config.silhouetteFill && config.silhouetteFillStyle !== 'none') {
    ctx.fillStyle = fillColor;
    ctx.globalAlpha = config.silhouetteFillOpacity;
    ctx.fill();
  }

  // Restore opacity for outline
  ctx.globalAlpha = config.marketProfileOpacity;

  // Draw outline if enabled with glow effect support
  if (config.silhouetteOutline) {
    // Apply glow effect before drawing outline
    applyGlowEffect(ctx, config);

    ctx.strokeStyle = config.silhouetteOutlineColor;
    ctx.lineWidth = config.silhouetteOutlineWidth;
    ctx.stroke();

    // Remove glow effect after drawing
    removeGlowEffect(ctx);
  }
}

/**
 * Create proper market profile silhouette from sorted edge points
 */
function createMarketProfileSilhouette(sortedPoints, enableSmoothing, smoothingFactor) {
  if (sortedPoints.length < 2) return sortedPoints;

  // Find the outermost edge points
  const outermostPoints = findOutermostEdgePoints(sortedPoints);

  if (outermostPoints.length < 3) return outermostPoints;

  // Apply smoothing if enabled
  if (enableSmoothing && outermostPoints.length >= 3) {
    return smoothMarketProfileEdge(outermostPoints, smoothingFactor);
  }

  return outermostPoints;
}

/**
 * Find outermost edge points from market profile data
 */
function findOutermostEdgePoints(sortedPoints) {
  if (sortedPoints.length === 0) return [];

  // Group points by similar Y coordinates (within tolerance)
  const tolerance = 2; // pixels
  const yGroups = [];

  sortedPoints.forEach(point => {
    // Find existing group or create new one
    let group = yGroups.find(g => Math.abs(g.y - point.y) <= tolerance);
    if (!group) {
      group = { y: point.y, leftmost: point, rightmost: point };
      yGroups.push(group);
    } else {
      // Update group boundaries
      if (point.x < group.leftmost.x) {
        group.leftmost = point;
      }
      if (point.x > group.rightmost.x) {
        group.rightmost = point;
      }
    }
  });

  // Create silhouette path following outermost edges
  const silhouettePoints = [];

  // Start from top-left
  silhouettePoints.push({ x: yGroups[0].leftmost.x, y: yGroups[0].y });

  // Trace down the left edge
  yGroups.forEach(group => {
    silhouettePoints.push({ x: group.leftmost.x, y: group.y });
  });

  // Connect to bottom-right
  const lastGroup = yGroups[yGroups.length - 1];
  silhouettePoints.push({ x: lastGroup.rightmost.x, y: lastGroup.y });

  // Trace up the right edge
  for (let i = yGroups.length - 2; i >= 0; i--) {
    silhouettePoints.push({ x: yGroups[i].rightmost.x, y: yGroups[i].y });
  }

  // Close back to top-right
  silhouettePoints.push({ x: yGroups[0].rightmost.x, y: yGroups[0].y });

  return silhouettePoints;
}

/**
 * Smooth market profile edge while maintaining proper shape
 */
function smoothMarketProfileEdge(points, smoothingFactor) {
  if (points.length < 3) return points;

  const smoothedPoints = [];

  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    // Add current point
    smoothedPoints.push(curr);

    // Add smoothed intermediate point
    const controlX = curr.x + (next.x - prev.x) * smoothingFactor * 0.15;
    const controlY = curr.y + (next.y - prev.y) * smoothingFactor * 0.15;

    smoothedPoints.push({ x: controlX, y: controlY });
  }

  return smoothedPoints;
}

// =============================================================================
// MARKET PROFILE SILHOUETTE ALGORITHM
// =============================================================================

/**
 * Create gradient fill for silhouette based on configuration
 */
function createSilhouetteGradient(ctx, outlinePoints, baseColor, config) {
  if (outlinePoints.length < 2) return baseColor;

  // Calculate bounds of outline points
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  outlinePoints.forEach(point => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  });

  // Create gradient based on direction setting
  let gradient;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  switch (config.silhouetteGradientDirection) {
    case 'horizontal':
      gradient = ctx.createLinearGradient(minX, centerY, maxX, centerY);
      break;
    case 'vertical':
      gradient = ctx.createLinearGradient(centerX, minY, centerX, maxY);
      break;
    case 'radial':
      const radius = Math.max(maxX - minX, maxY - minY) / 2;
      gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      break;
    default:
      gradient = ctx.createLinearGradient(minX, centerY, maxX, centerY);
      break;
  }

  // Create color stops with transparency variation
  const colorAlpha = config.silhouetteFillOpacity;

  if (config.silhouetteGradientDirection === 'radial') {
    // Radial gradient: solid center, transparent edges
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(0.7, baseColor);
    gradient.addColorStop(1, `${baseColor}00`); // Transparent at edge
  } else {
    // Linear gradient: solid to transparent
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(0.6, baseColor);
    gradient.addColorStop(1, `${baseColor}88`); // Semi-transparent at end
  }

  return gradient;
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

  // Calculate width-aware maximum bar width
  const maxBarWidth = getMaxBarWidth(contentArea, adrAxisX, config.positioning, config.barMinWidth);

  processedLevels.forEach(level => {
    if (level.displayValue === 0) return;

    // Width-aware calculation: bar width relative to available space, not fixed canvas width
    const normalizedWidth = Math.abs(level.displayValue) / maxDisplayValue;
    const barWidth = Math.max(config.barMinWidth, normalizedWidth * maxBarWidth);

    let x, width;
    // Determine color based on color mode configuration
    const side = (config.positioning === 'separate') ? (level.isPositive ? 'right' : 'left') : config.positioning;
    const color = getMarketProfileColor(config, level, side);

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

    // Render bar with comprehensive bounds checking
    const contentArea = renderingContext.contentArea;
    const endX = x + width;

    // Check if entire bar stays within canvas bounds
    const startInBounds = boundsUtils.isPointInBounds(x, level.priceY, { canvasArea: contentArea });
    const endInBounds = boundsUtils.isPointInBounds(endX, level.priceY, { canvasArea: contentArea });

    if (startInBounds && endInBounds) {
      ctx.fillStyle = color;
      ctx.fillRect(x, level.priceY, width, 1);

      // Add outline if enabled with glow effect support
      if (config.silhouetteOutline) {
        // Apply glow effect before drawing outline
        applyGlowEffect(ctx, config);

        ctx.strokeStyle = config.silhouetteOutlineColor;
        ctx.lineWidth = config.silhouetteOutlineWidth;
        ctx.strokeRect(x, level.priceY, width, 1);

        // Remove glow effect after drawing
        removeGlowEffect(ctx);
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

  // Calculate width-aware maximum bar width
  const maxBarWidth = getMaxBarWidth(contentArea, adrAxisX, config.positioning, config.barMinWidth);

  // Calculate marker position using width-aware approach
  const normalizedWidth = maxValue / data.maxDisplayValue;
  const barWidth = Math.max(config.barMinWidth, normalizedWidth * maxBarWidth);

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

    // Render marker dot with color mode support
    const markerSide = (config.positioning === 'separate') ? (pocLevel.isPositive ? 'right' : 'left') : config.positioning;
    const markerColor = getMarketProfileColor(config, pocLevel, markerSide);
    ctx.fillStyle = markerColor;
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