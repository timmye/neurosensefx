/**
 * Configurable Fuzzy Search for NeuroSense FX
 *
 * Enhanced fuzzy search with configurable parameters and improved performance
 */

import {
  createSearchConfig,
  detectSymbolType,
  getTypeSpecificBonuses,
  SYMBOL_TYPES
} from './searchConfig.js';

export class ConfigurableFuzzySearch {
  constructor(items, options = {}) {
    // Create configuration
    this.config = createSearchConfig(options, options.environment || 'production');

    // Set initial data
    this.items = items || [];
    this.index = this.buildIndex(this.items);

    // Performance metrics
    this.metrics = {
      searchCount: 0,
      totalSearchTime: 0,
      averageSearchTime: 0,
      slowSearchCount: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    // Search cache for performance
    this.cache = new Map();
    this.maxCacheSize = this.config.performance.cacheSize;

    // Pre-calculate common lookups for performance
    this.initializeOptimizations();
  }

  /**
   * Build searchable index with enhanced metadata
   */
  buildIndex(items) {
    return items.map(item => {
      const upperItem = item.toUpperCase();
      const type = detectSymbolType(upperItem);

      return {
        item,
        lower: item.toLowerCase(),
        upper: upperItem,
        original: item,
        length: item.length,
        type,
        // Pre-calculate if it's a common pair for performance
        isCommonPair: this.config.trading.commonPairs.includes(upperItem)
      };
    });
  }

  /**
   * Initialize performance optimizations
   */
  initializeOptimizations() {
    // Pre-build abbreviation lookup for performance
    this.abbreviationLookup = new Map();

    for (const [abbr, matches] of Object.entries(this.config.trading.abbreviations)) {
      for (const match of matches) {
        if (!this.abbreviationLookup.has(match.toLowerCase())) {
          this.abbreviationLookup.set(match.toLowerCase(), []);
        }
        this.abbreviationLookup.get(match.toLowerCase()).push(abbr);
      }
    }
  }

  /**
   * Perform fuzzy search with configuration
   */
  search(query) {
    const startTime = performance.now();

    // Handle edge cases
    if (!query || query.length === 0) {
      return this.items.slice(0, this.config.maxResults);
    }

    if (query.length < this.config.minMatchCharLength) {
      return [];
    }

    // Check cache first
    if (this.cache.has(query)) {
      this.metrics.cacheHits++;
      return this.cache.get(query);
    }

    this.metrics.cacheMisses++;

    // Perform search
    const results = this.performSearch(query);

    // Cache results
    this.setCache(query, results);

    // Track performance
    this.trackSearch(performance.now() - startTime);

    return results;
  }

  /**
   * Core search implementation
   */
  performSearch(query) {
    const queryLower = this.config.caseSensitive ? query : query.toLowerCase();
    const queryLength = queryLower.length;

    // Calculate scores for all items
    const scoredResults = this.index
      .map(indexed => ({
        item: indexed.item,
        score: this.calculateScore(queryLower, indexed),
        type: indexed.type,
        isCommonPair: indexed.isCommonPair
      }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxResults);

    // Format results based on configuration
    if (this.config.includeScore) {
      return scoredResults;
    } else {
      return scoredResults.map(result => result.item);
    }
  }

  /**
   * Calculate score using configuration
   */
  calculateScore(query, indexed) {
    const candidate = indexed.lower;
    const candidateLength = candidate.length;
    const queryLength = query.length;
    const { scoring } = this.config;

    // Exact match - highest score
    if (candidate === query) {
      return scoring.exactMatchScore;
    }

    // Start of string match - very high score
    if (candidate.startsWith(query)) {
      return scoring.prefixMatchScore + (candidateLength - queryLength) * 2;
    }

    // Contains match - high score
    if (candidate.includes(query)) {
      return scoring.containsMatchScore + (candidateLength - queryLength);
    }

    // Check for abbreviation match
    const abbreviationBonus = this.calculateAbbreviationBonus(query, indexed);
    if (abbreviationBonus > 0) {
      return scoring.abbreviationMatchScore + abbreviationBonus;
    }

    // Fuzzy matching with configurable scoring
    let score = 0;
    let queryIndex = 0;
    let candidateIndex = 0;
    let consecutiveMatches = 0;
    let maxConsecutiveMatches = 0;
    let totalSkips = 0;

    while (queryIndex < queryLength && candidateIndex < candidateLength) {
      if (query[queryIndex] === candidate[candidateIndex]) {
        score += scoring.baseMatchBonus + (consecutiveMatches * scoring.consecutiveMatchBonus);
        consecutiveMatches++;
        maxConsecutiveMatches = Math.max(maxConsecutiveMatches, consecutiveMatches);
        queryIndex++;
      } else {
        consecutiveMatches = 0;
        // Configurable penalty for skipped characters
        score -= scoring.characterSkipPenalty;
        totalSkips++;

        // Early exit optimization
        if (totalSkips > scoring.maxSkipsBeforeExit) {
          return 0;
        }
      }
      candidateIndex++;
    }

    // Bonus for matching all query characters
    if (queryIndex === queryLength) {
      score += scoring.fullQueryBonus;

      // Additional bonus for high consecutive match ratio
      const consecutiveRatio = maxConsecutiveMatches / queryLength;
      score += consecutiveRatio * scoring.consecutiveRatioBonus;

      // Reduced penalty for skips if we matched everything
      score -= totalSkips * 0.1;
    }

    // Configurable penalty for remaining unmatched characters
    const unmatchedPenalty = (candidateLength - queryIndex) * scoring.unmatchedCharacterPenalty;
    score -= unmatchedPenalty;

    // Ratio-based length difference penalty
    const lengthRatio = Math.abs(candidateLength - queryLength) / Math.max(candidateLength, queryLength);
    score -= lengthRatio * scoring.lengthDifferenceMultiplier;

    // Apply trading-specific bonuses
    score += this.applyTradingBonuses(indexed);

    // Proximity bonus
    if (queryIndex === queryLength) {
      const proximityScore = this.calculateProximityScore(query, candidate);
      score += Math.min(proximityScore, scoring.proximityMaxBonus);
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Apply trading-specific bonuses
   */
  applyTradingBonuses(indexed) {
    let bonus = 0;
    const { trading } = this.config;

    // Common pair bonus
    if (indexed.isCommonPair) {
      bonus += trading.commonPairBonus;
    }

    // Type-specific bonuses
    const typeBonuses = getTypeSpecificBonuses(indexed.type);
    bonus += typeBonuses[indexed.type] || 0;

    // Forex pattern bonus
    if (indexed.type === SYMBOL_TYPES.FOREX) {
      bonus += trading.forexPatternBonus;
    }

    return bonus;
  }

  /**
   * Calculate abbreviation bonus using configuration
   */
  calculateAbbreviationBonus(query, indexed) {
    if (query.length < 2 || query.length > 4) return 0;

    const { trading } = this.config;
    const queryLower = query.toLowerCase();

    // Check if query matches the beginning of candidate
    if (indexed.lower.startsWith(queryLower)) {
      const coverageRatio = query.length / indexed.lower.length;
      return Math.round(coverageRatio * 100);
    }

    // Check for common trading abbreviations
    if (trading.abbreviations[queryLower]) {
      const matches = trading.abbreviations[queryLower].filter(abbr =>
        indexed.lower.includes(abbr.toLowerCase()) ||
        abbr.toLowerCase().includes(indexed.lower)
      );
      if (matches.length > 0) {
        return trading.abbreviationBonus;
      }
    }

    // Check reverse abbreviation lookup
    if (this.abbreviationLookup.has(indexed.lower)) {
      const abbreviations = this.abbreviationLookup.get(indexed.lower);
      if (abbreviations.includes(queryLower)) {
        return trading.abbreviationBonus;
      }
    }

    return 0;
  }

  /**
   * Calculate proximity score
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
        return 0;
      }
    }

    // Calculate score based on character proximity
    if (foundPositions.length === query.length) {
      let minTotalDistance = Infinity;

      // Try first occurrence of each character
      let totalDistance = 0;
      for (let i = 1; i < foundPositions.length; i++) {
        const distance = Math.abs(foundPositions[i][0] - foundPositions[i-1][0]);
        totalDistance += distance;
      }
      minTotalDistance = Math.min(minTotalDistance, totalDistance);

      // Convert distance to score
      const maxPossibleDistance = candidate.length * 2;
      const proximityRatio = 1 - (minTotalDistance / maxPossibleDistance);
      proximityScore = Math.round(proximityRatio * 50);
    }

    return Math.max(0, proximityScore);
  }

  /**
   * Cache management
   */
  setCache(key, value) {
    // Remove oldest item if at capacity
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  /**
   * Update items and rebuild index
   */
  updateItems(items) {
    this.items = items;
    this.index = this.buildIndex(items);
    this.cache.clear(); // Clear cache when items change
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.initializeOptimizations();
    this.cache.clear();
  }

  /**
   * Track search performance
   */
  trackSearch(duration) {
    this.metrics.searchCount++;
    this.metrics.totalSearchTime += duration;
    this.metrics.averageSearchTime = this.metrics.totalSearchTime / this.metrics.searchCount;

    // Log slow searches if enabled
    if (duration > this.config.performance.maxSearchTime && this.config.performance.enableMetrics) {
      this.metrics.slowSearchCount++;
      console.warn(`Slow fuzzy search detected: ${duration.toFixed(2)}ms (target: ${this.config.performance.maxSearchTime}ms)`);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      cacheSize: this.cache.size
    };
  }

  /**
   * Clear metrics
   */
  clearMetrics() {
    this.metrics = {
      searchCount: 0,
      totalSearchTime: 0,
      averageSearchTime: 0,
      slowSearchCount: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Get search statistics
   */
  getStats() {
    return {
      itemCount: this.items.length,
      config: this.config,
      metrics: this.getMetrics(),
      symbolTypes: this.getSymbolTypeDistribution()
    };
  }

  /**
   * Get distribution of symbol types
   */
  getSymbolTypeDistribution() {
    const distribution = {};
    for (const type of Object.values(SYMBOL_TYPES)) {
      distribution[type] = 0;
    }

    for (const item of this.index) {
      distribution[item.type]++;
    }

    return distribution;
  }

  /**
   * Highlight matching characters
   */
  highlightMatch(item, query) {
    if (!query || query.length === 0 || !this.config.ui.highlightMatches) {
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
}

/**
 * Create a configured fuzzy search instance
 */
export function createConfigurableSearch(items, options = {}) {
  return new ConfigurableFuzzySearch(items, options);
}

export default ConfigurableFuzzySearch;