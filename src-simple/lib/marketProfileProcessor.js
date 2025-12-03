// Market Profile Data Processor - Crystal Clarity Compliant
// Framework-first: Pure data processing, no rendering logic

export function processMarketProfileData(data, lastProfile = null) {
  if (data.type === 'symbolDataPackage') {
    return buildInitialProfile(data.initialMarketProfile || []);
  } else if (data.type === 'tick' && lastProfile) {
    return updateProfileWithTick(lastProfile, data);
  }
  return lastProfile;
}

export function buildInitialProfile(m1Bars, bucketSize = 0.00001) {
  if (!m1Bars || m1Bars.length === 0) {
    return [];
  }

  const priceMap = new Map();

  m1Bars.forEach(bar => {
    const range = generatePriceLevels(bar.low, bar.high, bucketSize);
    range.forEach(price => {
      priceMap.set(price, (priceMap.get(price) || 0) + 1);
    });
  });

  return Array.from(priceMap.entries())
    .map(([price, tpo]) => ({ price, tpo }))
    .sort((a, b) => a.price - b.price);
}

export function updateProfileWithTick(lastProfile, tickData) {
  if (!lastProfile || !tickData.bid) {
    return lastProfile;
  }

  const updatedProfile = [...lastProfile];
  const tickPrice = tickData.bid;

  const existingLevel = updatedProfile.find(level => level.price === tickPrice);
  if (existingLevel) {
    existingLevel.tpo += 1;
  } else {
    updatedProfile.push({ price: tickPrice, tpo: 1 });
    updatedProfile.sort((a, b) => a.price - b.price);
  }

  return updatedProfile;
}

export function generatePriceLevels(low, high, bucketSize = 0.00001) {
  const levels = [];
  let currentPrice = Math.floor(low / bucketSize) * bucketSize;

  // Prevent infinite loops and excessive memory usage
  const maxLevels = 10000;
  let levelCount = 0;

  while (currentPrice <= high && levelCount < maxLevels) {
    levels.push(parseFloat(currentPrice.toFixed(5)));
    currentPrice += bucketSize;
    levelCount++;
  }

  if (levelCount >= maxLevels) {
    console.warn('[MARKET_PROFILE] Price level generation truncated to prevent memory overflow');
  }

  return levels;
}

export function calculatePointOfControl(profile) {
  if (!profile || profile.length === 0) {
    return null;
  }

  return profile.reduce((maxLevel, level) =>
    level.tpo > maxLevel.tpo ? level : maxLevel
  );
}

export function calculateValueArea(profile, targetPercentage = 0.7) {
  if (!profile || profile.length === 0) {
    return { high: null, low: null };
  }

  const sortedByTpo = [...profile].sort((a, b) => b.tpo - a.tpo);
  const totalTpo = profile.reduce((sum, level) => sum + level.tpo, 0);
  const targetTpo = totalTpo * targetPercentage;

  let currentTpo = 0;
  const valueAreaLevels = [];

  for (const level of sortedByTpo) {
    valueAreaLevels.push(level);
    currentTpo += level.tpo;
    if (currentTpo >= targetTpo) {
      break;
    }
  }

  const prices = valueAreaLevels.map(level => level.price);
  return {
    high: Math.max(...prices),
    low: Math.min(...prices),
    levels: valueAreaLevels
  };
}