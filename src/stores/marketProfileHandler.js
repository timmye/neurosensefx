export function mergeProfileUpdate(current, data) {
  if (data.feedSource === 'ctrader' && current._profileSource === 'tradingview') {
    return null;
  }

  let levels;
  if (data.profile?.levels) {
    levels = data.profile.levels;
  } else if (data.delta) {
    const profile = current.marketProfile ? [...current.marketProfile] : [];
    const levelMap = new Map(profile.map(l => [l.price, l]));

    for (const level of data.delta.added || []) {
      levelMap.set(level.price, level);
    }
    for (const level of data.delta.updated || []) {
      levelMap.set(level.price, level);
    }

    levels = Array.from(levelMap.values()).sort((a, b) => a.price - b.price);
  } else {
    return null;
  }

  const profileHigh = levels[levels.length - 1]?.price ?? null;
  const profileLow = levels[0]?.price ?? null;

  return {
    ...current,
    marketProfile: levels,
    high: profileHigh !== null
      ? Math.max(current.high ?? profileHigh, profileHigh)
      : current.high,
    low: profileLow !== null
      ? Math.min(current.low ?? profileLow, profileLow)
      : current.low,
    _profileSource: data.feedSource,
    lastUpdate: Date.now()
  };
}
