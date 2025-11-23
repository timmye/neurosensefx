# NeuroSense FX Unit Testing

This document covers the unit testing framework for NeuroSense FX, focusing on pure utility function testing without canvas mocks.

## Overview

The unit testing framework uses Vitest to test core business logic, calculations, and transformations without complex DOM or canvas API mocking. This approach ensures fast, reliable tests that target the mathematical accuracy and business logic of the trading visualization platform.

## Test Structure

```
tests/
├── unit/                         # Pure unit tests
│   ├── coordinateStore.test.js   # Coordinate transformation utilities
│   ├── priceFormatting.test.js   # Price formatting and asset classification
│   ├── configDefaults.test.js    # Configuration management and validation
│   └── dayRangeMeter.test.js     # ADR calculations and market data processing
├── integration/                  # Canvas component integration tests
│   └── canvasComponents.test.js  # Real DOM and canvas integration
├── helpers/                      # Test utilities
│   ├── fixtures.js              # Existing test data
│   └── marketDataGenerator.js   # Enhanced financial data generation
├── vitest.config.js             # Vitest configuration
└── UNIT_TESTING.md              # This file
```

## Running Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run unit tests in watch mode
npm run test:unit:watch

# Run unit tests with UI interface
npm run test:unit:ui

# Run unit tests with coverage report
npm run test:unit:coverage

