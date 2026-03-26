# Hosting Guide for NeuroSense FX

Production deployment guide for hosting NeuroSense FX on VPS providers.

## Overview

NeuroSense FX is a real-time FX trading visualization platform with specific hosting requirements:

- **Memory Usage**: ~185MB RAM in production (baseline)
- **CPU**: Primary bottleneck for tick data processing
- **Connectivity**: WebSocket connections required for cTrader API
- **Architecture**: Multi-container Docker Compose setup

## Hosting Provider Comparison

| Provider | Plan | Specs | Monthly Cost | Architecture | Recommendation |
|----------|------|-------|--------------|--------------|----------------|
| **Hetzner** | CX22 | 4GB RAM, 2 vCPU Arm64 | ~€4.50 | Arm64 | ✅ Recommended - Best value, sufficient CPU for tick processing |
| **DigitalOcean** | Basic | 1GB RAM, 1 vCPU | $6.00 | x64 | ⚠️ Minimum specs - May struggle with high tick frequency |
| **DigitalOcean** | Standard | 2GB RAM, 1 vCPU | $12.00 | x64 | ✅ Adequate - Mid-range option |
| **Hetzner** | CX21 | 2GB RAM, 1 vCPU | ~€3.50 | Arm64 | ⚠️ Minimum viable - Monitor CPU closely |

### Recommendation

**Hetzner CX22** provides the best balance:
- Arm64 architecture offers excellent performance per watt
- 2 vCPUs handle concurrent tick processing better than single core
- 4GB RAM provides headroom for Redis cache and monitoring stack
- Cost-effective at ~€4.50/month

## Prerequisites

### VPS Requirements

- **OS**: Ubuntu 22.04 LTS or Debian 12 (recommended)
- **RAM**: Minimum 2GB, 4GB recommended
- **CPU**: Minimum 1 vCPU, 2 vCPUs recommended for production
- **Storage**: 20GB SSD minimum
- **Architecture**: Arm64 or x64 (Docker images support both)

### Domain and DNS

- Registered domain name (e.g., `neurosensefx.example.com`)
- DNS A record pointing to VPS IP address
- Allow 24-48 hours for DNS propagation

### Required Credentials

