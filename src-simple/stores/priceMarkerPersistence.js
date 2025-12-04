// Price marker persistence using localStorage
// Follows pattern from PERSISTENT_STORAGE_SOLUTIONS.md

const STORAGE_PREFIX = 'price-markers-';

export function getStorageKey(symbol) {
  return `${STORAGE_PREFIX}${symbol.toUpperCase()}`;
}

export function loadMarkers(symbol) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const key = getStorageKey(symbol);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn(`Failed to load markers for ${symbol}:`, error);
    return [];
  }
}

export function saveMarkers(symbol, markers) {
  try {
    if (typeof localStorage === 'undefined') return;
    const key = getStorageKey(symbol);
    localStorage.setItem(key, JSON.stringify(markers));
  } catch (error) {
    console.warn(`Failed to save markers for ${symbol}:`, error);
  }
}

export function mergeWithPersisted(symbol, newMarkers) {
  const existing = loadMarkers(symbol);

  // Create Set of existing {symbol, price, type} combinations for fast lookup
  const existingKeySet = new Set(
    existing.map(marker => `${marker.symbol}-${marker.price}-${marker.type}`)
  );

  // Filter out duplicates from new markers
  const uniqueNew = newMarkers.filter(marker => {
    const key = `${marker.symbol}-${marker.price}-${marker.type}`;
    return !existingKeySet.has(key);
  });

  // Merge and save
  const merged = [...existing, ...uniqueNew];
  saveMarkers(symbol, merged);
  return merged;
}