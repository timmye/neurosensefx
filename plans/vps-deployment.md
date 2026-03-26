# VPS Cloud Deployment Preparation Plan

**Plan ID**: `vps-deployment-20240326`
**Created**: 2024-03-26
**Status**: Draft

## Overview

Prepare the NeuroSense FX repository for VPS cloud deployment by implementing health checks, Docker Secrets support, production nginx configuration, Prometheus monitoring, and optional ARM64 platform pinning.

### Problem

NeuroSense FX requires code changes for VPS deployment:
- Health check endpoint for Docker orchestration
- Secure credential loading via Docker Secrets
- Production nginx reverse proxy with SSL/WebSocket
- Prometheus metrics configuration
- Optional ARM64 platform specification

### Approach

Five independent milestones covering backend healthcheck, credential security, nginx routing, monitoring config, and platform specification. All changes are backward compatible with local development.

---

## Milestones

```
M-001    M-002    M-003    M-004    M-005
  |        |        |        |        |
Health    Secrets   Nginx    Prometheus ARM64
Check    Support   Config    Config      (opt)
```

**All milestones are independent and can be implemented in any order.**

---

## M-001: Backend Health Check HTTP Endpoint

**Files**: `services/tick-backend/server.js`, `services/tick-backend/healthcheck.js`

### Requirements
- HTTP server listens on same port as WebSocket (8081)
- GET /health returns 200 status with body `healthy\n`
- WebSocket upgrade handshake continues to work for non-HTTP requests
- healthcheck.js script performs HTTP GET and exits appropriately

### Acceptance Criteria
- [ ] `curl http://localhost:8081/health` returns `healthy` with status 200
- [ ] WebSocket clients can still connect to `ws://localhost:8081`
- [ ] `node healthcheck.js` exits 0 when backend is healthy, exits 1 when not

### Code Changes

#### 1. Create `services/tick-backend/healthcheck.js`

```javascript
const http = require('http');

const options = {
  host: 'localhost',
  port: process.env.WS_PORT || 8081,
  path: '/health',
  timeout: 2000
};

const request = http.request(options, (res) => {
  console.log(`Health check: ${res.statusCode}`);
  process.exit(res.statusCode === 200 ? 0 : 1);
});

request.on('error', (err) => {
  console.error(`Health check failed: ${err.message}`);
  process.exit(1);
});

request.end();
```

#### 2. Modify `services/tick-backend/server.js`

Add HTTP server after line 28 (after console.log statements, before CTraderSession instantiation):

```javascript
// Simple HTTP server for health checks
const http = require('http');
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('healthy\n');
  } else {
    res.writeHead(404);
    res.end('Not Found\n');
  }
});
healthServer.listen(port, () => {
  console.log(`🏥 HTTP health server listening on port ${port}`);
});
```

---

## M-002: Docker Secrets Support in CTraderSession

**Files**: `services/tick-backend/CTraderSession.js`
**Flags**: `security`

### Requirements
- Import fs module for file reading
- Create readSecret helper function with file existence check
- Apply readSecret to all 5 credentials: ctidTraderAccountId, accessToken, clientId, clientSecret, refreshToken
- Preserve environment variable fallback for local development

### Acceptance Criteria
- [ ] Local development with .env continues to work (environment variable fallback)
- [ ] Production with Docker Secrets mounted at /run/secrets/ reads credentials from files
- [ ] Missing secret file falls back to environment variable
- [ ] Both _FILE and direct environment variable patterns are supported

### Code Changes

Modify `services/tick-backend/CTraderSession.js` constructor (around line 20):

```javascript
const fs = require('fs');

// Helper function to read from file or fall back to env var
const readSecret = (filePath, envVar) => {
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8').trim();
  }
  return envVar;
};

// Use the helper for each credential
this.ctidTraderAccountId = Number(
  readSecret(
    process.env.CTRADER_ACCOUNT_ID_FILE,
    process.env.CTRADER_ACCOUNT_ID
  )
);
this.accessToken = readSecret(
  process.env.CTRADER_ACCESS_TOKEN_FILE,
  process.env.CTRADER_ACCESS_TOKEN
);
this.clientId = readSecret(
  process.env.CTRADER_CLIENT_ID_FILE,
  process.env.CTRADER_CLIENT_ID
);
this.clientSecret = readSecret(
  process.env.CTRADER_CLIENT_SECRET_FILE,
  process.env.CTRADER_CLIENT_SECRET
);
```

**Security Benefits:**
- Credentials not visible in `docker inspect` output
- Won't appear in crash dumps or child processes
- File permissions set to 600 (owner read-only)

---

## M-003: Production Nginx Reverse Proxy Configuration

**Files**: `docker/nginx/nginx.conf`

### Requirements
- Create nginx.conf in docker/nginx/ directory
- Configure http block with gzip compression
- Configure server block listening on port 80 with 301 redirect to HTTPS
- Configure server block listening on port 443 with SSL
- Location / proxies to frontend:4173 with WebSocket upgrade support
- Location /ws proxies to backend:8081 with WebSocket Connection upgrade
- Location /health returns 200 `healthy\n`

### Acceptance Criteria
- [ ] HTTP requests to port 80 redirect to HTTPS
- [ ] HTTPS requests to / serve frontend static files
- [ ] WebSocket connections to /ws upgrade successfully to backend
- [ ] Health check at /health returns 200
- [ ] SSL certificates are loaded from /etc/nginx/ssl/ directory

### Code Changes