# Run all tests (unit + e2e)
npm run test:all
```

## Test Categories

### 1. Coordinate Transformation Tests (`coordinateStore.test.js`)

**Focus**: Mathematical accuracy of coordinate transformations and bounds checking.

**Key Functions Tested**:
- Price-to-pixel coordinate conversion
- Pixel-to-price inverse transformation
- Normalized coordinate calculations
- Bounds checking and clamping
- DPR (Device Pixel Ratio) handling
- Error handling for edge cases

**Example Test**:
```javascript
it('should create price-to-pixel transformation with correct inversion', () => {
  const state = {
    bounds: { x: [0, 220], y: [0, 120] },
    priceRange: { min: 1.0000, max: 1.1000 }
  };

  const transform = coordinateActions.createPriceToPixelTransform(state);
  const inverse = coordinateActions.createPixelToPriceTransform(state);

  // Test round-trip transformation
  const price = 1.0550;
  const pixel = transform(price);
  const backToPrice = inverse(pixel);

  expect(Math.abs(price - backToPrice)).toBeLessThan(0.0001);
});
```

### 2. Price Formatting Tests (`priceFormatting.test.js`)

**Focus**: Financial precision, asset classification, and display formatting.

**Key Functions Tested**:
- Price formatting with pips and pipettes
- Asset class classification (FX, JPY, Commodities, Crypto)
- Text measurement and caching
- Performance optimization
- Edge case handling (invalid prices, extreme values)

**Asset Classes Covered**:
- **Standard FX**: EUR/USD (5 decimal places)
- **JPY Pairs**: USD/JPY (3 decimal places)
- **Commodities**: Gold, Silver (2 decimal places)
- **Crypto**: Bitcoin, Ethereum (2 decimal places)

**Example Test**:
```javascript
it('should classify assets correctly and format prices appropriately', () => {
  const fxPrice = formatPrice(1.08567, 5);
  expect(fxPrice.classification.type).toBe('FX_STANDARD');
  expect(fxPrice.text.pips).toBe('56');
  expect(fxPrice.text.pipette).toBe('7');

  const jpyPrice = formatPrice(149.82, 3);
  expect(jpyPrice.classification.type).toBe('FX_JPY_STYLE');
  expect(jpyPrice.text.pipette).toBe(''); // No pipette for JPY

  const goldPrice = formatPrice(1985.45, 2);
  expect(goldPrice.classification.type).toBe('HIGH_VALUE_COMMODITY');
});
```

### 3. Configuration Tests (`configDefaults.test.js`)

**Focus**: Configuration management, validation, and state persistence.

**Key Functions Tested**:
- Factory defaults management
- User defaults and overrides
- Configuration merging logic
- Validation and sanitization
- State persistence and import/export
- Error handling for invalid configurations

**Configuration Layers**:
1. **Factory Defaults**: Original immutable values
2. **User Defaults**: Modified persistent values
3. **Display Config**: Runtime display-specific overrides

**Example Test**:
```javascript
it('should merge configuration layers correctly', () => {
  manager.updateUserDefaults({ visualizationsContentWidth: 180 });

  const displayConfig = manager.getDisplayConfig({
    adrAxisPosition: 30,
    showAdrInfo: true
  });

  // Should have user default
  expect(displayConfig.visualizationsContentWidth).toBe(180);
  // Should have display override
  expect(displayConfig.adrAxisPosition).toBe(30);
  // Should have other factory defaults
  expect(displayConfig.meterHeight).toBeDefined();
});
```

### 4. Day Range Meter Tests (`dayRangeMeter.test.js`)

**Focus**: ADR (Average Daily Range) calculations and market data processing.

**Key Functions Tested**:
- ADR percentage calculations
- Session range analysis
- Price position within ADR
- Market scenario handling
- Performance with large datasets

**Market Scenarios**:
- **Normal Trading**: Standard volatility within ADR
- **High Volatility**: Session exceeds ADR boundaries
- **Low Volatility**: Minimal price movement
- **Extreme Markets**: Unusual price behavior

**Example Test**:
```javascript
it('should calculate ADR percentages with proper rounding', () => {
  const state = {
    midPrice: 1.0550,
    todaysHigh: 1.0620,
    todaysLow: 1.0480,
    projectedAdrHigh: 1.0650,
    projectedAdrLow: 1.0450
  };

  const result = calculateMaxAdrPercentage(state);

  // Should round up to 0.25 increments
  expect(result % 0.25).toBeCloseTo(0, 4);
  // Should handle session within ADR
  expect(result).toBeGreaterThanOrEqual(0.5);
});
```

## Integration Tests (`integration/canvasComponents.test.js`)

**Focus**: Canvas component behavior with real DOM elements instead of mocks.

**Key Features**:
- Real canvas element creation
- DOM context simulation with jsdom
- DPR (Device Pixel Ratio) handling
- Text rendering and measurement
- Canvas drawing verification
- Performance testing

**Example Integration Test**:
```javascript
it('should render ADR axis correctly on real canvas', () => {
  const contentArea = { x: 0, y: 0, width: 220, height: 120 };
  const adrAxisX = 30;

  dayRangeMeterFunctions.drawAdrAxis(ctx, contentArea, adrAxisX);

  // Verify drawing calls were made
  expect(ctx.calls).toContainEqual({ method: 'save' });
  expect(ctx.calls).toContainEqual({ method: 'translate', args: [0.5, 0.5] });

  // Verify axis line drawing
  const axisLineCalls = ctx.calls.filter(call =>
    call.method === 'moveTo' && call.args[0] === adrAxisX
  );
  expect(axisLineCalls.length).toBeGreaterThan(0);
});
```

## Test Data Generation

### Market Data Generator (`tests/helpers/marketDataGenerator.js`)

Provides realistic financial data for testing:

```javascript
import { testMarketDataGenerator } from '../helpers/marketDataGenerator.js';

// Generate single tick with volatility
const tick = testMarketDataGenerator.generateTick('EUR/USD', 'high');

// Generate complete trading day state
const dayState = testMarketDataGenerator.generateTradingDayState('GBP/USD', 'normal');

