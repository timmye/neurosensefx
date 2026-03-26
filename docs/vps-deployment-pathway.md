# VPS Deployment Pathway

Step-by-step guide for deploying NeuroSense FX to a VPS, including initial setup and ongoing update workflows.

---

## Initial Deployment Path

### Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INITIAL DEPLOYMENT                          │
└─────────────────────────────────────────────────────────────────────┘

1. SIGN UP & PROVISION
   ├─ Create Hetzner account (or DigitalOcean)
   ├─ Create CX22 VPS (Ubuntu 22.04, 4GB ARM64)
   └─ Note the public IP address

2. DNS CONFIGURATION
   ├─ Buy domain (if needed) ~$10-15/year
   ├─ Add A record: your-domain.com → VPS IP
   └─ Wait 24-48 hours for propagation (can proceed during this)

3. INITIAL SERVER SETUP (one-time, ~15 min)
   ├─ SSH into VPS: ssh root@your-vps-ip
   ├─ apt update && apt upgrade -y
   ├─ Create user: adduser neurosense
   ├─ Install Docker: curl -fsSL https://get.docker.com | sh
   ├─ Configure firewall: ufw allow 22/80/443
   └─ Clone repo: git clone <your-repo-url>

4. CODE PREPARATION (do here first, then push)
   ├─ Implement M-001 to M-005 from plan
   ├─ Test locally: ./run.sh dev
   ├─ Commit changes
   └─ git push origin main

