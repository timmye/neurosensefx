/**
 * Real Market Data Validation System
 *
 * Comprehensive validation for live cTrader market data ensuring:
 * - Data freshness and real-time accuracy
 * - Market data integrity and consistency
 * - Professional trading performance standards
 * - Real-time WebSocket connection quality
 *
 * No simulated or artificial data - validates actual market conditions.
 */

export class MarketDataValidator {
  constructor() {
    this.validationHistory = new Map();
    this.performanceMetrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageLatency: 0,
      averageFreshness: 0
    };
  }

  /**
   * Validate single tick data in real-time
   */
  validateRealTimeTick(tickData) {
    const validation = {
      timestamp: Date.now(),
      symbol: tickData.symbol,
      isValid: true,
      errors: [],
      warnings: [],
      metrics: {}
    };

    try {
      // Required fields validation
      const requiredFields = ['symbol', 'bid', 'ask', 'timestamp'];
      const missingFields = requiredFields.filter(field => !(field in tickData));

      if (missingFields.length > 0) {
        validation.isValid = false;
        validation.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
        return validation;
      }

      // Symbol validation
      if (typeof tickData.symbol !== 'string' || tickData.symbol.length === 0) {
        validation.isValid = false;
        validation.errors.push('Invalid symbol format');
      }

      // Price validation
      const bidValidation = this.validatePrice(tickData.bid, 'bid');
      const askValidation = this.validatePrice(tickData.ask, 'ask');

      if (!bidValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...bidValidation.errors);
      }
      validation.warnings.push(...bidValidation.warnings);

      if (!askValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...askValidation.errors);
      }
      validation.warnings.push(...askValidation.warnings);

      // Bid-ask spread validation
      const spreadValidation = this.validateBidAskSpread(tickData.bid, tickData.ask);
      if (!spreadValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...spreadValidation.errors);
      }
      validation.warnings.push(...spreadValidation.warnings);
      validation.metrics.spread = spreadValidation.spread;

      // Timestamp validation
      const timestampValidation = this.validateTimestamp(tickData.timestamp);
      if (!timestampValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...timestampValidation.errors);
      }
      validation.metrics.freshness = timestampValidation.freshness;
      validation.warnings.push(...timestampValidation.warnings);

      // Market condition validation
      const marketConditionValidation = this.validateMarketConditions(tickData);
      validation.warnings.push(...marketConditionValidation.warnings);
      validation.metrics.marketCondition = marketConditionValidation.condition;

      // Performance metrics
      validation.metrics.latency = this.calculateLatency(tickData.timestamp);

    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`Validation error: ${error.message}`);
    }

    // Update tracking
    this.updateValidationHistory(tickData.symbol, validation);
    this.updatePerformanceMetrics(validation);

    return validation;
  }

  /**
   * Validate historical market data package
   */
  validateDataPackage(dataPackage) {
    const validation = {
      timestamp: Date.now(),
      symbol: dataPackage.symbol,
      isValid: true,
      errors: [],
      warnings: [],
      metrics: {}
    };

    try {
      // Required fields for data package
      const requiredFields = ['symbol', 'digits', 'adr', 'todaysOpen', 'todaysHigh', 'todaysLow', 'initialPrice'];
      const missingFields = requiredFields.filter(field => !(field in dataPackage));

      if (missingFields.length > 0) {
        validation.isValid = false;
        validation.errors.push(`Missing required package fields: ${missingFields.join(', ')}`);
        return validation;
      }

      // Symbol validation
      if (typeof dataPackage.symbol !== 'string' || dataPackage.symbol.length === 0) {
        validation.isValid = false;
        validation.errors.push('Invalid symbol in data package');
      }

      // Digits validation
      if (typeof dataPackage.digits !== 'number' || dataPackage.digits < 0 || dataPackage.digits > 8) {
        validation.isValid = false;
        validation.errors.push(`Invalid digits value: ${dataPackage.digits}. Must be 0-8.`);
      }

      // Price validation for package
      const prices = {
        todaysOpen: dataPackage.todaysOpen,
        todaysHigh: dataPackage.todaysHigh,
        todaysLow: dataPackage.todaysLow,
        initialPrice: dataPackage.initialPrice,
        projectedAdrHigh: dataPackage.projectedAdrHigh,
        projectedAdrLow: dataPackage.projectedAdrLow
      };

      for (const [priceName, priceValue] of Object.entries(prices)) {
        if (priceValue !== null && priceValue !== undefined) {
          const priceValidation = this.validatePrice(priceValue, priceName);
          if (!priceValidation.isValid) {
            validation.isValid = false;
            validation.errors.push(`Invalid ${priceName}: ${priceValidation.errors.join(', ')}`);
          }
        }
      }

      // ADR validation
      if (typeof dataPackage.adr !== 'number' || dataPackage.adr <= 0) {
        validation.isValid = false;
        validation.errors.push(`Invalid ADR value: ${dataPackage.adr}. Must be positive number.`);
      }

      // Price range validation
      if (dataPackage.todaysHigh <= dataPackage.todaysLow) {
        validation.isValid = false;
        validation.errors.push(`Today's high (${dataPackage.todaysHigh}) must be greater than today's low (${dataPackage.todaysLow})`);
      }

      // ADR projection validation
      if (dataPackage.projectedAdrHigh && dataPackage.projectedAdrLow) {
        if (dataPackage.projectedAdrHigh <= dataPackage.projectedAdrLow) {
          validation.isValid = false;
          validation.errors.push(`Projected ADR high must be greater than projected ADR low`);
        }
      }

      // Market profile validation
      if (dataPackage.initialMarketProfile && Array.isArray(dataPackage.initialMarketProfile)) {
        const profileValidation = this.validateMarketProfile(dataPackage.initialMarketProfile, dataPackage.digits);
        validation.warnings.push(...profileValidation.warnings);
        validation.metrics.marketProfileSize = dataPackage.initialMarketProfile.length;
      }

      // Consistency checks
      const consistencyValidation = this.validateDataConsistency(dataPackage);
      if (!consistencyValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...consistencyValidation.errors);
      }
      validation.warnings.push(...consistencyValidation.warnings);

      // Performance metrics
      validation.metrics.packageAge = this.calculatePackageAge(dataPackage);

    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`Data package validation error: ${error.message}`);
    }

    // Update tracking
    this.updateValidationHistory(dataPackage.symbol, validation);
    this.updatePerformanceMetrics(validation);

    return validation;
  }

  /**
   * Validate individual price value
   */
  validatePrice(price, priceType) {
    const validation = { isValid: true, errors: [], warnings: [] };

    if (typeof price !== 'number' || isNaN(price)) {
      validation.isValid = false;
      validation.errors.push(`${priceType} must be a valid number`);
      return validation;
    }

    if (price <= 0) {
      validation.isValid = false;
      validation.errors.push(`${priceType} must be positive`);
      return validation;
    }

    // Reasonable FX price ranges (most major pairs)
    if (price > 1000) {
      validation.warnings.push(`${priceType} value (${price}) seems unusually high for FX pair`);
    }

    if (price < 0.001) {
      validation.warnings.push(`${priceType} value (${price}) seems unusually low for FX pair`);
    }

    // Check for excessive precision
    const decimalPlaces = this.countDecimalPlaces(price);
    if (decimalPlaces > 8) {
      validation.warnings.push(`${priceType} has excessive precision (${decimalPlaces} decimal places)`);
    }

    return validation;
  }

  /**
   * Validate bid-ask spread
   */
  validateBidAskSpread(bid, ask) {
    const validation = { isValid: true, errors: [], warnings: [], spread: null };

    if (ask <= bid) {
      validation.isValid = false;
      validation.errors.push(`Ask price (${ask}) must be greater than bid price (${bid})`);
      return validation;
    }

    const spread = ask - bid;
    const spreadPips = this.calculateSpreadInPips(bid, ask);
    validation.spread = { absolute: spread, pips: spreadPips };

    // Typical spread ranges for major pairs
    if (spreadPips > 50) {
      validation.warnings.push(`Wide spread detected: ${spreadPips.toFixed(1)} pips`);
    }

    if (spreadPips < 0.1) {
      validation.warnings.push(`Extremely tight spread: ${spreadPips.toFixed(1)} pips (possible data error)`);
    }

    // Check for negative spread (shouldn't happen with proper validation above)
    if (spread < 0) {
      validation.isValid = false;
      validation.errors.push(`Negative spread detected: ${spread}`);
    }

    return validation;
  }

  /**
   * Validate timestamp and data freshness
   */
  validateTimestamp(timestamp) {
    const validation = { isValid: true, errors: [], warnings: [], freshness: null };

    if (typeof timestamp !== 'number' || timestamp <= 0) {
      validation.isValid = false;
      validation.errors.push(`Invalid timestamp: ${timestamp}`);
      return validation;
    }

    const now = Date.now();
    const age = now - timestamp;
    validation.freshness = age;

    // Data freshness requirements
    if (age > 30000) { // 30 seconds
      validation.isValid = false;
      validation.errors.push(`Stale market data: ${age}ms old (max 30s allowed)`);
    } else if (age > 10000) { // 10 seconds
      validation.warnings.push(`Aging market data: ${age}ms old`);
    }

    // Future data check
    if (timestamp > now + 5000) { // 5 seconds tolerance for clock skew
      validation.isValid = false;
      validation.errors.push(`Future timestamp detected: ${timestamp} (current: ${now})`);
    }

    return validation;
  }

  /**
   * Validate market conditions and detect unusual patterns
   */
  validateMarketConditions(tickData) {
    const validation = { warnings: [], condition: 'normal' };

    const spread = tickData.ask - tickData.bid;
    const midPrice = (tickData.bid + tickData.ask) / 2;
    const spreadPercentage = (spread / midPrice) * 100;

    // Detect high volatility (wide spread)
    if (spreadPercentage > 0.1) { // 0.1% spread
      validation.warnings.push(`High volatility detected: spread ${spreadPercentage.toFixed(3)}%`);
      validation.condition = 'high_volatility';
    }

    // Detect extremely tight spreads (possible liquidity issues)
    if (spreadPercentage < 0.001) { // 0.001% spread
      validation.warnings.push(`Extremely tight spread: ${spreadPercentage.toFixed(4)}% (possible liquidity issue)`);
      validation.condition = 'tight_liquidity';
    }

    // Check for round numbers (possible placeholder data)
    if (tickData.bid % 0.00001 === 0 && tickData.ask % 0.00001 === 0) {
      validation.warnings.push('Prices are exact round numbers (possible placeholder data)');
    }

    return validation;
  }

  /**
   * Validate market profile data
   */
  validateMarketProfile(marketProfile, digits) {
    const validation = { warnings: [] };

    if (!Array.isArray(marketProfile)) {
      return { warnings: ['Market profile should be an array'] };
    }

    if (marketProfile.length === 0) {
      validation.warnings.push('Empty market profile data');
      return validation;
    }

    // Validate profile entries
    let invalidEntries = 0;
    for (let i = 0; i < Math.min(marketProfile.length, 10); i++) { // Check first 10 entries
      const entry = marketProfile[i];

      if (!entry || typeof entry !== 'object') {
        invalidEntries++;
        continue;
      }

      const requiredFields = ['open', 'high', 'low', 'close', 'timestamp'];
      const missingFields = requiredFields.filter(field => !(field in entry));

      if (missingFields.length > 0) {
        invalidEntries++;
      }

      // Validate price ranges
      if (entry.high <= entry.low) {
        invalidEntries++;
      }
    }

    if (invalidEntries > 0) {
      validation.warnings.push(`${invalidEntries} invalid market profile entries found`);
    }

    return validation;
  }

  /**
   * Validate data consistency within package
   */
  validateDataConsistency(dataPackage) {
    const validation = { isValid: true, errors: [], warnings: [] };

    // Check if initial price is within today's range
    if (dataPackage.initialPrice && dataPackage.todaysHigh && dataPackage.todaysLow) {
      if (dataPackage.initialPrice > dataPackage.todaysHigh) {
        validation.warnings.push(`Initial price (${dataPackage.initialPrice}) is above today's high (${dataPackage.todaysHigh})`);
      }

      if (dataPackage.initialPrice < dataPackage.todaysLow) {
        validation.warnings.push(`Initial price (${dataPackage.initialPrice}) is below today's low (${dataPackage.todaysLow})`);
      }
    }

    // Check ADR reasonableness
    if (dataPackage.adr && dataPackage.todaysHigh && dataPackage.todaysLow && dataPackage.todaysOpen) {
      const dailyRange = dataPackage.todaysHigh - dataPackage.todaysLow;
      const adrRatio = dailyRange / dataPackage.adr;

      if (adrRatio > 2) {
        validation.warnings.push(`Today's range (${dailyRange.toFixed(5)}) is ${(adrRatio * 100).toFixed(1)}% of ADR - unusual volatility`);
      }

      if (adrRatio < 0.1) {
        validation.warnings.push(`Today's range (${dailyRange.toFixed(5)}) is only ${(adrRatio * 100).toFixed(1)}% of ADR - unusually low volatility`);
      }
    }

    // Validate digits consistency
    if (dataPackage.digits && dataPackage.initialPrice) {
      const decimalPlaces = this.countDecimalPlaces(dataPackage.initialPrice);
      if (Math.abs(decimalPlaces - dataPackage.digits) > 1) {
        validation.warnings.push(`Price precision (${decimalPlaces}) doesn't match symbol digits (${dataPackage.digits})`);
      }
    }

    return validation;
  }

  /**
   * Helper method to count decimal places
   */
  countDecimalPlaces(number) {
    const str = number.toString();
    if (str.indexOf('.') !== -1 && str.indexOf('e-') === -1) {
      return str.split('.')[1].length;
    } else if (str.indexOf('e-') !== -1) {
      const [base, exponent] = str.split('e-');
      return parseInt(exponent, 10);
    }
    return 0;
  }

  /**
   * Calculate spread in pips
   */
  calculateSpreadInPips(bid, ask) {
    const spread = ask - bid;

    // Determine pip size based on price magnitude
    if (bid >= 1) {
      return spread * 10000; // 4 decimal places
    } else {
      return spread * 100000; // 5 decimal places for JPY pairs
    }
  }

  /**
   * Calculate latency from data timestamp
   */
  calculateLatency(dataTimestamp) {
    return Date.now() - dataTimestamp;
  }

  /**
   * Calculate data package age
   */
  calculatePackageAge(dataPackage) {
    // Use the most recent timestamp available
    const timestamps = [];

    if (dataPackage.initialMarketProfile && dataPackage.initialMarketProfile.length > 0) {
      const lastProfileEntry = dataPackage.initialMarketProfile[dataPackage.initialMarketProfile.length - 1];
      if (lastProfileEntry.timestamp) {
        timestamps.push(lastProfileEntry.timestamp);
      }
    }

    if (timestamps.length === 0) {
      return null; // Can't determine age
    }

    const mostRecentTimestamp = Math.max(...timestamps);
    return Date.now() - mostRecentTimestamp;
  }

  /**
   * Update validation history for symbol
   */
  updateValidationHistory(symbol, validation) {
    if (!this.validationHistory.has(symbol)) {
      this.validationHistory.set(symbol, []);
    }

    const history = this.validationHistory.get(symbol);
    history.push(validation);

    // Keep only last 100 validations per symbol
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(validation) {
    this.performanceMetrics.totalValidations++;

    if (validation.isValid) {
      this.performanceMetrics.successfulValidations++;
    } else {
      this.performanceMetrics.failedValidations++;
    }

    // Update latency and freshness averages
    if (validation.metrics.latency) {
      const currentAvg = this.performanceMetrics.averageLatency;
      this.performanceMetrics.averageLatency =
        (currentAvg * (this.performanceMetrics.totalValidations - 1) + validation.metrics.latency)
        / this.performanceMetrics.totalValidations;
    }

    if (validation.metrics.freshness) {
      const currentAvg = this.performanceMetrics.averageFreshness;
      this.performanceMetrics.averageFreshness =
        (currentAvg * (this.performanceMetrics.totalValidations - 1) + validation.metrics.freshness)
        / this.performanceMetrics.totalValidations;
    }
  }

  /**
   * Get validation history for symbol
   */
  getValidationHistory(symbol, limit = 50) {
    const history = this.validationHistory.get(symbol) || [];
    return history.slice(-limit);
  }

  /**
   * Get comprehensive validation report
   */
  getValidationReport() {
    const symbolReports = {};

    for (const [symbol, history] of this.validationHistory) {
      const recentValidations = history.slice(-20); // Last 20 validations
      const validCount = recentValidations.filter(v => v.isValid).length;
      const errorCount = recentValidations.reduce((sum, v) => sum + v.errors.length, 0);
      const warningCount = recentValidations.reduce((sum, v) => sum + v.warnings.length, 0);

      const recentLatencies = recentValidations
        .filter(v => v.metrics.latency)
        .map(v => v.metrics.latency);

      const recentFreshness = recentValidations
        .filter(v => v.metrics.freshness)
        .map(v => v.metrics.freshness);

      symbolReports[symbol] = {
        totalValidations: recentValidations.length,
        successRate: (validCount / recentValidations.length) * 100,
        errorCount,
        warningCount,
        averageLatency: recentLatencies.length > 0
          ? recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length
          : 0,
        maxLatency: recentLatencies.length > 0 ? Math.max(...recentLatencies) : 0,
        averageFreshness: recentFreshness.length > 0
          ? recentFreshness.reduce((a, b) => a + b, 0) / recentFreshness.length
          : 0,
        lastValidation: recentValidations[recentValidations.length - 1]?.timestamp
      };
    }

    return {
      summary: this.performanceMetrics,
      symbols: symbolReports,
      timestamp: Date.now()
    };
  }

  /**
   * Clear validation history
   */
  clearHistory() {
    this.validationHistory.clear();
    this.performanceMetrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageLatency: 0,
      averageFreshness: 0
    };
  }
}

// Singleton instance for easy import
export const marketDataValidator = new MarketDataValidator();

export default MarketDataValidator;