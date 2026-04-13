# Hosting Guide

Real-time FX trading visualization platform. Single VPS deployment for 1-5 users. Backend streams tick data from cTrader API via WebSocket. Auth uses cookie-based Redis sessions (30-day TTL). PostgreSQL stores user accounts, workspaces, drawings, price markers.

## Hosting Recommendation

| Provider | Plan | RAM | vCPU | Cost | Verdict |
|----------|------|-----|------|------|---------|
| Hetzner | CX21 | 2 GB | 1 | ~3.50 EUR/mo | Minimum viable |
| Hetzner | CX22 | 4 GB | 2 | ~4.50 EUR/mo | Recommended |
| Hetzner | CX32 | 8 GB | 4 | ~9.50 EUR/mo | Comfortable headroom |

CX22 is the pick. 4 GB covers the full stack including monitoring with room for spikes. 2 vCPUs handles concurrent tick processing. CX21 works if you skip monitoring (see section 9).

## MUST: Files That Must Exist Before Deploy

`docker-compose.yml` references files that do not exist in the repo. Without them, containers fail to start.

### Backend endpoints

**1. `services/tick-backend/httpServer.js` -- missing `/health` route**

Docker healthcheck (`node healthcheck.js`) and nginx healthcheck (`wget /health`) both need this. Add before the `const server = http.createServer(app);` line:

```javascript
app.get('/health', (req, res) => {
    res.status(200).send('healthy\n');
});
```

**2. `services/tick-backend/healthcheck.js` -- file does not exist**

`docker-compose.yml` runs `node healthcheck.js` for the backend healthcheck.

```javascript
const http = require('http');

const req = http.request({
    host: 'localhost',
    port: process.env.WS_PORT || 8081,
    path: '/health',
    timeout: 2000
}, (res) => {
    process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', () => process.exit(1));
req.on('timeout', () => { req.destroy(); process.exit(1); });
req.end();
```

**3. `/metrics` endpoint -- nothing serves it**

Prometheus scrapes `backend:8081/metrics` but nothing responds. Create `services/tick-backend/metrics.js`:

```javascript
const os = require('os');

function metricsHandler(req, res) {
    const mem = process.memoryUsage();
    const output = [
        '# HELP neurosensefx_process_memory_bytes Process memory usage in bytes',
        '# TYPE neurosensefx_process_memory_bytes gauge',
        `neurosensefx_process_memory_bytes{type="rss"} ${mem.rss}`,
        `neurosensefx_process_memory_bytes{type="heap_used"} ${mem.heapUsed}`,
        `neurosensefx_process_memory_bytes{type="heap_total"} ${mem.heapTotal}`,
        '',
        '# HELP neurosensefx_process_uptime_seconds Process uptime in seconds',
        '# TYPE neurosensefx_process_uptime_seconds gauge',
        `neurosensefx_process_uptime_seconds ${process.uptime().toFixed(1)}`,
        '',
    ].join('\n');
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(output);
}

module.exports = { metricsHandler };
```

Then in `httpServer.js`, add after the health route:

```javascript
const { metricsHandler } = require('./metrics');
app.get('/metrics', metricsHandler);
```

### Docker Secrets in CTraderSession.js

**4. `services/tick-backend/CTraderSession.js` -- ignores Docker Secrets**

Compose passes `CTRADER_*_FILE=/run/secrets/ctrader_*` but the constructor reads `process.env.CTRADER_*` directly. Add `fs` import at the top and replace lines 20-23:

```javascript
const fs = require('fs');

// Replace:
//   this.ctidTraderAccountId = Number(process.env.CTRADER_ACCOUNT_ID);
//   this.accessToken = process.env.CTRADER_ACCESS_TOKEN;
//   this.clientId = process.env.CTRADER_CLIENT_ID;
//   this.clientSecret = process.env.CTRADER_CLIENT_SECRET;
// With:
const readSecret = (filePath, envVar) => {
    if (filePath && fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8').trim();
    }
    return envVar;
};

this.ctidTraderAccountId = Number(
    readSecret(process.env.CTRADER_ACCOUNT_ID_FILE, process.env.CTRADER_ACCOUNT_ID)
);
this.accessToken = readSecret(
    process.env.CTRADER_ACCESS_TOKEN_FILE, process.env.CTRADER_ACCESS_TOKEN
);
this.clientId = readSecret(
    process.env.CTRADER_CLIENT_ID_FILE, process.env.CTRADER_CLIENT_ID
);
this.clientSecret = readSecret(
    process.env.CTRADER_CLIENT_SECRET_FILE, process.env.CTRADER_CLIENT_SECRET
);
```

