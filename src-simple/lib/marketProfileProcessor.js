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

  // Step 1: Calculate total TPO and target TPO for the value area
  const totalTpo = profile.reduce((sum, level) => sum + level.tpo, 0);
  const targetTpo = totalTpo * targetPercentage;

  // Step 2: Find Point of Control (POC) - price level with highest TPO
  const pocIndex = profile.reduce((maxIndex, level, index, arr) =>
    level.tpo > arr[maxIndex].tpo ? index : maxIndex, 0);

  // Step 3: Initialize value area with POC and start expanding outward
  let currentTpo = profile[pocIndex].tpo;
  const valueAreaLevels = [profile[pocIndex]];

  // Initialize expansion boundaries (above and below POC)
  let upperIndex = pocIndex + 1;
  let lowerIndex = pocIndex - 1;

  console.log(`[VALUE_AREA_CALC] POC found at price ${profile[pocIndex].price} with ${profile[pocIndex].tpo} TPOs`);
  console.log(`[VALUE_AREA_CALC] Target TPO: ${targetTpo} (${targetPercentage * 100}% of ${totalTpo})`);

  // Step 4: Expand value area outward from POC until target TPO is reached
  // This ensures price continuity - value area contains contiguous price levels
  while (currentTpo < targetTpo && (upperIndex < profile.length || lowerIndex >= 0)) {
    // Compare TPO counts at next levels above and below POC
    const upperLevel = upperIndex < profile.length ? profile[upperIndex] : null;
    const lowerLevel = lowerIndex >= 0 ? profile[lowerIndex] : null;

    let selectedLevel = null;

    // Choose level with higher TPO count (prioritize more active price levels)
    // This creates a more accurate value area focused on high-activity zones
    if (upperLevel && lowerLevel) {
      if (upperLevel.tpo >= lowerLevel.tpo) {
        selectedLevel = upperLevel;
        upperIndex++;
      } else {
        selectedLevel = lowerLevel;
        lowerIndex--;
      }
    } else if (upperLevel) {
      selectedLevel = upperLevel;
      upperIndex++;
    } else if (lowerLevel) {
      selectedLevel = lowerLevel;
      lowerIndex--;
    }

    if (selectedLevel) {
      valueAreaLevels.push(selectedLevel);
      currentTpo += selectedLevel.tpo;
      console.log(`[VALUE_AREA_CALC] Added level at ${selectedLevel.price} (${selectedLevel.tpo} TPOs), current TPO: ${currentTpo}`);
    }
  }

  // Step 5: Extract price range from continuous value area levels
  const prices = valueAreaLevels.map(level => level.price);
  const valueAreaRange = {
    high: Math.max(...prices),
    low: Math.min(...prices),
    levels: valueAreaLevels.sort((a, b) => a.price - b.price), // Sort by price for continuity
    totalTpo: currentTpo,
    targetTpo: targetTpo,
    percentage: (currentTpo / totalTpo) * 100
  };

  console.log(`[VALUE_AREA_CALC] Final Value Area: ${valueAreaRange.low.toFixed(5)} - ${valueAreaRange.high.toFixed(5)}`);
  console.log(`[VALUE_AREA_CALC] Actual coverage: ${valueAreaRange.percentage.toFixed(1)}% (${currentTpo}/${totalTpo} TPOs)`);

  return valueAreaRange;
}