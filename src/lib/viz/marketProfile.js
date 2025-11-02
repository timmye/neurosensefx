import { scaleLinear } from 'd3-scale';

export function drawMarketProfile(ctx, config, state, y) {
  const {
    visualizationsContentWidth,
    centralAxisXPosition,
    adrAxisXPosition,
    showMarketProfile,
    marketProfileView,
    marketProfileUpColor,
    marketProfileDownColor,
    marketProfileOpacity,
    marketProfileOutline,
    marketProfileOutlineShowStroke,
    marketProfileOutlineStrokeWidth,
    marketProfileOutlineUpColor,
    marketProfileOutlineDownColor,
    marketProfileOutlineOpacity,
    distributionDepthMode,
    distributionPercentage,
    priceBucketMultiplier,
    marketProfileWidthRatio,
    showMaxMarker,
    priceDisplayPadding,
    priceFontSize,
    marketProfileData,
    visualHigh,
    visualLow
  } = config;

  if (!showMarketProfile || !marketProfileData || !Array.isArray(marketProfileData)) return;

  // NEW: Use configurable ADR axis position with fallback to central axis
  const axisX = adrAxisXPosition || centralAxisXPosition;
  
  // Calculate bucket size and total distribution
  const priceRange = visualHigh - visualLow;
  const bucketSize = priceRange * 0.01 * priceBucketMultiplier;
  const buckets = new Map();
  let maxVolume = 0;
  
  // Bucket the price data
  marketProfileData.forEach(point => {
    const price = point.price;
    const volume = point.volume || 1;
    const bucketKey = Math.floor((price - visualLow) / bucketSize);
    
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, { upVolume: 0, downVolume: 0, totalVolume: 0, price: visualLow + bucketKey * bucketSize });
    }
    
    const bucket = buckets.get(bucketKey);
    const direction = point.direction || 'neutral';
    
    if (direction === 'up') {
      bucket.upVolume += volume;
    } else if (direction === 'down') {
      bucket.downVolume += volume;
    }
    
    bucket.totalVolume += volume;
    maxVolume = Math.max(maxVolume, bucket.totalVolume);
  });
  
  // Convert to array for processing
  const bucketArray = Array.from(buckets.values()).sort((a, b) => a.price - b.price);
  
  // Calculate profile dimensions
  const profileWidth = (visualizationsContentWidth * 0.15) * marketProfileWidthRatio;
  const maxBarWidth = profileWidth;
  
  // Filter based on distribution mode
  let filteredBuckets = bucketArray;
  if (distributionDepthMode === 'percentage' && distributionPercentage < 100) {
    const volumeThreshold = maxVolume * (distributionPercentage / 100);
    filteredBuckets = bucketArray.filter(bucket => bucket.totalVolume >= volumeThreshold);
  }
  
  // Draw market profile based on view mode
  ctx.save();
  
  switch (marketProfileView) {
    case 'left':
      drawLeftProfile(ctx, filteredBuckets, axisX, y, maxBarWidth, maxVolume, {
        marketProfileUpColor,
        marketProfileDownColor,
        marketProfileOpacity,
        marketProfileOutline,
        marketProfileOutlineShowStroke,
        marketProfileOutlineStrokeWidth,
        marketProfileOutlineUpColor,
        marketProfileOutlineDownColor,
        marketProfileOutlineOpacity
      });
      break;
      
    case 'right':
      drawRightProfile(ctx, filteredBuckets, axisX, y, maxBarWidth, maxVolume, {
        marketProfileUpColor,
        marketProfileDownColor,
        marketProfileOpacity,
        marketProfileOutline,
        marketProfileOutlineShowStroke,
        marketProfileOutlineStrokeWidth,
        marketProfileOutlineUpColor,
        marketProfileOutlineDownColor,
        marketProfileOutlineOpacity
      });
      break;
      
    case 'combined':
    case 'combinedLeft':
    case 'combinedRight':
    default:
      drawCombinedProfile(ctx, filteredBuckets, axisX, y, maxBarWidth, maxVolume, {
        marketProfileView,
        marketProfileUpColor,
        marketProfileDownColor,
        marketProfileOpacity,
        marketProfileOutline,
        marketProfileOutlineShowStroke,
        marketProfileOutlineStrokeWidth,
        marketProfileOutlineUpColor,
        marketProfileOutlineDownColor,
        marketProfileOutlineOpacity
      });
      break;
  }
  
  // Draw maximum volume marker if enabled
  if (showMaxMarker && filteredBuckets.length > 0) {
    const maxBucket = filteredBuckets.reduce((max, bucket) => 
      bucket.totalVolume > max.totalVolume ? bucket : max
    );
    
    drawMaxVolumeMarker(ctx, maxBucket, axisX, y, maxBarWidth, {
      marketProfileView,
      priceFontSize,
      priceDisplayPadding
    });
  }
  
  ctx.restore();
}

