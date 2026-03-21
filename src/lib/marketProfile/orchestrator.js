// Market Profile Orchestrator - Crystal Clarity Compliant
// Orchestrates Market Profile rendering by delegating to specialized modules
// Maintains backward compatibility with original renderMarketProfile() signature

import { renderStatusMessage, renderErrorMessage } from '../canvasStatusRenderer.js';
import { validateMarketData } from '../dayRangeRenderingUtils.js';
import { calculateAdaptiveScale, createPriceScale, calculateDimensions } from './scaling.js';
import { calculateMaxTpo, calculateTpoScale, computePOC, calculateValueArea } from './calculations.js';
import { drawValueArea, drawBars, drawPOC } from './rendering.js';
import { createDayRangeConfig } from '../dayRangeRenderingUtils.js';
import { getConfig } from '../dayRangeConfig.js';

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
    const dimensions = calculateDimensions(width, height, config);
    const adaptiveScale = calculateAdaptiveScale(data, marketData, width, height);

    const baseConfig = createDayRangeConfig({ marketData }, width, height, getConfig);
    const priceScale = createPriceScale(baseConfig, adaptiveScale, height);

    const maxTpo = calculateMaxTpo(data);
    const tpoScale = calculateTpoScale(maxTpo, dimensions.marketProfileWidth);

    console.log(`[DEBUGGER:orchestrator:34-35] maxTpo=${maxTpo}, marketProfileWidth=${dimensions.marketProfileWidth}, tpoScale=${tpoScale.toFixed(4)}`);
    console.log(`[DEBUGGER:orchestrator:34-35] data.length=${data.length}, sample levels:`, data.slice(0, 3).map(d => ({price: d.price, tpo: d.tpo})));

    const poc = computePOC(data);
    const valueArea = calculateValueArea(data);

    drawValueArea(ctx, valueArea, priceScale, dimensions.marketProfileStartX, dimensions.marketProfileWidth);
    drawBars(ctx, data, priceScale, tpoScale, dimensions.marketProfileStartX);
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
 * @param {Object} size - {width, height, pipPosition}
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

  console.log('[renderMiniMarketProfile] Rendering profile with', profile.length, 'levels, size:', size);
  const ctx = canvas.getContext('2d');
  const { width, height, pipPosition = 4 } = size;
  const dpr = window.devicePixelRatio || 1;

  // Set canvas size accounting for DPR
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  // Calculate price range
  const prices = profile.map(l => l.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  // Calculate TPO range
  const maxTpo = Math.max(...profile.map(l => l.tpo));

  // Background (Chart BG from spec)
  ctx.fillStyle = '#222222';
  ctx.fillRect(0, 0, width, height);

  // Draw profile bars (simplified, no labels)
  const barHeight = Math.max(1, (height - 4) / profile.length); // -4 for padding
  const padding = 2;

  profile.forEach((level, index) => {
    const y = padding + (index * barHeight);
    const barWidth = (level.tpo / maxTpo) * (width - 2); // -2 for right padding

    // Standard Bar color from spec: #00D2FF
    // Use opacity to indicate intensity
    const intensity = level.tpo / maxTpo;
    ctx.fillStyle = `rgba(0, 210, 255, ${0.4 + (intensity * 0.6)})`;

    ctx.fillRect(0, y, barWidth, barHeight - 0.5); // -0.5 for gap
  });

  // Draw POC line (level with highest TPO)
  // POC Bar color from spec: #FFCC00
  const pocLevel = profile.reduce((max, level) =>
    level.tpo > max.tpo ? level : max, profile[0]);

  if (pocLevel) {
    const pocIndex = profile.findIndex(l => l.price === pocLevel.price);
    const pocY = padding + (pocIndex * barHeight);

    ctx.strokeStyle = '#FFCC00';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, pocY);
    ctx.lineTo(width, pocY);
    ctx.stroke();
  }
}

export function renderMarketProfileError(ctx, errorMessage) {
  renderStatusMessage(ctx, `Market Profile Error: ${errorMessage}`);
}
