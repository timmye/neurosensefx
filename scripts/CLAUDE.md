# scripts/

Development, deployment, and diagnostic utility scripts.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `backup.sh` | Database backup script | Running backups, scheduling backup jobs |
| `basket-historical-reconstructor.cjs` | FX Basket historical data reconstruction | Rebuilding historical ADR data |
| `build-production.js` | Production build orchestration | Building for production deployment |
| `check_ctrader.cjs` | cTrader API connectivity diagnostic | Troubleshooting cTrader connection issues |
| `diagnose-candle-updates.cjs` | Candle update pipeline diagnostic | Debugging candle data flow issues |
| `setup_claude.sh` | Claude Code setup script | Configuring Claude Code for the project |
| `setup_codespace_db.sh` | Codespace PostgreSQL/Redis setup | Setting up databases in GitHub Codespaces |
| `test-available-symbols.cjs` | cTrader available symbols test | Debugging symbol availability |
| `test-ctrader-subscriptions.cjs` | cTrader subscription flow test | Testing cTrader subscription lifecycle |
| `test-symbol-math-parser.cjs` | Symbol math expression parser test | Testing TradingView expression parsing |
| `test-symbol-math-ticks.cjs` | Symbol math tick streaming test | Testing computed symbol tick delivery |
| `test-tv-expression-resolve.cjs` | TradingView expression resolution test | Debugging TV expression resolution |
| `test-tv-expression-series.cjs` | TradingView expression series test | Testing TV expression series generation |
| `update-dependencies.sh` | Dependency update automation | Updating project dependencies |