Create `docker/nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/xml+rss application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Frontend
        location / {
            proxy_pass http://frontend:4173;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # WebSocket backend
        location /ws {
            proxy_pass http://backend:8081;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 86400;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

**Note**: Replace `your-domain.com` with actual domain before deployment.

---

## M-004: Production Prometheus Configuration

**Files**: `docker/prometheus/prometheus.yml`

### Requirements
- Create prometheus.yml in docker/prometheus/ directory
- Global scrape_interval: 15s
- Job: prometheus (self-monitoring on localhost:9090)
- Job: neurosensefx-backend (backend:8081/metrics)
- Job: neurosensefx-frontend (frontend:4173/health)
- Job: redis (redis:6379)

### Acceptance Criteria
- [ ] Prometheus scrapes backend metrics endpoint every 10 seconds
- [ ] Prometheus scrapes frontend health endpoint every 30 seconds
- [ ] Prometheus self-scrapes every 15 seconds
- [ ] Prometheus UI at localhost:9090 shows all targets as 'up'

### Code Changes

Create `docker/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'neurosensefx-backend'
    static_configs:
      - targets: ['backend:8081']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'neurosensefx-frontend'
    static_configs:
      - targets: ['frontend:4173']
    scrape_interval: 30s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  # Health check endpoint monitoring
  - job_name: 'neurosensefx-health'
    static_configs:
      - targets: ['backend:8081']
    metrics_path: '/health'
    scrape_interval: 30s
```

---

## M-005: Optional ARM64 Platform Pinning

**Files**: `docker-compose.yml`
**Flags**: `optional`

### Requirements
- Add commented `platform: linux/arm64` to frontend service
- Add commented `platform: linux/arm64` to backend service
- Include comments explaining when to enable (Hetzner CX22)
- Include comments explaining when to disable (x64 deployments)

### Acceptance Criteria
- [ ] docker-compose.yml remains valid with platform directives commented
- [ ] Uncommenting platform directive does not break docker-compose build
- [ ] x64 deployments work without modification
- [ ] ARM64 deployments work after uncommenting platform directives

### Code Changes

Modify `docker-compose.yml`:

```yaml
services:
  frontend:
    # platform: linux/arm64  # Uncomment for Hetzner CX22 (ARM64). Leave commented for x64.
    build:
      context: .
      dockerfile: Dockerfile.frontend
      # ... rest of frontend config

  backend:
    # platform: linux/arm64  # Uncomment for Hetzner CX22 (ARM64). Leave commented for x64.
    build:
      context: ./services/tick-backend
      dockerfile: Dockerfile
    # ... rest of backend config
```

---

## Constraints

| ID | Type | Description |
|----|------|-------------|
| C-001 | Technical | All changes MUST be backward compatible with local development (`./run.sh dev`) |
| C-002 | Technical | Docker Secrets implementation MUST fallback to environment variables |
| C-003 | Security | MUST NOT commit any actual credentials or secrets to git |
| C-004 | Technical | Healthcheck HTTP server must coexist with WebSocket server on same port |

---

## Risks & Mitigations

| ID | Risk | Mitigation |
|----|------|------------|
| R-001 | HTTP and WebSocket on same port may have routing conflicts | HTTP server handles /health, all other requests fall through to WebSocket upgrade |
| R-002 | Docker Secrets file paths may not exist in local development | readSecret helper checks fs.existsSync before reading, falls back to environment variable |

---

## Rejected Alternatives

| ID | Alternative | Rejection Reason |
|----|-------------|------------------|
| RA-001 | Environment variables for secrets in production | Security risk: credentials visible in docker inspect and crash logs |
| RA-002 | Separate HTTP server process for healthcheck | Multi-process complexity adds deployment overhead |
| RA-003 | Use docker/performance/prometheus.yml for production | Performance config includes k6/cadvisor not needed in production |

---

## Implementation Order

All milestones are independent. Suggested order:

1. **M-002** (Docker Secrets) - Core security, testable locally
2. **M-001** (Health Check) - Enables health monitoring
3. **M-004** (Prometheus) - Configuration only
4. **M-003** (Nginx) - Configuration only
5. **M-005** (ARM64) - Optional, deploy-specific

---

## Testing Strategy

### Manual Verification

| Milestone | Test Command | Expected Result |
|-----------|--------------|-----------------|
| M-001 | `curl http://localhost:8081/health` | Returns `healthy` with 200 |
| M-001 | `node services/tick-backend/healthcheck.js` | Exits 0 when backend running |
| M-002 | `./run.sh dev` | Works with existing .env file |
| M-003 | `nginx -t -c docker/nginx/nginx.conf` | Config syntax valid |
| M-004 | `prometheus tool check-config docker/prometheus/prometheus.yml` | Config valid |

### Local Development

After each milestone:
1. Run `./run.sh dev` to verify backward compatibility
2. Check that WebSocket connections still work
3. Verify no breaking changes to existing functionality

---

## Deployment Notes

### VPS-Only Actions (Not in Scope)

These actions are performed on the VPS, not in this repository:

- Install Docker and Docker Compose
- Create directories (`/opt/neurosensefx/logs/`)
- Generate SSL certificates with certbot
- Create secrets files with real credentials
- Deploy containers with `docker-compose up -d`

### Secrets Files (Never Commit)

```
secrets/
├── ctrader_client_id.txt
├── ctrader_client_secret.txt
├── ctrader_access_token.txt
├── ctrader_refresh_token.txt
└── ctrader_account_id.txt
```

These are created on the VPS only with permissions 600.

---

## Reference Documentation

- **Full deployment guide**: `docs/hosting.md`
- **Docker Compose configuration**: `docker-compose.yml`
- **Existing performance Prometheus config**: `docker/performance/prometheus.yml`

---

## Summary

| Metric | Value |
|--------|-------|
| Total Files | 9 |
| Total Lines | ~200 |
| Estimated Time | 2-3 hours |
| Risk Level | Low (backward compatible) |
| Blocking Issues | None |
