// Market Profile Orchestrator - Crystal Clarity Compliant
// Orchestrates Market Profile rendering by delegating to specialized modules
// Orchestrates rendering pipeline: validate → scale → draw

import { renderStatusMessage, renderErrorMessage } from '../canvasStatusRenderer.js';
import { validateMarketData, createPriceScale } from '../dayRangeRenderingUtils.js';
import { calculateAdaptiveScale, calculateDimensions, createMiniPriceScale } from './scaling.js';
import { calculateMaxTpo, calculateTpoScale, computePOC, calculateValueArea } from './calculations.js';
import {
  drawValueArea, drawBars, drawPOC,
  drawMiniBars, drawMiniCurrentPrice, drawMiniOpenPrice, drawMiniTwapPrice,
} from './rendering.js';
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
 * @param {Object} size - {width, height, pipPosition, currentPrice, openPrice, highPrice, lowPrice}
 */
export function renderMiniMarketProfile(canvas, profile, size) {
  if (!canvas || !profile || profile.length === 0) return;

  const { width, height, currentPrice, openPrice, twapPrice, highPrice, lowPrice } = size;

  const ctx = setupCanvas(canvas, width, height);
  const dpr = window.devicePixelRatio || 1;

  // Price range: tick data as source of truth, profile as fallback
  const prices = profile.map(l => l.price);
  const profileMin = prices.reduce((min, p) => p < min ? p : min, Infinity);
  const profileMax = prices.reduce((max, p) => p > max ? p : max, -Infinity);
  const minPrice = lowPrice != null ? lowPrice : profileMin;
  const maxPrice = highPrice != null ? highPrice : profileMax;

  const priceScale = createMiniPriceScale(minPrice, maxPrice, height);

  // Background
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, width, height);

  // Borders
  ctx.save();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  renderPixelPerfectLine(ctx, 0, 0, width, 0);
  renderPixelPerfectLine(ctx, 0, height - 1, width, height - 1);
  ctx.restore();

  // Profile bars, price markers
  const maxTpo = profile.reduce((max, l) => l.tpo > max ? l.tpo : max, 0);
  drawMiniBars(ctx, profile, priceScale, maxTpo, width, height, dpr);
  drawMiniCurrentPrice(ctx, priceScale, currentPrice, minPrice, maxPrice, width);
  drawMiniOpenPrice(ctx, priceScale, openPrice, minPrice, maxPrice, height);
  drawMiniTwapPrice(ctx, priceScale, twapPrice, minPrice, maxPrice);
}