**cTrader API Credentials** (from https://openapi.ctrader.com/apps):
- Client ID
- Client Secret
- Access Token
- Refresh Token
- Account ID
- Account Type (LIVE or DEMO)

**TradingView Session ID** (optional but recommended):
- Login to tradingview.com
- DevTools → Application → Cookies
- Copy `sessionid` cookie value

## Required Code Changes

Before deploying, the following code changes are required for production hosting. These are small, isolated changes that enable Docker Secrets support and health checking.

### 1. Backend Health Check (NEW FILE)

Create `services/tick-backend/healthcheck.js`:

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

### 2. Docker Secrets Support (MODIFY EXISTING FILE)

**File**: `services/tick-backend/CTraderSession.js`

The backend reads cTrader credentials from Docker Secrets (file paths) mounted by Docker Compose, with fallback to environment variables for local development.

**Add at the top of the constructor** (around line 20):

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

**This change:**
- Reads credentials from Docker Secrets in production (file paths at `/run/secrets/`)
- Falls back to environment variables for local development
- Isolated to credential loading only, no business logic impact

**Security Benefits:**
- Credentials not visible in `docker inspect` output
- Won't appear in crash dumps or child processes
- File permissions set to 600 (owner read-only)
- cTrader credentials have monetary value—this prevents accidental exposure

### 3. ARM64 Platform Specification (OPTIONAL)

For Hetzner CX22 (Arm64), add platform pinning to `docker-compose.yml`:

```yaml
services:
  frontend:
    platform: linux/arm64
  backend:
    platform: linux/arm64
```

This ensures consistent builds across architectures and prevents cross-arch compatibility issues.

### Summary of Changes

| File | Change | Lines | Risk |
|------|--------|-------|------|
| `services/tick-backend/healthcheck.js` | New file | ~15 | None |
| `services/tick-backend/CTraderSession.js` | Modify credential loading | ~20 | Low (isolated) |
| `docker-compose.yml` | Add platform pinning | 2 | None |

**Total**: ~35 lines, isolated changes, no business logic impact.

---

## Initial Server Setup

### 1. Server Provisioning

```bash
# Create VPS at Hetzner or DigitalOcean
# Choose: Ubuntu 22.04 LTS
# Choose: CX22 (Hetzner) or 2GB+ (DigitalOcean)
# Note the public IP address
```

### 2. Initial System Configuration

```bash
# SSH into your server
ssh root@your-vps-ip

# Update system packages
apt update && apt upgrade -y

# Set timezone (optional)
timedatectl set-timezone UTC

# Create non-root user for application
adduser neurosense
usermod -aG sudo neurosense

# Configure firewall
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

### 3. Install Docker and Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Add user to docker group
usermod -aG docker neurosense

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

## Application Deployment

### 1. Clone Repository

```bash
# Switch to application user
su - neurosense

# Clone repository
git clone https://github.com/your-username/neurosensefx.git
cd neurosensefx

# Verify directory structure
ls -la
```

### 2. Configure Secrets

```bash
# Create secrets directory
mkdir -p secrets

# Create secret files (replace with actual values)
echo "your_client_id_here" > secrets/ctrader_client_id.txt
echo "your_client_secret_here" > secrets/ctrader_client_secret.txt
echo "your_access_token_here" > secrets/ctrader_access_token.txt
echo "your_refresh_token_here" > secrets/ctrader_refresh_token.txt
echo "your_account_id_here" > secrets/ctrader_account_id.txt

# Set restrictive permissions
chmod 600 secrets/*

# Verify secrets
ls -la secrets/
```

### 3. Configure Environment Variables

```bash
# Create production .env file
cat > .env << 'EOF'
# Production Environment
NODE_ENV=production

# WebSocket Configuration
WS_PORT=8081
VITE_BACKEND_URL=wss://your-domain.com/ws

# cTrader Configuration
CTRADER_ACCOUNT_TYPE=LIVE
HOST=live.ctraderapi.com
PORT=5035

# TradingView Session (optional)
TRADINGVIEW_SESSION_ID=your_sessionid_here

# Grafana Admin Password
GRAFANA_PASSWORD=your_secure_grafana_password
EOF

# Replace placeholder values
nano .env  # Edit with your actual values
```

### 4. Create Required Directories

```bash
# Create directories for bind mounts
sudo mkdir -p /opt/neurosensefx/logs/backend
sudo mkdir -p /opt/neurosensefx/logs/nginx
sudo mkdir -p /opt/neurosensefx/logs/prometheus

# Set ownership
sudo chown -R neurosense:neurosense /opt/neurosensefx

# Create SSL directory
mkdir -p docker/nginx/ssl
```

### 5. Configure Nginx Reverse Proxy

```bash
# Create nginx configuration
cat > docker/nginx/nginx.conf << 'EOF'
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

    # Frontend
    server {
        listen 80;
        server_name your-domain.com;

        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL configuration (certbot will populate this)
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
EOF

# Replace your-domain.com with actual domain
nano docker/nginx/nginx.conf
```

### 6. Configure Prometheus

```bash
# Ensure prometheus configuration exists
mkdir -p docker/prometheus
cat > docker/prometheus/prometheus.yml << 'EOF'
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

# Health check endpoint monitoring (requires healthcheck.js)
  - job_name: 'neurosensefx-health'
    static_configs:
      - targets: ['backend:8081']
    metrics_path: '/health'
    scrape_interval: 30s
EOF
```

## SSL Certificate Setup

### Using Certbot (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot -y

# Stop nginx temporarily
docker-compose -f docker-compose.yml stop nginx

# Generate certificate
sudo certbot certonly --standalone \
  -d your-domain.com \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive

# Copy certificates to nginx SSL directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/

# Set permissions
chmod 644 docker/nginx/ssl/*.pem

# Start nginx
docker-compose -f docker-compose.yml start nginx
```

### Auto-renewal Setup

```bash
# Test renewal
sudo certbot renew --dry-run

# Setup auto-renewal cron job
(crontab -l 2>/dev/null; echo "0 0 * * 0 certbot renew --quiet --post-hook 'docker-compose -f /home/neurosense/neurosensefx/docker-compose.yml restart nginx'") | crontab -
```

## Starting the Application

### 1. Build and Start Containers

```bash
# Build images
docker-compose -f docker-compose.yml build

# Start all services
docker-compose -f docker-compose.yml up -d

# Check container status
docker-compose ps

# View logs
docker-compose logs -f
```

### 2. Verify Deployment

```bash
# Check service health
curl http://localhost/health
curl http://localhost:4173
curl http://localhost:8081

# Check container logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs nginx
docker-compose logs redis
```

### 3. Access Monitoring

- **Grafana**: https://your-domain.com:3000
  - Default credentials: `admin` / your GRAFANA_PASSWORD
- **Prometheus**: http://your-domain.com:9090

## Monitoring and Maintenance

### System Monitoring

```bash
# Check resource usage
docker stats

# View disk usage
df -h

# View memory usage
free -h

# View CPU load
uptime
```

### Log Management

```bash
# View backend logs
docker-compose logs -f backend

# View nginx logs
tail -f /opt/neurosensefx/logs/nginx/access.log
tail -f /opt/neurosensefx/logs/nginx/error.log

# Rotate logs (add to cron)
0 0 * * * docker run --rm -v /opt/neurosensefx/logs:/logs alpine sh -c 'find /logs -name "*.log" -mtime +7 -delete'
```

### Backup Strategy

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/neurosense/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup secrets
tar -czf $BACKUP_DIR/secrets_$DATE.tar.gz secrets/

# Backup environment
cp .env $BACKUP_DIR/env_$DATE.backup

# Backup Grafana data
docker run --rm --volumes-from neurosensefx-grafana -v $BACKUP_DIR:/backup alpine tar -czf /backup/grafana_$DATE.tar.gz /var/lib/grafana

# Backup Prometheus data
docker run --rm --volumes-from neurosensefx-prometheus -v $BACKUP_DIR:/backup alpine tar -czf /backup/prometheus_$DATE.tar.gz /prometheus

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.backup" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x backup.sh

# Add to cron (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/neurosense/neurosensefx/backup.sh >> /home/neurosense/backup.log 2>&1") | crontab -
```

### Updates and Upgrades

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.yml build
docker-compose -f docker-compose.yml up -d

# Clean up old images
docker image prune -a -f
```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check logs
docker-compose logs [service-name]

# Check resource usage
docker stats

# Verify configuration
docker-compose config

# Restart specific service
docker-compose restart [service-name]
```

#### 2. WebSocket Connection Fails

```bash
# Verify backend is running
docker-compose ps backend

# Check backend logs
docker-compose logs backend

# Verify nginx proxy configuration
docker-compose exec nginx cat /etc/nginx/nginx.conf

# Test WebSocket connection
wscat -c ws://localhost:8081
```

#### 3. cTrader Connection Issues

```bash
# Verify secrets files exist and have content
cat secrets/ctrader_client_id.txt
ls -la secrets/

# Verify secrets are mounted in container
docker-compose exec backend ls -la /run/secrets/

# Check backend logs for connection errors
docker-compose logs backend | grep -i ctrader

# Verify network connectivity
docker-compose exec backend ping live.ctraderapi.com
```

#### 3.1. Docker Secrets Not Loading

If the backend cannot read credentials from Docker Secrets:

```bash
# Check if secrets files exist on host
ls -la secrets/

# Verify file permissions (should be 600)
stat secrets/ctrader_client_id.txt

# Check if secrets are mounted in container
docker-compose exec backend ls -la /run/secrets/

# Test reading a secret from within container
docker-compose exec backend cat /run/secrets/ctrader_client_id

# Verify _FILE environment variables are set
docker-compose exec backend env | grep CTRADER_FILE
```

#### 4. High CPU Usage

```bash
# Identify CPU-intensive container
docker stats

# Check number of active symbols
docker-compose logs backend | grep -i symbol

# Reduce symbol subscriptions if needed

# Consider upgrading to CX22 (2 vCPU) if on CX21
```

#### 5. Out of Memory

```bash
# Check memory usage
free -h
docker stats --no-stream

# Adjust Docker Compose resource limits
nano docker-compose.yml

# Find and adjust memory limits:
# deploy:
#   resources:
#     limits:
#       memory: 2G  # Increase if needed

# Restart with new limits
docker-compose up -d
```

#### 6. SSL Certificate Issues

```bash
# Check certificate expiration
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Restart nginx
docker-compose restart nginx

# Verify certificate
curl -vI https://your-domain.com
```

#### 7. DNS Propagation Issues

```bash
# Check DNS resolution
dig your-domain.com
nslookup your-domain.com

# Check from different locations
# Use: https://www.whatsmydns.net/

# Verify A record points to correct IP
dig your-domain.com A +short
```

### Performance Optimization

```bash
# Enable Docker build cache
export DOCKER_BUILDKIT=1

# Use multi-stage builds (already configured in Dockerfile)

# Monitor performance
docker-compose logs backend | grep -i "processing\|latency"

# Adjust Redis memory limit
nano docker-compose.yml
# Find redis service and adjust:
# command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### Security Hardening

```bash
# Ensure secrets have correct permissions
chmod 600 secrets/*
ls -la secrets/

# Update system regularly
sudo apt update && sudo apt upgrade -y

# Configure automatic security updates
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades

# Fail2Ban for SSH
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Disable root SSH login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

## Production Checklist

### Pre-Deployment (Code Changes)
- [ ] Backend health check file created (`services/tick-backend/healthcheck.js`)
- [ ] CTraderSession.js modified to read Docker Secrets
- [ ] ARM64 platform pinning added to docker-compose.yml (if using Hetzner CX22)
- [ ] Changes tested locally with environment variables (fallback)

### Server Setup
- [ ] VPS provisioned with Ubuntu 22.04 LTS
- [ ] Domain DNS A record configured and propagated
- [ ] Docker and Docker Compose installed
- [ ] Firewall configured (ports 22, 80, 443)
- [ ] Application cloned and configured

### Configuration
- [ ] Secrets files created with actual cTrader credentials
- [ ] Secrets files have restrictive permissions (600)
- [ ] Environment variables set correctly in .env
- [ ] Required directories created (`/opt/neurosensefx/logs/`)
- [ ] Nginx reverse proxy configured with domain

### SSL & Security
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] SSL auto-renewal configured
- [ ] Grafana password changed from default
- [ ] Redis password configured (optional but recommended)

### Deployment Verification
- [ ] All containers running (`docker-compose ps`)
- [ ] Health checks passing (`/health` endpoint)
- [ ] WebSocket connection working (wss://domain/ws)
- [ ] cTrader connection established (check backend logs)
- [ ] Frontend accessible via HTTPS

### Monitoring & Maintenance
- [ ] Monitoring accessible (Grafana, Prometheus)
- [ ] Backup script configured and tested
- [ ] Log rotation configured
- [ ] Security hardening completed (fail2ban, unattended-upgrades)

## Resource Scaling Guidelines

### When to Upgrade

| Symptom | Current Plan | Upgrade To |
|---------|--------------|------------|
| Consistent high CPU (80%+) | CX21 (1 vCPU) | CX22 (2 vCPU) |
| Memory near limit | 2GB RAM | 4GB RAM |
| Slow tick processing | Any | Higher CPU tier |
| Frequent OOM kills | 2GB RAM | 4GB RAM |

### Performance Monitoring

Monitor these metrics in Grafana:
- Container CPU usage (alert if >80% sustained)
- Container memory usage (alert if >85%)
- WebSocket message rate
- Average tick processing latency
- cTrader connection uptime

## Support and Maintenance

### Regular Maintenance Tasks

**Daily**:
- Check container status
- Review error logs

**Weekly**:
- Review performance metrics in Grafana
- Check disk usage
- Verify backups completed

**Monthly**:
- Apply security updates
- Review and rotate secrets
- Audit access logs

### Useful Commands

```bash
# Quick health check
docker-compose ps && curl -s http://localhost/health

# View real-time logs for all services
docker-compose logs -f

# Restart all services
docker-compose restart

# Stop all services
docker-compose down

# Start all services
docker-compose up -d

# View resource usage
docker stats --no-stream

# Clean up unused resources
docker system prune -a --volumes -f
```

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Reverse Proxy Guide](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [Let's Encrypt Certbot](https://certbot.eff.org/)
- [cTrader Open API Documentation](https://openapi.ctrader.com/)
- [Hetzner Cloud Docs](https://docs.hetzner.com/)
- [DigitalOcean Docs](https://docs.digitalocean.com/)

## Appendix: Docker Compose Services Reference

| Service | Port | Purpose | Resource Limits |
|---------|------|---------|-----------------|
| frontend | 4173 | Svelte frontend | 1GB RAM, 2 CPU |
| backend | 8081 | WebSocket + cTrader | 2GB RAM, 1.5 CPU |
| redis | 6379 | Session cache | 512MB RAM, 0.5 CPU |
| nginx | 80/443 | Reverse proxy + SSL | Default |
| prometheus | 9090 | Metrics collection | Default |
| grafana | 3000 | Metrics visualization | Default |

Total estimated resource usage:
- **RAM**: ~3-4GB baseline
- **CPU**: ~2 vCPUs recommended for production
- **Storage**: ~20GB with logs and monitoring data