// Generate market scenario data
const bullMarket = testMarketDataGenerator.generateScenarioData('bull-market', [
  'EUR/USD', 'GBP/USD', 'USD/JPY'
]);
```

### Supported Asset Classes

| Asset Class | Symbols | Digits | Spread Calculation |
|-------------|----------|--------|-------------------|
| Forex Major | EUR/USD, GBP/USD | 5 | 0.0001 |
| JPY Pairs | USD/JPY, EUR/JPY | 3 | 0.02 |
| Commodities | GOLD, SILVER | 2 | Price × 0.0001 |
| Indices | SPX, DAX | 2 | Price × 0.0001 |
| Crypto | BTC, ETH | 2 | Price × 0.0001 |

## Financial Testing Considerations

### Precision Requirements

- Use `toBeCloseTo()` for floating-point comparisons
- Test with realistic market data ranges
- Verify edge cases (zero prices, extreme values)
- Maintain sub-pip precision where required

**Example**:
```javascript
// Good: Handles floating point precision
expect(result).toBeCloseTo(10.00001, 5);

// Bad: May fail due to floating point errors
expect(result).toBe(10.00001);
```

### Market Data Realism

- Generate data that reflects actual market behavior
- Test different volatility conditions (low, normal, high, extreme)
- Include various asset classes with appropriate precision
- Simulate realistic spreads and price movements

### Performance Testing

- Verify 60fps rendering capabilities
- Test sub-100ms data-to-display latency
- Ensure memory stability during extended sessions
- Test with 20+ concurrent displays

## Configuration

### Vitest Configuration (`vitest.config.js`)

```javascript
export default defineConfig({
  test: {
    environment: 'jsdom',           // DOM simulation
    globals: true,                  // Global test functions
    coverage: {
      provider: 'v8',               // Coverage engine
      reporter: ['text', 'json', 'html']
    },
    timeout: 5000,                  // Test timeout
    verbose: true,                  // Detailed output
    watch: false                    // CI friendly
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests')
    }
  }
});
```

### Package.json Scripts

```json
{
  "test": "vitest",
  "test:unit": "vitest run",
  "test:unit:watch": "vitest watch",
  "test:unit:ui": "vitest --ui",
  "test:unit:coverage": "vitest run --coverage",
  "test:all": "npm run test:unit && npm run test:e2e"
}
```

## Best Practices

### 1. Test Structure
- **Arrange**: Set up test data and mocks
- **Act**: Call the function being tested
- **Assert**: Verify expected behavior
- **Cleanup**: Reset state if needed

### 2. Financial Accuracy
- Test boundary conditions (min/max values)
- Include negative scenarios (price drops)
- Verify precision requirements are met
- Test different asset class behaviors

### 3. Error Handling
- Test invalid inputs gracefully
- Verify appropriate error messages
- Test recovery mechanisms
- Include edge case scenarios

### 4. Performance
- Benchmark critical calculations
- Test with realistic data volumes
- Verify memory usage is bounded
- Test concurrent operations

### 5. Maintainability
- Use descriptive test names
- Include clear documentation
- Avoid brittle test data
- Focus on behavior over implementation

## Coverage Goals

### Core Modules
- **Coordinate transformations**: 100% coverage
- **Price formatting**: All asset classes and formats
- **Configuration management**: All validation paths
- **Financial calculations**: All ADR and percentage computations

### Quality Metrics
- **Unit test coverage**: > 90%
- **Branch coverage**: > 85%
- **Function coverage**: > 95%
- **Performance tests**: Complete in < 100ms

## Integration with E2E Tests

The unit testing framework complements existing E2E tests:

- **E2E Tests**: Verify user workflows and system integration
- **Unit Tests**: Test individual functions and calculations in isolation
- **Integration Tests**: Bridge between unit and E2E with real DOM interactions

All test types share common fixtures and data generators for consistency.

## Future Enhancements

- **Visual regression testing**: Canvas output comparison
- **Property-based testing**: Generated test cases with QuickCheck-style approach
- **Load testing**: Performance under extreme conditions
- **Accessibility testing**: Screen reader and keyboard navigation
- **Internationalization**: Multi-language and locale testing

Remember: **"Simple, Performant, Maintainable"** applies to tests too! Focus on testing business logic that matters most to traders.