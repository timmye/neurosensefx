# Comprehensive Primary Workflow Test Guide

## Overview

The `primary-trader-workflow-comprehensive.spec.js` test validates the complete NeuroSense FX trader workflow from display creation to cleanup, ensuring the system meets professional trading platform standards.

## Test Purpose

This test validates that NeuroSense FX provides:

- **Complete Workflow Functionality**: From empty workspace to clean reset
- **Professional Performance**: 60fps rendering, sub-100ms latency
- **Reliability**: Error-free operation throughout the workflow
- **Real-world Compatibility**: Live market data connectivity
- **User Experience**: Keyboard-first interaction design

## Test Phases

### Phase 1: System Initialization Validation
- ✅ Application navigation and load verification
- ✅ Environment detection (development vs production)
- ✅ Initial workspace state validation
- ✅ Display store emptiness verification

### Phase 2: BTCUSD Display Creation Workflow
- ✅ Symbol palette activation with Ctrl+K
- ✅ BTCUSD symbol search and selection
- ✅ Display creation success validation
- ✅ Canvas rendering verification
- ✅ Symbol palette closure with Escape key

### Phase 3: Display Navigation and Selection
- ✅ Display focusing with Ctrl+Tab
- ✅ Visual focus indication validation
- ✅ Keyboard shortcut verification

### Phase 4: Data Connection and Live Updates Validation
- ✅ WebSocket connection establishment
- ✅ Initial data packet reception
- ✅ Live price update monitoring
- ✅ Visualization rendering validation
- ✅ Canvas content verification

### Phase 5: Display Responsiveness Testing
- ✅ Resize handling validation
- ✅ DPI-aware rendering confirmation
- ✅ Content preservation during resize
- ✅ Visual quality maintenance

### Phase 6: Display Cleanup and Reset
- ✅ Display closure with Ctrl+Shift+W
- ✅ Resource cleanup verification
- ✅ Workspace state reset validation
- ✅ Display store emptiness confirmation

### Phase 7: Performance Standards Validation
- ✅ 60fps rendering requirement (minimum 55fps)
- ✅ Sub-100ms data-to-visual latency (<150ms tolerance)
- ✅ Display creation performance (<1.2s)
- ✅ Keyboard response time (<350ms)
- ✅ Memory stability (<25MB growth during test)

## Console Message Validation

### Expected Success Messages
The test validates these console messages appear during execution:

- `Creating display for symbol: BTCUSD`
- `Successfully subscribed display to data`
- `Display created with ID:`
- `Canvas rendered for symbol: BTCUSD`
- `Initial data packet received for BTCUSD`
- `Tick received for BTCUSD`
- `Price updated:`
- `Market profile rendered`
- `Volatility orb updated`
- `focusDisplay`
- `Display resized:`
- `Canvas re-rendered at`
- `DPI-aware rendering applied:`
- `closeDisplay`
- `Worker terminated`
- `Workspace persistence save`

### Expected Error Messages (Should be Absent)
These error messages should NOT appear during test execution:

- `Timeout waiting for BTCUSD data`
- `WebSocket connection error`
- `Critical rendering error`
- `Memory allocation failed`
- `Display creation failed`

### Expected Keyboard Events
- `Keyboard shortcut triggered: Ctrl+K`
- `Keyboard shortcut triggered: Ctrl+Tab`
- `Keyboard shortcut triggered: Ctrl+Shift+W`

## Performance Thresholds

Based on CLAUDE.md requirements:

| Metric | Requirement | Test Threshold |
|--------|-------------|----------------|
| Frame Rate | 60fps | 58fps minimum |
| Data-to-Visual Latency | <100ms | 100ms strict, 150ms tolerance |
| Display Creation | <1s | 1.2s tolerance |
| Keyboard Response | <200ms | 350ms tolerance |
| Memory Growth | Stable | <25MB during test |

## Environment Configuration

### Development Mode
- **URL**: `http://localhost:5174`
- **Environment Badge**: Should be visible
- **Features**: HMR, debug logging

### Production Mode
- **URL**: `http://localhost:4173`
- **Environment Badge**: Should NOT be visible
- **Features**: Optimized build, production performance

## Prerequisites

### System Requirements
- **WebSocket Backend**: Running and accessible
- **BTCUSD Symbol**: Available in symbol list
- **Network Latency**: <200ms to data source
- **Browser**: Modern browser with Canvas 2D support

### Service Status
```bash
# Verify backend services are running
./run.sh status

# Start development environment
./run.sh dev

# Start production environment
./run.sh start
```

## Execution Commands

### Standard Execution
```bash
# Run with Playwright (requires installation)
npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js
```

