// Price marker persistence dual-targets localStorage and server API when authenticated (ref: DL-007).
// Server is source of truth; localStorage provides offline fallback.
import { authStore } from './authStore.js';
import { get } from 'svelte/store';

const STORAGE_PREFIX = 'price-markers-';

export function getStorageKey(symbol) {
  return `${STORAGE_PREFIX}${symbol.toUpperCase()}`;
}

export async function loadMarkers(symbol) {
  try {
    if (typeof localStorage === 'undefined') return [];
    // Try server first when authenticated, fall back to localStorage (ref: DL-007)
    if (get(authStore).isAuthenticated) {
      try {
        const resp = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/markers/' + symbol.toUpperCase(), { credentials: 'include' });
        if (resp.ok) {
          const result = await resp.json();
          if (result && result.data) {
            // Cache server data in localStorage for offline fallback
            localStorage.setItem(getStorageKey(symbol), JSON.stringify(result.data));
            return result.data;
          }
        }
      } catch (err) {
        console.warn('[Markers] Server load failed for ' + symbol + ', falling back to localStorage:', err);
      }
    }
    return loadMarkersFromLocal(symbol);
  } catch (error) {
    console.warn(`Failed to load markers for ${symbol}:`, error);
    return [];
  }
}

/** Load markers from localStorage only. Used as fallback when server is unavailable. */
function loadMarkersFromLocal(symbol) {
  try {
    const stored = localStorage.getItem(getStorageKey(symbol));
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    return [];
  }
}

export function saveMarkers(symbol, markers) {
  try {
    if (typeof localStorage === 'undefined') return;
    const key = getStorageKey(symbol);
    localStorage.setItem(key, JSON.stringify(markers));
    // Debounced server sync: 1-second delay to batch rapid marker changes (ref: DL-007)
    if (get(authStore).isAuthenticated) {
      clearTimeout(saveMarkers._debounceTimers && saveMarkers._debounceTimers[symbol]);
      if (!saveMarkers._debounceTimers) saveMarkers._debounceTimers = {};
      saveMarkers._debounceTimers[symbol] = setTimeout(() => {
        fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/markers/' + symbol.toUpperCase(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(markers)
        }).catch(err => console.warn('Failed to sync markers for ' + symbol + ':', err));
      }, 1000);
    }
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
