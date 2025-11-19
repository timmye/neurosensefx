/**
 * Fuzzy Search Utility for Symbol Palette
 * 
 * Provides fast, intelligent symbol searching with scoring algorithm
 * optimized for trading symbol discovery.
 */

// Common trading pairs for bonus scoring
const COMMON_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD',
  'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY',
  'CADJPY', 'CHFJPY', 'NZDJPY', 'EURNZD', 'EURCAD', 'EURAUD',
  'GBPCHF', 'GBPAUD', 'GBPCAD', 'GBPNZD', 'AUDCHF', 'AUDNZD',
  'CADCHF', 'NZDCHF', 'XAUUSD', 'XAGUSD', 'BTCUSD', 'ETHUSD'
];

export class FuzzySearch {
  constructor(items, options = {}) {
    this.items = items;
    this.options = {
      threshold: 0.6,
      caseSensitive: false,
      includeScore: true,
      maxResults: 50,
      ...options
    };
    
    // Pre-compute index for faster searching
    this.index = this.buildIndex(items);
    
    // Performance tracking
    this.metrics = {
      searchCount: 0,
      totalSearchTime: 0,
      averageSearchTime: 0
    };
  }

  /**
   * Build searchable index from items
   */
  buildIndex(items) {
    return items.map(item => ({
      item,
      lower: item.toLowerCase(),
      original: item,
      length: item.length
    }));
  }

