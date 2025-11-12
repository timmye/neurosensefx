# NeuroSense FX Development & Production Protocol

## Overview

NeuroSense FX uses a **dual-environment architecture** that completely separates development and production environments. This guide clarifies what gets backed up (configurations and data) versus what stays in Git (source code).

## Architecture Summary

| Environment | Frontend Port | Backend Port | Purpose |
|-------------|---------------|--------------|---------|
| **Development** | 5174 | 8080 | Active coding, debugging, UI experimentation |
| **Production** | 4173 | 8081 | Production testing, performance validation, demos |

## Critical Distinction: Code vs Data

### 🟢 **Git Manages (Source Code)**
- **All source code**: `src/`, `services/`, `libs/`
- **Configuration files**: `vite.config.js`, `package.json`
- **Build scripts**: `run.sh`, `setup_project.sh`
- **Documentation**: `*.md` files
- **Dependencies**: `package-lock.json`, `node_modules/` (via npm install)

### 🟡 **Backup System Manages (Environment Data)**
- **Runtime configurations**: Environment-specific settings
- **Log files**: `backend.log`, `frontend.log`
- **Environment status**: `.env_status` (current runtime state)
- **Browser storage**: User preferences, workspace layouts
- **Application state**: Display configurations, user settings
- **Claude settings**: `.claude/settings.local.json`

## Why This Separation Matters

### Git = **Version Control**
- Tracks code changes over time
- Enables collaboration and rollbacks
- Handles deployment across machines
- **Never contains user data or runtime state**

### Backups = **Environment State**
- Preserves user configurations and preferences
- Protects against accidental data loss
- Enables quick environment restoration
- **Never contains code (that's Git's job)**

## Core Commands

### Development Mode
```bash
./run.sh dev
```
- **Purpose**: Active development with Hot Module Replacement
- **Features**:
  - Auto-reloads browser on code changes (1-2 second refresh)
  - Verbose logging and error overlays in browser
  - Runs in foreground (attached to terminal)
  - Source code served directly (no compilation step)
- **Use when**: Writing code, debugging, experimenting with UI

### Production Mode
```bash
./run.sh start
```
- **Purpose**: Production-ready testing with optimized build
- **Features**:
  - Creates optimized `dist/` build
  - Minimal logging for clean operation
  - Background services (detached from terminal)
  - Performance-optimized assets
- **Use when**: Production testing, performance validation, demos

## Environment Workflow

### Daily Development Cycle
```bash
# Start coding session
./run.sh dev
# → Make code changes → Browser updates automatically via HMR
```

### Moving from Development to Production

#### Option A: Clean Switch (Recommended)
```bash
./run.sh stop      # Stop development services
./run.sh start     # Start production services with optimized build
```

#### Option B: Environment Restart
```bash
./run.sh restart   # Restarts in current environment mode
```

### Production Build Process

**Development Build** (`./run.sh dev`):
- Uses `npm run dev` (Vite development server)
- Serves source code directly
- No compilation step
- Fast iteration, instant updates

**Production Build** (`./run.sh start`):
- Runs `npm run build:prod` → creates optimized `dist/` folder
- Starts `npm run preview` → serves built assets
- Optimized for performance and file size
- Code minification and optimization

## Backup System: What & Why

### What Gets Backed Up
```bash
# Automatic backup creation
./run.sh backup-env my-environment-state
```

**Backed up files:**
- `backend.log` - Runtime backend logs
- `frontend.log` - Runtime frontend logs
- `.env_status` - Current environment state and service status
- `src/lib/utils/environmentUtils.js` - Environment detection utilities
- `src/utils/crossEnvironmentCopy.js` - Cross-environment data copy utilities
- `.claude/settings.local.json` - Claude-specific settings

### What Does NOT Get Backed Up
- Source code (managed by Git)
- Dependencies (reproducible via `npm install`)
- System configurations (handled by environment variables)

### Backup Operations
```bash
# List available backups
./run.sh list-backups

# Restore from backup
./run.sh restore-env backup-name

# Emergency recovery
./run.sh stop
./run.sh restore-env auto_prod_20241112_143022
./run.sh start
```

## Environment Data Management

### Copy Development → Production
```bash
./run.sh copy-dev-to-prod
```
- **Safety**: Requires typing "PROD" to confirm
- **Creates**: Automatic backup before copy operation
- **Copies**: Runtime configurations, user settings, display layouts
- **Use case**: Promote tested development configuration to production
- **Does NOT copy**: Source code (already in Git)

