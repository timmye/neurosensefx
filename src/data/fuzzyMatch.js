/**
 * Fuzzy matching implementation for symbol search
 * Provides simple string matching with scoring for symbol autocomplete
 */

/**
 * Performs fuzzy matching on an array of symbols based on a query
 * @param {string} query - The search query
 * @param {string[]} symbols - Array of symbols to search through
 * @returns {string[]} - Array of matching symbols sorted by relevance
 */
export function fuzzyMatch(query, symbols) {
  if (!query || query.trim() === '') {
    return [];
  }
  
  const normalizedQuery = query.toLowerCase().trim();
  const matches = [];
  
  for (const symbol of symbols) {
    const normalizedSymbol = symbol.toLowerCase();
    const score = calculateMatchScore(normalizedQuery, normalizedSymbol);
    
    if (score > 0) {
      matches.push({
        symbol,
        score
      });
    }
  }
  
  // Sort by score (highest first) and return just the symbols
  return matches
    .sort((a, b) => b.score - a.score)
    .map(match => match.symbol);
}

/**
 * Gets detailed match information for highlighting
 * @param {string} symbol - The symbol to check
 * @param {string} query - The search query
 * @returns {Object} - Match information with indices
 */
export function getMatchInfo(symbol, query) {
  if (!query || query.trim() === '') {
    return {
      matched: false,
      indices: []
    };
  }
  
  const normalizedSymbol = symbol.toLowerCase();
  const normalizedQuery = query.toLowerCase().trim();
  
  const indices = [];
  let queryIndex = 0;
  
  // Find all matching characters in order
  for (let i = 0; i < normalizedSymbol.length && queryIndex < normalizedQuery.length; i++) {
    if (normalizedSymbol[i] === normalizedQuery[queryIndex]) {
      indices.push(i);
      queryIndex++;
    }
  }
  
  return {
    matched: queryIndex === normalizedQuery.length,
    indices
  };
}

/**
 * Calculates a match score between query and symbol
 * @param {string} query - Normalized query
 * @param {string} symbol - Normalized symbol
 * @returns {number} - Match score (0 = no match, higher = better match)
 */
function calculateMatchScore(query, symbol) {
  if (query === symbol) {
    return 100; // Exact match
  }
  
  if (symbol.startsWith(query)) {
    return 80; // Starts with query
  }
  
  if (symbol.includes(query)) {
    return 60; // Contains query
  }
  
  // Calculate fuzzy match score
  let queryIndex = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  
  for (let i = 0; i < symbol.length && queryIndex < query.length; i++) {
    if (symbol[i] === query[queryIndex]) {
      queryIndex++;
      consecutiveMatches++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
    } else {
      consecutiveMatches = 0;
    }
  }
  
  // If we matched all characters in order
  if (queryIndex === query.length) {
    // Base score for matching all characters
    let score = 40;
    
    // Bonus for consecutive matches
    score += maxConsecutive * 5;
    
    // Penalty for longer gaps between matches
    const ratio = query.length / symbol.length;
    score += ratio * 20;
    
    return Math.min(score, 50); // Cap at 50 to keep below contains match
  }
  
  return 0; // No match
}