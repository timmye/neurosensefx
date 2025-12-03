// Market Profile Renderer - Crystal Clarity Compliant
// Framework-first: Canvas 2D API with DPR-aware rendering
// Uses EXACT same rendering methods as Day Range Meter for 100% compliance

import { renderStatusMessage, renderErrorMessage } from './canvasStatusRenderer.js';
import { calculatePointOfControl, calculateValueArea } from './marketProfileProcessor.js';
import { calculateAdaptiveScale } from './dayRangeCalculations.js';
import { createPriceScale } from './priceScale.js';
import { setupCanvas, renderPixelPerfectLine, setupTextRendering } from './dayRangeCore.js';
import { renderBackground } from './dayRangeRenderingUtils.js';
import { createDayRangeConfig, validateMarketData } from './dayRangeRenderingUtils.js';
import { getConfig } from './dayRangeConfig.js';

export function renderMarketProfile(ctx, data, config) {
  console.log('[DEBUGGER:MARKET_PROFILE_RENDERER:15] renderMarketProfile called');
  console.log('[DEBUGGER:MARKET_PROFILE_RENDERER:16] Data length:', data?.length);
  console.log('[DEBUGGER:MARKET_PROFILE_RENDERER:17] Config:', config);

  if (!data || data.length === 0) {
    console.log('[DEBUGGER:MARKET_PROFILE_RENDERER:19] No data - rendering status message');
    renderStatusMessage(ctx, "No Market Profile Data");
    return;
  }

  console.log('[DEBUGGER:MARKET_PROFILE_RENDERER:24] Starting Market Profile rendering');

  try {
    const { width, height } = config;

    // Use Day Range Meter standard validation (includes marketData checking)
    if (!validateMarketData(config.marketData, ctx, { width, height })) {
      renderStatusMessage(ctx, "No Market Profile Data");
      return;
    }

    // NOTE: No background rendering - market profile is overlay on day range meter
    // Background handled by day range meter base layer

    // Get market data reference for ADR values (must be passed from parent component)
    const marketData = config.marketData || {};

    // Create base Day Range Meter configuration first for padding access
    // CRITICAL FIX: Use EXACT same padding as Day Range Meter (padding: 0) for Y-coordinate parity
    const baseDayRangeConfig = createDayRangeConfig({
      marketData: marketData
    }, width, height, getConfig);

    // Use Day Range Meter standard padding configuration (both now use padding: 0)
    const positioning = baseDayRangeConfig.positioning;
    const padding = positioning.padding;

    // Calculate ADR axis position for market profile extending RIGHT from ADR axis
    const adrAxisX = width * 0.75; // ADR axis at 75% from left
    const marketProfileStartX = adrAxisX; // Start from ADR axis, extend right
    const marketProfileWidth = width - adrAxisX; // Right side space only (25% of canvas)
    const profileHeight = height - (padding * 2);

    // Use EXACT same scaling system as Day Range Meter for trader accuracy
    let adaptiveScale, priceScale;

    if (marketData.adrHigh && marketData.adrLow && marketData.current) {
      // Use Day Range Meter's ADR-based scaling (exact same calculations)
      const adaptiveScaleConfig = {
        scaling: {
          maxAdrPercentage: 0.5, // Default 50% ADR
          progressiveDisclosure: true
        }
      };

      adaptiveScale = calculateAdaptiveScale(marketData, adaptiveScaleConfig);

      // Use EXACT same Day Range Meter price scaling function
      // (baseDayRangeConfig already created above with correct marketData)
      priceScale = createPriceScale(baseDayRangeConfig, adaptiveScale, height);
    } else {
      // Fallback: create synthetic adaptive scale from market profile data only
      const prices = data.map(d => d.price);
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);

      // Create adaptive scale object for consistency
      adaptiveScale = {
        min: minPrice,
        max: maxPrice,
        range: maxPrice - minPrice,
        isProgressive: false
      };

      // Update baseDayRangeConfig with synthetic market data for fallback
      baseDayRangeConfig.marketData = {
        high: maxPrice,
        low: minPrice,
        current: (maxPrice + minPrice) / 2
      };
      priceScale = createPriceScale(baseDayRangeConfig, adaptiveScale, height);
    }

    const maxTpo = Math.max(...data.map(d => d.tpo));
    const tpoScale = maxTpo > 0 ? marketProfileWidth / maxTpo : 1;

    // Calculate profile metrics
    const poc = calculatePointOfControl(data);
    const valueArea = calculateValueArea(data);

    // Render value area background
    if (valueArea.high && valueArea.low) {
      console.log('[DEBUGGER:MARKET_PROFILE_RENDERER:99] Rendering value area background');
      ctx.fillStyle = 'rgba(74, 158, 255, 0.1)';
      const vaY = priceScale(valueArea.high);
      const vaHeight = priceScale(valueArea.low) - priceScale(valueArea.high);
      console.log('[DEBUGGER:MARKET_PROFILE_RENDERER:103] Value area rect:', marketProfileStartX, vaY, marketProfileWidth, vaHeight);
      ctx.fillRect(marketProfileStartX, vaY, marketProfileWidth, vaHeight);
    }

    console.log('[DEBUGGER:MARKET_PROFILE_RENDERER:107] Rendering profile bars - data length:', data.length);
    // Render profile bars
    data.forEach((level, index) => {
      const x = marketProfileStartX; // Start from ADR axis, extend right
      const y = priceScale(level.price);
      const barWidth = Math.max(level.tpo * tpoScale, 1);

      // Color based on TPO intensity
      const intensity = level.tpo / maxTpo;
      if (intensity > 0.8) {
        ctx.fillStyle = '#4a9eff';
      } else if (intensity > 0.6) {
        ctx.fillStyle = '#66b3ff';
      } else {
        ctx.fillStyle = '#666';
      }

      if (index < 5) { // Only log first 5 bars to avoid spam
        console.log('[DEBUGGER:MARKET_PROFILE_RENDERER:121] Rendering bar', index, 'at', x, y, 'width', barWidth, 'color', ctx.fillStyle);
      }
      ctx.fillRect(x, y, barWidth, 2);
    });

    // Render POC line using Day Range Meter pixel-perfect rendering
    if (poc) {
      const pocY = priceScale(poc.price);
      renderPixelPerfectLine(ctx, marketProfileStartX, pocY, width, pocY, {
        color: '#4a9eff',
        width: 2,
        dashPattern: [5, 3]
      });

      // // POC label using Day Range Meter standard text rendering
      // setupTextRendering(ctx, { font: '10px monospace', fill: '#4a9eff' });
      // ctx.fillText(`POC ${poc.price.toFixed(5)}`, marketProfileStartX + 10, pocY + 3);
    }

    // Render price labels for key levels using Day Range Meter standard text rendering
    // setupTextRendering(ctx, { font: '9px monospace', fill: '#fff', textAlign: 'right' });

    // data.forEach(level => {
    //   const intensity = level.tpo / maxTpo;
    //   if (intensity > 0.7) {
    //     const y = priceScale(level.price);
    //     // Position price labels relative to ADR axis (left of market profile)
    //     ctx.fillText(level.price.toFixed(5), adrAxisX - 5, y + 3);
    //   }
    // });

    // ctx.textAlign = 'left';

    // Render value area range using Day Range Meter standard text rendering
    // if (valueArea.high && valueArea.low) {
    //   setupTextRendering(ctx, { font: '10px monospace', fill: '#4a9eff', textAlign: 'left' });
    //   ctx.fillText(
    //     `VA: ${valueArea.low.toFixed(5)} - ${valueArea.high.toFixed(5)}`,
    //     marketProfileStartX + 10,
    //     height - 10
    //   );
    // }
  } catch (error) {
    console.error('[MARKET_PROFILE RENDER] Error during rendering:', error);
    renderErrorMessage(ctx, `MARKET_PROFILE_RENDER_ERROR: ${error.message}`, { width: config.width, height: config.height });
  }
}

export function renderMarketProfileError(ctx, errorMessage) {
  renderStatusMessage(ctx, `Market Profile Error: ${errorMessage}`);
}