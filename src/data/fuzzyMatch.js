/**
 * Simple fuzzy matching implementation for symbol search
 * Supports partial matching and finds symbols that contain the search term
 */
export function fuzzyMatch(searchTerm, symbols) {
  if (!searchTerm || !symbols || symbols.length === 0) {
    return [];
  }
  
  const term = searchTerm.toLowerCase().trim();
  
  return symbols
    .map(symbol => {
      const symbolLower = symbol.toLowerCase();
      
      // Exact match gets highest priority
      if (symbolLower === term) {
        return { symbol, score: 100, matchType: 'exact' };
      }
      
      // Prefix match gets high priority (e.g., "eur" matches "eurusd")
      if (symbolLower.startsWith(term)) {
        return { symbol, score: 90, matchType: 'prefix' };
      }
      
      // Contains match gets medium priority (e.g., "usd" matches "eurusd")
      if (symbolLower.includes(term)) {
        return { symbol, score: 70, matchType: 'contains' };
      }
      
      // Partial word match gets lower priority (e.g., "eur" matches "eurusd")
      const termWords = term.split('');
      let partialScore = 0;
      let lastMatchIndex = -1;
      
      for (const char of termWords) {
        const charIndex = symbolLower.indexOf(char, lastMatchIndex + 1);
        if (charIndex === -1) break;
        
        partialScore += 10;
        // Bonus for consecutive characters
        if (charIndex === lastMatchIndex + 1) {
          partialScore += 5;
        }
        lastMatchIndex = charIndex;
      }
      
      if (partialScore > 0) {
        return { symbol, score: partialScore, matchType: 'partial' };
      }
      
      return null;
    })
    .filter(result => result !== null)
    .sort((a, b) => {
      // Sort by score first, then alphabetically
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.symbol.localeCompare(b.symbol);
    })
    .map(result => result.symbol);
}

/**
 * Get match information for highlighting
 */
export function getMatchInfo(symbol, searchTerm) {
  if (!searchTerm || !symbol) {
    return { fullMatch: false, positions: [] };
  }
  
  const term = searchTerm.toLowerCase();
  const symbolLower = symbol.toLowerCase();
  
  const positions = [];
  let index = 0;
  
  while ((index = symbolLower.indexOf(term, index)) !== -1) {
    positions.push({ start: index, end: index + term.length });
    index += term.length;
  }
  
  return {
    fullMatch: symbolLower === term,
    positions: positions
  };
}