#!/bin/bash

# Enhanced Docker Container Setup for NeuroSense FX
# Optimized for WSL2 with native filesystem performance
# Production-grade deployment with development features

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
DEV_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev.yml"
PERF_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.perf.yml"

# Environment detection
ENVIRONMENT="${NODE_ENV:-development}"
DOCKER_PROFILE="${DOCKER_PROFILE:-default}"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Check Docker installation and status
check_docker_prerequisites() {
    log_info "Checking Docker prerequisites..."

    # Check Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        log_info "Install Docker from: https://docs.docker.com/get-docker/"
        exit 1
    fi

    # Check Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not available"
        exit 1
    fi

    # Check Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
        log_info "Start Docker service and try again"
        exit 1
    fi

    # Check WSL2 specific optimizations
    if grep -qi "microsoft\|wsl" /proc/version 2>/dev/null; then
        log_info "WSL2 environment detected"
        optimize_wsl2_docker
    fi

    log_success "Docker prerequisites verified"
}

# Optimize Docker for WSL2
optimize_wsl2_docker() {
    log_info "Optimizing Docker for WSL2..."

    # Check if .dockerdaemon exists
    if [[ ! -f "$HOME/.docker/daemon.json" ]]; then
        mkdir -p "$HOME/.docker"
        log_info "Creating Docker daemon configuration for WSL2..."
    fi

    # WSL2 Docker daemon optimizations
    cat > "$HOME/.docker/daemon.json" << 'EOF'
{
  "experimental": false,
  "features": {
    "buildkit": true
  },
  "builder": {
    "gc": {
      "enabled": true,
      "defaultKeepStorage": "20GB"
    }
  },
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "default-runtime": "runc",
  "runtimes": {
    "runc": {
      "path": "runc",
      "runtimeArgs": []
    }
  },
  "registry-mirrors": [
    "https://mirror.gcr.io"
  ]
}
EOF

    log_success "WSL2 Docker optimizations applied"
}

# Create enhanced development compose file
create_dev_compose_file() {
    log_info "Creating enhanced development Docker configuration..."

    cat > "$DEV_COMPOSE_FILE" << 'EOF'
# Enhanced Development Docker Compose Configuration
# Optimized for hot reload and developer experience

version: '3.8'

services:
  # Development Frontend with Hot Reload
  frontend-dev:
    build:
      context: .
      dockerfile: Dockerfile.frontend
      target: development
    container_name: neurosensefx-frontend-dev
    restart: unless-stopped
    environment:
      - NODE_ENV=development
      - VITE_DEV=true
      - VITE_BACKEND_URL=ws://localhost:8080
      - CHOKIDAR_USEPOLLING=true
      - CHOKIDAR_INTERVAL=1000
    ports:
      - "5173:5173"
      - "5174:5174"  # Alternative port for testing
    volumes:
      # Mount source code for hot reload
      - ./src:/app/src
      - ./public:/app/public
      - ./package.json:/app/package.json
      - ./package-lock.json:/app/package-lock.json
      - ./vite.config.js:/app/vite.config.js
      - ./vitest.config.js:/app/vitest.config.js
      # Node modules for faster startup (cached)
      - node_modules_dev:/app/node_modules
    depends_on:
      - backend-dev
    networks:
      - neurosensefx-dev-network
    command: npm run dev
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5173"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s

  # Development Backend with Debug Support
  backend-dev:
    build:
      context: ./services/tick-backend
      dockerfile: Dockerfile.dev
    container_name: neurosensefx-backend-dev
    restart: unless-stopped
    environment:
      - NODE_ENV=development
      - WS_PORT=8080
      - DEBUG=neurosensefx:*
      - CTRADER_CLIENT_ID=${CTRADER_CLIENT_ID}
      - CTRADER_CLIENT_SECRET=${CTRADER_CLIENT_SECRET}
      - CTRADER_ACCESS_TOKEN=${CTRADER_ACCESS_TOKEN}
      - CTRADER_REFRESH_TOKEN=${CTRADER_REFRESH_TOKEN}
      - CTRADER_ACCOUNT_ID=${CTRADER_ACCOUNT_ID}
    ports:
      - "8080:8080"
      - "9229:9229"  # Node.js debugger port
      - "9230:9230"  # Alternative debugger port
    volumes:
      # Mount source code for hot reload
      - ./services/tick-backend:/app
      - ./libs/cTrader-Layer:/app/libs/cTrader-Layer
      # Logs for debugging
      - dev-logs:/app/logs
    networks:
      - neurosensefx-dev-network
    command: npm run dev
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s

  # Redis for development
  redis-dev:
    image: redis:7-alpine
    container_name: neurosensefx-redis-dev
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis-dev-data:/data
    networks:
      - neurosensefx-dev-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 15s
      timeout: 5s
      retries: 3

  # Development Database (optional)
  postgres-dev:
    image: postgres:15-alpine
    container_name: neurosensefx-postgres-dev
    restart: unless-stopped
    environment:
      - POSTGRES_DB=neurosensefx_dev
      - POSTGRES_USER=neurosensefx
      - POSTGRES_PASSWORD=neurosensefx_dev_123
    ports:
      - "5432:5432"
    volumes:
      - postgres-dev-data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d
    networks:
      - neurosensefx-dev-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U neurosensefx"]
      interval: 15s
      timeout: 5s
      retries: 3

  # MailHog for email testing
  mailhog:
    image: mailhog/mailhog:latest
    container_name: neurosensefx-mailhog
    restart: unless-stopped
    ports:
      - "1025:1025"  # SMTP port
      - "8025:8025"  # Web interface
    networks:
      - neurosensefx-dev-network

  # Development tools
  adminer:
    image: adminer:latest
    container_name: neurosensefx-adminer
    restart: unless-stopped
    ports:
      - "8082:8080"
    environment:
      - ADMINER_DEFAULT_SERVER=postgres-dev
    depends_on:
      - postgres-dev
    networks:
      - neurosensefx-dev-network

networks:
  neurosensefx-dev-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.21.0.0/16

volumes:
  node_modules_dev:
    driver: local
  redis-dev-data:
    driver: local
  postgres-dev-data:
    driver: local
  dev-logs:
    driver: local
EOF

    log_success "Development Docker configuration created"
}

