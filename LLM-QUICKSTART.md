# LLM Quick Start Guide for Simple Frontend Development

## Crystal Clarity Philosophy
**Simple, Reliable, Deterministic** - Perfect for LLM developers who need consistent, predictable behavior.

## Quick Start Commands

### For LLM Developers (Most Common)
```bash
# Start everything in one command
./simple-dev.sh start

# Check if everything is working
./simple-dev.sh status

# Stop everything when done
./simple-dev.sh stop
```

### Simple Frontend Only (If backend is already running)
```bash
# Start only the simple frontend on port 5175
./src-simple/simple-start.sh
```

### Emergency Commands
```bash
# Force stop everything
./simple-dev.sh stop

# Restart if something is broken
./simple-dev.sh restart

# Check what's running
./simple-dev.sh status
```

## What Each Command Does

### `./simple-dev.sh start`
- ✅ Starts backend service on port 8080
- ✅ Starts simple frontend on port 5175
- ✅ Waits for both services to be ready
- ✅ Shows URLs for accessing the application
- ✅ Enables hot reload for development

### `./simple-dev.sh status`
- Shows if backend is running (port 8080)
- Shows if frontend is running (port 5175)
- Displays process IDs for debugging
- Shows quick action commands

### `./simple-dev.sh stop`
- Safely stops both services
- Cleans up any hanging processes
- Ensures ports are freed for next use

## URLs After Starting

- **Frontend**: http://localhost:5175
- **Backend WebSocket**: ws://localhost:8080

## Common Issues & Solutions

### Port 5175 is already in use
```bash
./simple-dev.sh stop
./simple-dev.sh start
```

### Services won't start
```bash
# Check status first
./simple-dev.sh status

# Force restart
./simple-dev.sh restart
```

### Only frontend is needed (backend already running)
```bash
./src-simple/simple-start.sh
```

## Why This Is LLM-Friendly

1. **Deterministic**: Same command always does the same thing
2. **Simple**: Only 3 main commands to remember
3. **Clear**: Status shows exactly what's running
4. **Safe**: Stop commands clean up properly
5. **Fast**: Starts in under 30 seconds
6. **Reliable**: Won't hang or leave orphaned processes

## File Locations

- **Main script**: `./simple-dev.sh`
- **Frontend-only script**: `./src-simple/simple-start.sh`
- **Frontend code**: `./src-simple/`
- **Backend code**: `./services/tick-backend/`
- **Logs**: `backend.log`, `frontend.log`

## Development Workflow for LLMs

1. **Start**: `./simple-dev.sh start`
2. **Develop**: Edit files in `./src-simple/`
3. **Test**: Visit http://localhost:5175
4. **Debug**: Check logs or run `./simple-dev.sh status`
5. **Stop**: `./simple-dev.sh stop` when done

---

**Crystal Clarity**: This system eliminates complexity and provides reliable, predictable behavior for consistent development experiences.