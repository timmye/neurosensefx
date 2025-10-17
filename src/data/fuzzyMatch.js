/**
 * Symbol search implementation using unified fuzzy search utility
 * Maintains backward compatibility while using the consolidated implementation
 */

import { fuzzyMatchSymbols, getMatchInfo } from '../utils/fuzzySearch.js';

/**
 * Fuzzy matching implementation for symbol search
 * @param {string} searchTerm - Search term
 * @param {Array} symbols - Array of symbol strings
 * @returns {Array} - Array of matching symbols
 */
export function fuzzyMatch(searchTerm, symbols) {
  return fuzzyMatchSymbols(searchTerm, symbols);
}

// Re-export getMatchInfo from the unified utility
export { getMatchInfo };