The fallback to `process.env` preserves local dev behavior.

### Nginx main config

**5. `docker/nginx/nginx.conf` -- file does not exist**

Compose mounts three volumes into the nginx container:
- `./docker/nginx/nginx.conf` -> `/etc/nginx/nginx.conf`
- `./docker/nginx/sites-available` -> `/etc/nginx/sites-available`
- `./docker/nginx/ssl` -> `/etc/nginx/ssl`

Problem: `frontend.conf` and `ssl.conf` are in `./docker/nginx/`, not in `sites-available/` or `ssl/`. The `sites-available` and `ssl` directories don't exist on disk, so these mounts create empty directories inside the container, making the existing configs inaccessible.

Fix: create the directories and move the files so the mounts work.

```bash
mkdir -p docker/nginx/sites-available docker/nginx/ssl
mv docker/nginx/frontend.conf docker/nginx/sites-available/
mv docker/nginx/ssl.conf docker/nginx/ssl/
```

Then create `docker/nginx/nginx.conf`:

```nginx
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent"';
    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    client_max_body_size 1m;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript application/json;

    include /etc/nginx/ssl/ssl.conf;
    include /etc/nginx/sites-available/frontend.conf;
}
```

Also update the `ssl_certificate` paths in `frontend.conf` (now at `docker/nginx/sites-available/frontend.conf`). The current paths (`/etc/nginx/ssl/fullchain.pem`) are correct -- the ssl directory mount puts certs there.

### Prometheus + Grafana configs

These are COULD tier functionally, but `docker-compose.yml` unconditionally mounts them. If the files don't exist, the containers crash on startup. You have two options:

**Option A: Create stub configs so containers start silently**

**6. `docker/prometheus/prometheus.yml`:**

```bash
mkdir -p docker/prometheus
cp docker/performance/prometheus.yml docker/prometheus/prometheus.yml
```

Strip the perf-only targets (node-exporter, cadvisor, k6, frontend nginx_status). Keep prometheus self-monitoring and backend scrape.

**7. `docker/grafana/provisioning/datasources/prometheus.yml`:**

```bash
mkdir -p docker/grafana/provisioning/datasources
cp docker/performance/grafana/provisioning/datasources/prometheus.yml docker/grafana/provisioning/datasources/
```

The performance datasource already points to `http://prometheus:9090` which is correct.

**Option B: Comment out prometheus and grafana services in docker-compose.yml**

Saves 300-800 MB RAM and removes the need for these files. Only do this if you don't plan to use monitoring.

## MUST: Server Setup

```bash
# SSH in, update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Firewall: SSH, HTTP, HTTPS only
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Log out and back in for docker group
```

## MUST: Secrets and Environment

```bash
# cTrader credentials (monetary value -- protect these)
mkdir -p secrets
echo "your_client_id"       > secrets/ctrader_client_id.txt
echo "your_client_secret"   > secrets/ctrader_client_secret.txt
echo "your_access_token"    > secrets/ctrader_access_token.txt
echo "your_refresh_token"   > secrets/ctrader_refresh_token.txt
echo "your_account_id"      > secrets/ctrader_account_id.txt
chmod 600 secrets/*

# Environment (compose uses :? on POSTGRES_PASSWORD -- fails if unset)
cat > .env << 'EOF'
POSTGRES_PASSWORD=<strong-random-password>
GRAFANA_PASSWORD=<strong-random-password>
EOF
chmod 600 .env

# Bind-mounted log directories (defined as bind volumes in compose)
sudo mkdir -p /opt/neurosensefx/logs/{backend,nginx}
sudo chown -R $USER:$USER /opt/neurosensefx

# SSL certificate directory
mkdir -p docker/nginx/ssl
```

## MUST: SSL Certificate

Browsers require HTTPS for WebSocket connections. Without SSL, `/ws` won't work.

