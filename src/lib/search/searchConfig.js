/**
 * Search Configuration for NeuroSense FX
 *
 * Centralized configuration for fuzzy search parameters,
 * trading bonuses, and search behavior.
 */

/**
 * Default search configuration
 */
export const DEFAULT_SEARCH_CONFIG = {
  // Core search parameters
  threshold: 0.6,
  caseSensitive: false,
  includeScore: true,
  maxResults: 50,
  minMatchCharLength: 1,

  // Scoring weights and penalties
  scoring: {
    exactMatchScore: 1000,
    prefixMatchScore: 800,
    containsMatchScore: 600,
    abbreviationMatchScore: 400,

    // Penalties (reduced for more forgiving search)
    characterSkipPenalty: 0.2,
    unmatchedCharacterPenalty: 1.5,
    lengthDifferenceMultiplier: 20,

    // Bonuses
    baseMatchBonus: 10,
    consecutiveMatchBonus: 5,
    fullQueryBonus: 50,
    consecutiveRatioBonus: 30,
    proximityMaxBonus: 50,

    // Performance optimization
    earlyExitThreshold: 0.1,
    maxSkipsBeforeExit: 50
  },

  // Trading-specific bonuses
  trading: {
    commonPairBonus: 50,
    forexPatternBonus: 25,
    cryptoBonus: 30,
    commodityBonus: 35,
    abbreviationBonus: 80,

    // Common trading pairs (expanded)
    commonPairs: [
      // Major pairs
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
      // Cross pairs
      'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY', 'CADJPY', 'CHFJPY',
      'NZDJPY', 'EURNZD', 'EURCAD', 'EURAUD', 'GBPCHF', 'GBPAUD', 'GBPCAD',
      'GBPNZD', 'AUDCHF', 'AUDNZD', 'CADCHF', 'NZDCHF',
      // Precious metals
      'XAUUSD', 'XAGUSD', 'XAUJPY', 'XAGJPY',
      // Crypto
      'BTCUSD', 'ETHUSD', 'BTCUSDT', 'ETHUSDT', 'BTCJPY', 'ETHJPY',
      // Additional popular pairs
      'USDCAD', 'USDNOK', 'USDSEK', 'EURSEK', 'EURNOK'
    ],

    // Common abbreviations
    abbreviations: {
      'eur': ['euro', 'eurusd', 'eur', 'eurgbp', 'eurjpy', 'eurcad', 'euraud', 'eurczk'],
      'gbp': ['pound', 'gbpusd', 'gbp', 'gbpjpy', 'gbpchf', 'gbpaud', 'gbpcad', 'gbpnzd'],
      'usd': ['dollar', 'eurusd', 'gbpusd', 'usdjpy', 'usdcad', 'usdchf', 'audusd', 'nzdusd'],
      'jpy': ['yen', 'usdjpy', 'eurjpy', 'gbpjpy', 'audjpy', 'cadjpy', 'chfjpy', 'nzdjpy'],
      'aud': ['aussie', 'audusd', 'aud', 'audjpy', 'audchf', 'audnzd', 'audcad'],
      'cad': ['loonie', 'usdcad', 'cad', 'cadjpy', 'cadchf', 'eurcad', 'gbpcad'],
      'chf': ['swissy', 'usdchf', 'chf', 'chfjpy', 'eurchf', 'gbpchf', 'audchf', 'cadchf'],
      'nzd': ['kiwi', 'nzdusd', 'nzd', 'nzdjpy', 'nzdjpy', 'audnzd', 'eurnzd', 'gbpnzd'],
      'xau': ['gold', 'xauusd', 'goldusd', 'xaujpy', 'goldjpy'],
      'xag': ['silver', 'xagusd', 'silverusd', 'xagjpy', 'silverjpy'],
      'btc': ['bitcoin', 'btcusd', 'btcusdt', 'btcjpy', 'bitcoinusd'],
      'eth': ['ethereum', 'ethusd', 'ethusdt', 'ethjpy', 'ethereumusd']
    }
  },

  // Performance settings
  performance: {
    debounceDelay: 300,
    progressiveDebounce: true,
    cacheSize: 100,
    maxSearchTime: 100,
    enableMetrics: true,
    batchSize: 1000
  },

  // UI behavior
  ui: {
    preserveSearchAfterAction: true,
    highlightMatches: true,
    showAbbreviations: true,
    showTradingBonuses: false,
    sortResults: true,
    groupByType: false
  }
};

/**
 * Environment-specific configurations
 */
export const ENVIRONMENT_CONFIGS = {
  development: {
    ...DEFAULT_SEARCH_CONFIG,
    performance: {
      ...DEFAULT_SEARCH_CONFIG.performance,
      enableMetrics: true,
      logSlowSearches: true
    },
    ui: {
      ...DEFAULT_SEARCH_CONFIG.ui,
      showTradingBonuses: true,
      showScores: true
    }
  },

  production: {
    ...DEFAULT_SEARCH_CONFIG,
    performance: {
      ...DEFAULT_SEARCH_CONFIG.performance,
      enableMetrics: false,
      logSlowSearches: false
    },
    ui: {
      ...DEFAULT_SEARCH_CONFIG.ui,
      showTradingBonuses: false,
      showScores: false
    }
  },

  testing: {
    ...DEFAULT_SEARCH_CONFIG,
    maxResults: 10,
    performance: {
      ...DEFAULT_SEARCH_CONFIG.performance,
      debounceDelay: 0,
      cacheSize: 10
    }
  }
};

