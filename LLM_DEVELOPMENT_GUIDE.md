# LLM Development Guide for NeuroSense FX

This guide provides LLM developers with clear understanding of the development environment setup and service status awareness.

## 🚀 Quick Start for LLM Developers

### Starting Development
```bash
./run.sh dev
```

**Expected Success Indicators:**
- ✅ Backend started successfully
- ✅ Frontend built successfully and is serving
- ✅ Development environment ready!

**Failure Indicators:**
- ❌ Backend failed to start
- ❌ Frontend build failed or timed out
- ⚠️ Recent errors detected

## 📋 Service Architecture Understanding

### Service Separation
- **Backend**: WebSocket server on `ws://localhost:8080`
- **Frontend**: Vite development server on `http://localhost:5174`
- **Logs**: Backend → `backend.log`, Frontend → Terminal + `frontend.log`

### Development Modes

#### `./run.sh dev` (Recommended for LLM)
- **Purpose**: Active development with verification
- **Frontend**: Runs in terminal (immediate build feedback)
- **Backend**: Runs in background (logs to `backend.log`)
- **HMR**: Enabled (hot module replacement)
- **Verification**: Automatic build success/failure detection

#### `./run.sh start` (Background Mode)
- **Purpose**: Production simulation
- **Both services**: Run in background
- **Verification**: Use `./run.sh status` for health check
- **Logs**: Both services to log files

## 🔍 Service Health Verification

### Check Service Status
```bash
./run.sh status
```

**Healthy Status Output:**
```
✅ Backend: RUNNING (PID: 12345)
   WebSocket: ws://localhost:8080

✅ Frontend: SERVING (PID: 12346)
   URL: http://localhost:5174
   HMR: Active (hot reload enabled)
```

**Unhealthy Status Indicators:**
- `❌ Backend: STOPPED` - Backend process not running
- `❌ Frontend: STOPPED` - Frontend process not running
- `⚠️ Frontend: BUILDING` - Still building, may need more time
- `⚠️ Recent errors detected` - Check log files

### Port Conflict Detection
The status command automatically detects:
- Port 5174 conflicts (frontend)
- Port 8080 conflicts (backend)

## 📝 Log Management

### Log Locations
- **Backend**: Always in `backend.log`
- **Frontend**: Terminal during `dev`, `frontend.log` in background mode
- **Build Errors**: Terminal first, then `frontend.log`

### Viewing Logs
```bash
./run.sh logs           # All logs (tail following)
./run.sh logs backend   # Backend logs only
./run.sh logs frontend  # Frontend logs only
```

### Error Detection
The enhanced script automatically detects recent errors in log files and shows warnings in status output.

## 🛠️ Common LLM Development Patterns

### Starting a Development Session
```bash
# 1. Start with verification
./run.sh dev

# 2. Look for success indicators:
#    ✅ Backend started successfully
#    ✅ Frontend built successfully and is serving
#    ✅ Development environment ready!

# 3. If you see errors, check:
#    ./run.sh status    # Service health
#    ./run.sh logs      # Recent logs
```

### When "I need to run test"
```bash
# Don't assume success - verify!
./run.sh dev

# Wait for completion, then check status:
./run.sh status

# Look for ✅ indicators, not just absence of errors
```

### Debugging Build Issues
```bash
# Check frontend build logs
./run.sh logs frontend

# Check service health
./run.sh status

# Clear and restart
./run.sh stop
./run.sh dev
```

## 🚨 Troubleshooting Guide

### Port Conflicts
```bash
# Kill processes on required ports
pkill -f "vite"           # Frontend port 5174
pkill -f "node.*server.js" # Backend port 8080

# Then restart
./run.sh dev
```

### Build Failures
1. **Check terminal output** - Most errors appear immediately
2. **Check `frontend.log`** - Additional build details
3. **Missing dependencies**: `npm install`
4. **Clear cache**: `rm -rf node_modules/.vite`

### Backend Issues
1. **Check `backend.log`** for connection errors
2. **Verify cTrader connection** in backend logs
3. **Check WebSocket port conflicts**: `netstat -an | grep 8080`

### General Health Check
```bash
./run.sh status    # Comprehensive health report
./run.sh logs      # Recent activity
```

## 💡 Best Practices for LLM Awareness

### DO:
- ✅ Always wait for `./run.sh dev` completion
- ✅ Look for explicit ✅ success indicators
- ✅ Use `./run.sh status` to verify service health
- ✅ Check log files when errors occur
- ✅ Verify both backend AND frontend are running

### DON'T:
- ❌ Assume success when no errors shown
- ❌ Proceed without checking ✅ indicators
- ❌ Ignore ⚠️ warnings in status output
- ❌ Forget to check both services (backend + frontend)

### Success Criteria
A development session is successful when you see:
```
✅ Backend started successfully (PID: 12345)
   WebSocket: ws://localhost:8080

✅ Frontend built successfully and is serving
   URL: http://localhost:5174
   HMR: Active (hot reload enabled)

✅ Development environment ready!
```

## 📞 Quick Reference

| Command | Purpose | LLM Usage |
|---------|---------|-----------|
| `./run.sh dev` | Start with verification | ✅ Recommended |
| `./run.sh status` | Check service health | ✅ Use often |
| `./run.sh logs` | View logs | ✅ Debug issues |
| `./run.sh stop` | Stop services | ✅ Clean restart |
| `./run.sh restart` | Background restart | ⚠️ Less visibility |

**Remember**: Clear success indicators build LLM confidence and prevent silent failures!