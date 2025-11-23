You are executing NeuroSense FX service management commands. The project uses a unified `run.sh` script for comprehensive service orchestration with environment-aware development and production modes.

## Available Service Management Commands

### Development Environment
- **`/dev`** - Start development server with HMR (Hot Module Replacement)
  - Frontend on http://localhost:5174 with hot reload
  - Backend WebSocket on ws://localhost:8080
  - Automatic browser opening (unless `false` flag passed)
  - Verbose logging and error overlays

### Production Environment
- **`/start`** - Start production services (background mode)
  - Frontend on http://localhost:5174 (optimized build)
  - Backend WebSocket on ws://localhost:8081
  - Manual browser refresh required
  - Minimal logging for production testing

### Service Control
- **`/stop`** - Gracefully stop all services
- **`/restart`** - Restart services in current mode
- **`/status`** - Check health of all services
- **`/logs [service]`** - View real-time logs
  - `logs backend` - Backend logs only
  - `logs frontend` - Frontend logs only
  - `logs all` - All logs (default)

## Environment Management

### Environment Status
- **`/env-status`** - Show current environment and configuration
- **`/browser [url]`** - Open browser to specified URL (auto-detects environment)
- **`/clean-env [level]`** - Clean environment state
  - `clean-env light` - Clean temporary files
  - `clean-env deep` - Full environment reset

## Backup & Restore Operations

### Environment Backups
- **`/backup-env [name]`** - Create environment backup
- **`/restore-env [name]`** - Restore from backup
- **`/list-backups`** - Show available backups

### Cross-Environment Copy
- **`/copy-prod-to-dev`** - Copy production environment to development
- **`/copy-dev-to-prod`** - Copy development environment to production

## Snapshot Management (Stable Builds)

### Snapshot Commands
- **`/snapshot_save`** - Create stable snapshot of current build
- **`/snapshot_show`** - List all available snapshots
- **`/snapshot_use [tag]`** - Deploy specific snapshot
- **`/back_to_work`** - Return to development branch
- **`/am_i_dev`** - Check if running on development branch

## Examples

**Development Workflow:**
```bash
/dev                    # Start development with HMR
/status                 # Check service health
/logs backend           # Monitor backend logs
```

**Production Deployment:**
```bash
/snapshot_save          # Create stable build
/snapshot_use stable-20241119  # Deploy specific snapshot
/start                  # Start production services
```

**Environment Management:**
```bash
/backup-env my-config   # Save current configuration
/clean-env deep         # Reset environment
/restore-env my-config  # Restore saved configuration
```

## Error Handling

If services fail to start:
1. Check `/status` for service health
2. Review `/logs` for error messages
3. Try `/clean-env` to reset state
4. Use `/restart` to reload services

## Port Configuration

**Development Mode:**
- Frontend: 5174 (Vite dev server)
- Backend: 8080 (WebSocket proxy)

**Production Mode:**
- Frontend: 5174 (static file serving)
- Backend: 8081 (direct WebSocket)

The system automatically detects environment mode and configures appropriate ports.