// Market Profile Calculations - Crystal Clarity Compliant
// Pure calculation functions: POC, value area, intensity

export function calculateIntensity(level, maxTpo) {
  return maxTpo > 0 ? level.tpo / maxTpo : 0;
}

export function calculateMaxTpo(profile) {
  if (!profile || profile.length === 0) return 0;
  return Math.max(...profile.map(d => d.tpo));
}

export function calculateTpoScale(maxTpo, marketProfileWidth) {
  return maxTpo > 0 ? marketProfileWidth / maxTpo : 1;
}

export function getIntensityLevel(intensity) {
  if (intensity <= 0.6) return 'low';
  if (intensity <= 0.8) return 'medium';
  return 'high';
}

export function getIntensityColor(level) {
  const colors = {
    low: '#374151',
    medium: '#404694ff',
    high: '#7b5dc0'
  };
  return colors[level] || colors.low;
}

export function computePOC(profile) {
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

  const totalTpo = profile.reduce((sum, level) => sum + level.tpo, 0);
  const targetTpo = totalTpo * targetPercentage;
  const pocIndex = findPOCIndex(profile);
  const { levels, finalTpo } = expandArea(profile, pocIndex, targetTpo);

  return extractAreaRange(levels);
}

function findPOCIndex(profile) {
  return profile.reduce((maxIdx, level, idx, arr) =>
    level.tpo > arr[maxIdx].tpo ? idx : maxIdx, 0
  );
}

function expandArea(profile, pocIndex, targetTpo) {
  const levels = [profile[pocIndex]];
  let currentTpo = profile[pocIndex].tpo;
  let upperIndex = pocIndex + 1;
  let lowerIndex = pocIndex - 1;

  while (currentTpo < targetTpo && (upperIndex < profile.length || lowerIndex >= 0)) {
    const { selectedLevel, newUpper, newLower } = selectNextLevel(profile, upperIndex, lowerIndex);

    if (selectedLevel) {
      levels.push(selectedLevel);
      currentTpo += selectedLevel.tpo;
      upperIndex = newUpper;
      lowerIndex = newLower;
    }
  }

  return { levels, finalTpo: currentTpo };
}

function selectNextLevel(profile, upperIndex, lowerIndex) {
  const upperLevel = upperIndex < profile.length ? profile[upperIndex] : null;
  const lowerLevel = lowerIndex >= 0 ? profile[lowerIndex] : null;

  if (upperLevel && lowerLevel) {
    return upperLevel.tpo >= lowerLevel.tpo
      ? { selectedLevel: upperLevel, newUpper: upperIndex + 1, newLower: lowerIndex }
      : { selectedLevel: lowerLevel, newUpper: upperIndex, newLower: lowerIndex - 1 };
  }

  if (upperLevel) {
    return { selectedLevel: upperLevel, newUpper: upperIndex + 1, newLower: lowerIndex };
  }

  if (lowerLevel) {
    return { selectedLevel: lowerLevel, newUpper: upperIndex, newLower: lowerIndex - 1 };
  }

  return { selectedLevel: null, newUpper: upperIndex, newLower: lowerIndex };
}

function extractAreaRange(levels) {
  const prices = levels.map(level => level.price);

  return {
    high: Math.max(...prices),
    low: Math.min(...prices)
  };
}