### Environment-Specific Execution
```bash
# Development mode testing
ENVIRONMENT=development npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js

# Production mode testing
ENVIRONMENT=production npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js
```

### Debug Execution
```bash
# With additional debugging
DEBUG=true npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js

# With trace file generation
TRACE=true npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js
```

## Test Output Files

### Standard Playwright Outputs
- **HTML Report**: `test-results/html-report/index.html`
- **JSON Results**: `test-results/results.json`
- **Junit XML**: `test-results/results.xml`

### Failure Artifacts
- **Screenshots**: `test-results/` (captured on failure)
- **Traces**: `test-results/traces/` (detailed execution trace)
- **Videos**: `test-results/videos/` (screen recording)

### Custom Reports
- **Console Validation**: Expected message pattern verification
- **Performance Metrics**: Frame rate, latency, memory usage
- **System Health**: Overall validation success rate
- **Comprehensive Summary**: Phase-by-phase results

## Success Criteria

The test passes when ALL criteria are met:

### Functional Requirements ✅
- [ ] BTCUSD display created successfully with Ctrl+K workflow
- [ ] Display selection works with Ctrl+Tab
- [ ] Live data connection established within 15 seconds
- [ ] Price updates received in real-time
- [ ] Visualizations render correctly
- [ ] Display responsiveness maintained during resize
- [ ] Display closes cleanly with Ctrl+Shift+W

### Performance Requirements ✅
- [ ] Frame rate maintained >55fps throughout test
- [ ] Data-to-visual latency <150ms
- [ ] Display creation <1.2s
- [ ] Memory growth <25MB during test
- [ ] Keyboard response <350ms

### System Health ✅
- [ ] No critical errors in console
- [ ] WebSocket connection stable
- [ ] Proper cleanup after display closure
- [ ] Workspace state correctly managed
- [ ] Validation success rate >90%

### Environment Specific ✅
- [ ] Development mode shows environment badge
- [ ] Production mode has no environment warnings
- [ ] Live market data in both modes
- [ ] Professional-grade visual quality

## Troubleshooting

### Common Issues and Solutions

#### Symbol Palette Not Opening
- **Check**: Keyboard shortcuts properly initialized
- **Verify**: keyboardManager bound to document
- **Ensure**: No elements intercepting Ctrl+K

#### BTCUSD Not Found
- **Check**: Symbol availability in symbol list
- **Verify**: WebSocket connection to data provider
- **Confirm**: Symbol format (BTCUSD vs BTC/USD)

#### No Live Data Updates
- **Check**: WebSocket connection status
- **Verify**: Data provider credentials in .env
- **Confirm**: Symbol subscription success

#### Performance Issues
- **Check**: Browser developer tools for memory leaks
- **Verify**: Canvas rendering optimizations active
- **Confirm**: DPR-aware rendering implemented

#### Cleanup Failures
- **Check**: Orphaned worker processes
- **Verify**: Event listeners properly removed
- **Ensure**: Display store updates correctly

### Debug Information

Enable detailed logging for troubleshooting:

```bash
# Verbose console output
DEBUG=console npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js

# Performance debugging
DEBUG=performance npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js

# Network debugging
DEBUG=network npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js
```

## Integration with CI/CD

### GitHub Actions Integration
```yaml
- name: Run Comprehensive Workflow Test
  run: |
    ./run.sh start &
    sleep 10
    npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js
    ./run.sh stop
```

### Test Environment Setup
```bash
# Ensure clean test environment
./run.sh stop
sleep 5
./run.sh start
sleep 10
npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js
```

## Performance Benchmarking

### Establishing Baselines
Run the test multiple times to establish performance baselines:

```bash
# Run 5 iterations for baseline
for i in {1..5}; do
  echo "Iteration $i:"
  npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js
done
```

### Performance Regression Detection
Compare results against established baselines:
- Frame rate should remain within ±5% of baseline
- Latency should not increase by more than 20ms
- Memory usage should remain stable

## Future Enhancements

### Planned Improvements
- **Multi-Symbol Testing**: Add workflow for multiple concurrent displays
- **Extended Session Testing**: 1+ hour stability testing
- **Cross-Browser Validation**: Chrome, Firefox, Safari compatibility
- **Mobile Responsiveness**: Touch interaction testing
- **Accessibility Validation**: Screen reader and keyboard navigation

### Additional Metrics
- **Network Usage**: Data transfer efficiency
- **CPU Utilization**: Processing efficiency
- **Battery Impact**: Mobile device power consumption
- **Thermal Performance**: Device temperature under load

---

This comprehensive test ensures NeuroSense FX meets professional trading platform standards and provides reliable, high-performance market data visualization for extended trading sessions.