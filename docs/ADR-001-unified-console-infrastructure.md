# ADR-001: Unified Console Infrastructure for LLM Test Visibility

## Revision log

| Date | Description |
|------|-------------|
| 2025-11-27 | Document created |

## Context

The Unified Console Infrastructure was implemented to provide comprehensive LLM visibility during browser testing by aggregating build logs, browser console errors, WebSocket events, and user interactions with correlation IDs. However, this system interferes with normal service startup processes, causing test failures when backend WebSocket connections are required.

## Decision

We will document the Unified Console Infrastructure architecture and its fundamental conflict with service coordination, accepting that comprehensive visibility comes at the cost of functional testing reliability.

## Consequences

**Benefits:**
- Provides complete LLM visibility across all test execution components
- Enables correlation of build, browser, and test events with unified timestamps
- Captures comprehensive system state for debugging and analysis
- Exports structured data for post-test analysis and reporting

**Tradeoffs:**
- Observer effect: The visibility infrastructure changes system behavior being observed
- Test failures due to interference with multi-service coordination
- Increased complexity in test execution and debugging
- Dependency on custom infrastructure that may break with system changes

**Operational Implications:**
- Tests requiring backend services fail when unified console is active
- Normal `./run.sh dev` service coordination is disrupted
- Development workflow complexity increases for testing scenarios
- Debugging requires understanding both the application and the visibility infrastructure

## Implementation

1. **Unified Console Reporter**: Created `tests/reporters/unified-console-reporter.cjs` to capture build logs, browser console events, and test execution with correlation IDs

2. **Browser Log Injection**: Implemented `vite.config.unified.js` to inject console override scripts that forward browser logs to a unified collection endpoint

3. **Fixture System**: Built `tests/fixtures/unified-console.fixture.cjs` to provide unified console infrastructure to all tests through Playwright's fixture system

4. **Multi-File Export**: System exports data to multiple JSON files including correlation-export.json, health-metrics.json, build-summary.json, browser-sessions.json, and final-summary.json

5. **Service Startup Conflict**: The system interferes with the normal `./run.sh dev` multi-service coordination, causing tests that depend on backend WebSocket connections to fail (3 passed smoke tests vs 12 failed backend-dependent tests)

## Related Decisions

This ADR documents the architectural decision that created the current testing infrastructure conflicts. No existing ADRs were found in the codebase, indicating this may be one of the first formal architectural decisions documented.

## Future Considerations

**Immediate Resolution Options:**
- **Conditional Infrastructure**: Enable unified console only for tests that don't require backend services
- **Service Integration**: Modify unified console to work with the existing `./run.sh dev` service coordination
- **Separate Test Flows**: Create distinct test commands for visibility vs functional testing

**Long-term Architectural Evolution:**
- **Non-Intrusive Observation**: Develop visibility infrastructure that doesn't interfere with system behavior
- **Service-Aware Testing**: Build test infrastructure that understands and works with multi-service architectures
- **Production-Ready Visibility**: Create observability tools that work in both development and production environments

**Observer Effect Mitigation:**
- **Minimal Intervention**: Reduce system modifications required for visibility
- **Async Collection**: Use non-blocking approaches to log and event collection
- **External Observation**: Move visibility infrastructure outside the tested system boundary

## Appendix A: Unified Console Data Flow Architecture

The unified console infrastructure operates through multiple coordinated components:

**Data Collection Flow:**
```
Build Server (npm run dev) → stdout/stderr → UnifiedConsoleReporter → unified-console.log
Browser Console → vite.config.unified.js → localhost:9999/log → UnifiedConsoleReporter
Playwright Tests → Test Events → UnifiedConsoleReporter → Multiple JSON exports
```

**Export Files Structure:**
- `correlation-export.json`: Event correlation tracking across test execution
- `health-metrics.json`: System performance and timing data
- `build-summary.json`: Build server execution statistics
- `browser-sessions.json`: Browser state and interaction logging
- `final-summary.json`: Test run completion summary and metrics

**Key Component Functions:**
- `UnifiedConsoleReporter`: Central event aggregation and formatting
- `Browser Log Capture`: Console method overriding in browser context
- `Correlation Manager`: Test execution tracking with unique IDs
- `Build Log Capture`: Real-time build server output monitoring

## Appendix B: Service Startup Conflict Analysis

**Normal Service Coordination:**
```bash
./run.sh dev  # Starts both frontend (5174) and backend (8080) services
```

**Test Execution with Unified Console:**
```bash
npm run test:e2e  # Playwright starts frontend only, backend coordination fails
```

**Conflict Points:**
1. **Process Management**: Unified console captures stdout/stderr, interfering with service process coordination
2. **Port Competition**: Multiple systems attempting to manage the same service ports
3. **Timing Dependencies**: Visibility infrastructure startup delays service availability
4. **Resource Contention**: Console capture interferes with service communication channels

**Evidence from Test Results:**
- 3 smoke tests passed (basic frontend functionality)
- 12 tests failed (required backend WebSocket connections)
- Build summary shows 1 failed build out of 1 total attempt
- Browser session count shows 0, indicating connection failures

## Appendix C: Configuration Files Integration

**playwright.config.cjs Integration:**
```javascript
webServer: {
  command: 'npm run dev',
  port: 5174,
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000,
}
```

**package.json Test Commands:**
```json
{
  "test:e2e": "playwright test",
  "test:unified": "npm run test:e2e -- --reporter=list,./tests/reporters/unified-console-reporter.cjs",
  "test:logs": "tail -f test-results/unified-console.log",
  "test:summary": "cat test-results/final-summary.json"
}
```

**Service Management Conflict:**
The unified console infrastructure modifies the execution environment that Playwright uses to start services, creating a fundamental conflict between observation and system operation.