```bash
sudo apt install certbot -y

# Stop nginx to free port 80
docker compose stop nginx

# Issue certificate
sudo certbot certonly --standalone \
    -d your-domain.com \
    --email your@email.com \
    --agree-tos --non-interactive

# Copy certs into place
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/
chmod 644 docker/nginx/ssl/*.pem

docker compose start nginx

# Auto-renewal (weekly check, restart nginx if renewed)
(crontab -l 2>/dev/null; echo "0 3 * * 0 certbot renew --quiet --post-hook \"cd $(pwd) && docker compose restart nginx\"") | crontab -
```

## MUST: Deploy

```bash
docker compose build && docker compose up -d

# Verify
docker compose ps
curl -s http://localhost/health          # should print "healthy"
docker compose exec backend curl -s http://localhost:8081/health  # same
docker compose exec postgres pg_isready -U neurosensefx
docker compose exec redis redis-cli ping
```

All 7 services should show "healthy" or "running". Check backend logs for cTrader connection: `docker compose logs backend | grep -i connected`.

## SHOULD: Reliability Basics

| Task | How | Why |
|------|-----|-----|
| Database backups | `./scripts/backup.sh` via cron | Only copy of user data outside the container |
| Log rotation | `find /opt/neurosensefx/logs -name "*.log" -mtime +7 -delete` via cron | Bind-mounted logs grow unbounded |
| Container restart | Already configured (`restart: unless-stopped`) | Survives reboots and crashes |
| SSH security | Install fail2ban, disable root login, enable unattended-upgrades | Prevents brute force, keeps packages patched |

Backup cron (daily 2 AM):

```bash
(crontab -l 2>/dev/null; echo "0 2 * * * cd $(pwd) && ./scripts/backup.sh >> /opt/neurosensefx/logs/backup.log 2>&1") | crontab -
```

Note: `scripts/backup.sh` defaults to dev credentials (`neurosensefx_dev` / `neurosensefx_dev_123`). For production, either update the script or dump via Docker:

```bash
docker compose exec postgres pg_dump -U neurosensefx neurosensefx > backups/neurosensefx_$(date +%Y%m%d).sql
```

## COULD: Monitoring (Prometheus + Grafana)

Adds memory/CPU/uptime graphs for the backend. Costs 300-800 MB RAM for 4 metrics that you can get from `docker stats` and `docker compose logs`. Useful if you want historical trend data or alerting.

To enable: create the config files from section 3 (Option A), set `GRAFANA_PASSWORD` in `.env`, and uncomment the prometheus/grafana services if you previously commented them out. Access at `:9090` (Prometheus) and `:3000` (Grafana). Block these ports from the public internet:

```bash
ufw deny 3000/tcp
ufw deny 9090/tcp
```

For most 1-5 user deployments, `docker stats --no-stream` and checking logs covers the practical need.

## Troubleshooting

| Symptom | Diagnostic | What to look for |
|---------|-----------|------------------|
| Container won't start | `docker compose logs <service>` | Missing file, port conflict, OOM |
| WebSocket fails | `curl -v https://domain/ws` | 502 = backend down, 403 = nginx config |
| cTrader not connecting | `docker compose logs backend \| grep -i ctrader` | Auth error = secrets issue, timeout = network |
| Secrets not loading | `docker compose exec backend ls -la /run/secrets/` | Empty files or wrong permissions |
| PostgreSQL connection refused | `docker compose exec postgres pg_isready` | Not healthy yet, or wrong PG_HOST |
| 502 on API calls | `docker compose ps` | Backend not running or healthcheck failing |
| SSL errors | `curl -vI https://domain` | Expired cert, wrong cert path, missing chain |
| Out of memory | `free -h && docker stats --no-stream` | Disable monitoring or upgrade VPS |

## Production Checklist

### MUST (app won't work)

- [ ] All 7 files from section 3 created/modified
- [ ] Docker installed, firewall open on 22/80/443
- [ ] `secrets/*.txt` created with real cTrader credentials, chmod 600
- [ ] `.env` created with `POSTGRES_PASSWORD` and `GRAFANA_PASSWORD`
- [ ] `/opt/neurosensefx/logs/{backend,nginx}` created
- [ ] `docker/nginx/ssl/` has valid certificates
- [ ] `docker compose build && docker compose up -d` succeeds
- [ ] All services healthy: `docker compose ps`
- [ ] HTTPS works: `curl -s https://domain/health`
- [ ] WebSocket connects: backend logs show cTrader connected

