# NeuroSense FX Enhanced run.sh Script

## Overview

The NeuroSense FX service management script has been comprehensively enhanced with environment-aware service management, backup capabilities, and production safeguards. The script now provides seamless development/production workflow support while maintaining full backward compatibility.

## Key Enhancements

### 1. Environment-Aware Service Management
- **Environment Detection**: Automatically detects development vs production mode
- **Environment-Specific Logging**: Logs include environment indicators (DEV/PROD)
- **Environment Status File**: Tracks service state, last commands, and timestamps
- **Environment Validation**: Validates setup and dependencies before starting services

### 2. Enhanced Development Workflow
- **Auto-Browser Opening**: Development mode now automatically opens browser with HMR
- **Real-time Build Verification**: Waits for services to be fully ready
- **Enhanced Error Detection**: Monitors logs for recent errors and reports them
- **Performance Monitoring**: Tracks service PID, memory usage, and CPU usage

### 3. Production Safeguards
- **Production Safety Validation**: Checks for development data in production
- **Uncommitted Changes Detection**: Warns about uncommitted git changes
- **Force-Required Operations**: Production cleanup requires explicit force flag
- **Multiple Confirmations**: Critical operations require multiple confirmation steps

### 4. Backup and Restore System
- **Environment-Specific Backups**: Automatic backup creation before major operations
- **Backup Management**: List, restore, and cleanup backup operations
- **Pre-Operation Backups**: Automatic backups before copy operations
- **Backup Metadata**: Tracks backup size, date, and contents

### 5. Cross-Environment Data Management
- **Safe Copy Operations**: Production ↔ Development data copying with validation
- **Copy with Backup**: Creates backups before any copy operation
- **Production Copy Protection**: Multiple confirmation steps for production copies
- **Data Validation**: Validates data integrity during copy operations

### 6. Browser Integration
- **Auto-Detection**: Detects available browsers (Chrome, Firefox, Safari, Edge)
- **Environment-Specific Profiles**: Opens browser with environment-specific settings
- **Dev Tools Support**: Development mode opens with developer-friendly settings
- **Custom URLs**: Supports opening specific URLs if provided

## New Commands

### Core Commands (Enhanced)
- `./run.sh dev` - Development mode with HMR and auto-browser
- `./run.sh start` - Background services with production optimizations
- `./run.sh stop` - Enhanced service cleanup
- `./run.sh restart` - Environment-aware service restart
- `./run.sh status` - Enhanced service status with resource monitoring
- `./run.sh logs` - Environment-aware log viewing

### Environment Management
- `./run.sh env-status` - Comprehensive environment status and diagnostics
- `./run.sh browser` - Open browser with environment configuration
- `./run.sh clean-env` - Clean environment-specific data (production-safe)

### Backup and Restore
- `./run.sh backup-env [name]` - Create environment backup
- `./run.sh restore-env [name]` - Restore from backup
- `./run.sh list-backups` - List available backups

### Cross-Environment Operations
- `./run.sh copy-prod-to-dev` - Copy production data to development
- `./run.sh copy-dev-to-prod` - Copy development data to production

### Help and Information
- `./run.sh help` - Comprehensive help documentation
- `./run.sh version` - Show script version and environment

## Backward Compatibility

All existing commands continue to work exactly as before:
- `./run.sh dev` - Enhanced but maintains same interface
- `./run.sh start` - Enhanced but maintains same behavior
- `./run.sh stop` - Enhanced but maintains same functionality
- `./run.sh restart` - Enhanced but maintains same workflow
- `./run.sh status` - Enhanced with additional information
- `./run.sh logs` - Enhanced with environment awareness

## Environment Detection

The script automatically detects the current environment using:
- `VITE_DEV` environment variable
- `NODE_ENV` environment variable
- `ENV` environment variable
- Default fallback to production mode

## Production Safeguards

### Safety Checks
- Validates environment setup before starting services
- Checks for development data contamination in production
- Validates git state in production mode
- Requires explicit confirmation for destructive operations

### Copy Protection
- Production copy operations require typing "PROD" to confirm
- Multiple confirmation steps for critical operations
- Automatic backup creation before any copy operation
- Clear warnings about data overwriting

## File Structure

### New Files Created
- `.env_status` - Environment state tracking
- `backups/` - Directory for environment backups

### Enhanced Files
- `run.sh` - Main service management script (completely rewritten)

### Integration Points
- `src/lib/utils/environmentUtils.js` - Environment detection utilities
- `src/utils/crossEnvironmentCopy.js` - Cross-environment data copying
- `src/components/UnifiedContextMenu/CopyEnvironmentTab.svelte` - UI for copy operations

## Usage Examples

### Development Workflow
```bash
# Start development with auto-browser
./run.sh dev

# Check environment status
./run.sh env-status

# Monitor logs
./run.sh logs backend

# Clean environment if needed
./run.sh clean-env
```

### Production Workflow
```bash
# Start production services
./run.sh start

# Open production browser
./run.sh browser

# Create backup before changes
./run.sh backup-env pre-update

# Check service health
./run.sh status
```

### Environment Switching
```bash
# Copy production data to development for testing
./run.sh copy-prod-to-dev

# Test in development
./run.sh dev

# Deploy changes to production
./run.sh copy-dev-to-prod
```

## Error Handling

The script includes comprehensive error handling:
- Environment validation failures with clear error messages
- Service startup failures with log references
- Port conflict detection and resolution guidance
- Backup/restore error handling with rollback capabilities
- Production safety check failures with actionable guidance

## Performance Considerations

- Minimal overhead for environment detection
- Efficient log monitoring for error detection
- Optimized backup operations with compression
- Fast environment status reporting
- Low-impact browser detection and launching

## Future Enhancements

The script is designed to be extensible for future enhancements:
- Integration with container environments (Docker, Podman)
- Cloud deployment support
- Advanced monitoring and alerting
- Automated testing integration
- CI/CD pipeline integration

## Conclusion

The enhanced NeuroSense FX run.sh script provides a comprehensive environment-aware service management system that improves developer experience while adding production-grade safety features. All existing functionality is preserved while adding powerful new capabilities for environment management, backup/restore, and cross-environment data operations.