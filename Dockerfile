# =============================================================================
# NEUROSENSE FX - PRODUCTION DOCKERFILE
# =============================================================================
# Multi-stage build for minimal, secure, self-contained deployment
# Maintains "Simple, Performant, Maintainable" principles

# =============================================================================
# BUILD STAGE - Build and compile all components
# =============================================================================
FROM node:20-alpine AS builder

# Set build environment
WORKDIR /build
ENV NODE_ENV=production
ENV VITE_DEV=false

# Install build dependencies
RUN apk add --no-cache git python3 make g++

# Copy package files first (better cache layering)
COPY package*.json ./
COPY services/tick-backend/package*.json ./services/tick-backend/
COPY libs/cTrader-Layer/package*.json ./libs/cTrader-Layer/

# Install all dependencies (including dev dependencies for build)
RUN npm ci --only=production=false
RUN cd services/tick-backend && npm ci --only=production=false
RUN cd libs/cTrader-Layer && npm ci --only=production=false

# Copy source code
COPY . .

# Build cTrader-Layer library
RUN cd libs/cTrader-Layer && npm run build

# Build Svelte frontend application
RUN npm run build:prod

# =============================================================================
# RUNTIME STAGE - Minimal production image
# =============================================================================
FROM node:20-alpine AS runtime

# Create application user for security
RUN addgroup -g 1001 -S neurosense && \
    adduser -S neurosense -u 1001 -G neurosense

# Set runtime environment
WORKDIR /app
ENV NODE_ENV=production
ENV VITE_DEV=false
ENV WS_PORT=8080
ENV FRONTEND_PORT=4173

# Install runtime dependencies only
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Copy built application from builder stage
COPY --from=builder --chown=neurosense:neurosense /build/dist ./dist
COPY --from=builder --chown=neurosense:neurosense /build/node_modules ./node_modules
COPY --from=builder --chown=neurosense:neurosense /build/services ./services
COPY --from=builder --chown=neurosense:neurosense /build/libs ./libs
COPY --from=builder --chown=neurosense:neurosense /build/package.json ./
COPY --from=builder --chown=neurosense:neurosense /build/run.sh ./
COPY --from=builder --chown=neurosense:neurosense /build/.env.example ./.env

# Set permissions
RUN chmod +x run.sh
RUN chown -R neurosense:neurosense /app

# Create necessary directories
RUN mkdir -p /app/logs /app/backups && \
    chown -R neurosense:neurosense /app/logs /app/backups

# Switch to application user
USER neurosense

# Health check script
COPY --from=builder --chown=neurosense:neurosense /build/docker-healthcheck.sh ./docker-healthcheck.sh
RUN chmod +x docker-healthcheck.sh

# Expose ports
EXPOSE 4173 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD ./docker-healthcheck.sh

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["./run.sh", "start", "--production"]