import { formatPrice } from './priceFormat.js';

const MAX_LEVELS = 5000;

export function buildInitialProfile(m1Bars, bucketSize = 0.00001, symbolData = null) {
  if (!m1Bars || m1Bars.length === 0) {
    return { profile: [], actualBucketSize: bucketSize };
  }

  // Calculate overall price range to validate/adjust bucket size
  const overallLow = Math.min(...m1Bars.map(bar => bar.low));
  const overallHigh = Math.max(...m1Bars.map(bar => bar.high));
  const expectedLevels = Math.floor((overallHigh - overallLow) / bucketSize) + 1;
  let actualBucketSize = bucketSize;

  // If expected levels exceed safety limit, adaptively increase bucket size
  if (expectedLevels > MAX_LEVELS) {
    actualBucketSize = (overallHigh - overallLow) / (MAX_LEVELS - 1);
    // Round to reasonable precision based on original bucket size
    const precision = bucketSize < 0.001 ? 6 : bucketSize < 0.01 ? 4 : 2;
    actualBucketSize = Math.round(actualBucketSize * Math.pow(10, precision)) / Math.pow(10, precision);
    console.warn(`[MARKET_PROFILE] Adjusted bucketSize from ${bucketSize} to ${actualBucketSize} (expected ${expectedLevels} levels, max ${MAX_LEVELS})`);
  }

  const priceMap = new Map();

  m1Bars.forEach(bar => {
    const range = generatePriceLevels(bar.low, bar.high, actualBucketSize, symbolData);
    range.forEach(price => {
      priceMap.set(price, (priceMap.get(price) || 0) + 1);
    });
  });

  const profile = Array.from(priceMap.entries())
    .map(([price, tpo]) => ({ price, tpo }))
    .sort((a, b) => a.price - b.price);

  console.log(`[MARKET_PROFILE] Built profile with ${profile.length} levels from ${m1Bars.length} M1 bars (bucket size: ${actualBucketSize})`);

  return { profile, actualBucketSize };
}

export function generatePriceLevels(low, high, bucketSize = 0.00001, symbolData = null) {
  const levels = [];
  let currentPrice = Math.floor(low / bucketSize) * bucketSize;
  let levelCount = 0;

  while (currentPrice <= high && levelCount < MAX_LEVELS) {
    const pipPosition = symbolData?.pipPosition ?? 4;
    levels.push(parseFloat(formatPrice(currentPrice, pipPosition)));
    currentPrice += bucketSize;
    levelCount++;
  }

  if (levelCount >= MAX_LEVELS) {
    console.warn('[MARKET_PROFILE] Price level generation hit safety limit - check bucket size calculation');
  }

  return levels;
}
