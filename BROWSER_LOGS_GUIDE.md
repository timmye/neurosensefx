# Browser Log Viewer - Quick Guide

## 🎯 What It Does

The browser log viewer provides **direct access to real browser console logs** from your NeuroSense FX application, perfect for debugging and getting LLM visibility into frontend issues.

## 🚀 Quick Start Commands

```bash
# Quick 30-second log capture (default)
npm run browser:logs

# Continuous follow mode - keep capturing until Ctrl+C
npm run browser:logs:follow

# Timed capture for 60 seconds
npm run browser:logs:timed
```

## 📊 What You'll See

The browser log viewer captures and displays:

- **CONSOLE** - All console.log, console.error, console.warn messages
- **ERROR** - Page errors and unhandled exceptions
- **NETWORK** - HTTP requests and API calls
- **PAGE** - Navigation and lifecycle events

### Example Output

```
[36m[2025-11-27T06:26:35.739Z][+158ms][0m [34m[CONSOLE][0m [34mDEBUG[0m: [vite] connecting...
[36m[2025-11-27T06:26:35.857Z][+276ms][0m [34m[CONSOLE][0m [34mLOG[0m: [ENV_UTILS] Initializing development environment...
[36m[2025-11-27T06:26:35.884Z][+303ms][0m [35m[NETWORK][0m [35mGET[0m: http://localhost:5174/api/symbols
[36m[2025-11-27T06:26:35.885Z][+304ms][0m [34m[CONSOLE][0m [31mERROR[0m: [KEYBOARD] Initialization failed: ReferenceError...
```

## 🔧 Advanced Usage

### Custom Duration

```bash
# Capture for 2 minutes
node browser-logs.cjs --duration=120000

# Capture for 10 seconds
node browser-logs.cjs --duration=10000
```

### Follow Mode

```bash
# Keep running until you stop it (Ctrl+C)
node browser-logs.cjs --follow
```

### Disable File Output

```bash
# Only show logs in terminal, don't save to file
node browser-logs.cjs --no-file
```

## 📁 Log Files

All browser logs are automatically saved to:
- `test-results/browser-logs-{timestamp}.json`

The JSON files contain structured data with:
- Timestamps
- Log types (console, network, error)
- Full messages
- Source locations

## 🎯 When to Use

### Perfect For:
- **Debugging initialization issues** - See exactly what happens when the app loads
- **WebSocket connection problems** - Monitor connection attempts and failures
- **State management debugging** - Track store updates and display changes
- **Performance monitoring** - See timing of initialization and data loading
- **LLM visibility** - Give the AI complete insight into frontend behavior

### Common Scenarios:

```bash
# Check for initialization errors
npm run browser:logs

# Monitor WebSocket connection stability
npm run browser:logs:follow

# Debug display creation issues
npm run browser:logs:timed
```

## 🛠️ Requirements

- **Dev server running** on `http://localhost:5174` (default from `npm run dev`)
- **Playwright installed** (`npm run test:install` if needed)

## 🎮 Integration with Unified Console

This browser log viewer complements the existing unified console system:

- **`npm run test:unified`** - Complete test execution with browser logs
- **`npm run browser:logs`** - Standalone browser log capture for debugging
- **`npm run test:logs`** - View saved unified console logs

## 🔍 Example Debugging Session

1. **Start the app**: `npm run dev`
2. **Check for errors**: `npm run browser:logs`
3. **Look for patterns** in the console output
4. **Use follow mode** for ongoing issues: `npm run browser:logs:follow`

The browser log viewer gives you **direct visibility** into what's happening in your NeuroSense FX frontend application!