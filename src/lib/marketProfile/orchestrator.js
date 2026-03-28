// Market Profile Orchestrator - Crystal Clarity Compliant
// Orchestrates Market Profile rendering by delegating to specialized modules
// Orchestrates rendering pipeline: validate → scale → draw

import { renderStatusMessage, renderErrorMessage } from '../canvasStatusRenderer.js';
import { validateMarketData, createPriceScale } from '../dayRangeRenderingUtils.js';
import { calculateAdaptiveScale, calculateDimensions } from './scaling.js';
import { calculateMaxTpo, calculateTpoScale, computePOC, calculateValueArea } from './calculations.js';
import { drawValueArea, drawBars, drawPOC } from './rendering.js';
import { createDayRangeConfig } from '../dayRangeRenderingUtils.js';
import { getConfig } from '../dayRangeConfig.js';
import { setupCanvas, renderPixelPerfectLine } from '../dayRangeCore.js';

export function renderMarketProfile(ctx, data, config) {
  if (!data || data.length === 0) {
    renderStatusMessage(ctx, "No Market Profile Data", { width: config?.width || 300, height: config?.height || 300 });
    return;
  }

  try {
    const { width, height } = config;

    if (!validateMarketData(config.marketData, ctx, { width, height })) {
      renderStatusMessage(ctx, "No Market Profile Data", { width, height });
      return;
    }

    const marketData = config.marketData || {};
    const dimensions = calculateDimensions(width);
    const adaptiveScale = calculateAdaptiveScale(data, marketData, width, height);

    const baseConfig = createDayRangeConfig({ marketData }, width, height, getConfig);
    const priceScale = createPriceScale(baseConfig, adaptiveScale, height);

    const maxTpo = calculateMaxTpo(data);
    const tpoScale = calculateTpoScale(maxTpo, dimensions.marketProfileWidth);

    const poc = computePOC(data);
    const valueArea = calculateValueArea(data);

    drawValueArea(ctx, valueArea, priceScale, dimensions.marketProfileStartX, dimensions.marketProfileWidth);
    drawBars(ctx, data, priceScale, tpoScale, dimensions.marketProfileStartX, maxTpo);
    drawPOC(ctx, poc, priceScale, dimensions.marketProfileStartX, width);

  } catch (error) {
    console.error('[MARKET_PROFILE] Rendering error:', error);
    renderErrorMessage(ctx, `MARKET_PROFILE_ERROR: ${error.message}`, { width: config.width, height: config.height });
  }
}

/**
 * Render mini market profile for Price Ticker component.
 * Simplified rendering optimized for 37.5px width, 60px height (1:1.6 aspect ratio).
 *
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 * @param {Array} profile - Market profile data [{price, tpo}, ...]
 * @param {Object} size - {width, height, pipPosition, currentPrice}
 */
export function renderMiniMarketProfile(canvas, profile, size) {
  if (!canvas) {
    console.warn('[renderMiniMarketProfile] No canvas element provided');
    return;
  }
  if (!profile) {
    console.warn('[renderMiniMarketProfile] No profile data provided');
    return;
  }
  if (profile.length === 0) {
    console.warn('[renderMiniMarketProfile] Profile has 0 levels');
    return;
  }

  const { width, height, pipPosition = 4, currentPrice, openPrice } = size;

  // DPR-aware canvas setup
  const ctx = setupCanvas(canvas, width, height);
  const dpr = window.devicePixelRatio || 1;

  // Calculate price range and create proper price scale
  const prices = profile.map(l => l.price);
  const minPrice = prices.reduce((min, p) => p < min ? p : min, Infinity);
  const maxPrice = prices.reduce((max, p) => p > max ? p : max, -Infinity);
  const priceRange = maxPrice - minPrice || 1;

  // Create adaptive scale for proper price-to-Y mapping
  const adaptiveScale = {
    min: minPrice,
    max: maxPrice,
    range: priceRange,
    isProgressive: false
  };

  // Custom price scale for mini profile - NO padding, bars extend to edges
  // Maps maxPrice → 0 (top), minPrice → height-1 (just above bottom border)
  const priceScale = (price) => {
    const normalized = (maxPrice - price) / priceRange;
    return Math.round(normalized * (height - 1));
  };

  // Calculate TPO range
  const maxTpo = profile.reduce((max, l) => l.tpo > max ? l.tpo : max, 0);

  // Background (Chart BG)
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width, height);

  // Top and bottom border lines (match ticker border style)
  ctx.save();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  renderPixelPerfectLine(ctx, 0, 0, width, 0);           // Top border
  renderPixelPerfectLine(ctx, 0, height - 1, width, height - 1);  // Bottom border
  ctx.restore();

  // Draw profile bars using proper price scale
  const padding = 2;
  const gap = 1 / dpr; // DPR-aware gap

  profile.forEach((level) => {
    // Use price scale for proper Y coordinate
    const y = Math.round(priceScale(level.price));
    const barWidth = (level.tpo / maxTpo) * (width - 2); // -2 for right padding

    // Standard Bar color from spec: #00D2FF
    // Use opacity to indicate intensity
    const intensity = level.tpo / maxTpo;
    ctx.fillStyle = `rgba(0, 210, 255, ${0.2 + (intensity * 0.4)})`;

    // Calculate bar height based on price scale
    const nextPriceY = Math.round(priceScale(level.price + (adaptiveScale.range / profile.length)));
    const barHeight = Math.max(1, Math.abs(nextPriceY - y) - gap);

    ctx.fillRect(0, y, barWidth, barHeight);
  });

  // Draw current price marker (clamp to visible range if price exceeds profile bounds)
  if (currentPrice != null) {
    // Clamp price to visible range for rendering
    const clampedPrice = Math.max(minPrice, Math.min(maxPrice, currentPrice));
    const currentY = Math.round(priceScale(clampedPrice));

    // Neon orange line for current price (most visible)
    ctx.save();
    ctx.strokeStyle = '#FF6600';
    ctx.lineWidth = 1.5;
    renderPixelPerfectLine(ctx, 0, currentY, width - 4, currentY);
    ctx.restore();

    // Accent dot on right edge (pixel-aligned, offset for visibility)
    ctx.fillStyle = '#FF6600';
    ctx.beginPath();
    ctx.arc(Math.round(width - 4), currentY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw open price marker (separate from current price to always render)
  const openY = (openPrice != null && openPrice >= minPrice && openPrice <= maxPrice)
    ? Math.round(priceScale(openPrice))
    : Math.round(height / 2);
  ctx.fillStyle = '#FF6600';
  ctx.beginPath();
  ctx.arc(2, openY, 2, 0, Math.PI * 2);
  ctx.fill();
}

