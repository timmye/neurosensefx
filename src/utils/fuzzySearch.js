/**
 * Unified fuzzy search implementation for NeuroSense FX
 * Consolidates functionality from both CanvasContextMenu and symbol search
 */

/**
 * Advanced fuzzy matching implementation with configurable options
 * @param {string} query - Search query
 * @param {string} target - Target string to match against
 * @param {Object} options - Configuration options
 * @returns {number} - Match score (0 = no match, higher = better match)
 */
export const fuzzyMatch = (query, target, options = {}) => {
  const {
    exactMatchScore = 100,
    prefixMatchScore = 80,
    containsMatchScore = 60,
    consecutiveMatchBonus = 2,
    lengthDiffPenalty = 2,
    fullMatchBonus = 20
  } = options;

  if (!query) return 0;
  if (!target) return 0;
  
  query = query.toLowerCase();
  target = target.toLowerCase();
  
  // Exact match gets highest score
  if (query === target) return exactMatchScore;
  
  // Starts with query gets high score
  if (target.startsWith(query)) return prefixMatchScore;
  
  // Contains query gets medium score
  if (target.includes(query)) return containsMatchScore;
  
  // Calculate character proximity score
  let queryIndex = 0;
  let targetIndex = 0;
  let score = 0;
  let consecutiveMatches = 0;
  
  while (queryIndex < query.length && targetIndex < target.length) {
    if (query[queryIndex] === target[targetIndex]) {
      score += 10;
      consecutiveMatches++;
      
      // Bonus for consecutive matches
      if (consecutiveMatches > 1) {
        score += consecutiveMatches * consecutiveMatchBonus;
      }
      
      queryIndex++;
    } else {
      consecutiveMatches = 0;
    }
    targetIndex++;
  }
  
  // Bonus if we matched all characters in query
  if (queryIndex === query.length) {
    score += fullMatchBonus;
  }
  
  // Penalty for length difference
  const lengthDiff = Math.abs(query.length - target.length);
  score -= lengthDiff * lengthDiffPenalty;
  
  return Math.max(0, score);
};

/**
 * Search through an array of items with fuzzy matching
 * @param {string} query - Search query
 * @param {Array} items - Array of items to search
 * @param {Function} getItemString - Function to extract searchable string from item
 * @param {Object} options - Search options
 * @returns {Array} - Array of search results with metadata
 */
export const fuzzySearch = (query, items, getItemString, options = {}) => {
  const {
    minScore = 30,
    maxResults = 20,
    fuzzyOptions = {}
  } = options;

  if (!query || query.trim() === '') {
    return [];
  }
  
  const queryTrimmed = query.trim();
  const results = [];
  
  items.forEach((item, index) => {
    const itemString = getItemString(item);
    if (!itemString) return;
    
    const score = fuzzyMatch(queryTrimmed, itemString, fuzzyOptions);
    
    if (score >= minScore) {
      results.push({
        item,
        index,
        score,
        matchString: itemString
      });
    }
  });
  
  // Sort by score (descending) and limit results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
};

/**
 * Symbol-specific fuzzy search (legacy compatibility)
 * @param {string} searchTerm - Search term
 * @param {Array} symbols - Array of symbol strings
 * @returns {Array} - Array of matching symbols
 */
export function fuzzyMatchSymbols(searchTerm, symbols) {
  if (!searchTerm || !symbols || symbols.length === 0) {
    return [];
  }
  
  const results = fuzzySearch(
    searchTerm,
    symbols,
    symbol => symbol,
    {
      minScore: 20,
      maxResults: symbols.length,
      fuzzyOptions: {
        exactMatchScore: 100,
        prefixMatchScore: 90,
        containsMatchScore: 70,
        consecutiveMatchBonus: 5,
        lengthDiffPenalty: 1,
        fullMatchBonus: 10
      }
    }
  );
  
  return results.map(result => result.item);
}

/**
 * Get match information for highlighting
 * @param {string} text - Original text
 * @param {string} query - Search query
 * @returns {Object} - Match information with positions
 */
export function getMatchInfo(text, query) {
  if (!query || !text) {
    return { fullMatch: false, positions: [] };
  }
  
  const term = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  const positions = [];
  let index = 0;
  
  while ((index = textLower.indexOf(term, index)) !== -1) {
    positions.push({ start: index, end: index + term.length });
    index += term.length;
  }
  
  return {
    fullMatch: textLower === term,
    positions
  };
}

/**
 * Highlight matching text in search results
 * @param {string} text - Original text
 * @param {string} query - Search query
 * @returns {string} - Text with highlighted matches
 */
export const highlightMatch = (text, query) => {
  if (!query || !text) return text;
  
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const index = textLower.indexOf(queryLower);
  
  if (index === -1) return text;
  
  const before = text.substring(0, index);
  const match = text.substring(index, index + query.length);
  const after = text.substring(index + query.length);
  
  return `${before}<mark>${match}</mark>${after}`;
};

// Export the fuzzyMatch function as default for compatibility
export default fuzzyMatch;