# ADR: Environment-Aware Development/Production Architecture

## Status
Accepted - November 2024

## Context
Development and production environments were sharing ports, causing conflicts and deployment issues. Switching between environments required manual configuration changes and port hunting.

## Decision
We will implement environment-aware port isolation with automatic browser integration and unified service management through a centralized run.sh script.

## Consequences
**Benefits:**
- Zero port conflicts between development and production
- One-command environment switching
- Automatic browser opening with correct configuration
- Built-in safeguards for production deployments

**Tradeoffs:**
- Additional shell script complexity (~1800 lines)
- Environment-specific URLs to remember
- Learning curve for new developers

## Implementation
1. Port isolation: Dev uses 5174/8080, Prod uses 4173/8081
2. Environment detection via NODE_ENV/VITE_DEV variables
3. Unified service management through run.sh
4. Automatic browser integration with environment-specific URLs
5. Production safeguards requiring explicit confirmation for dangerous operations