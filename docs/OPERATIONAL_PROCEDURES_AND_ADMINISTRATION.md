# Operational Procedures and Administration Guide

## Overview

This guide provides comprehensive operational procedures and administration tasks for maintaining NeuroSense FX trading platform in production environments, ensuring optimal performance, security, and reliability.

## Daily Operations

### Morning System Check

**Automated Health Check Script:**
```bash
#!/bin/bash
# daily-health-check.sh
DATE=$(date +"%Y-%m-%d %H:%M:%S")
LOG_FILE="/var/log/neurosensefx/daily-checks.log"

echo "=== NeuroSense FX Daily Health Check - $DATE ===" >> $LOG_FILE

# Check service status
echo "Checking service status..." >> $LOG_FILE
./run.sh status >> $LOG_FILE 2>&1

# Check memory usage
echo "Memory usage:" >> $LOG_FILE
free -h >> $LOG_FILE

# Check disk space
echo "Disk usage:" >> $LOG_FILE
df -h >> $LOG_FILE

# Check SSL certificate expiry
echo "SSL certificate status:" >> $LOG_FILE
if [ -f /etc/letsencrypt/live/your-domain.com/cert.pem ]; then
    openssl x509 -in /etc/letsencrypt/live/your-domain.com/cert.pem -noout -dates >> $LOG_FILE
fi

# Check recent errors
echo "Recent backend errors:" >> $LOG_FILE
grep -i "error\|critical\|failed" backend.log | tail -10 >> $LOG_FILE

echo "=== Health Check Complete ===" >> $LOG_FILE
echo "" >> $LOG_FILE
```

**Manual Verification Steps:**
1. **Service Status Check**
   ```bash
   ./run.sh status
   ./run.sh env-status
   ```

2. **Performance Verification**
   ```bash
   # Check WebSocket connection
   curl -s http://localhost:8081/health || echo "Backend health check failed"

   # Check frontend serving
   curl -s -I http://localhost:4173 | head -1
   ```

3. **Resource Utilization Check**
   ```bash
   # Memory and CPU usage
   top -b -n 1 | head -20

   # Disk space
   df -h /opt/neurosensefx

   # Network connections
   netstat -an | grep -E ":(8081|4173|80|443)" | wc -l
   ```

### Throughout the Day Monitoring

**Real-time Monitoring:**
```bash
# Monitor active connections
watch "netstat -an | grep ESTABLISHED | wc -l"

# Monitor log files for errors
tail -f backend.log | grep -i "error\|critical"

# Monitor system resources
htop
```

**Alert Response Procedures:**
1. **Service Down Alert**
   - Check service status: `./run.sh status`
   - Restart if needed: `./run.sh stop && ./run.sh start --production`
   - Verify recovery: `./run.sh env-status`

2. **High Memory Usage Alert**
   - Identify memory usage: `ps aux --sort=-%mem | head -10`
   - Check for memory leaks: Monitor over time
   - Restart services if necessary

3. **High CPU Usage Alert**
   - Identify CPU consumers: `ps aux --sort=-%cpu | head -10`
   - Check for infinite loops or blocking processes
   - Restart affected services if needed

### End of Day Procedures

**Daily Backup:**
```bash
#!/bin/bash
# daily-backup.sh
BACKUP_DIR="/opt/backups/neurosensefx"
DATE=$(date +%Y%m%d)

# Create backup directory
mkdir -p $BACKUP_DIR/$DATE

# Backup configuration
tar -czf $BACKUP_DIR/$DATE/config.tar.gz .env nginx.conf ecosystem.config.js

# Backup recent logs
find . -name "*.log" -mtime -1 -exec cp {} $BACKUP_DIR/$DATE/ \;

# Clean old backups (keep 30 days)
find $BACKUP_DIR -type d -mtime +30 -exec rm -rf {} \;
```

**Log Rotation:**
```bash
#!/bin/bash
# log-rotation.sh
LOG_DIR="/opt/neurosensefx/logs"
DATE=$(date +%Y%m%d)

# Rotate and compress logs
for log in backend.log frontend.log; do
    if [ -f "$log" ]; then
        mv $log $LOG_DIR/$log.$DATE
        gzip $LOG_DIR/$log.$DATE
    fi
done

# Restart services to recreate log files
./run.sh restart
```

## Weekly Operations

### System Maintenance

