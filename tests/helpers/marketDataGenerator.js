/**
 * Enhanced Market Data Generator for Testing
 *
 * Provides realistic financial data for unit and integration tests
 * Covers different asset classes and market conditions
 */

export class TestMarketDataGenerator {
  constructor() {
    this.basePrices = {
      // Forex pairs
      'EUR/USD': 1.0857,
      'GBP/USD': 1.2744,
      'USD/JPY': 149.82,
      'AUD/USD': 0.6543,
      'USD/CHF': 0.8756,
      'USD/CAD': 1.3689,
      'EUR/GBP': 0.8523,
      'EUR/JPY': 162.78,

      // Commodities
      'GOLD': 1985.45,
      'SILVER': 24.56,
      'OIL': 78.32,
      'NATGAS': 2.85,

      // Indices
      'SPX': 4567.18,
      'DAX': 16780.23,
      'FTSE': 7542.15,
      'NIKKEI': 32876.50,

      // Crypto
      'BTC': 45678.90,
      'ETH': 2345.67,
      'BNB': 245.67,
      'SOL': 98.45
    };

    this.digitsMap = {
      // Forex pairs
      'EUR/USD': 5,
      'GBP/USD': 5,
      'USD/JPY': 3,
      'AUD/USD': 5,
      'USD/CHF': 5,
      'USD/CAD': 5,
      'EUR/GBP': 5,
      'EUR/JPY': 3,

      // Commodities
      'GOLD': 2,
      'SILVER': 2,
      'OIL': 2,
      'NATGAS': 3,

      // Indices
      'SPX': 2,
      'DAX': 2,
      'FTSE': 2,
      'NIKKEI': 2,

      // Crypto
      'BTC': 2,
      'ETH': 2,
      'BNB': 2,
      'SOL': 2
    };
  }

  /**
   * Generate a single tick with realistic market movement
   */
  generateTick(symbol, volatility = 'normal') {
    const basePrice = this.basePrices[symbol] || 100;
    const digits = this.digitsMap[symbol] || 5;

    // Volatility multipliers for different market conditions
    const volatilityMultipliers = {
      'low': 0.001,
      'normal': 0.002,
      'high': 0.005,
      'extreme': 0.010
    };

    const multiplier = volatilityMultipliers[volatility] || volatilityMultipliers['normal'];
    const variation = (Math.random() - 0.5) * 2 * multiplier;
    const price = basePrice * (1 + variation);

    // Realistic spread based on asset class
    const spread = this.calculateSpread(symbol, price);
    const bid = parseFloat((price - spread / 2).toFixed(digits));
    const ask = parseFloat((price + spread / 2).toFixed(digits));

    return {
      symbol,
      bid,
      ask,
      mid: parseFloat(((bid + ask) / 2).toFixed(digits)),
      spread: parseFloat(spread.toFixed(digits)),
      change: parseFloat((price - basePrice).toFixed(digits)),
      changePercent: parseFloat(((price - basePrice) / basePrice * 100).toFixed(3)),
      timestamp: Date.now(),
      volume: Math.floor(Math.random() * 1000) + 100,
      digits
    };
  }

  /**
   * Calculate realistic spread based on asset class and price
   */
  calculateSpread(symbol, price) {
    const isForex = symbol.includes('/');
    const isCrypto = ['BTC', 'ETH', 'BNB', 'SOL'].includes(symbol);
    const isCommodity = ['GOLD', 'SILVER', 'OIL', 'NATGAS'].includes(symbol);

    if (isForex) {
      if (symbol.includes('JPY')) {
        return 0.02; // Typical JPY spread
      }
      return 0.0001; // Typical major pair spread
    }

    if (isCrypto) {
      return price * 0.0001; // 0.01% spread
    }

    if (isCommodity) {
      if (symbol === 'GOLD') {
        return 0.5; // Typical gold spread
      }
      if (symbol === 'SILVER') {
        return 0.02; // Typical silver spread
      }
      return price * 0.0005; // 0.05% spread for other commodities
    }

    // Default spread
    return price * 0.0001;
  }

