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

/**
 * Pure computation step for Market Profile rendering.
 * @param {Array} data - Market profile data [{price, tpo}, ...]
 * @param {Object} config - {width, height, marketData}
 * @returns {Object} All computed values needed for drawing
 */
export function computeMarketProfile(data, config) {
  const { width, height } = config;
  const marketData = config.marketData || {};
  const dimensions = calculateDimensions(width);
  const adaptiveScale = calculateAdaptiveScale(data, marketData, width, height);
  const baseConfig = createDayRangeConfig({ marketData }, width, height, getConfig);
  const priceScale = createPriceScale(baseConfig, adaptiveScale, height);
  const maxTpo = calculateMaxTpo(data);
  const tpoScale = calculateTpoScale(maxTpo, dimensions.marketProfileWidth);
  const poc = computePOC(data);
  const valueArea = calculateValueArea(data);
  return { dimensions, adaptiveScale, priceScale, maxTpo, tpoScale, poc, valueArea, width, height };
}

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

    const computed = computeMarketProfile(data, config);

    drawValueArea(ctx, computed.valueArea, computed.priceScale, computed.dimensions.marketProfileStartX, computed.dimensions.marketProfileWidth);
    drawBars(ctx, data, computed.priceScale, computed.tpoScale, computed.dimensions.marketProfileStartX, computed.maxTpo);
    drawPOC(ctx, computed.poc, computed.priceScale, computed.dimensions.marketProfileStartX, width);

  } catch (error) {
    console.error('[MARKET_PROFILE] Rendering error:', error);
    renderErrorMessage(ctx, `MARKET_PROFILE_ERROR: ${error.message}`, { width: config.width, height: config.height });
  }
}

/**
 * Pure computation step for Mini Market Profile rendering.
 * @param {Array} profile - Market profile data [{price, tpo}, ...]
 * @param {Object} size - {width, height, currentPrice, openPrice, twapPrice, highPrice, lowPrice}
 * @returns {Object} All computed values needed for drawing
 */
export function computeMiniMarketProfile(profile, size) {
  const { width, height, currentPrice, openPrice, twapPrice, highPrice, lowPrice } = size;
  const prices = profile.map(l => l.price);
  const profileMin = prices.reduce((min, p) => p < min ? p : min, Infinity);
  const profileMax = prices.reduce((max, p) => p > max ? p : max, -Infinity);
  const minPrice = lowPrice != null ? lowPrice : profileMin;
  const maxPrice = highPrice != null ? highPrice : profileMax;
  const priceScale = createMiniPriceScale(minPrice, maxPrice, height);
  const maxTpo = profile.reduce((max, l) => l.tpo > max ? l.tpo : max, 0);
  return { priceScale, maxTpo, minPrice, maxPrice, width, height };
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

  const ctx = setupCanvas(canvas, size.width, size.height);
  const dpr = window.devicePixelRatio || 1;

  const computed = computeMiniMarketProfile(profile, size);

  // Background
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, computed.width, computed.height);

  // Borders
  ctx.save();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  renderPixelPerfectLine(ctx, 0, 0, computed.width, 0);
  renderPixelPerfectLine(ctx, 0, computed.height - 1, computed.width, computed.height - 1);
  ctx.restore();

  // Profile bars, price markers
  drawMiniBars(ctx, profile, computed.priceScale, computed.maxTpo, computed.width, computed.height, dpr);
  drawMiniCurrentPrice(ctx, computed.priceScale, size.currentPrice, computed.minPrice, computed.maxPrice, computed.width);
  drawMiniOpenPrice(ctx, computed.priceScale, size.openPrice, computed.minPrice, computed.maxPrice, computed.height);
  drawMiniTwapPrice(ctx, computed.priceScale, size.twapPrice, computed.minPrice, computed.maxPrice);
}

