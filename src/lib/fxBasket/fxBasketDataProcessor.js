// FX Basket Data Processor - Crystal Clarity Compliant
// Processes WebSocket data messages for FX basket updates

import { updatePrice, updateAllBaskets, initializeBaselinesFromDailyOpens } from './fxBasketData.js';

// Create data callback handler for WebSocket messages
export function createDataCallback(basketState, fxPairs, subscriptionsReady, canvasRef) {
  return (data) => {
    if (!subscriptionsReady() && data.type !== 'symbolDataPackage') return;

    try {
      if (data.type === 'tick' && fxPairs.includes(data.symbol)) {
        updatePrice(data.symbol, data.bid || data.price, basketState, false);
      } else if (data.type === 'symbolDataPackage') {
        const pair = data.symbol;
        const dailyOpen = data.todaysOpen || data.open || data.initialPrice;
        const currentPrice = data.current || data.bid || data.ask;

        if (pair && fxPairs.includes(pair)) {
          if (dailyOpen) {
            updatePrice(pair, dailyOpen, basketState, true);
            console.log('[FX BASKET] Daily open extracted:', pair, '->', dailyOpen);
          }
          if (currentPrice) {
            updatePrice(pair, currentPrice, basketState, false);
          }
          initializeBaselinesFromDailyOpens(basketState);
        }
      }
      updateAllBaskets(basketState);
      if (canvasRef?.renderFxBasket) {
        canvasRef.renderFxBasket(basketState.baskets);
      }
    } catch (error) {
      console.error('[FX BASKET] Error in dataCallback:', error);
      canvasRef?.renderError(`FX_BASKET_ERROR: ${error.message}`);
    }
  };
}
