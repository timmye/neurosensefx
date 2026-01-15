/**
 * FX Basket Data Store
 * Single source of truth for basket data
 * All functions <15 lines (Crystal Clarity)
 */

export function createStore() {
  return {
    baseline: new Map(),
    current: new Map(),
    pairs: new Set()
  };
}

export function setDailyOpen(store, pair, price) {
  store.baseline.set(pair, price);
  store.pairs.add(pair);
}

export function setCurrentPrice(store, pair, price) {
  store.current.set(pair, price);
  store.pairs.add(pair);
}

export function getPriceMap(store, type) {
  if (type === 'baseline') {
    return store.baseline;
  }
  if (type === 'current') {
    return store.current;
  }
  throw new Error(`Invalid price map type: ${type}`);
}

export function hasPairData(store, pair) {
  return store.baseline.has(pair) && store.current.has(pair);
}
