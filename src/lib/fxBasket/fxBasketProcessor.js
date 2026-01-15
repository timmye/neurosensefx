/**
 * FX Basket Data Processor
 * Routes WebSocket messages to state machine and store
 * Uses generic message coordinator for dual-message coordination
 * Crystal Clarity: <120 lines, <15 line functions
 */

import { setDailyOpen, setCurrentPrice } from './fxBasketStore.js';
import { trackPair, canCalculate, BasketState } from './fxBasketStateMachine.js';
import { updateBaskets } from './fxBasketManager.js';

export function createProcessorCallback(store, stateMachine, onUpdate) {
  let symbolDataPackageCount = 0;
  const uniquePairs = new Set();

  return (message) => {
    const pair = message.symbol;

    // Handle error messages from backend
    if (message.type === 'error') {
      console.error(`[FX BASKET] Backend error for ${pair}: ${message.message}`);
      return;
    }

    if (message.type === 'symbolDataPackage') {
      symbolDataPackageCount++;
      uniquePairs.add(pair);
      console.log(`[FX BASKET] symbolDataPackage #${symbolDataPackageCount}, unique pairs: ${uniquePairs.size}, pair: ${pair}`);
      handleDataPackage(store, stateMachine, onUpdate, pair, message);
    } else if (message.type === 'tick' && (message.bid || message.ask)) {
      handleTick(store, stateMachine, onUpdate, pair, message);
    } else {
      handleLegacyMessage(store, stateMachine, onUpdate, pair, message);
    }
  };
}

function handleDataPackage(store, stateMachine, onUpdate, pair, message) {
  console.log(`[FX BASKET DEBUG] symbolDataPackage arrived for ${pair}`);

  if (!message.todaysOpen) {
    console.log(`[FX BASKET] Received symbolDataPackage for ${pair} (no todaysOpen)`);
    return;
  }

  setDailyOpen(store, pair, message.todaysOpen);

  // Use current price from tick, symbolDataPackage, or fall back to todaysOpen
  const currentPrice = message.current || message.bid || message.ask ||
                       store.current.get(pair) || message.todaysOpen;

  setCurrentPrice(store, pair, currentPrice);

  console.log(`[FX BASKET DEBUG] Calling processPairData for ${pair}, currentPrice: ${currentPrice}`);

  processPairData(store, stateMachine, onUpdate, pair, message.todaysOpen, currentPrice);

  console.log(`[FX BASKET] Received symbolDataPackage for ${pair}, Daily opens: ${store.baseline.size}, State machine pairs: ${stateMachine.receivedPairs.size}`);
}

function handleTick(store, stateMachine, onUpdate, pair, message) {
  const currentPrice = message.bid || message.ask;
  setCurrentPrice(store, pair, currentPrice);
  const dailyOpen = store.baseline.get(pair);
  if (dailyOpen) processPairData(store, stateMachine, onUpdate, pair, dailyOpen, currentPrice);
}

function processPairData(store, stateMachine, onUpdate, pair, dailyOpen, currentPrice) {
  if (!store.baseline.has(pair)) setDailyOpen(store, pair, dailyOpen);
  setCurrentPrice(store, pair, currentPrice);

  const wasReady = trackPair(stateMachine, pair, dailyOpen, currentPrice);

  if (stateMachine.state === BasketState.WAITING) {
    onUpdate({ _state: BasketState.WAITING, _progress: stateMachine.getProgress() });
  } else if (wasReady && canCalculate(stateMachine)) {
    const baskets = updateBaskets(store, stateMachine);
    if (baskets) onUpdate({ ...baskets, _state: BasketState.READY });
  }
}

function handleLegacyMessage(store, stateMachine, onUpdate, pair, message) {
  const dailyOpen = message.todaysOpen || message.dailyOpen;
  const currentPrice = message.current || message.bid || message.ask;
  if (dailyOpen && currentPrice) {
    processPairData(store, stateMachine, onUpdate, pair, dailyOpen, currentPrice);
  }
}