### Copy Production → Development
```bash
./run.sh copy-prod-to-dev
```
- **Use case**: Test production data in development environment
- **Safer**: Only overwrites development environment
- **Copies**: Production user settings and configurations
- **Does NOT copy**: Source code (already in Git)

## Environment Status Monitoring

### Check Current Environment
```bash
./run.sh env-status    # Comprehensive environment information
./run.sh status        # Service health check
./run.sh logs          # View environment-specific logs
```

### Environment Detection
The system automatically detects environment through:
- `NODE_ENV` environment variable (`development` vs `production`)
- `VITE_DEV` flag (`true` vs `false`)
- Port usage patterns (5174/8080 vs 4173/8081)
- Command-line flags (`--production`, `--development`)

## Best Practices

### Development Workflow
1. **Morning setup**:
   ```bash
   ./run.sh dev  # Start fresh development environment
   ```
2. **During coding**: Changes auto-refresh via HMR
3. **Before commits**:
   ```bash
   ./run.sh stop  # Clean git state
   git add .
   git commit -m "feat: implement new feature"
   ```
4. **Production testing**:
   ```bash
   ./run.sh start  # Test in production mode
   ```

### Production Deployment
1. **Backup current production state**:
   ```bash
   ./run.sh backup-env pre-deployment-$(date +%Y%m%d_%H%M%S)
   ```
2. **Stop development**:
   ```bash
   ./run.sh stop
   ```
3. **Start production**:
   ```bash
   ./run.sh start
   ```
4. **Verify deployment**:
   ```bash
   ./run.sh env-status  # Check environment health
   # Manual testing in browser
   ./run.sh logs         # Monitor for issues
   ```

### Emergency Recovery Procedures
```bash
# If production environment breaks
./run.sh stop
./run.sh restore-env [last-known-good-backup]
./run.sh start
```

## Environment Cleanup

### Clean Environment Data
```bash
./run.sh clean-env              # Clean current environment (with confirmation)
./run.sh clean-env --force      # Force clean production environment
```

**What gets cleaned:**
- Log files (`backend.log`, `frontend.log`)
- Environment status (`.env_status`)
- Runtime temporary files

**What does NOT get cleaned:**
- Source code (Git-managed)
- Dependencies (reproducible via npm install)
- User data in browser localStorage (manual cleanup required)

## Port Management & Conflict Prevention

The system uses **strict port separation**:
- **Development**: Frontend 5174, Backend 8080
- **Production**: Frontend 4173, Backend 8081

This design:
- Prevents environment conflicts
- Allows running both environments simultaneously
- Provides clear environment identification via ports

## Quick Reference Commands

```bash
# Environment Control
./run.sh dev                  # Start development with HMR
./run.sh start                # Start production services
./run.sh stop                 # Stop all services
./run.sh restart              # Restart current environment

# Environment Information
./run.sh env-status           # Detailed environment status
./run.sh status               # Service health check
./run.sh logs                 # View environment logs
./run.sh browser              # Open browser with environment config

# Backup & Recovery
./run.sh backup-env [name]    # Create environment backup
./run.sh restore-env [name]   # Restore from backup
./run.sh list-backups         # Show available backups

# Environment Data Management
./run.sh copy-dev-to-prod     # Promote dev config to prod
./run.sh copy-prod-to-dev     # Copy prod config to dev
./run.sh clean-env [--force]  # Clean environment data
```

## Key Principles

1. **Git manages code, backups manage data**
2. **Never commit user configurations or runtime state to Git**
3. **Always backup production before major changes**
4. **Use development for coding, production for testing**
5. **Environment data is portable across machines (via backups)**
6. **Source code is portable via Git**

## Troubleshooting

### Port Conflicts
```bash
# Check what's using ports
netstat -tuln | grep -E ":(5174|8080|4173|8081)"

# Kill all services
./run.sh stop

# Start fresh
./run.sh dev  # or ./run.sh start
```

### Environment Detection Issues
```bash
# Force environment detection
NODE_ENV=production ./run.sh start
NODE_ENV=development ./run.sh dev
```

### Backup Restoration Failure
```bash
# List backups to find correct name
./run.sh list-backups

# Force restore (overwrites current environment)
./run.sh restore-env backup-name --force
```

---

**Remember**: This system is designed for **zero-downtime workflow** - you can switch between environments seamlessly while maintaining complete separation of code (Git) and data (backups).