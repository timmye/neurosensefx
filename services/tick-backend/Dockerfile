# =============================================================================
# NEUROSENSE FX - BACKEND PRODUCTION DOCKERFILE
# =============================================================================
# Multi-stage build for minimal, secure WebSocket backend deployment

FROM node:20-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY ../../../package*.json ./libs/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# =============================================================================
# RUNTIME STAGE
# =============================================================================
FROM node:20-alpine AS runtime

# Create application user
RUN addgroup -g 1001 -S neurosense && \
    adduser -S neurosense -u 1001 -G neurosense

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Copy built application
COPY --from=builder --chown=neurosense:neurosense /build/node_modules ./node_modules
COPY --from=builder --chown=neurosense:neurosense /build/*.js ./
COPY --from=builder --chown=neurosense:neurosense /build/utils ./utils
COPY --from=builder --chown=neurosense:neurosense /build/UI ./UI
COPY --from=builder --chown=neurosense:neurosense /build/package.json ./

# Create logs directory
RUN mkdir -p /app/logs && \
    chown -R neurosense:neurosense /app/logs

# Switch to application user
USER neurosense

# Environment
ENV NODE_ENV=production
ENV WS_PORT=8081

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8081/health || exit 1

# Use dumb-init for signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start backend
CMD ["node", "server.js"]
