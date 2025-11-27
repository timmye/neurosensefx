# Production Deployment Guide

## Overview

This guide provides comprehensive procedures for deploying NeuroSense FX to production environments, ensuring high availability, security, and performance for foreign exchange trading operations.

## Architecture Overview

NeuroSense FX consists of:
- **Frontend**: Svelte 4.x application with Vite build system
- **Backend**: Node.js WebSocket server with cTrader Open API integration
- **Services**: Real-time market data processing and visualization
- **Infrastructure**: Containerized deployment with environment isolation

## Prerequisites

### System Requirements

**Hardware Specifications:**
- **CPU**: 4+ cores minimum, 8+ cores recommended
- **Memory**: 8GB minimum, 16GB recommended
- **Storage**: 50GB SSD minimum, 100GB+ recommended
- **Network**: 1Gbps connection with <100ms latency to trading venues

**Software Requirements:**
- **Operating System**: Ubuntu 20.04+ LTS, CentOS 8+, or Docker-compatible environment
- **Node.js**: 18.x LTS or higher
- **NPM**: 9.x or higher
- **Docker**: 20.10+ (optional but recommended)
- **Reverse Proxy**: Nginx 1.18+ or equivalent

### External Services

**cTrader API Credentials:**
- Live trading account access
- Valid API keys and tokens
- Account permissions for real-time data

**SSL/TLS Certificate:**
- Valid SSL certificate for production HTTPS/WSS
- Certificate auto-renewal mechanism

## Pre-Deployment Preparation

### 1. Environment Setup

```bash
# Clone repository
git clone https://github.com/your-org/neurosensefx.git
cd neurosensefx

# Install dependencies
npm install
cd services/tick-backend
npm install
cd ../..

# Set up environment file
cp .env.example .env
# Edit .env with production credentials
```

### 2. Production Configuration

Create `/workspaces/neurosensefx/.env` with:

```bash
# Trading Environment Configuration
CTRADER_ACCOUNT_TYPE=LIVE
CTRADER_CLIENT_ID=your_production_client_id
CTRADER_CLIENT_SECRET=your_production_client_secret
CTRADER_ACCESS_TOKEN=your_production_access_token
CTRADER_REFRESH_TOKEN=your_production_refresh_token
CTRADER_ACCOUNT_ID=your_production_account_id
CTRADER_HOST_TYPE=LIVE
HOST=live.ctraderapi.com
PORT=5035

# Production Ports
NODE_ENV=production
VITE_DEV=false
WS_PORT=8081

# Optional: Cloud deployment backend URL
# VITE_BACKEND_URL=wss://your-domain.com/ws
```

### 3. Security Configuration

**Environment Security:**
```bash
# Set proper file permissions
chmod 600 .env
chmod 755 run.sh

# Create service user (optional but recommended)
sudo useradd -r -s /bin/false neurosensefx
sudo chown -R neurosensefx:neurosensefx /opt/neurosensefx
```

**SSL Certificate Setup:**
```bash
# Using Let's Encrypt (example)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Deployment Procedures

### Option 1: Direct Server Deployment

**Step 1: Build Production Assets**
```bash
# Build frontend for production
npm run build:prod

# Verify build output
ls -la dist/
```

**Step 2: Service Deployment**
```bash
# Start production services
./run.sh start --production

# Verify service status
./run.sh status
./run.sh env-status
```

**Step 3: Configure Reverse Proxy**

**Nginx Configuration Example:**
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend
    location / {
        root /opt/neurosensefx/dist;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }
}
```

### Option 2: Docker Deployment

**Step 1: Create Dockerfile**

**Frontend Dockerfile:**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build:prod

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Backend Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY services/tick-backend/package*.json ./
RUN npm ci --only=production
COPY services/tick-backend/ .
COPY .env .env.production
EXPOSE 8081
CMD ["node", "server.js"]
```

**Step 2: Docker Compose**
```yaml
version: '3.8'
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/ssl/certs
    depends_on:
      - backend

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    environment:
      - NODE_ENV=production
      - WS_PORT=8081
    ports:
      - "8081:8081"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - frontend
      - backend
```

**Step 3: Deploy with Docker**
```bash
# Build and start services
docker-compose up -d --build

# Verify deployment
docker-compose ps
docker-compose logs backend
```

## Service Management

### Production Service Operations

**Start Services:**
```bash
./run.sh start --production
```

**Stop Services:**
```bash
./run.sh stop
```

**Check Status:**
```bash
./run.sh status          # Basic service status
./run.sh env-status       # Detailed environment status
```

**Monitor Logs:**
```bash
./run.sh logs             # All service logs
./run.sh logs backend     # Backend logs only
./run.sh logs frontend    # Frontend logs only
```

**Service Health Checks:**
```bash
# Check backend WebSocket connection
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: test" \
     -H "Sec-WebSocket-Version: 13" \
     http://localhost:8081/ws

# Check frontend serving
curl -I http://localhost:4173
```

## Performance Optimization

### Production Tuning

**Node.js Performance:**
```bash
# Set Node.js production flags
export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"

# Use process manager for auto-restart
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js
```

**PM2 Configuration (ecosystem.config.js):**
```javascript
module.exports = {
  apps: [
    {
      name: 'neurosensefx-backend',
      script: 'services/tick-backend/server.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        WS_PORT: 8081
      },
      max_memory_restart: '1G',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    }
  ]
};
```

**System Optimization:**
```bash
# Increase file descriptor limits
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# Optimize network settings
echo "net.core.somaxconn = 65536" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65536" >> /etc/sysctl.conf
sysctl -p
```

## Monitoring and Alerting

### Essential Monitoring

**Service Health Monitoring:**
```bash
# Create health check script
cat > /opt/neurosensefx/health-check.sh << 'EOF'
#!/bin/bash
# Check backend health
if ! curl -s http://localhost:8081/health > /dev/null; then
    echo "CRITICAL: Backend health check failed"
    exit 2