# Create performance testing compose file
create_perf_compose_file() {
    log_info "Creating performance testing Docker configuration..."

    cat > "$PERF_COMPOSE_FILE" << 'EOF'
# Performance Testing Docker Compose Configuration
# Comprehensive testing with k6, Grafana, and monitoring

version: '3.8'

services:
  # k6 Performance Testing
  k6:
    image: grafana/k6:latest
    container_name: neurosensefx-k6
    volumes:
      - ./tests/performance:/scripts
      - ./test-results:/results
    environment:
      - K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write
      - K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM=true
    networks:
      - neurosensefx-perf-network
    profiles:
      - performance
    command: ["tail", "-f", "/dev/null"]  # Keep running for manual tests

  # Enhanced Prometheus for performance metrics
  prometheus-perf:
    image: prom/prometheus:latest
    container_name: neurosensefx-prometheus-perf
    restart: unless-stopped
    ports:
      - "9091:9090"
    volumes:
      - ./docker/performance/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-perf-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=7d'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    networks:
      - neurosensefx-perf-network
    profiles:
      - performance

  # Grafana with performance dashboards
  grafana-perf:
    image: grafana/grafana:latest
    container_name: neurosensefx-grafana-perf
    restart: unless-stopped
    ports:
      - "3001:3000"
    volumes:
      - grafana-perf-data:/var/lib/grafana
      - ./docker/performance/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./docker/performance/grafana/dashboards:/var/lib/grafana/dashboards:ro
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=neurosensefx123
      - GF_INSTALL_PLUGINS=grafana-piechart-panel,grafana-worldmap-panel
    networks:
      - neurosensefx-perf-network
    profiles:
      - performance

  # Node Exporter for system metrics
  node-exporter:
    image: prom/node-exporter:latest
    container_name: neurosensefx-node-exporter
    restart: unless-stopped
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - neurosensefx-perf-network
    profiles:
      - performance

  # cAdvisor for container metrics
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: neurosensefx-cadvisor
    restart: unless-stopped
    ports:
      - "8083:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    privileged: true
    devices:
      - /dev/kmsg
    networks:
      - neurosensefx-perf-network
    profiles:
      - performance

networks:
  neurosensefx-perf-network:
    driver: bridge

volumes:
  prometheus-perf-data:
    driver: local
  grafana-perf-data:
    driver: local
EOF

    log_success "Performance testing Docker configuration created"
}

