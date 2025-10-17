# NeuroSense FX - Manual Service Startup Guide

## Overview
The DevContainer no longer starts services automatically. You must start them manually after the container is ready.

## Quick Start Commands

### Start Both Services
```bash
./run.sh start
```

### Start Services Individually
```bash
# Frontend Server (Vite) - Port 5173
./run.sh start       # Recommended: starts both services
# OR for frontend only:
npm run dev

# Backend Server (Node.js WebSocket) - Port 8080
node services/tick-backend/server.js
```

### Check Service Status
```bash
./run.sh status
```

### Stop Services
```bash
./run.sh stop
```

### View Service Logs
```bash
./run.sh logs
```

## Typical Workflow

1. **Container starts** (no automatic services)
2. **Start services manually**: `./run.sh start`
3. **Wait for services** to be ready (usually 10-20 seconds)
4. **Access application**: http://localhost:5173
5. **Work as normal**

## Troubleshooting

### Services Not Starting
- Check if ports are available: `./run.sh status`
- View detailed logs: `./run.sh logs`
- Try individual startup commands

### Port Conflicts
- Frontend: Port 5173 (Vite dev server)
- Backend: Port 8080 (WebSocket server)
- Use `./run.sh stop` before restarting

### Container Issues
- Rebuild container if services fail consistently
- Check `./setup_project.sh` completed successfully

## Development Tips

- Use `./run.sh logs` to monitor real-time service activity
- Services stay running until you stop them or rebuild container
- Frontend hot-reload works when services are running
- WebSocket connection requires both services to be active

## Why Manual Startup?

- **Reliability**: Eliminates DevContainer timeout issues
- **Control**: Start services only when needed
- **Debugging**: Easier to troubleshoot startup problems
- **Performance**: No waiting for services during container startup