5. SECRETS CONFIGURATION (~5 min)
   ├─ Create secrets/*.txt files with cTrader credentials
   ├─ chmod 600 secrets/*
   ├─ Create .env with domain/config
   └─ Verify: ls -la secrets/

6. SSL CERTIFICATE (~5 min)
   ├─ Install certbot: apt install certbot
   ├─ Generate certificate: certbot certonly --standalone
   ├─ Copy to nginx ssl directory
   └─ Setup auto-renewal cron job

7. DEPLOY (~5 min)
   ├─ docker-compose build
   ├─ docker-compose up -d
   ├─ docker-compose ps (verify all running)
   └─ curl https://your-domain.com/health

8. VERIFY
   ├─ Frontend loads: https://your-domain.com
   ├─ WebSocket connects: check browser console
   ├─ cTrader connected: docker-compose logs backend
   └─ Monitoring: https://your-domain.com:3000 (Grafana)

TOTAL TIME: ~30-45 minutes (after DNS propagation)
```

---

## Step 1: Sign Up & Provision VPS

### Hetzner CX22 (Recommended)

1. Create account at https://www.hetzner.com/
2. Create new project:
   - Location: Choose region closest to you (for latency)
   - Image: Ubuntu 22.04 LTS
   - Type: CX22 (4GB RAM, 2 vCPU ARM64)
   - SSH Key: Add your public SSH key

3. Note the **Public IPv4** address

### Alternative: DigitalOcean

1. Create account at https://www.digitalocean.com/
2. Create Droplet:
   - Image: Ubuntu 22.04 LTS
   - Size: Basic ($6/mo, 1GB) or Standard ($12/mo, 2GB)
   - Region: Choose closest to you

---

## Step 2: DNS Configuration

### If You Have a Domain

1. Go to your domain registrar (Namecheap, GoDaddy, etc.)
2. Add DNS A record:
   - **Type**: A
   - **Name**: @ (or your subdomain)
   - **Value**: Your VPS public IP
   - **TTL**: 300 (5 minutes)

3. Wait for propagation (can proceed with other steps during this time)

### Verify DNS Propagation

```bash
# From your local machine
dig your-domain.com A +short
# Should return your VPS IP

# Or use online tool
# https://www.whatsmydns.net/
```

---

## Step 3: Initial Server Setup

### SSH into VPS

```bash
ssh root@your-vps-ip
```

### Update System

```bash
apt update && apt upgrade -y
timedatectl set-timezone UTC
```

### Create Application User

```bash
adduser neurosense
usermod -aG sudo neurosense
usermod -aG docker neurosense
```

### Configure Firewall

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

### Switch to Application User

```bash
su - neurosense
cd ~
```

---

## Step 4: Code Preparation (Do This Locally First)

Before deploying to VPS, implement required code changes:

1. Complete milestones M-001 through M-005 from `plans/vps-deployment.md`
2. Test locally: `./run.sh dev`
3. Commit and push:

```bash
git add .
git commit -m "feat: prepare for VPS deployment"
git push origin main
```

---

## Step 5: Clone & Configure on VPS

### Clone Repository

```bash
# As neurosense user on VPS
git clone https://github.com/your-username/neurosensefx.git
cd neurosensefx
```

### Create Secrets Files

```bash
mkdir -p secrets

# Create secrets with your cTrader credentials
echo "your_client_id" > secrets/ctrader_client_id.txt
echo "your_client_secret" > secrets/ctrader_client_secret.txt
echo "your_access_token" > secrets/ctrader_access_token.txt
echo "your_refresh_token" > secrets/ctrader_refresh_token.txt
echo "your_account_id" > secrets/ctrader_account_id.txt

# Set restrictive permissions
chmod 600 secrets/*
```

### Create Environment File

```bash
cat > .env << 'EOF'
NODE_ENV=production
WS_PORT=8081
VITE_BACKEND_URL=wss://your-domain.com/ws
CTRADER_ACCOUNT_TYPE=LIVE
GRAFANA_PASSWORD=your_secure_password_here
EOF
```

### Create Required Directories

```bash
sudo mkdir -p /opt/neurosensefx/logs/backend
sudo mkdir -p /opt/neurosensefx/logs/nginx
sudo chown -R neurosense:neurosense /opt/neurosensefx
```

---

## Step 6: SSL Certificate

### Install Certbot

```bash
sudo apt install certbot -y
```

### Stop Nginx (if Running)

```bash
# If nginx is running, stop it temporarily
sudo systemctl stop nginx  # or docker-compose stop nginx
```

### Generate Certificate

```bash
sudo certbot certonly --standalone \
  -d your-domain.com \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive
```

### Create SSL Directory and Copy Certificates

```bash
mkdir -p docker/nginx/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/
sudo chown neurosense:neurosense docker/nginx/ssl/*
chmod 644 docker/nginx/ssl/*
```

### Setup Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job for auto-renewal
(crontab -l 2>/dev/null; echo "0 0 * * 0 certbot renew --quiet --post-hook 'docker-compose -f /home/neurosense/neurosensefx/docker-compose.yml restart nginx'") | crontab -
```

---

## Step 7: Deploy

### Build and Start Services

```bash
docker-compose build
docker-compose up -d
```

### Verify Deployment

```bash
# Check all containers are running
docker-compose ps

# Check health endpoint
curl http://localhost/health

# Check logs
docker-compose logs -f
```

---

## Step 8: Final Verification

```bash
# 1. Frontend loads
curl -I https://your-domain.com

# 2. Health check
curl https://your-domain.com/health

# 3. WebSocket (test from browser)
# Open browser console and connect to wss://your-domain.com/ws

# 4. Backend logs for cTrader connection
docker-compose logs backend | grep -i ctrader

# 5. Monitoring
# Visit https://your-domain.com:3000 (Grafana)
```

---

## Ongoing: Deploying New Versions

### Option 1: Direct Git Pull (Simplest)

**Locally:**
```bash
# Make changes, test, commit
./run.sh dev  # test locally
git add .
git commit -m "feature: description"
git push origin main
```

**On VPS:**
```bash
ssh neurosense@your-domain.com
cd neurosensefx
git pull origin main
docker-compose build
docker-compose up -d --force-recreate
```

### Option 2: Tagged Releases (Recommended)

**Locally:**
```bash
# Create version tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

**On VPS:**
```bash
cd neurosensefx
git fetch --tags
git checkout v1.0.0
docker-compose build
docker-compose up -d --force-recreate
```

### Option 3: Using Built-in Snapshot System

**Locally:**
```bash
./run.sh snapshot_save
# Creates tag: stable-YYYYMMDD-HHMMSS
git push origin main --tags
```

**On VPS:**
```bash
cd neurosensefx
git fetch --tags
./run.sh snapshot_use stable-20240326-120000
docker-compose build
docker-compose up -d --force-recreate
```

---

## Quick Reference Commands

### Remote Status Checks

```bash
# SSH one-liners for common tasks

# Check service status
ssh neurosense@domain "cd neurosensefx && ./run.sh status"

# View recent logs
ssh neurosense@domain "cd neurosensefx && docker-compose logs --tail=50"

# Restart services
ssh neurosense@domain "cd neurosensefx && docker-compose restart"

# Quick health check
ssh neurosense@domain "curl -s http://localhost/health"
```

### Update and Deploy

```bash
# One-line update command
ssh neurosense@domain "cd neurosensefx && git pull && docker-compose up -d --build"
```

---

## Rollback Procedure

### Quick Rollback

```bash
ssh neurosense@your-domain.com
cd neurosensefx

# View recent commits
git log --oneline -5

# Checkout previous working commit
git checkout abc1234
docker-compose build
docker-compose up -d --force-recreate
```

### Rollback to Tag

```bash
# List available tags
git tag -l

# Checkout specific tag
git checkout v1.0.0
# or
./run.sh snapshot_use stable-20240326-100000

# Rebuild and restart
docker-compose build
docker-compose up -d --force-recreate
```

**Rollback time**: ~2-3 minutes

---

## What Doesn't Require Redeployment

| Change | Action | Time |
|--------|--------|------|
| `.env` config changes | `docker-compose restart backend` | ~5 sec |
| Secrets rotation | `docker-compose restart backend` | ~5 sec |
| Grafana dashboards | No action (auto-saved) | - |
| Prometheus config | `docker-compose restart prometheus` | ~5 sec |
| Nginx config | `docker-compose restart nginx` | ~5 sec |

Only **code changes** require `docker-compose build && docker-compose up -d`.

---

## Monitoring & Maintenance

### Automated (Cron Jobs)

```bash
# View existing cron jobs
crontab -l

# Automated tasks:
# - SSL auto-renewal (weekly)
# - Backups (daily at 2 AM)
```

### Manual Weekly Tasks

```bash
# 1. Review Grafana dashboards
# Visit: https://your-domain.com:3000

# 2. Check disk usage
ssh neurosense@domain "df -h"

# 3. Review error logs
ssh neurosense@domain "docker-compose logs backend | grep ERROR | tail -20"

# 4. Verify backups
ssh neurosense@domain "ls -lah backups/ | tail -5"
```

### Monthly Tasks

```bash
# 1. Security updates
ssh neurosense@domain
sudo apt update && sudo apt upgrade -y

# 2. Review and rotate secrets (optional)
# Consider rotating cTrader tokens

# 3. Test backup restoration
# (Documented in hosting guide)
```

---

## Troubleshooting Deployment Issues

### Container Won't Start

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

### WebSocket Connection Fails

```bash
# Verify backend is running
docker-compose ps backend

# Check backend logs
docker-compose logs backend | tail -50

# Test WebSocket connection
wscat -c ws://localhost:8081
```

### SSL Certificate Issues

```bash
# Check certificate expiration
sudo certbot certificates

# Renew manually
sudo certbot renew

# Restart nginx
docker-compose restart nginx
```

### High CPU Usage

```bash
# Identify CPU-intensive container
docker stats

# Check number of active symbols
docker-compose logs backend | grep -i symbol

# Consider reducing symbol subscriptions
```

---

## Backup Strategy

### Automated Backup Script

```bash
# On VPS: Create backup script
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
docker run --rm --volumes-from neurosensefx-grafana \
  -v $BACKUP_DIR:/backup alpine \
  tar -czf /backup/grafana_$DATE.tar.gz /var/lib/grafana

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x backup.sh

# Add to cron (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/neurosense/neurosensefx/backup.sh >> /home/neurosense/backup.log 2>&1") | crontab -
```

---

## Security Checklist

### Initial Setup

- [ ] SSH key authentication (disable password login)
- [ ] Firewall configured (ports 22, 80, 443 only)
- [ ] Fail2Ban installed and running
- [ ] Unattended upgrades configured
- [ ] Root SSH login disabled
- [ ] Secrets files have 600 permissions
- [ ] SSL/TLS configured properly
- [ ] Grafana password changed from default

### Ongoing

- [ ] Security patches applied monthly
- [ ] Secrets rotated periodically
- [ ] Access logs reviewed for suspicious activity
- [ ] Backup restoration tested quarterly

---

## Cost Summary

| Item | Cost (Monthly) |
|------|----------------|
| Hetzner CX22 VPS | ~€4.50 |
| Domain Name | ~$1-2 |
| **Total** | **~€5-7/month** |

---

## Additional Resources

- [Full Hosting Guide](hosting.md) - Detailed deployment documentation
- [Implementation Plan](../plans/vps-deployment.md) - Technical change specifications
- [Hetzner Cloud Docs](https://docs.hetzner.com/)
- [Let's Encrypt Certbot](https://certbot.eff.org/)
