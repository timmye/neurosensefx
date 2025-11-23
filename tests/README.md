# NeuroSense FX E2E Testing with Playwright

This directory contains end-to-end tests for the NeuroSense FX financial trading visualization platform, configured for VSCode container environments using Playwright's built-in capabilities.

## Test Structure

```
tests/
├── e2e/                          # E2E test specifications
│   ├── basic-load.spec.js        # Basic application loading tests
│   ├── canvas-rendering.spec.js  # Canvas rendering performance tests
│   ├── user-interactions.spec.js # User interaction tests
│   ├── performance.spec.js       # Performance benchmarking tests
│   ├── coordinate-precision.spec.js # Coordinate system validation
│   ├── extended-session-stability.spec.js # Long-running session tests
│   ├── user-interaction-workflows.spec.js # Complete user workflows
│   ├── performance-benchmarking.spec.js # Performance validation
│   └── memory-management-cleanup.spec.js # Memory leak detection
├── helpers/                      # Test utilities and fixtures
│   └── fixtures.js              # Test data and configurations
├── global-setup.js              # Global test setup
├── global-teardown.js           # Global test cleanup
└── README.md                    # This file
```

## Available Test Scripts

### Basic Test Execution
```bash
npm run test:e2e                 # Run all E2E tests
npm run test:performance        # Run performance tests only
npm run test:e2e:validation     # Run validation test suite
npm run test:e2e:validation-quick # Quick validation run
```

### Browser-Specific Testing
```bash
npm run test:e2e:chrome         # Run tests on Chrome/Chromium
npm run test:e2e:firefox        # Run tests on Firefox
npm run test:e2e:safari         # Run tests on Safari/WebKit
npm run test:e2e:mobile         # Run tests on mobile viewport
```

### Development and Debugging
```bash
npm run test:e2e:headed         # Run tests with visible browser
npm run test:e2e:debug          # Run tests in debug mode
npm run test:e2e:ui             # Run tests with Playwright UI
npm run test:e2e:codegen        # Generate test code with recorder
```

### Reporting and Results
```bash
npm run test:e2e:report         # View HTML test report
npm run test:e2e:install        # Install browser dependencies
```

## Container-Aware Features

The test suite is specifically configured for VSCode container environments using Playwright's built-in features:

### Browser Configuration
- **Chrome/Chromium**: Optimized for container environments with sandbox disabled and GPU acceleration disabled
- **Firefox**: Configured for reliable operation in headless mode with WebGL enabled
- **Safari/WebKit**: Cross-platform testing capabilities
- **Mobile**: Responsive design testing with touch simulation

### Performance Monitoring
- **Built-in Metrics**: Playwright's native performance tracking
- **Screenshot/Video Capture**: Automatic capture on test failure
- **Trace Recording**: Detailed execution traces for debugging
- **Network Monitoring**: Request/response timing and WebSocket tracking

### Financial Application Testing
- **Market Data Simulation**: Mock data generators for testing
- **Canvas Rendering**: DPR-aware text rendering verification
- **User Interactions**: Mouse, keyboard, and touch event testing

## Test Categories

### 1. Basic Load Tests (`basic-load.spec.js`)
- Application loads without errors
- Canvas elements initialize correctly
- WebSocket connections establish
- Responsive design works across viewports

### 2. Canvas Rendering Tests (`canvas-rendering.spec.js`)
- Market profile rendering verification
- Performance benchmarking
- DPR-aware text rendering quality
- Responsive canvas resizing
- Color gradient rendering

### 3. User Interaction Tests (`user-interactions.spec.js`)
- Mouse event handling
- Context menu functionality
- Keyboard navigation
- Drag and drop operations
- Touch interactions
- Form input handling

### 4. Performance Tests (`performance.spec.js`)
- Memory usage monitoring
- Page load time analysis
- Rendering stress testing
- WebSocket latency measurement
- Resource loading optimization

## Configuration

### Playwright Config (`playwright.config.js`)
- Container-aware browser launch options
- Multiple browser project configurations with financial app optimizations
- Test reporting setup (HTML, JSON, JUnit)
- Global timeout and retry configurations
- Screenshot and video capture on failure
- Trace recording on first retry

### Environment Variables
- `BASE_URL`: Application base URL (default: http://localhost:5174)
- `CI`: Continuous integration flag (affects retries and parallelism)

## Test Fixtures

The `fixtures.js` file provides:

- **Test Data**: Mock market data and symbols
- **Viewports**: Standard screen sizes for testing
- **Selectors**: CSS selectors for UI elements
- **Benchmarks**: Performance threshold values
- **Error Scenarios**: Common error conditions
- **Market Data Generator**: Dynamic data creation for testing

## Running Tests in Development

1. **Start the application**:
   ```bash
   npm run dev  # Development mode on port 5174
   ```

2. **Run tests**:
   ```bash
   npm run test:e2e:debug  # With debugging
   ```

3. **View results**:
   ```bash
   npm run test:e2e:report
   ```

## CI/CD Integration

The test suite is designed for CI/CD environments:

- **Headless Execution**: Tests run without UI
- **Parallel Execution**: Multiple browsers test simultaneously
- **Artifact Collection**: Screenshots, videos, and traces saved
- **Report Generation**: Multiple report formats (HTML, JSON, JUnit)

## Troubleshooting

### Common Issues

1. **Browser Launch Failures**:
   - Ensure system dependencies are installed: `sudo npx playwright install-deps`
   - Check container has sufficient resources

2. **WebSocket Connection Issues**:
   - Verify application is running on expected port
   - Check network policies in container environment

3. **Performance Test Flakiness**:
   - Adjust timeouts for container environment
   - Consider resource constraints

4. **Canvas Rendering Issues**:
   - Verify GPU drivers are available
   - Check display settings in container

### Debug Mode

Run tests with full debugging:
```bash
npm run test:e2e:debug
```

This will pause execution and open developer tools for inspection.

## Test Data Generation

Use the market data generator for realistic testing:
```javascript
import { marketDataGenerator } from '../helpers/fixtures.js';

const tickData = marketDataGenerator.generateTick('EUR/USD');
const dataStream = marketDataGenerator.generateDataStream(['EUR/USD', 'GBP/USD'], 100);
```

## Best Practices

1. **Use Descriptive Test Names**: Make test names meaningful
2. **Include Assertions**: Verify expected behavior
3. **Cleanup Resources**: Close browsers and contexts
4. **Handle Race Conditions**: Use proper waiting strategies
5. **Monitor Performance**: Track key metrics during tests
6. **Document Scenarios**: Explain complex test logic
7. **Parallel Testing**: Structure tests to run independently
8. **Error Recovery**: Include fallback assertions

## Future Enhancements

- **Visual Regression Testing**: Image comparison capabilities
- **Accessibility Testing**: ARIA and screen reader support
- **API Testing**: Backend integration testing
- **Load Testing**: High-volume user simulation
- **Cross-Browser Matrix**: Extended browser coverage
- **Performance Budgets**: Automated performance regression detection