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
    renderStatusMessage(ctx, "No Market Profile Data");
    return;
  }

  try {
    const { width, height } = config;

    if (!validateMarketData(config.marketData, ctx, { width, height })) {
      renderStatusMessage(ctx, "No Market Profile Data");
      return;
    }

    const marketData = config.marketData || {};
    const dimensions = calculateDimensions(width, height, config);
    const adaptiveScale = calculateAdaptiveScale(data, marketData, width, height);

    const baseConfig = createDayRangeConfig({ marketData }, width, height, getConfig);
    const priceScale = createPriceScale(baseConfig, adaptiveScale, height);

    const maxTpo = calculateMaxTpo(data);
    const tpoScale = calculateTpoScale(maxTpo, dimensions.marketProfileWidth);

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

export function renderMarketProfileError(ctx, errorMessage) {
  renderStatusMessage(ctx, `Market Profile Error: ${errorMessage}`);
}
