# NeuroSense FX Linux VM Installation Script
# Optimized for professional trading environments

set -euo pipefail

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
    exit 1
}

# System Requirements Check
check_system_requirements() {
    log "Checking system requirements..."

    # Check CPU cores
    CPU_CORES=$(nproc)
    if [ "$CPU_CORES" -lt 4 ]; then
        error "Minimum 4 CPU cores required. Found: $CPU_CORES"
    fi

    # Check RAM
    TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_RAM" -lt 16 ]; then
        error "Minimum 16GB RAM required. Found: ${TOTAL_RAM}GB"
    fi

    # Check available storage
    AVAILABLE_STORAGE=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
    if [ "$AVAILABLE_STORAGE" -lt 100 ]; then
        error "Minimum 100GB storage required. Found: ${AVAILABLE_STORAGE}GB"
    fi

    log "System requirements check passed ✓"
}

# Install System Dependencies
install_system_dependencies() {
    log "Installing system dependencies..."

    # Update package list
    apt-get update

    # Install essential packages
    apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        nodejs \
        npm \
        python3 \
        python3-pip \
        python3-venv \
        docker.io \
        docker-compose \
        ufw \
        htop \
        iotop \
        nethogs \
        nginx \
        certbot \
        python3-certbot-nginx

    # Configure Docker
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ubuntu

    # Install Node.js 20 LTS (matching project requirements)
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs

    log "System dependencies installed ✓"
}

# Configure Firewall
configure_firewall() {
    log "Configuring firewall..."

    # Reset firewall rules
    ufw --force reset

    # Default policies
    ufw default deny incoming
    ufw default allow outgoing

    # Essential ports for NeuroSense FX
    ufw allow ssh                    # SSH (22)
    ufw allow 80                    # HTTP
    ufw allow 443                   # HTTPS
    ufw allow 5174                  # Development frontend
    ufw allow 8080                  # Development backend WebSocket
    ufw allow 4173                  # Production frontend
    ufw allow 8081                  # Production backend WebSocket

    # Enable firewall
    ufw --force enable

    log "Firewall configured ✓"
}

# Optimize System Performance
optimize_system_performance() {
    log "Optimizing system performance for trading applications..."

    # Configure sysctl for low-latency trading
    cat >> /etc/sysctl.conf << 'EOF'

# NeuroSense FX Performance Optimizations
# Network stack optimization for real-time trading data
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 65536 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.core.netdev_max_backlog = 5000

# CPU scheduling optimization
kernel.sched_min_granularity_ns = 10000000
kernel.sched_wakeup_granularity_ns = 2000000

# Memory management
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# File system performance
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288
EOF

    # Apply sysctl changes
    sysctl -p

    # Create systemd drop-in for Docker performance
    mkdir -p /etc/systemd/system/docker.service.d
    cat > /etc/systemd/system/docker.service.d/performance.conf << 'EOF'
[Service]
# Performance optimizations for real-time trading
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// --exec-opt native.cgroupdriver=systemd --userland-proxy=false
LimitNOFILE=1048576
LimitNPROC=infinity
EOF

    systemctl daemon-reload
    systemctl restart docker

    log "System performance optimized ✓"
}

# Setup Application Directory
setup_application_directory() {
    log "Setting up NeuroSense FX application directory..."

    # Create main application directory
    mkdir -p /opt/neurosensefx
    cd /opt/neurosensefx

    # Clone repository (replace with your actual repository)
    if [ ! -d ".git" ]; then
        log "Cloning NeuroSense FX repository..."
        git clone https://github.com/your-org/neurosensefx.git .
    else
        log "Repository already exists, pulling latest changes..."
        git pull origin main
    fi

    # Set proper permissions
    chown -R ubuntu:ubuntu /opt/neurosensefx
    chmod +x /opt/neurosensefx/run.sh

    log "Application directory setup complete ✓"
}

# Install Node.js Dependencies
install_node_dependencies() {
    log "Installing Node.js dependencies..."

    cd /opt/neurosensefx

    # Install main project dependencies
    npm install

    # Install backend dependencies
    cd services/tick-backend
    npm install

    cd ../..

    log "Node.js dependencies installed ✓"
}