# Create optimized Dockerfiles
create_optimized_dockerfiles() {
    log_info "Creating optimized Dockerfiles..."

    # Frontend Dockerfile
    cat > "$PROJECT_ROOT/Dockerfile.frontend" << 'EOF'
# Multi-stage Frontend Dockerfile
# Optimized for both development and production

FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl

# Install dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development
RUN npm install -g pnpm@latest
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx/frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF

    # Backend Dockerfile
    cat > "$PROJECT_ROOT/services/tick-backend/Dockerfile.dev" << 'EOF'
# Development Backend Dockerfile
# Optimized for hot reload and debugging

FROM node:18-alpine
WORKDIR /app

# Install development tools
RUN apk add --no-cache curl tini bash

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose ports
EXPOSE 8080 9229

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "dev"]
EOF

    log_success "Optimized Dockerfiles created"
}

# Setup secrets and configuration
setup_secrets_and_config() {
    log_info "Setting up secrets and configuration..."

    # Create secrets directory
    mkdir -p "$PROJECT_ROOT/secrets"

    # Create template for secrets
    cat > "$PROJECT_ROOT/secrets/.template" << 'EOF'
# cTrader API Credentials Template
# Copy this file and replace with your actual credentials

# Create these files in the secrets directory:
# - ctrader_client_id.txt
# - ctrader_client_secret.txt
# - ctrader_access_token.txt
# - ctrader_refresh_token.txt
# - ctrader_account_id.txt

# Each file should contain only the credential value
# Example for ctrader_client_id.txt:
# your_client_id_here
EOF

    # Create nginx configuration
    mkdir -p "$PROJECT_ROOT/docker/nginx"
    cat > "$PROJECT_ROOT/docker/nginx/frontend.conf" << 'EOF'
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

    log_success "Secrets and configuration setup completed"
}

# Build Docker images with optimizations
build_docker_images() {
    log_step "Building Docker images with optimizations..."

    # Set build arguments for optimization
    export DOCKER_BUILDKIT=1
    export BUILDKIT_PROGRESS=plain

    # Build frontend image
    log_info "Building frontend image..."
    if [[ "$ENVIRONMENT" == "development" ]]; then
        docker-compose -f "$COMPOSE_FILE" -f "$DEV_COMPOSE_FILE" build frontend-dev --parallel
    else
        docker-compose -f "$COMPOSE_FILE" build frontend --parallel
    fi

    # Build backend image
    log_info "Building backend image..."
    if [[ "$ENVIRONMENT" == "development" ]]; then
        docker-compose -f "$COMPOSE_FILE" -f "$DEV_COMPOSE_FILE" build backend-dev --parallel
    else
        docker-compose -f "$COMPOSE_FILE" build backend --parallel
    fi

    log_success "Docker images built successfully"
}

# Start containers with appropriate configuration
start_containers() {
    log_step "Starting containers..."

    if [[ "$ENVIRONMENT" == "development" ]]; then
        log_info "Starting development environment..."
        docker-compose -f "$COMPOSE_FILE" -f "$DEV_COMPOSE_FILE" up -d

        log_info "Waiting for services to be healthy..."
        sleep 10

        # Check health of development services
        check_service_health "neurosensefx-frontend-dev" "http://localhost:5173"
        check_service_health "neurosensefx-backend-dev" "http://localhost:8080/health"
    else
        log_info "Starting production environment..."
        docker-compose -f "$COMPOSE_FILE" up -d

        log_info "Waiting for services to be healthy..."
        sleep 15

        # Check health of production services
        check_service_health "neurosensefx-frontend" "http://localhost:4173"
        check_service_health "neurosensefx-backend" "http://localhost:8080"
    fi

    log_success "Containers started successfully"
}

# Check service health
check_service_health() {
    local container_name="$1"
    local health_url="$2"
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "$health_url" > /dev/null 2>&1; then
            log_success "$container_name is healthy"
            return 0
        fi

        log_info "Waiting for $container_name to be healthy (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    log_warning "$container_name health check failed, but continuing..."
    return 1
}

# Setup performance monitoring
setup_performance_monitoring() {
    log_info "Setting up performance monitoring..."

    if [[ "$ENVIRONMENT" == "development" ]]; then
        # Start performance tools in development
        docker-compose -f "$PERF_COMPOSE_FILE" --profile performance up -d
        log_info "Performance monitoring available at:"
        log_info "  - Grafana: http://localhost:3001 (admin/neurosensefx123)"
        log_info "  - Prometheus: http://localhost:9091"
    fi
}

