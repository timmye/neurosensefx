// Market Profile Renderer - Crystal Clarity Compliant
// Framework-first: Canvas 2D API with DPR-aware rendering

import { renderStatusMessage, renderErrorMessage } from './canvasStatusRenderer.js';
import { calculatePointOfControl, calculateValueArea } from './marketProfileProcessor.js';
import { calculateAdaptiveScale } from './dayRangeCalculations.js';

export function renderMarketProfile(ctx, data, config) {
  console.log('[MARKET_PROFILE RENDER] Starting render - Data length:', data?.length, 'Config:', config);

  if (!data || data.length === 0) {
    console.log('[MARKET_PROFILE RENDER] No data available - Rendering status message');
    renderStatusMessage(ctx, "No Market Profile Data");
    return;
  }

  try {
    const { width, height } = config;
    const dpr = window.devicePixelRatio || 1;
    console.log('[MARKET_PROFILE RENDER] Canvas setup - Width:', width, 'Height:', height, 'DPR:', dpr);

    // Setup canvas for DPR
    const canvas = ctx.canvas;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const padding = 40;
    const profileWidth = width - (padding * 2);
    const profileHeight = height - (padding * 2);

    // Get market data reference for ADR values (assuming it's available in the display state)
    // This should be passed from the parent component
    const marketData = config.marketData || {};

    // Calculate scaling using Day Range Meter's approach
    let priceScale;
    if (marketData.adrHigh && marketData.adrLow && marketData.current) {
      // Use Day Range Meter's ADR-based scaling if market data is available
      const adaptiveScaleConfig = {
        scaling: {
          maxAdrPercentage: 0.5, // Default 50% ADR
          progressiveDisclosure: true
        }
      };

      const adaptiveScale = calculateAdaptiveScale(marketData, adaptiveScaleConfig);
      const { min: scaleMin, max: scaleMax } = adaptiveScale;
      const scaleRange = scaleMax - scaleMin;

      console.log('[MARKET_PROFILE RENDER] Using ADR-based scaling - Min:', scaleMin, 'Max:', scaleMax, 'Range:', scaleRange);

      priceScale = scaleRange > 0 ? profileHeight / scaleRange : 1;

      // Store adaptive scale for use in coordinate calculations
      config.adaptiveScale = adaptiveScale;
    } else {
      // Fallback to simple min/max scaling if no market data
      const prices = data.map(d => d.price);
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      const priceRange = maxPrice - minPrice;

      console.log('[MARKET_PROFILE RENDER] Using simple min/max scaling - Min:', minPrice, 'Max:', maxPrice, 'Range:', priceRange);

      priceScale = priceRange > 0 ? profileHeight / priceRange : 1;

      // Store simple scale for consistency
      config.adaptiveScale = { min: minPrice, max: maxPrice, range: priceRange };
    }

    const maxTpo = Math.max(...data.map(d => d.tpo));
    const tpoScale = maxTpo > 0 ? profileWidth / maxTpo : 1;

    // Calculate profile metrics
    console.log('[MARKET_PROFILE RENDER] Calculating profile metrics...');
    const poc = calculatePointOfControl(data);
    const valueArea = calculateValueArea(data);
    console.log('[MARKET_PROFILE RENDER] POC:', poc, 'ValueArea:', valueArea);

    // Helper function to convert price to Y coordinate using the adaptive scale
    const priceToY = (price) => {
      const { min, max, range } = config.adaptiveScale;
      const normalized = (max - price) / range;
      return padding + (normalized * profileHeight);
    };

    // Render value area background
    if (valueArea.high && valueArea.low) {
      console.log('[MARKET_PROFILE RENDER] Rendering value area background');
      ctx.fillStyle = 'rgba(74, 158, 255, 0.1)';
      const vaY = priceToY(valueArea.high);
      const vaHeight = priceToY(valueArea.low) - priceToY(valueArea.high);
      ctx.fillRect(padding, vaY, profileWidth, vaHeight);
    }

    // Render profile bars
    console.log('[MARKET_PROFILE RENDER] Rendering', data.length, 'profile bars');
    data.forEach((level, index) => {
      const x = padding;
      const y = priceToY(level.price);
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

      ctx.fillRect(x, y, barWidth, 2);

      if (index < 5) { // Log first 5 bars for debugging
        console.log('[MARKET_PROFILE RENDER] Bar', index, '- Price:', level.price, 'TPO:', level.tpo, 'Width:', barWidth, 'Y:', y);
      }
    });

    // Render POC line
    if (poc) {
      console.log('[MARKET_PROFILE RENDER] Rendering POC line at price:', poc.price);
      const pocY = priceToY(poc.price);
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(padding, pocY);
      ctx.lineTo(width - padding, pocY);
      ctx.stroke();
      ctx.setLineDash([]);

      // POC label
      ctx.fillStyle = '#4a9eff';
      ctx.font = '10px monospace';
      ctx.fillText(`POC ${poc.price.toFixed(5)}`, width - padding - 80, pocY + 3);
    }

    // Render price labels for key levels
    console.log('[MARKET_PROFILE RENDER] Rendering price labels');
    ctx.fillStyle = '#fff';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';

    data.forEach(level => {
      const intensity = level.tpo / maxTpo;
      if (intensity > 0.7) {
        const y = priceToY(level.price);
        ctx.fillText(level.price.toFixed(5), padding - 5, y + 3);
      }
    });

    ctx.textAlign = 'left';

    // Render value area range
    if (valueArea.high && valueArea.low) {
      console.log('[MARKET_PROFILE RENDER] Rendering value area range');
      ctx.fillStyle = '#4a9eff';
      ctx.font = '10px monospace';
      ctx.fillText(
        `VA: ${valueArea.low.toFixed(5)} - ${valueArea.high.toFixed(5)}`,
        padding,
        height - 10
      );
    }

    console.log('[MARKET_PROFILE RENDER] Render completed successfully');
  } catch (error) {
    console.error('[MARKET_PROFILE RENDER] Error during rendering:', error);
    console.error('[MARKET_PROFILE RENDER] Error stack:', error.stack);
    renderErrorMessage(ctx, `MARKET_PROFILE_RENDER_ERROR: ${error.message}`, { width: config.width, height: config.height });
  }
}

export function renderMarketProfileError(ctx, errorMessage) {
  renderStatusMessage(ctx, `Market Profile Error: ${errorMessage}`);
}