fi

# Check frontend health
if ! curl -s http://localhost:4173 > /dev/null; then
    echo "CRITICAL: Frontend health check failed"
    exit 2
fi

echo "OK: All services healthy"
exit 0
EOF

chmod +x /opt/neurosensefx/health-check.sh
```

**Log Monitoring:**
```bash
# Monitor for critical errors
tail -f backend.log | grep -i "error\|critical\|failed"

# Monitor WebSocket connection counts
grep "Client connected" backend.log | wc -l
```

### Performance Metrics

**Key Performance Indicators:**
- WebSocket connection latency < 100ms
- Frontend page load time < 2s
- Memory usage < 4GB per service
- CPU usage < 80% average
- 99.9% uptime SLA

## Security Considerations

### Production Security

**Network Security:**
- Configure firewall to allow only necessary ports (80, 443, 22)
- Use DDoS protection services
- Implement rate limiting for WebSocket connections
- Regular security updates and patching

**Application Security:**
- Environment variables properly secured
- SSL/TLS encryption enforced
- API credentials rotated regularly
- Error information sanitized in production logs

## Backup and Recovery

### Data Backup Procedures

**Configuration Backup:**
```bash
# Create backup script
cat > /opt/neurosensefx/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/neurosensefx"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup configuration files
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
    .env \
    nginx.conf \
    ecosystem.config.js

# Backup logs (last 7 days)
find . -name "*.log" -mtime -7 -exec tar -czf $BACKUP_DIR/logs_$DATE.tar.gz {} +

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
EOF

chmod +x /opt/neurosensefx/backup.sh
```

**Automated Backup (Crontab):**
```bash
# Add to crontab: crontab -e
0 2 * * * /opt/neurosensefx/backup.sh
```

### Disaster Recovery

**Service Recovery:**
```bash
# Restore from backup
./run.sh stop
tar -xzf /opt/backups/neurosensefx/config_latest.tar.gz
./run.sh start --production

# Restore to previous stable version
./run.sh snapshot_use stable-YYYYMMDD-HHMMSS
```

## Rollback Procedures

### Quick Rollback

**Using Snapshot Management:**
```bash
# View available snapshots
./run.sh snapshot_show

# Rollback to previous stable version
./run.sh snapshot_use stable-20241119-143000

# Return to development
./run.sh back_to_work
```

**Manual Rollback:**
```bash
# Stop current deployment
./run.sh stop

# Checkout previous commit
git checkout <previous-stable-commit>

# Rebuild and deploy
npm run build:prod
./run.sh start --production
```

## Post-Deployment Validation

### Validation Checklist

**Functional Validation:**
- [ ] Frontend loads correctly on HTTPS
- [ ] WebSocket connection established (WSS)
- [ ] Market data streaming active
- [ ] All visualization components functioning
- [ ] Keyboard shortcuts working
- [ ] Display creation and management operational

**Performance Validation:**
- [ ] Page load times < 2 seconds
- [ ] WebSocket latency < 100ms
- [ ] Memory usage within limits
- [ ] CPU usage within limits
- [ ] No console errors in production

**Security Validation:**
- [ ] SSL certificate valid and properly configured
- [ ] Environment variables secured
- [ ] No sensitive data in client-side code
- [ ] API endpoints properly secured

### User Acceptance Testing

**Trading Workflow Validation:**
1. **Display Creation**: Test Ctrl+K workflow for symbol search and display creation
2. **Live Data**: Verify real-time market data updates and visualization
3. **Multi-Display**: Test performance with 10+ concurrent displays
4. **Navigation**: Validate Ctrl+Tab display switching functionality
5. **Responsiveness**: Test drag-resize and repositioning during live updates

## Troubleshooting

### Common Issues

**Service Won't Start:**
```bash
# Check environment validation
./run.sh env-status

# Check port conflicts
sudo netstat -tulpn | grep -E ":(8081|4173|80|443)"

# Check log files
./run.sh logs backend
./run.sh logs frontend
```

**WebSocket Connection Issues:**
```bash
# Verify backend WebSocket is listening
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     http://localhost:8081/ws

# Check reverse proxy configuration
nginx -t
```

**Performance Issues:**
```bash
# Monitor resource usage
htop
iostat -x 1

# Check Node.js process limits
ps aux | grep node
ulimit -a
```

## Maintenance Procedures

### Regular Maintenance

**Weekly Tasks:**
- Review and rotate logs
- Check SSL certificate expiration
- Monitor performance metrics
- Apply security updates

**Monthly Tasks:**
- Backup verification and testing
- Performance tuning optimization
- Security audit review
- Dependency updates

**Quarterly Tasks:**
- Disaster recovery testing
- Capacity planning review
- Architecture optimization assessment
- Documentation updates

## Support and Escalation

### Contact Information

**Technical Support:**
- Primary: tech-support@your-domain.com
- Emergency: emergency@your-domain.com
- Documentation: https://docs.your-domain.com

**Service Level Agreement:**
- Critical issues: 1-hour response time
- High priority: 4-hour response time
- Medium priority: 24-hour response time
- Low priority: 72-hour response time

---

For additional support or questions, refer to the complete documentation set or contact the technical support team.