  /**
   * Generate a complete trading day state for testing visualizations
   */
  generateTradingDayState(symbol, volatility = 'normal') {
    const basePrice = this.basePrices[symbol] || 100;
    const digits = this.digitsMap[symbol] || 5;
    const adrPercentage = 0.01 + (Math.random() * 0.02); // 1-3% ADR

    const openPrice = basePrice;
    const adrHigh = openPrice * (1 + adrPercentage);
    const adrLow = openPrice * (1 - adrPercentage);

    // Generate realistic session range within ADR
    const sessionRange = adrPercentage * (0.3 + Math.random() * 0.4); // 30-70% of ADR
    const sessionHigh = openPrice + (openPrice * sessionRange * (Math.random() * 2 - 1));
    const sessionLow = openPrice - (openPrice * sessionRange * (Math.random() * 2 - 1));

    // Current price somewhere in the session range
    const currentRange = sessionHigh - sessionLow;
    const currentPrice = sessionLow + (currentRange * Math.random());

    return {
      symbol,
      midPrice: parseFloat(openPrice.toFixed(digits)),
      currentPrice: parseFloat(currentPrice.toFixed(digits)),
      todaysHigh: parseFloat(Math.max(sessionHigh, currentPrice).toFixed(digits)),
      todaysLow: parseFloat(Math.min(sessionLow, currentPrice).toFixed(digits)),
      projectedAdrHigh: parseFloat(adrHigh.toFixed(digits)),
      projectedAdrLow: parseFloat(adrLow.toFixed(digits)),
      digits,
      adrValue: parseFloat((adrHigh - adrLow).toFixed(digits)),
      timestamp: Date.now()
    };
  }

  /**
   * Generate multiple trading day states for different assets
   */
  generateMultipleDayStates(symbols, volatility = 'normal') {
    return symbols.map(symbol => this.generateTradingDayState(symbol, volatility));
  }

  /**
   * Generate a stream of price data over time
   */
  generatePriceStream(symbol, count = 100, volatility = 'normal', timeframe = 1000) {
    const stream = [];
    let lastPrice = this.basePrices[symbol] || 100;
    const digits = this.digitsMap[symbol] || 5;

    for (let i = 0; i < count; i++) {
      const tick = this.generateTick(symbol, volatility);
      lastPrice = tick.mid;

      // Add some trend and mean reversion
      const trendFactor = Math.sin(i * 0.1) * 0.001;
      const meanReversion = (this.basePrices[symbol] - lastPrice) * 0.01;

      lastPrice = lastPrice + trendFactor + meanReversion;
      lastPrice = parseFloat(lastPrice.toFixed(digits));

      stream.push({
        ...tick,
        mid: lastPrice,
        timestamp: Date.now() + (i * timeframe),
        sequence: i
      });
    }

    return stream;
  }

  /**
   * Generate test data for specific market scenarios
   */
  generateScenarioData(scenario, symbols) {
    const scenarios = {
      'bull-market': {
        volatility: 'normal',
        bias: 0.002,
        description: 'Gradually rising market with normal volatility'
      },
      'bear-market': {
        volatility: 'high',
        bias: -0.003,
        description: 'Falling market with increased volatility'
      },
      'sideways': {
        volatility: 'low',
        bias: 0.0001,
        description: 'Range-bound market with low volatility'
      },
      'volatile': {
        volatility: 'extreme',
        bias: 0,
        description: 'High volatility with no clear direction'
      }
    };

    const config = scenarios[scenario] || scenarios['sideways'];
    const data = {};

    symbols.forEach(symbol => {
      let basePrice = this.basePrices[symbol] || 100;
      const digits = this.digitsMap[symbol] || 5;
      const dayData = [];

      // Generate intraday price action
      for (let hour = 0; hour < 8; hour++) {
        const trend = config.bias * hour;
        const randomWalk = (Math.random() - 0.5) * 0.01;
        const price = basePrice * (1 + trend + randomWalk);

        dayData.push(parseFloat(price.toFixed(digits)));
      }

      const high = Math.max(...dayData);
      const low = Math.min(...dayData);
      const open = dayData[0];
      const current = dayData[dayData.length - 1];

      // Calculate ADR based on scenario
      const adrMultiplier = config.volatility === 'extreme' ? 0.03 :
                           config.volatility === 'high' ? 0.02 : 0.015;
      const adrValue = basePrice * adrMultiplier;

      data[symbol] = {
        symbol,
        midPrice: parseFloat(open.toFixed(digits)),
        currentPrice: parseFloat(current.toFixed(digits)),
        todaysHigh: parseFloat(high.toFixed(digits)),
        todaysLow: parseFloat(low.toFixed(digits)),
        projectedAdrHigh: parseFloat((open + adrValue).toFixed(digits)),
        projectedAdrLow: parseFloat((open - adrValue).toFixed(digits)),
        digits,
        adrValue: parseFloat(adrValue.toFixed(digits)),
        scenario
      };
    });

    return data;
  }