# Create management scripts
create_management_scripts() {
    log_info "Creating container management scripts..."

    # Container management script
    cat > "$PROJECT_ROOT/scripts/docker-manage.sh" << 'EOF'
#!/bin/bash

# Docker Container Management Script
# Provides easy access to common Docker operations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

case "${1:-}" in
    "start")
        echo "Starting containers..."
        if [[ "${2:-}" == "prod" ]]; then
            docker-compose -f docker-compose.yml up -d
        else
            docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
        fi
        ;;
    "stop")
        echo "Stopping containers..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
        ;;
    "restart")
        echo "Restarting containers..."
        $0 stop
        sleep 2
        $0 start "${2:-}"
        ;;
    "logs")
        if [[ -n "${2:-}" ]]; then
            docker logs -f "neurosensefx-${2}"
        else
            docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
        fi
        ;;
    "exec")
        if [[ -n "${2:-}" ]]; then
            docker exec -it "neurosensefx-${2}" bash
        else
            echo "Usage: $0 exec <container-name>"
            exit 1
        fi
        ;;
    "status")
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps
        ;;
    "clean")
        echo "Cleaning up Docker resources..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v
        docker system prune -f
        ;;
    "perf")
        echo "Starting performance testing..."
        docker-compose -f docker-compose.perf.yml --profile performance up -d
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|exec|status|clean|perf}"
        echo ""
        echo "Commands:"
        echo "  start [prod]   - Start containers (dev or prod)"
        echo "  stop           - Stop all containers"
        echo "  restart [prod] - Restart containers"
        echo "  logs [service] - Show logs (all or specific service)"
        echo "  exec <service> - Execute shell in container"
        echo "  status         - Show container status"
        echo "  clean          - Clean up Docker resources"
        echo "  perf           - Start performance testing stack"
        exit 1
        ;;
esac
EOF

    chmod +x "$PROJECT_ROOT/scripts/docker-manage.sh"

    log_success "Container management scripts created"
}

# Print setup completion information
print_completion_info() {
    log_success "Enhanced Docker setup completed!"
    echo
    echo "=== Setup Summary ==="
    echo
    echo "Environment: $ENVIRONMENT"
    echo "Docker Profile: $DOCKER_PROFILE"
    echo
    echo "=== Access Information ==="
    echo

    if [[ "$ENVIRONMENT" == "development" ]]; then
        echo "Development Services:"
        echo "  Frontend:     http://localhost:5173"
        echo "  Backend:      http://localhost:8080"
        echo "  Redis:        localhost:6379"
        echo "  PostgreSQL:   localhost:5432"
        echo "  Adminer:      http://localhost:8082"
        echo "  MailHog:      http://localhost:8025"
        echo "  Node Debug:   localhost:9229"
        echo
    else
        echo "Production Services:"
        echo "  Frontend:     http://localhost:4173"
        echo "  Backend:      http://localhost:8080"
        echo "  Nginx:        http://localhost"
        echo "  Grafana:      http://localhost:3000"
        echo "  Prometheus:   http://localhost:9090"
        echo
    fi

    echo "=== Management Commands ==="
    echo
    echo "Container Management:"
    echo "  ./scripts/docker-manage.sh start      - Start containers"
    echo "  ./scripts/docker-manage.sh stop       - Stop containers"
    echo "  ./scripts/docker-manage.sh logs       - View logs"
    echo "  ./scripts/docker-manage.sh exec <svc> - Execute shell"
    echo "  ./scripts/docker-manage.sh status     - Check status"
    echo "  ./scripts/docker-manage.sh clean      - Clean up"
    echo

    echo "Development Features:"
    echo "  - Hot reload for frontend and backend"
    echo "  - Node.js debugging on port 9229"
    echo "  - Redis for caching"
    echo "  - PostgreSQL for development"
    echo "  - MailHog for email testing"
    echo

    echo "Performance Testing:"
    echo "  ./scripts/docker-manage.sh perf - Start performance stack"
    echo "  - Grafana dashboards available"
    echo "  - k6 load testing ready"
    echo "  - System metrics collection"
    echo

    log_success "Enhanced Docker environment is ready for development!"
}

# Main execution
main() {
    echo "=== Enhanced Docker Setup for NeuroSense FX ==="
    echo

    check_docker_prerequisites
    create_dev_compose_file
    create_perf_compose_file
    create_optimized_dockerfiles
    setup_secrets_and_config
    build_docker_images
    start_containers
    setup_performance_monitoring
    create_management_scripts
    print_completion_info
}

# Handle script interruption
trap 'log_error "Setup interrupted"; exit 1' INT TERM

# Run main function
main "$@"