**Weekly Health Audit:**
```bash
#!/bin/bash
# weekly-audit.sh

echo "=== NeuroSense FX Weekly Audit ==="
echo "Date: $(date)"
echo ""

# Service uptime
echo "Service Uptime:"
ps -o etime,cmd -p $(pgrep -f "node.*server.js") | grep -v "ETIME"

# SSL certificate check
echo ""
echo "SSL Certificate Status:"
if [ -f /etc/letsencrypt/live/your-domain.com/cert.pem ]; then
    openssl x509 -in /etc/letsencrypt/live/your-domain.com/cert.pem -noout -dates
    EXPIRY=$(openssl x509 -in /etc/letsencrypt/live/your-domain.com/cert.pem -noout -enddate | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_LEFT=$(( (EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))
    echo "Days until expiry: $DAYS_LEFT"
    if [ $DAYS_LEFT -lt 30 ]; then
        echo "WARNING: Certificate expires soon!"
    fi
fi

# System updates check
echo ""
echo "System Updates:"
apt list --upgradable 2>/dev/null | grep -c "upgradable"

# Disk usage trend
echo ""
echo "Disk Usage Analysis:"
df -h | grep -E "(Filesystem|/dev/)"

# Memory usage analysis
echo ""
echo "Memory Usage Analysis:"
free -h
echo ""

# Performance metrics
echo "Performance Metrics (last 7 days):"
echo "Average CPU: $(top -b -n 1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)"
echo "Memory Usage: $(free | grep Mem | awk '{printf("%.1f%%"), $3/$2 * 100.0}')"
```

**Performance Optimization:**
```bash
#!/bin/bash
# performance-tuning.sh

# Clear system caches
echo 3 > /proc/sys/vm/drop_caches

# Optimize file descriptors
ulimit -n 65536

# Check Node.js heap usage
pkill -USR2 node  # Triggers heap dump if configured

# Optimize network settings
echo "Optimizing network parameters..."
echo "net.core.somaxconn = 65536" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65536" >> /etc/sysctl.conf
sysctl -p
```

### Security Maintenance

**Security Scan:**
```bash
#!/bin/bash
# security-scan.sh

echo "=== Security Audit ==="

# Check for failed login attempts
echo "Failed SSH attempts:"
grep "Failed password" /var/log/auth.log | wc -l

# Check running processes
echo "Suspicious processes:"
ps aux | grep -E "(nc|ncat|wget|curl)" | grep -v grep

# Check open ports
echo "Open ports:"
netstat -tuln | grep LISTEN

# Check file permissions
echo "Critical file permissions:"
ls -la .env
ls -la /etc/ssl/private/

# Check for known vulnerabilities in Node packages
echo "Checking Node.js security vulnerabilities:"
npm audit --audit-level=high
cd services/tick-backend
npm audit --audit-level=high
cd ../..
```

## Monthly Operations

### System Updates and Patches

**System Update Procedure:**
```bash
#!/bin/bash
# monthly-update.sh

echo "=== Monthly System Update ==="

# Create pre-update backup
./backup.sh pre-update-$(date +%Y%m%d)

# Update system packages
echo "Updating system packages..."
apt update
apt upgrade -y

# Update Node.js packages
echo "Updating Node.js packages..."
npm update
cd services/tick-backend
npm update
cd ../..

# Restart services
echo "Restarting services..."
./run.sh restart

# Verify functionality
echo "Verifying services..."
./run.sh status
sleep 30
./run.sh env-status
```

**Dependency Security Audit:**
```bash
#!/bin/bash
# dependency-audit.sh

echo "=== Dependency Security Audit ==="

# Frontend dependencies
echo "Frontend dependencies:"
npm audit --audit-level=moderate

# Backend dependencies
echo "Backend dependencies:"
cd services/tick-backend
npm audit --audit-level=moderate
cd ../..

# cTrader-Layer dependencies
echo "cTrader-Layer dependencies:"
cd libs/cTrader-Layer
npm audit --audit-level=moderate
cd ../..
```

### Capacity Planning Review

**Performance Analysis:**
```bash
#!/bin/bash
# capacity-analysis.sh

echo "=== Capacity Planning Analysis ==="

# CPU utilization trends
echo "CPU utilization trends:"
sar -u | grep "Average"

# Memory utilization trends
echo "Memory utilization trends:"
sar -r | grep "Average"

# Network utilization
echo "Network utilization:"
sar -n DEV | grep "Average"

# Disk I/O
echo "Disk I/O:"
sar -d | grep "Average"

# User growth projections
echo "User activity analysis:"
grep "Client connected" backend.log | wc -l
echo "Total connections this month"
```

## Quarterly Operations

### Disaster Recovery Testing

