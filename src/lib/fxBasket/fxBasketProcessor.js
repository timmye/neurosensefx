/**
 * FX Basket Data Processor
 * Routes WebSocket messages to state machine and store
 * All functions <15 lines (Crystal Clarity)
 */

import { setDailyOpen, setCurrentPrice } from './fxBasketStore.js';
import { trackPair, canCalculate, BasketState } from './fxBasketStateMachine.js';
import { updateBaskets } from './fxBasketManager.js';

export function createProcessorCallback(store, stateMachine, onUpdate) {
  return (message) => {
    const pair = message.symbol;

    // Handle symbolDataPackage: store todaysOpen
    if (message.type === 'symbolDataPackage') {
      if (message.todaysOpen) {
        setDailyOpen(store, pair, message.todaysOpen);
        // Log daily open extraction for tests
        const dailyOpenCount = store.baseline.size;
        console.log(`[FX BASKET] Received symbolDataPackage for ${pair}, Daily opens: ${dailyOpenCount}`);
        // Check if we also have current price from previous tick
        const currentPrice = store.current.get(pair);
        if (currentPrice) {
          processPairData(store, stateMachine, onUpdate, pair, message.todaysOpen, currentPrice);
        }
      } else {
        // symbolDataPackage without todaysOpen - log for debugging
        console.log(`[FX BASKET] Received symbolDataPackage for ${pair} (no todaysOpen field)`);
      }
      return;
    }

    // Handle tick: store bid/ask as current price
    if (message.type === 'tick' && (message.bid || message.ask)) {
      const currentPrice = message.bid || message.ask;
      setCurrentPrice(store, pair, currentPrice);
      // Check if we also have todaysOpen from previous symbolDataPackage
      const dailyOpen = store.baseline.get(pair);
      if (dailyOpen) {
        processPairData(store, stateMachine, onUpdate, pair, dailyOpen, currentPrice);
      }
      return;
    }

    // Legacy support: handle messages with both fields in one
    // Also check if tick contains todaysOpen (some backends send it this way)
    const dailyOpen = message.todaysOpen || message.dailyOpen;
    const currentPrice = message.current || message.bid || message.ask;
    if (dailyOpen && currentPrice) {
      const dailyOpenCount = store.baseline.size;
      console.log(`[FX BASKET] Received message with daily open for ${pair}, Daily opens: ${dailyOpenCount}`);
      processPairData(store, stateMachine, onUpdate, pair, dailyOpen, currentPrice);
    }
  };
}

function processPairData(store, stateMachine, onUpdate, pair, dailyOpen, currentPrice) {
  // Only set baseline if not already set (daily open should be set once)
  if (!store.baseline.has(pair)) {
    setDailyOpen(store, pair, dailyOpen);
  }
  setCurrentPrice(store, pair, currentPrice);

  const wasReady = trackPair(stateMachine, pair, dailyOpen, currentPrice);

  // Trigger update during WAITING for progress, READY for baskets
  if (stateMachine.state === BasketState.WAITING) {
    onUpdate({ _state: BasketState.WAITING, _progress: stateMachine.getProgress() });
  } else if (wasReady && canCalculate(stateMachine)) {
    const baskets = updateBaskets(store, stateMachine);
    if (baskets) onUpdate({ ...baskets, _state: BasketState.READY });
  }
}
