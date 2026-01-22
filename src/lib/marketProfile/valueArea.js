export function calculateValueArea(profile, targetPercentage = 0.7) {
  if (!profile || profile.length === 0) {
    return { high: null, low: null };
  }

  const totalTpo = profile.reduce((sum, level) => sum + level.tpo, 0);
  const targetTpo = totalTpo * targetPercentage;
  const pocIndex = findPointOfControlIndex(profile);
  const { levels, finalTpo } = expandValueArea(profile, pocIndex, targetTpo);

  return extractValueAreaRange(levels, finalTpo, totalTpo, targetTpo);
}

function expandValueArea(profile, pocIndex, targetTpo) {
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

function extractValueAreaRange(levels, finalTpo, totalTpo, targetTpo) {
  const prices = levels.map(level => level.price);

  return {
    high: Math.max(...prices),
    low: Math.min(...prices),
    levels: levels.sort((a, b) => a.price - b.price),
    totalTpo: finalTpo,
    targetTpo,
    percentage: (finalTpo / totalTpo) * 100
  };
}

function findPointOfControlIndex(profile) {
  return profile.reduce((maxIdx, level, idx, arr) =>
    level.tpo > arr[maxIdx].tpo ? idx : maxIdx, 0
  );
}