**Backup Recovery Test:**
```bash
#!/bin/bash
# disaster-recovery-test.sh

BACKUP_DATE=$(date +%Y%m%d)
TEST_DIR="/opt/neurosensefx-test"

echo "=== Disaster Recovery Test - $BACKUP_DATE ==="

# Create test environment
mkdir -p $TEST_DIR

# Test configuration restore
echo "Testing configuration restore..."
tar -xzf /opt/backups/neurosensefx/config_latest.tar.gz -C $TEST_DIR

# Verify configuration files
if [ -f "$TEST_DIR/.env" ] && [ -f "$TEST_DIR/nginx.conf" ]; then
    echo "✅ Configuration restore successful"
else
    echo "❌ Configuration restore failed"
fi

# Test service startup from backup
echo "Testing service startup..."
cd $TEST_DIR
# Note: This would need adaptation for actual test environment

# Cleanup test environment
rm -rf $TEST_DIR

echo "=== Disaster Recovery Test Complete ==="
```

### Performance Benchmarking

**Quarterly Performance Test:**
```bash
#!/bin/bash
# performance-benchmark.sh

echo "=== Quarterly Performance Benchmark ==="

# Run load test
echo "Running load test..."
# Integration with k6 or JMeter would go here

# Measure baseline performance
echo "Measuring baseline performance..."
START_TIME=$(date +%s)

# Test WebSocket latency
echo "Testing WebSocket latency..."
for i in {1..100}; do
    # WebSocket latency test would go here
done

END_TIME=$(date +%s)
ELAPSED_TIME=$((END_TIME - START_TIME))

echo "Benchmark completed in $ELAPSED_TIME seconds"
```

## Incident Management

### Incident Response Procedures

**Severity Classification:**

**SEV-1 - Critical:**
- Complete service outage
- Data corruption or loss
- Security breach
- Response time: 15 minutes
- Resolution time: 4 hours

**SEV-2 - High:**
- Major feature unavailable
- Performance degradation > 50%
- Partial service outage
- Response time: 1 hour
- Resolution time: 8 hours

**SEV-3 - Medium:**
- Minor feature issues
- Performance degradation < 50%
- Response time: 4 hours
- Resolution time: 24 hours

**SEV-4 - Low:**
- Cosmetic issues
- Documentation errors
- Response time: 24 hours
- Resolution time: 72 hours

### Incident Response Checklist

**Initial Response (First 15 Minutes):**
1. Acknowledge incident
2. Assess impact scope
3. Form incident response team
4. Establish communication channel
5. Begin initial diagnosis

**Investigation (First Hour):**
1. Review monitoring alerts
2. Check recent changes
3. Analyze log files
4. Correlate with external factors
5. Identify root cause hypothesis

**Resolution:**
1. Implement fix
2. Monitor impact
3. Validate resolution
4. Document changes
5. Plan preventive measures

**Post-Incident:**
1. Conduct post-mortem
2. Document lessons learned
3. Update procedures
4. Communicate to stakeholders
5. Track action items

## Change Management

### Change Control Process

**Change Request Template:**
```
Change Request ID: CR-YYYY-NNN
Date Submitted: YYYY-MM-DD
Submitter: Name/Team
Priority: [Critical/High/Medium/Low]

Change Description:
- What is being changed
- Why the change is needed
- Expected benefits

Implementation Plan:
- Step-by-step procedures
- Resources required
- Timeline and schedule

Risk Assessment:
- Potential impacts
- Mitigation strategies
- Rollback procedures

Approval:
- Technical approval: ___________ Date: _______
- Business approval: ___________ Date: _______
- Security approval: ___________ Date: _______
```

**Standard Change Procedures:**
1. **Planning Phase**
   - Define change scope
   - Assess risk and impact
   - Develop implementation plan
   - Schedule change window

2. **Testing Phase**
   - Test in staging environment
   - Validate functionality
   - Performance testing
   - Security review

3. **Implementation Phase**
   - Communicate change
   - Execute implementation
   - Monitor systems
   - Validate success

4. **Post-Implementation Phase**
   - Monitor performance
   - Document changes
   - Update documentation
   - Conduct review

## Monitoring and Alerting

### Dashboard Configuration

**Key Performance Indicators:**
- Service availability percentage
- Average response time
- Active user count
- Error rate percentage
- System resource utilization