### SHOULD (you'll have a bad time without it)

- [ ] Backup cron configured and tested
- [ ] Log rotation cron configured
- [ ] fail2ban installed and running
- [ ] Root SSH login disabled
- [ ] unattended-upgrades enabled
- [ ] Monitoring ports (3000, 9090) blocked by firewall

### COULD (nice-to-have)

- [ ] Prometheus + Grafana configs in place and running
- [ ] Grafana dashboards configured
- [ ] Cert auto-renewal tested with `certbot renew --dry-run`

## Appendix: Reference Tables

### Services

| Service | Image | Host Port | Purpose |
|---------|-------|-----------|---------|
| frontend | Dockerfile.frontend (nginx) | 4173 | Svelte SPA static files |
| backend | services/tick-backend/Dockerfile | 8081 | WebSocket + Express + cTrader |
| redis | redis:7-alpine | internal | Session storage |
| postgres | postgres:15-alpine | internal | Auth, workspaces, drawings, markers |
| nginx | nginx:alpine | 80, 443 | SSL termination, reverse proxy |
| prometheus | prom/prometheus | 9090 | Metrics collection |
| grafana | grafana/grafana | 3000 | Metrics visualization |
| performance-test | Dockerfile.performance | -- | Load testing (profile: testing) |

### Environment Variables

| Variable | Source | Notes |
|----------|--------|-------|
| `NODE_ENV` | Hardcoded | `production` |
| `WS_PORT` | Hardcoded | `8081` |
| `CTRADER_*_FILE` | Compose + secrets | Points to `/run/secrets/ctrader_*` |
| `REDIS_URL` | Compose | `redis://redis:6379` |
| `PG_HOST` | Compose | `postgres` |
| `PG_PORT` | Compose | `5432` |
| `PG_DATABASE` | `.env` | Defaults to `neurosensefx` |
| `PG_USER` | `.env` | Defaults to `neurosensefx` |
| `PG_PASSWORD` | `.env` | Required, `:?` syntax |
| `HOST` | `.env` | cTrader API host |
| `PORT` | `.env` | cTrader API port |
| `TRADINGVIEW_SESSION_ID` | `.env` | Optional |
| `MAX_RECONNECT_ATTEMPTS` | `.env` | Optional, defaults to 20 |
| `GRAFANA_PASSWORD` | `.env` | Optional, defaults to `neurosensefx123` |

### Volumes

| Volume | Type | Host Path | Container Path |
|--------|------|-----------|----------------|
| backend-logs | bind | `/opt/neurosensefx/logs/backend` | `/app/logs` |
| nginx-logs | bind | `/opt/neurosensefx/logs/nginx` | `/var/log/nginx` |
| redis-data | named | Docker managed | `/data` |
| postgres-data | named | Docker managed | `/var/lib/postgresql/data` |
| prometheus-data | named | Docker managed | `/prometheus` |
| grafana-data | named | Docker managed | `/var/lib/grafana` |

### Secrets

| Secret | File | Used by |
|--------|------|---------|
| ctrader_client_id | `secrets/ctrader_client_id.txt` | CTraderSession.js |
| ctrader_client_secret | `secrets/ctrader_client_secret.txt` | CTraderSession.js |
| ctrader_access_token | `secrets/ctrader_access_token.txt` | CTraderSession.js |
| ctrader_refresh_token | `secrets/ctrader_refresh_token.txt` | CTraderSession.js |
| ctrader_account_id | `secrets/ctrader_account_id.txt` | CTraderSession.js |

### Resource Estimates (1-5 users, actual usage)

| Component | Typical | Notes |
|-----------|---------|-------|
| frontend (nginx) | 10-30 MB | Static file serving |
| backend (Node.js) | 200-400 MB | WebSocket + cTrader connection |
| PostgreSQL | 50-100 MB | 5 tables, tiny data volume |
| Redis | 10-30 MB | A few session JSON blobs |
| nginx | 10-20 MB | Reverse proxy |
| **Total (without monitoring)** | **280-580 MB** | |
| prometheus | 200-400 MB | |
| grafana | 100-400 MB | |
| **Total (with monitoring)** | **580-1380 MB** | |

Compose sets resource limits totaling 4.5 GB, but actual usage is well under 1 GB for the essential stack. The limits exist as safety caps, not as allocation targets.