# Create Production Environment Configuration
create_production_config() {
    log "Creating production environment configuration..."

    cd /opt/neurosensefx

    # Create production environment file
    if [ ! -f ".env.production" ]; then
        cp .env.example .env.production

        log "Please update .env.production with your cTrader credentials"
        log "File location: /opt/neurosensefx/.env.production"
    fi

    # Create systemd service for production deployment
    cat > /etc/systemd/system/neurosensefx.service << 'EOF'
[Unit]
Description=NeuroSense FX Trading Platform
After=docker.service
Wants=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/neurosensefx
User=ubuntu
Group=ubuntu
ExecStart=/opt/neurosensefx/run.sh start --production
ExecStop=/opt/neurosensefx/run.sh stop
TimeoutStartSec=300
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
EOF

    systemctl enable neurosensefx

    log "Production configuration created ✓"
}

# Setup SSL Certificate (Let's Encrypt)
setup_ssl_certificate() {
    log "Setting up SSL certificate..."

    # Note: This assumes you have a domain name configured
    # Replace your-domain.com with your actual domain

    cat > /etc/nginx/sites-available/neurosensefx << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Proxy to NeuroSense FX
    location / {
        proxy_pass http://localhost:4173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # WebSocket proxy configuration
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # WebSocket endpoint
    location /ws {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/neurosensefx /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    # Test and reload nginx
    nginx -t && systemctl reload nginx

    log "SSL certificate setup complete ✓"
}

# Create Backup Script
create_backup_script() {
    log "Creating backup script..."

    cat > /opt/neurosensefx/scripts/backup.sh << 'EOF'
#!/bin/bash

# NeuroSense FX Backup Script
BACKUP_DIR="/opt/backups/neurosensefx"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="neurosensefx_${DATE}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup application files
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_code.tar.gz" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=logs \
    --exclude=backups \
    -C /opt/neurosensefx .

# Backup environment configuration
cp /opt/neurosensefx/.env.production "${BACKUP_DIR}/${BACKUP_NAME}_env.txt"

# Backup database (if applicable)
# mysqldump -u root -p neurosensefx_db > "${BACKUP_DIR}/${BACKUP_NAME}_database.sql"

# Cleanup old backups (keep last 30 days)
find "$BACKUP_DIR" -name "neurosensefx_*.tar.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "neurosensefx_*_env.txt" -mtime +30 -delete

echo "Backup completed: ${BACKUP_NAME}"
EOF

    chmod +x /opt/neurosensefx/scripts/backup.sh
    chown ubuntu:ubuntu /opt/neurosensefx/scripts/backup.sh

    # Add to cron for daily backups at 2 AM
    (crontab -l 2>/dev/null; echo "0 2 * * * /opt/neurosensefx/scripts/backup.sh") | crontab -

    log "Backup script created ✓"
}

# Installation Summary
installation_summary() {
    log "NeuroSense FX Linux VM setup completed!"

    cat << 'EOF'

🎉 INSTALLATION COMPLETE 🎉

NeuroSense FX has been successfully installed and configured for production use.

NEXT STEPS:
1. Update cTrader credentials in /opt/neurosensefx/.env.production
2. Configure your domain name in nginx configuration
3. Set up SSL certificate: certbot --nginx -d your-domain.com
4. Start the application: systemctl start neurosensefx
5. Monitor logs: journalctl -u neurosensefx -f

IMPORTANT FILES:
- Application: /opt/neurosensefx/
- Environment: /opt/neurosensefx/.env.production
- Service: /etc/systemd/system/neurosensefx.service
- Nginx: /etc/nginx/sites-available/neurosensefx
- Backup: /opt/neurosensefx/scripts/backup.sh

USEFUL COMMANDS:
- Start service: systemctl start neurosensefx
- Stop service: systemctl stop neurosensefx
- Check status: systemctl status neurosensefx
- View logs: journalctl -u neurosensefx -f
- Manual control: cd /opt/neurosensefx && ./run.sh [dev|start|stop]

PERFORMANCE OPTIMIZATIONS APPLIED:
- Network stack tuned for real-time data
- Docker performance optimizations
- Memory management for extended sessions
- File system limits increased
- Firewall configured for trading security

Enjoy your professional trading environment! 🚀
EOF
}

# Main Installation Flow
main() {
    log "Starting NeuroSense FX Linux VM installation..."

    check_system_requirements
    install_system_dependencies
    configure_firewall
    optimize_system_performance
    setup_application_directory
    install_node_dependencies
    create_production_config
    setup_ssl_certificate
    create_backup_script
    installation_summary

    log "Installation completed successfully! ✓"
}

# Run installation
main "$@"