function drawLeftProfile(ctx, buckets, axisX, y, maxBarWidth, maxVolume, colors) {
  buckets.forEach(bucket => {
    const bucketY = y(bucket.price);
    const barWidth = (bucket.totalVolume / maxVolume) * maxBarWidth;
    const upWidth = (bucket.upVolume / maxVolume) * maxBarWidth;
    const downWidth = (bucket.downVolume / maxVolume) * maxBarWidth;
    
    // Draw down volume
    if (downWidth > 0) {
      ctx.fillStyle = hexToRgba(colors.marketProfileDownColor, colors.marketProfileOpacity);
      ctx.fillRect(axisX - downWidth - 2, bucketY - 0.5, downWidth, 1);
    }
    
    // Draw up volume
    if (upWidth > 0) {
      ctx.fillStyle = hexToRgba(colors.marketProfileUpColor, colors.marketProfileOpacity);
      ctx.fillRect(axisX - upWidth - downWidth - 2, bucketY - 0.5, upWidth, 1);
    }
    
    // Draw outline
    if (colors.marketProfileOutline && colors.marketProfileOutlineShowStroke) {
      ctx.strokeStyle = hexToRgba(colors.marketProfileOutlineUpColor, colors.marketProfileOutlineOpacity);
      ctx.lineWidth = colors.marketProfileOutlineStrokeWidth;
      ctx.strokeRect(axisX - barWidth - 2, bucketY - 0.5, barWidth, 1);
    }
  });
}

function drawRightProfile(ctx, buckets, axisX, y, maxBarWidth, maxVolume, colors) {
  buckets.forEach(bucket => {
    const bucketY = y(bucket.price);
    const barWidth = (bucket.totalVolume / maxVolume) * maxBarWidth;
    const upWidth = (bucket.upVolume / maxVolume) * maxBarWidth;
    const downWidth = (bucket.downVolume / maxVolume) * maxBarWidth;
    
    // Draw up volume
    if (upWidth > 0) {
      ctx.fillStyle = hexToRgba(colors.marketProfileUpColor, colors.marketProfileOpacity);
      ctx.fillRect(axisX + 2, bucketY - 0.5, upWidth, 1);
    }
    
    // Draw down volume
    if (downWidth > 0) {
      ctx.fillStyle = hexToRgba(colors.marketProfileDownColor, colors.marketProfileOpacity);
      ctx.fillRect(axisX + upWidth + 2, bucketY - 0.5, downWidth, 1);
    }
    
    // Draw outline
    if (colors.marketProfileOutline && colors.marketProfileOutlineShowStroke) {
      ctx.strokeStyle = hexToRgba(colors.marketProfileOutlineUpColor, colors.marketProfileOutlineOpacity);
      ctx.lineWidth = colors.marketProfileOutlineStrokeWidth;
      ctx.strokeRect(axisX + 2, bucketY - 0.5, barWidth, 1);
    }
  });
}

function drawCombinedProfile(ctx, buckets, axisX, y, maxBarWidth, maxVolume, colors) {
  const { marketProfileView } = colors;
  const isLeft = marketProfileView === 'combinedLeft' || marketProfileView === 'left';
  
  buckets.forEach(bucket => {
    const bucketY = y(bucket.price);
    const barWidth = (bucket.totalVolume / maxVolume) * maxBarWidth;
    const upWidth = (bucket.upVolume / maxVolume) * maxBarWidth;
    const downWidth = (bucket.downVolume / maxVolume) * maxBarWidth;
    
    // Draw left side (down volume)
    if (downWidth > 0) {
      ctx.fillStyle = hexToRgba(colors.marketProfileDownColor, colors.marketProfileOpacity);
      ctx.fillRect(axisX - downWidth - 2, bucketY - 0.5, downWidth, 1);
    }
    
    // Draw right side (up volume)
    if (upWidth > 0) {
      ctx.fillStyle = hexToRgba(colors.marketProfileUpColor, colors.marketProfileOpacity);
      ctx.fillRect(axisX + 2, bucketY - 0.5, upWidth, 1);
    }
    
    // Draw outline
    if (colors.marketProfileOutline && colors.marketProfileOutlineShowStroke) {
      ctx.strokeStyle = hexToRgba(colors.marketProfileOutlineUpColor, colors.marketProfileOutlineOpacity);
      ctx.lineWidth = colors.marketProfileOutlineStrokeWidth;
      
      // Left outline
      if (downWidth > 0) {
        ctx.strokeRect(axisX - downWidth - 2, bucketY - 0.5, downWidth, 1);
      }
      
      // Right outline
      if (upWidth > 0) {
        ctx.strokeRect(axisX + 2, bucketY - 0.5, upWidth, 1);
      }
    }
  });
}

function drawMaxVolumeMarker(ctx, maxBucket, axisX, y, maxBarWidth, options) {
  const { marketProfileView, priceFontSize, priceDisplayPadding } = options;
  const bucketY = y(maxBucket.price);
  
  ctx.save();
  ctx.font = `${priceFontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const volumeText = `${maxBucket.totalVolume.toFixed(0)}`;
  const textMetrics = ctx.measureText(volumeText);
  
  // Position text based on view mode
  let textX;
  if (marketProfileView === 'left' || marketProfileView === 'combinedLeft') {
    textX = axisX - maxBarWidth - textMetrics.width / 2 - priceDisplayPadding - 5;
  } else {
    textX = axisX + maxBarWidth + textMetrics.width / 2 + priceDisplayPadding + 5;
  }
  
  // Draw text background
  const padding = priceDisplayPadding;
  const bgX = textX - textMetrics.width / 2 - padding;
  const bgY = bucketY - priceFontSize / 2 - padding;
  const bgWidth = textMetrics.width + (padding * 2);
  const bgHeight = priceFontSize + (padding * 2);
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
  
  // Draw text
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(volumeText, textX, bucketY);
  
  ctx.restore();
}

function hexToRgba(hex, opacity) {
  if (!hex) return `rgba(0,0,0,${opacity})`;
  
  const finalOpacity = (opacity === undefined || opacity === null) ? 1 : opacity;
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
