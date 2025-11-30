# Claude Code Startup Procedures Guide

## Overview

This guide provides Claude Code with unambiguous startup procedures for the NeuroSense FX project. The project has two frontend implementations with a unified startup system designed for clarity and predictability.

## Philosophy: "Backend First, Then Frontend Choice"

**Core Principle**: Backend WebSocket server (port 8080) is always required. Frontend choice depends on development needs.

## Startup Commands

### Primary Entry Point: `./run.sh` (from project root)

#### Recommended Commands

```bash
# Standard development (current default behavior)
./run.sh dev                    # Backend + Original Frontend (30,000+ lines)
                                # Backend: ws://localhost:8080
                                # Frontend: http://localhost:5174

# Crystal Clarity development (ultra-lean implementation)
./run.sh dev-simple             # Backend + Simple Frontend (252 lines)
                                # Backend: ws://localhost:8080
                                # Frontend: http://localhost:5175

# Backend only (useful for testing)
./run.sh backend                # Backend WebSocket server only
                                # Backend: ws://localhost:8080
```

#### Service Management

```bash
# Check what's currently running
./run.sh status

# Stop all services
./run.sh stop

# View logs
./run.sh logs backend           # Backend logs
./run.sh logs frontend          # Original frontend logs
./run.sh logs all               # All logs

# Get help
./run.sh help                   # Complete command reference
```

### Secondary Entry Point: `src-simple/start.sh`

#### Smart Startup with Backend Detection

```bash
# Navigate to simple frontend directory
cd src-simple

# Start simple frontend (auto-detects and starts backend if needed)
./start.sh

# This script will:
# 1. Check if backend is running on port 8080
# 2. Auto-start backend if not detected
# 3. Start simple frontend on port 5175
# 4. Provide clear status messages throughout
```

## Port Allocation

| Service | Port | Purpose | Command |
|---------|------|---------|---------|
| Backend WebSocket | 8080 | Real-time market data | All commands |
| Original Frontend | 5174 | Full-featured UI | `./run.sh dev` |
| Simple Frontend | 5175 | Crystal Clarity UI | `./run.sh dev-simple` or `./start.sh` |

## Development Workflows

### For Claude Code Automation

```bash
# Start Crystal Clarity development (recommended for new features)
./run.sh dev-simple

# Start standard development (legacy system compatibility)
./run.sh dev

# Start backend only for testing
./run.sh backend
```

### For Human Developers

```bash
# Quick start Crystal Clarity
./run.sh dev-simple

# Compare both systems (run in separate terminals)
./run.sh dev                    # Terminal 1: Original system
./run.sh dev-simple             # Terminal 2: Crystal Clarity

# Check system status
./run.sh status
```

### For Simple Frontend Development

```bash
# Method 1: Primary entry point (recommended)
./run.sh dev-simple

# Method 2: Secondary entry point (convenient for frontend-only work)
cd src-simple && ./start.sh
```

## Key Decision Points

### When to Use Each Command

1. **`./run.sh dev`** (Original System)
   - Working with existing production features
   - Need full 30,000+ line functionality
   - Legacy system compatibility required
   - Production bug fixes

2. **`./run.sh dev-simple`** (Crystal Clarity)
   - New feature development
   - Performance optimization work
   - Crystal Clarity initiative tasks
   - Learning the simplified architecture

3. **`./run.sh backend`** (Backend Only)
   - API development and testing
   - WebSocket functionality testing
   - Backend performance optimization
   - Database/market data integration work

4. **`./start.sh`** (Simple Frontend Direct)
   - Frontend-only development when backend is already running
   - Quick frontend iterations
   - UI/UX work on Crystal Clarity system

## Service Dependencies

### Backend Requirements
- **Required by**: Both frontend systems
- **Auto-start**: Available in `src-simple/start.sh`
- **Manual start**: `./run.sh backend`
- **Port**: 8080 (WebSocket)

### Frontend Independence
- **Original**: Can run with or without simple frontend
- **Simple**: Can run with or without original frontend
- **No conflicts**: Different ports (5174 vs 5175)

## Troubleshooting

### Port Conflicts
```bash
# Check what's using ports
lsof -i :8080  # Backend
lsof -i :5174  # Original frontend
lsof -i :5175  # Simple frontend

# Stop all services cleanly
./run.sh stop
```

### Backend Issues
```bash
# Check backend logs
./run.sh logs backend

# Restart backend only
./run.sh stop && ./run.sh backend
```

### Frontend Issues
```bash
# Check specific frontend logs
./run.sh logs frontend          # Original
tail -f frontend-simple.log     # Simple (if using run.sh)
tail -f ../backend.log          # Simple (if using start.sh)
```

## Migration Notes

### Current Status
- **Original frontend**: Remains default (`./run.sh dev`)
- **Simple frontend**: Available via dedicated commands
- **No breaking changes**: All existing workflows preserved
- **Shadow mode**: Simple system developed alongside original

### Future Migration
- Simple frontend will become default after Crystal Clarity validation
- Original system will remain accessible via `./run.sh dev-legacy` (planned)
- Migration timeline depends on feature parity achievement

## Claude Code Best Practices

1. **Always check status first**: `./run.sh status`
2. **Use Crystal Clarity for new work**: `./run.sh dev-simple`
3. **Preserve existing workflows**: Don't modify original system unless necessary
4. **Clear communication**: Indicate which system you're starting in logs
5. **Backend-first thinking**: Ensure backend is running before frontend operations

## Success Indicators

✅ **Successful startup**: Services start without port conflicts
✅ **Backend connectivity**: Frontends connect to WebSocket successfully
✅ **Clear logging**: Status messages provide unambiguous feedback
✅ **No surprises**: Same command always produces same result

This system ensures predictable, unambiguous startup procedures for both automated tools and human developers.