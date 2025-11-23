# Environment-Aware Development/Production System provides isolated port management for seamless workflow transitions.

# Core abstraction: Environment-specific port isolation with automatic browser integration.
#
# Basic usage:
#
#   ./run.sh dev          # Development: frontend 5174 + backend 8080
#   ./run.sh start        # Production: frontend 4173 + backend 8081
#   ./run.sh browser      # Auto-open browser with environment config
#
# The system handles environment detection through NODE_ENV/VITE_DEV variables.
# Port conflicts are prevented by strict environment isolation.
# Error handling uses validation functions. Thread safety: N/A (shell processes).
#
# For service management, see run.sh. For build configuration, see vite.config.js.