  /**
   * Perform fuzzy search
   */
  search(query) {
    const startTime = performance.now();
    
    if (!query || query.length === 0) {
      return this.items.slice(0, this.options.maxResults);
    }

    const queryLower = this.options.caseSensitive ? query : query.toLowerCase();
    const queryLength = queryLower.length;

    // Calculate scores for all items
    const results = this.index
      .map(indexed => ({
        item: indexed.item,
        score: this.calculateScore(queryLower, indexed),
        original: indexed.original
      }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.options.maxResults)
      .map(result => this.options.includeScore ? result : result.item);

    // Track performance
    this.trackSearch(performance.now() - startTime);

    return results;
  }

  /**
   * Calculate fuzzy search score
   */
  calculateScore(query, indexed) {
    const candidate = indexed.lower;
    const candidateLength = candidate.length;
    const queryLength = query.length;

    // Exact match - highest score
    if (candidate === query) {
      return 1000;
    }

    // Start of string match - very high score
    if (candidate.startsWith(query)) {
      return 800 + (candidateLength - queryLength) * 2;
    }

    // Contains match - high score
    if (candidate.includes(query)) {
      return 600 + (candidateLength - queryLength);
    }

    // Check for abbreviation match (e.g., "eur" matches "eurusd")
    const abbreviationBonus = this.calculateAbbreviationBonus(query, candidate);
    if (abbreviationBonus > 0) {
      return 400 + abbreviationBonus;
    }

    // Relaxed fuzzy matching with more generous scoring
    let score = 0;
    let queryIndex = 0;
    let candidateIndex = 0;
    let consecutiveMatches = 0;
    let maxConsecutiveMatches = 0;
    let totalSkips = 0;
    let matchedPositions = [];

    while (queryIndex < queryLength && candidateIndex < candidateLength) {
      if (query[queryIndex] === candidate[candidateIndex]) {
        score += 15 + (consecutiveMatches * 8); // Increased bonuses for matches
        consecutiveMatches++;
        maxConsecutiveMatches = Math.max(maxConsecutiveMatches, consecutiveMatches);
        matchedPositions.push(candidateIndex);
        queryIndex++;
      } else {
        consecutiveMatches = 0;
        // Much smaller penalty for skipped characters (very forgiving)
        score -= 0.05; // Reduced from 0.2 to 0.05
        totalSkips++;
      }
      candidateIndex++;
    }

    // Large bonus for matching all query characters
    if (queryIndex === queryLength) {
      score += 100; // Increased from 50

      // Additional bonus for high consecutive match ratio
      const consecutiveRatio = maxConsecutiveMatches / queryLength;
      score += consecutiveRatio * 50; // Increased from 30

      // Minimal penalty for skips if we matched everything
      score -= totalSkips * 0.02; // Reduced from 0.1 to 0.02

      // Position-based bonus - reward characters that are close together
      if (matchedPositions.length > 1) {
        let totalDistance = 0;
        for (let i = 1; i < matchedPositions.length; i++) {
          totalDistance += matchedPositions[i] - matchedPositions[i-1];
        }
        const avgDistance = totalDistance / (matchedPositions.length - 1);
        // Smaller distances get bigger bonuses
        if (avgDistance < 3) score += 30;
        else if (avgDistance < 5) score += 20;
        else if (avgDistance < 8) score += 10;
      }
    }

    // Very light penalty for remaining unmatched characters
    const unmatchedPenalty = (candidateLength - queryIndex) * 0.5; // Reduced from 1.5
    score -= unmatchedPenalty;

    // Very forgiving length difference penalty
    const lengthRatio = Math.abs(candidateLength - queryLength) / Math.max(candidateLength, queryLength);
    score -= lengthRatio * 10; // Reduced from 20

    // Bonus for common trading pairs
    const upperCandidate = indexed.original.toUpperCase();
    if (COMMON_PAIRS.includes(upperCandidate)) {
      score += 50;
    }

    // Bonus for common forex patterns
    if (this.isForexPattern(upperCandidate)) {
      score += 25;
    }

    // Proximity bonus - reward characters that are close together
    if (queryIndex === queryLength) {
      const proximityScore = this.calculateProximityScore(query, candidate);
      score += proximityScore;
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Calculate abbreviation bonus (e.g., "eur" matches "eurusd")
   */
  calculateAbbreviationBonus(query, candidate) {
    if (query.length < 2 || query.length > 4) return 0;

    // Check if query matches the beginning of candidate
    if (candidate.startsWith(query)) {
      // Bonus based on how much of the candidate we captured
      const coverageRatio = query.length / candidate.length;
      return Math.round(coverageRatio * 100);
    }

    // Check for common trading abbreviations
    const abbreviations = {
      'eur': ['euro', 'eurusd', 'eur', 'eurgbp'],
      'gbp': ['pound', 'gbpusd', 'gbp', 'gbpjpy'],
      'usd': ['dollar', 'eurusd', 'gbpusd', 'usdjpy'],
      'jpy': ['yen', 'usdjpy', 'eurjpy', 'gbpjpy'],
      'aud': ['aussie', 'audusd', 'aud', 'audjpy'],
      'cad': ['loonie', 'usdcad', 'cad', 'cadjpy'],
      'chf': ['swissy', 'usdchf', 'chf', 'eurchf'],
      'nzd': ['kiwi', 'nzdusd', 'nzd', 'nzdjpy'],
      'xau': ['gold', 'xauusd', 'goldusd'],
      'xag': ['silver', 'xagusd', 'silverusd'],
      'btc': ['bitcoin', 'btcusd', 'btcusdt'],
      'eth': ['ethereum', 'ethusd', 'ethusdt']
    };

    const queryLower = query.toLowerCase();
    if (abbreviations[queryLower]) {
      const matches = abbreviations[queryLower].filter(abbr =>
        candidate.includes(abbr) || abbr.includes(candidate)
      );
      if (matches.length > 0) {
        return 80; // Strong bonus for abbreviation matches
      }
    }

    return 0;
  }

  /**
   * Calculate proximity bonus for characters that appear close together
   */
  calculateProximityScore(query, candidate) {
    let proximityScore = 0;
    let foundPositions = [];

    // Find positions of all query characters in candidate
    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      let charPositions = [];

      for (let j = 0; j < candidate.length; j++) {
        if (candidate[j] === char) {
          charPositions.push(j);
        }
      }

      if (charPositions.length > 0) {
        foundPositions.push(charPositions);
      } else {
        return 0; // Missing character, no proximity bonus
      }
    }

    // Calculate score based on how close characters are to each other
    if (foundPositions.length === query.length) {
      // Find the best combination of positions
      let minTotalDistance = Infinity;

      // Simple heuristic: try first occurrence of each character
      let totalDistance = 0;
      for (let i = 1; i < foundPositions.length; i++) {
        const distance = Math.abs(foundPositions[i][0] - foundPositions[i-1][0]);
        totalDistance += distance;
      }
      minTotalDistance = Math.min(minTotalDistance, totalDistance);

      // Convert distance to score (closer = higher score)
      const maxPossibleDistance = candidate.length * 2;
      const proximityRatio = 1 - (minTotalDistance / maxPossibleDistance);
      proximityScore = Math.round(proximityRatio * 50);
    }

    return Math.max(0, proximityScore);
  }

  /**
   * Check if symbol matches common forex patterns
   */
  isForexPattern(symbol) {
    // Common forex patterns: 6 characters (3+3) or with USD suffix
    const forexPattern = /^[A-Z]{3}[A-Z]{3}$/;
    const forexWithUsdPattern = /^[A-Z]{3}USD$/;

    return forexPattern.test(symbol) || forexWithUsdPattern.test(symbol);
  }

  /**
   * Track search performance metrics
   */
  trackSearch(duration) {
    this.metrics.searchCount++;
    this.metrics.totalSearchTime += duration;
    this.metrics.averageSearchTime = this.metrics.totalSearchTime / this.metrics.searchCount;

    // Log slow searches
    if (duration > 100) {
      console.warn(`Slow fuzzy search detected: ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Update items and rebuild index
   */
  updateItems(items) {
    this.items = items;
    this.index = this.buildIndex(items);
  }

  /**
   * Highlight matching characters in result
   */
  highlightMatch(item, query) {
    if (!query || query.length === 0) {
      return item;
    }

    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return item.replace(regex, '<mark>$1</mark>');
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get suggestions for partial queries
   */
  getSuggestions(partialQuery, maxSuggestions = 5) {
    if (!partialQuery || partialQuery.length < 2) {
      return [];
    }

    const results = this.search(partialQuery);
    return results.slice(0, maxSuggestions);
  }

  /**
   * Check if query should trigger search
   */
  shouldSearch(query) {
    return query && query.length >= 1;
  }
}

/**
 * Debounced search utility
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Create a debounced fuzzy search instance
 */
export function createDebouncedSearch(items, options = {}) {
  const fuzzySearch = new FuzzySearch(items, options);
  const debouncedSearch = debounce(fuzzySearch.search.bind(fuzzySearch), 900);
  
  return {
    search: debouncedSearch,
    getInstance: () => fuzzySearch,
    updateItems: (items) => {
      fuzzySearch.updateItems(items);
    },
    getMetrics: () => fuzzySearch.getMetrics()
  };
}

/**
 * Quick search for small lists (no indexing needed)
 */
export function quickSearch(items, query, options = {}) {
  if (!query || query.length === 0) {
    return items;
  }

  const queryLower = query.toLowerCase();
  const threshold = options.threshold || 0.6;
  
  return items
    .map(item => {
      const itemLower = item.toLowerCase();
      let score = 0;

      // Exact match
      if (itemLower === queryLower) score = 1000;
      // Start match
      else if (itemLower.startsWith(queryLower)) score = 800;
      // Contains match
      else if (itemLower.includes(queryLower)) score = 600;
      // Fuzzy match
      else {
        score = calculateSimpleScore(queryLower, itemLower);
      }

      return { item, score };
    })
    .filter(result => result.score > threshold * 100)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.maxResults || 50)
    .map(result => result.item);
}

/**
 * Simple score calculation for quick search
 */
function calculateSimpleScore(query, candidate) {
  let score = 0;
  let queryIndex = 0;
  let candidateIndex = 0;

  while (queryIndex < query.length && candidateIndex < candidate.length) {
    if (query[queryIndex] === candidate[candidateIndex]) {
      score += 10;
      queryIndex++;
    }
    candidateIndex++;
  }

  // Penalty for length difference
  score -= Math.abs(candidate.length - query.length) * 2;

  return Math.max(0, score);
}

/**
 * Search result cache for performance optimization
 */
export class SearchCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    if (this.cache.has(key)) {
      this.hits++;
      // Move to end (LRU)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    this.misses++;
    return null;
  }

  set(key, value) {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  getHitRate() {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Create a cached fuzzy search instance
 */
export function createCachedSearch(items, options = {}) {
  const cache = new SearchCache(options.cacheSize || 100);
  const fuzzySearch = new FuzzySearch(items, options);

  return {
    search(query) {
      const cacheKey = `${query}_${JSON.stringify(options)}`;
      
      let results = cache.get(cacheKey);
      if (results === null) {
        results = fuzzySearch.search(query);
        cache.set(cacheKey, results);
      }
      
      return results;
    },
    
    getMetrics: () => ({
      search: fuzzySearch.getMetrics(),
      cache: {
        hitRate: cache.getHitRate(),
        size: cache.cache.size
      }
    }),
    
    updateItems: (items) => {
      fuzzySearch.updateItems(items);
      cache.clear(); // Clear cache when items change
    }
  };
}

/**
 * Symbol fuzzy matching function for compatibility
 */
export function fuzzyMatchSymbols(searchTerm, symbols) {
  const fuzzySearch = new FuzzySearch(symbols, {
    threshold: 0.6,
    includeScore: false,
    maxResults: 50
  });

  return fuzzySearch.search(searchTerm);
}

/**
 * Get detailed match information for highlighting
 */
export function getMatchInfo(symbol, query) {
  const fuzzySearch = new FuzzySearch([symbol]);
  const results = fuzzySearch.search(query);

  if (results.length > 0) {
    return {
      match: true,
      highlighted: fuzzySearch.highlightMatch(symbol, query)
    };
  }

  return {
    match: false,
    highlighted: symbol
  };
}

export default FuzzySearch;