  /**
   * Generate coordinate transformation test data
   */
  generateCoordinateTestData() {
    return {
      // Standard 220x120 canvas
      canvas: {
        width: 220,
        height: 120,
        bounds: { x: [0, 220], y: [0, 120] }
      },

      // Test price ranges
      priceRanges: [
        {
          name: 'FX pair',
          min: 1.0450,
          max: 1.0650,
          center: 1.0550
        },
        {
          name: 'JPY pair',
          min: 148.50,
          max: 151.50,
          center: 150.00
        },
        {
          name: 'Commodity',
          min: 1970.00,
          max: 2000.00,
          center: 1985.00
        }
      ],

      // Test coordinates and expected transformations
      testPoints: [
        { price: 1.0550, expectedY: 60 }, // Center
        { price: 1.0450, expectedY: 120 }, // Bottom (min)
        { price: 1.0650, expectedY: 0 },   // Top (max)
        { price: 1.0600, expectedY: 30 },  // 75% position
        { price: 1.0500, expectedY: 90 }   // 25% position
      ]
    };
  }

  /**
   * Get asset class information for a symbol
   */
  getAssetClass(symbol) {
    if (symbol.includes('/')) return 'forex';
    if (['GOLD', 'SILVER', 'OIL', 'NATGAS'].includes(symbol)) return 'commodity';
    if (['SPX', 'DAX', 'FTSE', 'NIKKEI'].includes(symbol)) return 'index';
    if (['BTC', 'ETH', 'BNB', 'SOL'].includes(symbol)) return 'crypto';
    return 'unknown';
  }

  /**
   * Validate generated market data for consistency
   */
  validateMarketData(data) {
    const errors = [];

    if (!data.symbol) errors.push('Missing symbol');
    if (typeof data.bid !== 'number' || typeof data.ask !== 'number') errors.push('Invalid bid/ask');
    if (data.bid >= data.ask) errors.push('Invalid spread (bid >= ask)');
    if (typeof data.mid !== 'number') errors.push('Invalid mid price');
    if (Math.abs(data.mid - ((data.bid + data.ask) / 2)) > 0.00001) errors.push('Mid price calculation error');

    // Check trading day state consistency
    if (data.todaysHigh < data.todaysLow) errors.push('Invalid high/low range');
    if (data.projectedAdrHigh < data.projectedAdrLow) errors.push('Invalid ADR range');
    if (data.currentPrice < data.todaysLow || data.currentPrice > data.todaysHigh) {
      errors.push('Current price outside session range');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const testMarketDataGenerator = new TestMarketDataGenerator();

// Export convenience functions
export const generateTick = (symbol, volatility) =>
  testMarketDataGenerator.generateTick(symbol, volatility);

export const generateTradingDayState = (symbol, volatility) =>
  testMarketDataGenerator.generateTradingDayState(symbol, volatility);

export const generateMultipleDayStates = (symbols, volatility) =>
  testMarketDataGenerator.generateMultipleDayStates(symbols, volatility);

export const generateScenarioData = (scenario, symbols) =>
  testMarketDataGenerator.generateScenarioData(scenario, symbols);

export const generateCoordinateTestData = () =>
  testMarketDataGenerator.generateCoordinateTestData();