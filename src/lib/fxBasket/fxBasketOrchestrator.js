// FX Basket Orchestrator - Crystal Clarity Compliant
// Main coordination for state-based rendering
// All functions <15 lines

import { BasketState } from './fxBasketStateMachine.js';
import { renderBaseline, renderBasketMarker, renderBasketLabel, renderWaitingState, renderErrorState, calculateLabelPositions, measureTextHeight } from './fxBasketElements.js';
import { renderStatusMessage } from '../canvasStatusRenderer.js';
import { getConfig } from './fxBasketConfig.js';

export function renderFxBasket(ctx, baskets, config = {}, dimensions) {
  const { width, height } = dimensions;
  const cfg = getConfig(config);
  ctx.clearRect(0, 0, width, height);

  const state = baskets._state || BasketState.FAILED;
  renderByState(ctx, state, baskets, cfg, dimensions);
}

function renderByState(ctx, state, baskets, config, dimensions) {
  switch (state) {
    case BasketState.WAITING:
      renderWaitingState(ctx, baskets._progress, config, dimensions);
      break;
    case BasketState.READY:
      renderReadyState(ctx, baskets, config, dimensions);
      break;
    case BasketState.ERROR:
      renderErrorState(ctx, baskets._missingPairs, baskets._failedPairs, baskets._totalPairs, config, dimensions);
      break;
    default:
      renderStatusMessage(ctx, 'Waiting for FX data...', dimensions);
  }
}

/**
 * Pure computation step for FX Basket rendering.
 * Extracts basket positions and range without canvas dependency.
 * @param {Object} baskets - Basket data with _state, currencies as keys
 * @param {Object} dimensions - {width, height}
 * @param {Object} config - Visual config (optional)
 * @returns {Object} Layout data for drawing
 */
export function computeFxBasketLayout(baskets, dimensions, config = {}) {
  const cfg = getConfig(config);
  const { width, height } = dimensions;
  const verticalPadding = cfg.positioning.verticalPadding;
  const renderHeight = height - (verticalPadding * 2);

  const basketValues = Object.values(baskets)
    .filter(b => b.currency && b.currency !== '_state' && b.currency !== '_progress');

  if (basketValues.length === 0) {
    return { basketValues: [], rangeMin: 99.98, rangeMax: 100.02, baselineY: height / 2, dimensions, renderHeight };
  }

  const normalizedValues = basketValues.map(b => b.normalized);
  const minVal = Math.min(...normalizedValues);
  const maxVal = Math.max(...normalizedValues);
  const { rangeMin, rangeMax } = calculateRange(minVal, maxVal);
  const baselineY = verticalPadding + renderHeight / 2;

  const basketPositions = basketValues.map(basket => ({
    y: mapValueToY(basket.normalized, renderHeight, rangeMin, rangeMax, verticalPadding),
    basket
  }));

  return { basketValues, basketPositions, rangeMin, rangeMax, baselineY, dimensions, renderHeight, width, height };
}

function renderReadyState(ctx, baskets, config, dimensions) {
  const layout = computeFxBasketLayout(baskets, dimensions, config);
  const { width, baselineY, basketPositions } = layout;

  renderBaseline(ctx, baselineY, width, config);

  // Measure actual text height for collision detection
  const textHeight = measureTextHeight(ctx, config);

  // Calculate label positions to avoid collisions
  const labelPositions = calculateLabelPositions(basketPositions, textHeight);

  basketPositions.forEach((bp, i) => {
    renderBasketMarker(ctx, bp.basket, bp.y, width, config);
    renderBasketLabel(ctx, bp.basket, bp.y, width, config, labelPositions[i]);
  });
}

export function calculateRange(minVal, maxVal) {
  const centerValue = 100;
  const maxUpward = Math.max(maxVal - centerValue, 0);
  const maxDownward = Math.max(centerValue - minVal, 0);
  const maxMovement = Math.max(maxUpward, maxDownward);

  const rangeExpansion = maxMovement <= 0.01 ? 0.02 : maxMovement * 1.1;
  return { rangeMin: centerValue - rangeExpansion, rangeMax: centerValue + rangeExpansion };
}

export function mapValueToY(value, renderHeight, min, max, verticalPadding) {
  const range = max - min;
  const position = (value - min) / range;
  return verticalPadding + renderHeight - (position * renderHeight);
}