**Alert Configuration:**
```json
{
  "alerts": {
    "service_down": {
      "condition": "service_status != 'running'",
      "severity": "critical",
      "notification": ["email", "sms", "slack"]
    },
    "high_cpu": {
      "condition": "cpu_usage > 90% for 5 minutes",
      "severity": "high",
      "notification": ["email", "slack"]
    },
    "high_memory": {
      "condition": "memory_usage > 95%",
      "severity": "high",
      "notification": ["email", "slack"]
    },
    "ssl_expiry": {
      "condition": "ssl_days_left < 30",
      "severity": "medium",
      "notification": ["email"]
    }
  }
}
```

### Log Analysis Procedures

**Automated Log Analysis:**
```bash
#!/bin/bash
# log-analysis.sh

LOG_FILE="backend.log"
ERROR_PATTERNS="ERROR|CRITICAL|FATAL|Exception|Failed"

# Count errors by type
echo "Error Summary:"
grep -E "$ERROR_PATTERNS" $LOG_FILE | awk '{print $NF}' | sort | uniq -c | sort -nr

# Show recent errors
echo ""
echo "Recent Errors (Last Hour):"
find $LOG_FILE -mmin -60 -exec grep -E "$ERROR_PATTERNS" {} \;

# Analyze connection patterns
echo ""
echo "Connection Analysis:"
echo "Peak connections: $(grep "Client connected" $LOG_FILE | wc -l)"
echo "Disconnections: $(grep "Client disconnected" $LOG_FILE | wc -l)"
```

## Troubleshooting Guide

### Common Issues and Solutions

**Service Won't Start:**
```bash
# Check environment validation
./run.sh env-status

# Check port conflicts
sudo netstat -tulpn | grep -E ":(8081|4173)"

# Check log files for errors
./run.sh logs backend | tail -20
./run.sh logs frontend | tail -20

# Check file permissions
ls -la .env run.sh
```

**WebSocket Connection Issues:**
```bash
# Test WebSocket endpoint
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: test" \
     -H "Sec-WebSocket-Version: 13" \
     http://localhost:8081/ws

# Check backend service
ps aux | grep "node.*server.js"

# Check firewall rules
sudo ufw status
```

**Performance Issues:**
```bash
# Check system resources
top
iostat -x 1
free -h

# Check Node.js process details
ps aux | grep node
kill -USR2 <pid>  # Trigger heap dump if configured

# Check network latency
ping -c 10 live.ctraderapi.com
```

**SSL Certificate Issues:**
```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/your-domain.com/cert.pem -noout -dates

# Test SSL configuration
openssl s_client -connect your-domain.com:443

# Renew certificate
sudo certbot renew --dry-run
```

## Automation and Scripting

### Maintenance Automation

**Crontab Configuration:**
```bash
# Edit crontab
crontab -e

# Add automated tasks
0 2 * * * /opt/neurosensefx/scripts/daily-backup.sh
0 3 * * 0 /opt/neurosensefx/scripts/weekly-audit.sh
0 4 1 * * /opt/neurosensefx/scripts/monthly-update.sh
*/5 * * * * /opt/neurosensefx/scripts/health-check.sh
```

**Automated Health Checks:**
```bash
#!/bin/bash
# automated-health-check.sh

# Service health check
if ! curl -s http://localhost:8081/health > /dev/null; then
    echo "ALERT: Backend service down" | mail -s "Service Alert" admin@domain.com
    ./run.sh restart
fi

# Disk space check
DISK_USAGE=$(df /opt/neurosensefx | tail -1 | awk '{print $5}' | cut -d'%' -f1)
if [ $DISK_USAGE -gt 90 ]; then
    echo "ALERT: Disk usage at ${DISK_USAGE}%" | mail -s "Disk Alert" admin@domain.com
fi

# Memory check
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f"), $3/$2 * 100.0}')
if [ $MEMORY_USAGE -gt 95 ]; then
    echo "ALERT: Memory usage at ${MEMORY_USAGE}%" | mail -s "Memory Alert" admin@domain.com
fi
```

## Documentation Maintenance

### Documentation Review Schedule

**Monthly:**
- Update incident response procedures
- Review and update contact information
- Update system configuration documentation

**Quarterly:**
- Complete procedures review
- Update performance benchmarks
- Review and update security procedures

**Annually:**
- Complete documentation audit
- Update architecture documentation
- Review compliance requirements

### Knowledge Base Management

**Documentation Standards:**
- All procedures must be step-by-step
- Include troubleshooting steps for each procedure
- Document expected outcomes and validation steps
- Include rollback procedures for all changes
- Maintain change logs for all procedures

**Review Process:**
- Technical review by senior administrator
- Security review by security team
- Business process review by operations manager
- Final approval by system owner

---

For additional support or specific operational scenarios, refer to the complete documentation set or contact the technical support team.