/**
 * Get configuration for current environment
 */
export function getSearchConfig(environment = 'production') {
  return ENVIRONMENT_CONFIGS[environment] || ENVIRONMENT_CONFIGS.production;
}

/**
 * Merge user configuration with defaults
 */
export function mergeSearchConfig(baseConfig, userConfig) {
  const merged = { ...baseConfig };

  for (const [key, value] of Object.entries(userConfig)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      merged[key] = { ...merged[key], ...value };
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Validate search configuration
 */
export function validateSearchConfig(config) {
  const errors = [];

  // Ensure nested objects exist
  if (!config.scoring) {
    errors.push('scoring configuration is required');
  }
  if (!config.trading) {
    errors.push('trading configuration is required');
  }
  if (!config.performance) {
    errors.push('performance configuration is required');
  }

  // Validate numeric parameters
  if (config.threshold < 0 || config.threshold > 1) {
    errors.push('threshold must be between 0 and 1');
  }

  if (config.maxResults < 1 || config.maxResults > 1000) {
    errors.push('maxResults must be between 1 and 1000');
  }

  if (config.performance && config.performance.debounceDelay < 0) {
    errors.push('debounceDelay must be non-negative');
  }

  // Validate scoring parameters
  if (config.scoring) {
    if (config.scoring.characterSkipPenalty < 0 || config.scoring.characterSkipPenalty > 10) {
      errors.push('characterSkipPenalty should be between 0 and 10');
    }
  }

  if (config.performance) {
    if (config.performance.maxSearchTime < 10 || config.performance.maxSearchTime > 1000) {
      errors.push('maxSearchTime should be between 10 and 1000ms');
    }
  }

  // Validate trading configuration
  if (config.trading) {
    if (!Array.isArray(config.trading.commonPairs)) {
      errors.push('commonPairs must be an array');
    }

    if (typeof config.trading.abbreviations !== 'object') {
      errors.push('abbreviations must be an object');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create a search configuration factory
 */
export function createSearchConfig(overrides = {}, environment = 'production') {
  const baseConfig = getSearchConfig(environment);
  const finalConfig = mergeSearchConfig(baseConfig, overrides);

  const validation = validateSearchConfig(finalConfig);
  if (!validation.isValid) {
    console.warn('Invalid search configuration:', validation.errors);
  }

  return finalConfig;
}

/**
 * Symbol type detection
 */
export const SYMBOL_TYPES = {
  FOREX: 'forex',
  CRYPTO: 'crypto',
  COMMODITY: 'commodity',
  INDEX: 'index',
  STOCK: 'stock',
  UNKNOWN: 'unknown'
};

/**
 * Detect symbol type based on pattern
 */
export function detectSymbolType(symbol) {
  const upperSymbol = symbol.toUpperCase();

  // Crypto patterns
  if (upperSymbol.includes('BTC') || upperSymbol.includes('ETH')) {
    return SYMBOL_TYPES.CRYPTO;
  }

  // Commodity patterns
  if (upperSymbol.includes('XAU') || upperSymbol.includes('XAG') ||
      upperSymbol.includes('GOLD') || upperSymbol.includes('SILVER')) {
    return SYMBOL_TYPES.COMMODITY;
  }

  // Forex patterns (6 characters = typical forex pair)
  if (/^[A-Z]{6}$/.test(upperSymbol) || /^[A-Z]{3}USD$/.test(upperSymbol)) {
    return SYMBOL_TYPES.FOREX;
  }

  return SYMBOL_TYPES.UNKNOWN;
}

/**
 * Get type-specific bonuses
 */
export function getTypeSpecificBonuses(symbolType) {
  const bonuses = {
    [SYMBOL_TYPES.FOREX]: 0,
    [SYMBOL_TYPES.CRYPTO]: 0,
    [SYMBOL_TYPES.COMMODITY]: 0,
    [SYMBOL_TYPES.INDEX]: 0,
    [SYMBOL_TYPES.STOCK]: 0,
    [SYMBOL_TYPES.UNKNOWN]: 0
  };

  const config = getSearchConfig();

  switch (symbolType) {
    case SYMBOL_TYPES.FOREX:
      bonuses[symbolType] = config.trading.commonPairBonus;
      break;
    case SYMBOL_TYPES.CRYPTO:
      bonuses[symbolType] = config.trading.cryptoBonus;
      break;
    case SYMBOL_TYPES.COMMODITY:
      bonuses[symbolType] = config.trading.commodityBonus;
      break;
    default:
      break;
  }

  return bonuses;
}

export default {
  DEFAULT_SEARCH_CONFIG,
  ENVIRONMENT_CONFIGS,
  getSearchConfig,
  mergeSearchConfig,
  validateSearchConfig,
  createSearchConfig,
  detectSymbolType,
  getTypeSpecificBonuses,
  SYMBOL_TYPES
};