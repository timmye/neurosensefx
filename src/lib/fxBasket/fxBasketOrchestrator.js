// FX Basket Orchestrator - Crystal Clarity Compliant
// Main coordination for state-based rendering
// All functions <15 lines

import { BasketState } from './fxBasketStateMachine.js';
import { renderBaseline, renderBasketMarker, renderBasketLabel, renderWaitingState, renderErrorState } from './fxBasketElements.js';
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
      renderErrorState(ctx, baskets._missingPairs, config, dimensions);
      break;
    default:
      renderStatusMessage(ctx, 'Waiting for FX data...', dimensions);
  }
}

function renderReadyState(ctx, baskets, config, dimensions) {
  const { width, height } = dimensions;
  const verticalPadding = config.positioning.verticalPadding;
  const renderHeight = height - (verticalPadding * 2);

  const basketValues = Object.values(baskets)
    .filter(b => b.currency && b.currency !== '_state' && b.currency !== '_progress');

  const normalizedValues = basketValues.map(b => b.normalized);
  const minVal = Math.min(...normalizedValues);
  const maxVal = Math.max(...normalizedValues);

  const { rangeMin, rangeMax } = calculateRange(minVal, maxVal);
  const baselineY = verticalPadding + renderHeight / 2;

  renderBaseline(ctx, baselineY, width, config);

  basketValues.forEach(basket => {
    const y = mapValueToY(basket.normalized, renderHeight, rangeMin, rangeMax, verticalPadding);
    renderBasketMarker(ctx, basket, y, width, config);
    renderBasketLabel(ctx, basket, y, width, config);
  });
}

function calculateRange(minVal, maxVal) {
  const centerValue = 100;
  const maxUpward = Math.max(maxVal - centerValue, 0);
  const maxDownward = Math.max(centerValue - minVal, 0);
  const maxMovement = Math.max(maxUpward, maxDownward);

  const rangeExpansion = maxMovement <= 0.01 ? 0.02 : maxMovement * 1.1;
  return { rangeMin: centerValue - rangeExpansion, rangeMax: centerValue + rangeExpansion };
}

function mapValueToY(value, renderHeight, min, max, verticalPadding) {
  const range = max - min;
  const position = (value - min) / range;
  return verticalPadding + renderHeight - (position * renderHeight);
}
