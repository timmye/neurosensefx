import { CURRENCIES, BASKET_ZONES } from './fxBasketConfig.js';

let prevChangePercent = {};
let ewmaAbs = {};
let smoothed = { sigma: 0, maxZone: 0, velocity: 0, range: 0 };

const EMPTY_RESULT = {
  sigma: 0,
  maxZone: 0,
  ewmaVelocity: 0,
  range: 0,
  smoothedSigma: 0,
  smoothedMaxZone: 0,
  smoothedVelocity: 0,
  smoothedRange: 0,
  perBasket: {},
  ready: false
};

export function initVolatility(baskets) {
  for (const [currency, data] of Object.entries(baskets)) {
    if (data && data.initialized) {
      prevChangePercent[currency] = data.changePercent || 0;
      ewmaAbs[currency] = 0;
    }
  }
}

export function computeVolatility(baskets) {
  const validEntries = [];
  for (const currency of CURRENCIES) {
    const data = baskets[currency];
    if (data && data.initialized && data.changePercent != null) {
      validEntries.push({ currency, changePercent: data.changePercent });
    }
  }

  if (validEntries.length < 2) {
    return { ...EMPTY_RESULT };
  }

  const n = validEntries.length;

  // Metric A: Max Zone-Normalized Score
  let maxZoneRaw = 0;
  const perBasket = {};
  for (const { currency, changePercent } of validEntries) {
    const zoneScore = Math.abs(changePercent) / BASKET_ZONES[currency].active;
    if (zoneScore > maxZoneRaw) maxZoneRaw = zoneScore;
    perBasket[currency] = {
      vol: Math.min(Math.max(Math.abs(changePercent) / BASKET_ZONES[currency].active / 1.5 * 100, 0), 100),
      direction: changePercent
    };
  }
  const rawMaxZone = Math.min(Math.max(maxZoneRaw / 1.5 * 100, 0), 100);

  // Metric B: Dispersion Sigma
  let sum = 0;
  for (const { changePercent } of validEntries) {
    sum += changePercent;
  }
  const meanCp = sum / n;
  let variance = 0;
  for (const { changePercent } of validEntries) {
    variance += (changePercent - meanCp) ** 2;
  }
  const sigma = Math.sqrt(variance / n);
  const rawSigma = Math.min(Math.max(sigma / 0.40 * 100, 0), 100);

  // Metric C: EWMA Tick-to-Tick Velocity
  let velocitySum = 0;
  let velocityCount = 0;
  for (const { currency, changePercent } of validEntries) {
    const prev = prevChangePercent[currency] ?? changePercent;
    const delta = Math.abs(changePercent - prev);
    ewmaAbs[currency] = 0.97 * (ewmaAbs[currency] || 0) + 0.03 * delta;
    velocitySum += ewmaAbs[currency];
    velocityCount++;
  }
  const velocity = velocityCount > 0 ? velocitySum / velocityCount : 0;
  const rawVelocity = Math.min(Math.max(velocity / 0.05 * 100, 0), 100);

  // Metric D: Range
  let minCp = Infinity;
  let maxCp = -Infinity;
  for (const { changePercent } of validEntries) {
    if (changePercent < minCp) minCp = changePercent;
    if (changePercent > maxCp) maxCp = changePercent;
  }
  const range = maxCp - minCp;
  const rawRange = Math.min(Math.max(range / 1.0 * 100, 0), 100);

  // Update prevChangePercent
  for (const { currency, changePercent } of validEntries) {
    prevChangePercent[currency] = changePercent;
  }

  // Outer EWMA smoothing
  smoothed.sigma = 0.92 * smoothed.sigma + 0.08 * rawSigma;
  smoothed.maxZone = 0.88 * smoothed.maxZone + 0.12 * rawMaxZone;
  smoothed.velocity = 0.90 * smoothed.velocity + 0.10 * rawVelocity;
  smoothed.range = 0.92 * smoothed.range + 0.08 * rawRange;

  return {
    sigma: rawSigma,
    maxZone: rawMaxZone,
    ewmaVelocity: rawVelocity,
    range: rawRange,
    smoothedSigma: smoothed.sigma,
    smoothedMaxZone: smoothed.maxZone,
    smoothedVelocity: smoothed.velocity,
    smoothedRange: smoothed.range,
    perBasket,
    ready: true
  };
}

export function resetVolatility() {
  prevChangePercent = {};
  ewmaAbs = {};
  smoothed = { sigma: 0, maxZone: 0, velocity: 0, range: 0 };
}
