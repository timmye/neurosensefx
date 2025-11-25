# NeuroSense FX Skills System

**Purpose**: Comprehensive skills system for Claude Code that ensures consistent testing, implementation, and validation approaches for the NeuroSense FX financial trading platform.

## Skills Overview

### **[TESTING_PROTOCOL.md](./TESTING_PROTOCOL.md)**
**Core testing philosophy and methodology**
- Real application testing only (no isolated components)
- Live WebSocket connections (no synthetic data)
- Complete user workflows (no proxy metrics)
- Environment setup and service management

**When to use**: Always reference before implementing or testing any feature

### **[EVIDENCE_STANDARDS.md](./EVIDENCE_STANDARDS.md)**
**What constitutes valid proof of successful implementation**
- Real application behavior evidence
- Performance measurement from actual usage
- Live data connection validation
- User workflow completion proof

**When to use**: When validating implementation success or writing test assertions

### **[APPLICATION_TESTING.md](./APPLICATION_TESTING.md)**
**How to test the actual NeuroSense FX application**
- Application structure and entry points
- Real DOM element selection patterns
- WebSocket integration testing
- Multi-display management testing

**When to use**: When writing Playwright tests or validating application behavior

### **[PERFORMANCE_VALIDATION.md](./PERFORMANCE_VALIDATION.md)**
**Exact performance requirements and measurement methods**
- Keyboard response under 310ms
- Canvas rendering at 60fps
- Memory stability under 50MB increase
- Real performance measurement techniques

**When to use**: When implementing performance-critical features or measuring system performance

### **[TESTING_FRAMEWORKS.md](./TESTING_FRAMEWORKS.md)**
**Vitest and Playwright usage patterns**
- Unit testing with pure functions only
- E2E testing with real browser automation
- Framework configuration and commands
- Valid vs. invalid testing patterns

**When to use**: When writing tests or choosing the right testing approach

## Usage Guidelines

### **Before Implementation**
1. **Read [TESTING_PROTOCOL.md](./TESTING_PROTOCOL.md)** - Understand the testing philosophy
2. **Check [APPLICATION_TESTING.md](./APPLICATION_TESTING.md)** - Know the application structure
3. **Review [PERFORMANCE_VALIDATION.md](./PERFORMANCE_VALIDATION.md)** - Understand requirements

### **During Implementation**
1. **Reference [TESTING_FRAMEWORKS.md](./TESTING_FRAMEWORKS.md)** - Use correct testing patterns
2. **Follow [EVIDENCE_STANDARDS.md](./EVIDENCE_STANDARDS.md)** - Collect valid evidence
3. **Adhere to [TESTING_PROTOCOL.md](./TESTING_PROTOCOL.md)** - Avoid anti-patterns

### **After Implementation**
1. **Validate with [EVIDENCE_STANDARDS.md](./EVIDENCE_STANDARDS.md)** - Ensure valid proof
2. **Test with [APPLICATION_TESTING.md](./APPLICATION_TESTING.md)** - Use real app testing
3. **Verify with [PERFORMANCE_VALIDATION.md](./PERFORMANCE_VALIDATION.md)** - Check performance

## Quick Reference

### **Application URLs**
- **Development**: `http://localhost:5174` (via `./run.sh dev`)
- **Production**: `http://localhost:4173` (via `./run.sh start`)

### **WebSocket Services**
- **Development**: `ws://localhost:8080`
- **Production**: `ws://localhost:8081`

### **Key Commands**
```bash
npm run test:unit              # Vitest pure function tests
npm run test:e2e               # Playwright real browser tests
npm run test:all               # Both test suites
npm run test:e2e:headed        # Visible browser testing
```

### **Performance Requirements**
- **Keyboard Response**: Under 310ms
- **Canvas Creation**: Under 1000ms
- **Data-to-Visual**: Sub-100ms latency
- **Memory Stability**: <50MB increase during usage

## Anti-Pattern Prevention

### **🚫 FORBIDDEN PATTERNS**
1. **Isolated Test Pages**: Never create `test.html` or standalone components
2. **Synthetic Data**: Never mock WebSocket connections or market data
3. **Proxy Validation**: Never use file sizes, coverage, or synthetic benchmarks
4. **Mock Browsers**: Never test browser features outside Playwright

### **✅ REQUIRED PATTERNS**
1. **Real Application**: Always test `http://localhost:5174` or `http://localhost:4173`
2. **Live Connections**: Always use real WebSocket backend services
3. **User Workflows**: Always test complete user interactions
4. **Performance Measurement**: Always use `performance.now()` and real browser APIs

## Skills Integration

### **In Claude Code Prompts**
Reference skills directly in prompts:
- "Follow the [TESTING_PROTOCOL.md](./TESTING_PROTOCOL.md) skill for implementation"
- "Validate using the [EVIDENCE_STANDARDS.md](./EVIDENCE_STANDARDS.md) skill"
- "Test according to [APPLICATION_TESTING.md](./APPLICATION_TESTING.md) patterns"

### **For Validation Agents**
Skills provide the ground truth for:
- Whether testing approaches are valid
- What counts as successful implementation
- How to measure performance correctly
- Which testing framework to use for what

## Example Usage

### **Implementation Prompt with Skills**
```
Implement a new visualization component for NeuroSense FX.

Requirements:
- Create canvas-based visualization following DPR-aware rendering patterns
- Integrate with existing displayStore and WebSocket data flow
- Test complete user workflow: Ctrl+K → symbol selection → display creation
- Validate performance under 310ms keyboard response
- Use real market data from WebSocket connection

Reference:
- [TESTING_PROTOCOL.md](./TESTING_PROTOCOL.md) for testing approach
- [APPLICATION_TESTING.md](./APPLICATION_TESTING.md) for application structure
- [PERFORMANCE_VALIDATION.md](./PERFORMANCE_VALIDATION.md) for performance requirements
```

### **Validation Prompt with Skills**
```
Validate that the new symbol palette feature works correctly.

Evidence required:
- Real application screenshots showing palette opening and symbol selection
- Performance measurements from actual user interactions
- Console logs showing successful WebSocket connections
- Complete workflow video from Ctrl+K to display creation

Use [EVIDENCE_STANDARDS.md](./EVIDENCE_STANDARDS.md) to validate evidence quality.
```

## Skills as Ground Truth

These skills serve as the authoritative reference for:
1. **How to test**: Real application testing only
2. **What to test**: Complete user workflows with live data
3. **How to measure**: Real performance metrics from actual usage
4. **What counts as success**: Valid evidence from real application behavior

Any deviation from these skills should be considered incorrect implementation or testing approach.

## Project-Specific Context

This skills system is tailored specifically to NeuroSense FX:
- **Financial Trading Platform**: Real-time market data visualization
- **Performance-Critical**: 60fps rendering with sub-100ms latency
- **Keyboard-First**: Rapid interaction for active trading
- **Professional Use**: Extended trading sessions with multiple displays
- **Real Data**: Live WebSocket connections to cTrader integration

The skills prevent common anti-patterns that would compromise the platform's reliability and performance for professional trading workflows.

---