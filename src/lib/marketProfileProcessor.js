import { formatPrice } from './priceFormat.js';

export function buildInitialProfile(m1Bars, bucketSize = 0.00001, symbolData = null) {
  if (!m1Bars || m1Bars.length === 0) {
    return { profile: [], actualBucketSize: bucketSize };
  }

  // Use backend-provided bucketSize directly (no adaptive calculation)
  // This ensures frontend and backend use identical bucket sizes
  const priceMap = new Map();

  m1Bars.forEach(bar => {
    const range = generatePriceLevels(bar.low, bar.high, bucketSize, symbolData);
    range.forEach(price => {
      priceMap.set(price, (priceMap.get(price) || 0) + 1);
    });
  });

  const profile = Array.from(priceMap.entries())
    .map(([price, tpo]) => ({ price, tpo }))
    .sort((a, b) => a.price - b.price);

  console.log(`[MARKET_PROFILE] Built profile with ${profile.length} levels from ${m1Bars.length} M1 bars (bucket size: ${bucketSize})`);

  return { profile, actualBucketSize: bucketSize };
}

export function generatePriceLevels(low, high, bucketSize = 0.00001, symbolData = null) {
  const levels = [];
  let currentPrice = Math.floor(low / bucketSize) * bucketSize;
  const maxLevels = 5000;
  let levelCount = 0;

  while (currentPrice <= high && levelCount < maxLevels) {
    const pipPosition = symbolData?.pipPosition ?? 4;
    levels.push(parseFloat(formatPrice(currentPrice, pipPosition)));
    currentPrice += bucketSize;
    levelCount++;
  }

  if (levelCount >= maxLevels) {
    console.warn('[MARKET_PROFILE] Price level generation hit safety limit - check bucket size calculation');
  }

  return levels;
}
