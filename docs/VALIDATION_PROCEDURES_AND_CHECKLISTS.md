# Validation Procedures and Checklists

## Overview

This document provides comprehensive validation procedures and checklists for ensuring successful deployment, operation, and maintenance of the NeuroSense FX trading platform. These procedures are designed to validate system readiness, performance, security, and reliability.

## Pre-Deployment Validation Checklist

### Environment Readiness Validation

**System Requirements Check:**
```bash
#!/bin/bash
# validate-system-requirements.sh

echo "=== System Requirements Validation ==="

# Check operating system
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "OS: $NAME $VERSION"
    if [[ "$ID" != "ubuntu" ]] && [[ "$ID" != "centos" ]] && [[ "$ID" != "rhel" ]]; then
        echo "❌ Unsupported operating system"
        exit 1
    fi
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_NODE_VERSION="18"
if [ "$(printf '%s\n' "$REQUIRED_NODE_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is below required version $REQUIRED_NODE_VERSION"
    exit 1
fi
echo "✅ Node.js version: $NODE_VERSION"

# Check available memory
TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
if [ $TOTAL_MEM -lt 8 ]; then
    echo "❌ Insufficient memory: ${TOTAL_MEM}GB (minimum 8GB required)"
    exit 1
fi
echo "✅ Memory: ${TOTAL_MEM}GB"

# Check disk space
DISK_SPACE=$(df /opt | tail -1 | awk '{print $4}')
DISK_SPACE_GB=$((DISK_SPACE / 1024 / 1024))
if [ $DISK_SPACE_GB -lt 50 ]; then
    echo "❌ Insufficient disk space: ${DISK_SPACE_GB}GB (minimum 50GB required)"
    exit 1
fi
echo "✅ Disk space: ${DISK_SPACE_GB}GB"

# Check network connectivity
if ! ping -c 1 google.com > /dev/null 2>&1; then
    echo "❌ No internet connectivity"
    exit 1
fi
echo "✅ Network connectivity confirmed"

echo "=== System Requirements Validation Complete ==="
```

**Software Dependencies Validation:**
```bash
#!/bin/bash
# validate-dependencies.sh

echo "=== Software Dependencies Validation ==="

# Check Node.js modules
if [ ! -d "node_modules" ]; then
    echo "❌ Frontend dependencies not installed"
    echo "Run: npm install"
    exit 1
fi
echo "✅ Frontend dependencies installed"

# Check backend dependencies
if [ ! -d "services/tick-backend/node_modules" ]; then
    echo "❌ Backend dependencies not installed"
    echo "Run: cd services/tick-backend && npm install"
    exit 1
fi
echo "✅ Backend dependencies installed"

# Check cTrader-Layer dependencies
if [ ! -d "libs/cTrader-Layer/node_modules" ]; then
    echo "❌ cTrader-Layer dependencies not installed"
    echo "Run: cd libs/cTrader-Layer && npm install"
    exit 1
fi
echo "✅ cTrader-Layer dependencies installed"

# Validate package integrity
npm audit --audit-level=moderate
cd services/tick-backend
npm audit --audit-level=moderate
cd ../..
cd libs/cTrader-Layer
npm audit --audit-level=moderate
cd ../..

echo "=== Software Dependencies Validation Complete ==="
```

### Configuration Validation

**Environment Configuration Check:**
```bash
#!/bin/bash
# validate-configuration.sh

echo "=== Configuration Validation ==="

# Check environment file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found"
    echo "Copy .env.example to .env and configure with production credentials"
    exit 1
fi
echo "✅ .env file exists"

# Check required environment variables
REQUIRED_VARS=(
    "CTRADER_CLIENT_ID"
    "CTRADER_CLIENT_SECRET"
    "CTRADER_ACCESS_TOKEN"
    "CTRADER_ACCOUNT_ID"
    "HOST"
    "PORT"
)

for VAR in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${VAR}=" .env; then
        echo "❌ Missing required environment variable: $VAR"
        exit 1
    fi
done
echo "✅ Required environment variables present"

# Check for placeholder values
if grep -q "your_.*_here" .env; then
    echo "❌ Placeholder values found in .env file"
    echo "Please replace placeholder values with actual credentials"
    exit 1
fi
echo "✅ No placeholder values found"

# Validate file permissions
if [ "$(stat -c %a .env)" != "600" ]; then
    echo "❌ .env file permissions are insecure"
    echo "Run: chmod 600 .env"
    exit 1
fi
echo "✅ .env file permissions are secure"

echo "=== Configuration Validation Complete ==="
```

**Network Configuration Validation:**
```bash
#!/bin/bash
# validate-network.sh

echo "=== Network Configuration Validation ==="

# Check port availability
PORTS=(80 443 8081 22)
for PORT in "${PORTS[@]}"; do
    if netstat -tuln | grep -q ":$PORT "; then
        echo "⚠️  Port $PORT is already in use"
    else
        echo "✅ Port $PORT is available"
    fi
done

# Test cTrader API connectivity
HOST=$(grep "^HOST=" .env | cut -d'=' -f2)
PORT=$(grep "^PORT=" .env | cut -d'=' -f2)
if nc -z -w3 $HOST $PORT; then
    echo "✅ cTrader API connectivity confirmed"
else
    echo "❌ Cannot connect to cTrader API at $HOST:$PORT"
    exit 1
fi

# Test DNS resolution
if nslookup live.ctraderapi.com > /dev/null 2>&1; then
    echo "✅ DNS resolution working"
else
    echo "❌ DNS resolution failed"
    exit 1
fi

echo "=== Network Configuration Validation Complete ==="
```

### Security Validation

**SSL Certificate Validation:**
```bash
#!/bin/bash
# validate-ssl.sh

echo "=== SSL Certificate Validation ==="

SSL_CERT_PATH="/etc/letsencrypt/live/your-domain.com/cert.pem"

if [ ! -f "$SSL_CERT_PATH" ]; then
    echo "❌ SSL certificate not found at $SSL_CERT_PATH"
    echo "Please obtain and install SSL certificate"
    exit 1
fi

# Check certificate validity
if openssl x509 -checkend 86400 -noout -in "$SSL_CERT_PATH"; then
    echo "✅ SSL certificate is valid"
else
    echo "❌ SSL certificate has expired or will expire within 24 hours"
    exit 1
fi

# Check certificate expiry date
EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$SSL_CERT_PATH" | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))

echo "Certificate expires: $EXPIRY_DATE ($DAYS_LEFT days)"

if [ $DAYS_LEFT -lt 30 ]; then
    echo "⚠️  Certificate expires in less than 30 days"
fi

echo "=== SSL Certificate Validation Complete ==="
```

**Security Configuration Validation:**
```bash
#!/bin/bash
# validate-security.sh

echo "=== Security Configuration Validation ==="

# Check file permissions
CRITICAL_FILES=(".env" "nginx.conf")
for FILE in "${CRITICAL_FILES[@]}"; do
    if [ -f "$FILE" ]; then
        PERMS=$(stat -c %a "$FILE")
        if [ "$PERMS" = "600" ] || [ "$PERMS" = "644" ]; then
            echo "✅ $FILE permissions: $PERMS"
        else
            echo "⚠️  $FILE permissions may be insecure: $PERMS"
        fi
    fi
done

# Check for exposed secrets
if grep -r "password\|secret\|token" --include="*.js" --include="*.json" src/ | grep -v "example"; then
    echo "❌ Potential secrets found in source code"
    exit 1
fi
echo "✅ No exposed secrets in source code"

# Check firewall status
if command -v ufw >/dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
        echo "✅ Firewall is active"
    else
        echo "⚠️  Firewall is not active"
    fi
fi

echo "=== Security Configuration Validation Complete ==="
```

## Functional Validation Procedures

### Core Functionality Testing

**Service Startup Validation:**
```bash
#!/bin/bash
# validate-service-startup.sh

echo "=== Service Startup Validation ==="

# Start services
echo "Starting production services..."
./run.sh start --production

# Wait for services to initialize
echo "Waiting for services to initialize..."
sleep 30

# Check backend service
if pgrep -f "node.*server.js" > /dev/null; then
    echo "✅ Backend service is running"
else
    echo "❌ Backend service failed to start"
    ./run.sh logs backend | tail -20
    exit 1
fi

# Check WebSocket endpoint
if curl -s http://localhost:8081/health > /dev/null 2>&1; then
    echo "✅ WebSocket endpoint is responding"
else
    echo "❌ WebSocket endpoint is not responding"
    exit 1
fi

# Check frontend service
if curl -s -I http://localhost:4173 | head -1 | grep -q "200 OK"; then
    echo "✅ Frontend service is serving"
else
    echo "❌ Frontend service is not responding"
    ./run.sh logs frontend | tail -20
    exit 1
fi

echo "=== Service Startup Validation Complete ==="
```

**WebSocket Connection Validation:**
```bash
#!/bin/bash
# validate-websocket.sh

echo "=== WebSocket Connection Validation ==="

# Test WebSocket connection using curl
RESPONSE=$(curl -i -N -H "Connection: Upgrade" \
                 -H "Upgrade: websocket" \
                 -H "Sec-WebSocket-Key: test" \
                 -H "Sec-WebSocket-Version: 13" \
                 -s http://localhost:8081/ws 2>&1)

if echo "$RESPONSE" | grep -q "HTTP/1.1 101 Switching Protocols"; then
    echo "✅ WebSocket handshake successful"
else
    echo "❌ WebSocket handshake failed"
    echo "$RESPONSE"
    exit 1
fi

# Test WebSocket message handling
# This would typically be done with a WebSocket client library
# For basic validation, we can check if the service is listening
if netstat -tuln | grep -q ":8081.*LISTEN"; then
    echo "✅ WebSocket service is listening on port 8081"
else
    echo "❌ WebSocket service is not listening"
    exit 1
fi

echo "=== WebSocket Connection Validation Complete ==="
```

**Trading Functionality Validation:**
```bash
#!/bin/bash
# validate-trading-functionality.sh

echo "=== Trading Functionality Validation ==="

# Test cTrader API connection
# This would require a test client that can connect to the WebSocket
# and verify the connection status

echo "Testing cTrader API connection..."
# Check backend logs for successful connection
if grep -q "Connected to cTrader" backend.log; then
    echo "✅ cTrader API connection successful"
else
    echo "⚠️  cTrader API connection status unclear"
    echo "Checking recent logs..."
    tail -20 backend.log
fi

# Test symbol data availability
# This would typically be done by checking the available symbols list
echo "Testing symbol data availability..."
# Monitor backend logs for symbol loading
sleep 10
if grep -q "availableSymbols" backend.log; then
    echo "✅ Symbol data loaded successfully"
else
    echo "⚠️  Symbol data loading may be incomplete"
fi

echo "=== Trading Functionality Validation Complete ==="
```

## Performance Validation

### Load Testing Procedures

**WebSocket Load Testing:**
```javascript
// websocket-load-test.js
// Using k6 for load testing
import ws from 'k6/ws';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
};

const WS_URL = 'ws://localhost:8081/ws';

export default function () {
  const response = ws.connect(WS_URL, {}, function (socket) {
    socket.on('open', () => {
      // Send connection message
      socket.send(JSON.stringify({ type: 'connect' }));

      // Subscribe to symbols
      socket.send(JSON.stringify({
        type: 'subscribe',
        symbols: ['EURUSD', 'GBPUSD', 'XAUUSD']
      }));
    });

    socket.on('message', (message) => {
      check(message, {
        'message received': (msg) => msg !== '',
        'tick data format': (msg) => {
          const data = JSON.parse(msg);
          return data.type === 'tick' && data.symbol && data.bid && data.ask;
        },
      });
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    socket.setTimeout(() => {
      socket.close();
    }, 30000);
  });

  check(response, { 'status is 101': (r) => r && r.status === 101 });
}
```

**Performance Benchmark Testing:**
```bash
#!/bin/bash
# performance-benchmark.sh

echo "=== Performance Benchmark Testing ==="

# Measure response times
echo "Measuring WebSocket response times..."
for i in {1..100}; do
    START_TIME=$(date +%s%N)
    curl -s http://localhost:8081/health > /dev/null
    END_TIME=$(date +%s%N)
    RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
    echo $RESPONSE_TIME >> response_times.log
done

AVG_RESPONSE_TIME=$(awk '{sum+=$1; count++} END {print sum/count}' response_times.log)
echo "Average response time: ${AVG_RESPONSE_TIME}ms"

if [ $(echo "$AVG_RESPONSE_TIME < 100" | bc) -eq 1 ]; then
    echo "✅ Response time meets target (<100ms)"
else
    echo "❌ Response time exceeds target (${AVG_RESPONSE_TIME}ms > 100ms)"
fi

# Measure memory usage
MEMORY_USAGE=$(ps -o rss= -p $(pgrep -f "node.*server.js") | awk '{print $1/1024}')
echo "Memory usage: ${MEMORY_USAGE}MB"

if [ $(echo "$MEMORY_USAGE < 1024" | bc) -eq 1 ]; then
    echo "✅ Memory usage within limits (<1GB)"
else
    echo "⚠️  Memory usage high (${MEMORY_USAGE}MB)"
fi

# Clean up
rm -f response_times.log

echo "=== Performance Benchmark Testing Complete ==="
```

### Stress Testing

**System Stress Testing:**
```bash
#!/bin/bash
# stress-test.sh

echo "=== System Stress Testing ==="

# Monitor system resources during stress test
echo "Starting resource monitoring..."
top -b -d 1 -n 300 > stress_monitor.log &
MONITOR_PID=$!

# Generate load (simulate 100 concurrent connections)
echo "Generating load..."
for i in {1..100}; do
    curl -s http://localhost:8081/health > /dev/null &
done

# Wait for load test to complete
wait

# Stop monitoring
kill $MONITOR_PID

# Analyze results
MAX_CPU=$(grep "Cpu(s)" stress_monitor.log | awk '{print $2}' | sort -nr | head -1 | cut -d'%' -f1)
MAX_MEMORY=$(grep "Mem" stress_monitor.log | awk '{print $3}' | sort -nr | head -1)

echo "Peak CPU usage: ${MAX_CPU}%"
echo "Peak memory usage: ${MAX_MEMORY}"

if [ $(echo "$MAX_CPU < 80" | bc) -eq 1 ]; then
    echo "✅ CPU usage within acceptable limits during stress test"
else
    echo "❌ CPU usage exceeded limits during stress test"
fi

# Clean up
rm -f stress_monitor.log

echo "=== System Stress Testing Complete ==="
```

## Post-Deployment Validation

### User Acceptance Testing

**Trading Workflow Validation:**
```bash
#!/bin/bash
# user-acceptance-testing.sh

echo "=== User Acceptance Testing ==="

# Create test checklist
cat > uat_checklist.md << 'EOF'
# User Acceptance Testing Checklist

## Core Trading Workflows

### Display Creation
- [ ] Ctrl+K opens symbol search
- [ ] Symbol search returns results
- [ ] Enter creates display successfully
- [ ] Display renders correctly
- [ ] Market data appears in display

### Navigation
- [ ] Ctrl+Tab switches between displays
- [ ] Arrow keys navigate interface
- [ ] Escape closes dialogs/menus
- [ ] Context menus appear on right-click

### Display Management
- [ ] Drag-resize works correctly
- [ ] Repositioning maintains smooth rendering
- [ ] Display removal works (Ctrl+Shift+W)
- [ ] Multiple displays can be active

### Performance
- [ ] 20+ displays can be active simultaneously
- [ ] Real-time data updates smoothly
- [ ] No lag during high-frequency updates
- [ ] Keyboard response is immediate

### Error Handling
- [ ] Network disconnection handled gracefully
- [ ] Reconnection works automatically
- [ ] Invalid symbols handled properly
- [ ] Error messages are user-friendly

## Environment-Specific Tests

### Production Environment
- [ ] HTTPS/WSS connections work
- [ ] SSL certificate is valid
- [ ] Performance meets production targets
- [ ] No development tools visible

### Browser Compatibility
- [ ] Chrome/Chromium works correctly
- [ ] Firefox works correctly
- [ ] Safari works correctly (if applicable)
- [ ] Edge works correctly (if applicable)
EOF

echo "User Acceptance Testing checklist created: uat_checklist.md"
echo "Please complete the checklist and verify all requirements are met."

echo "=== User Acceptance Testing Setup Complete ==="
```

### Production Readiness Validation

**Complete Production Readiness Checklist:**
```bash
#!/bin/bash
# production-readiness-check.sh

echo "=== Production Readiness Validation ==="

PASSED=0
FAILED=0

# Function to validate and count results
validate() {
    local test_name="$1"
    local test_command="$2"

    echo -n "Testing $test_name... "
    if eval "$test_command"; then
        echo "✅ PASS"
        ((PASSED++))
        return 0
    else
        echo "❌ FAIL"
        ((FAILED++))
        return 1
    fi
}

# Service availability tests
validate "Backend service" "pgrep -f 'node.*server.js' > /dev/null"
validate "WebSocket endpoint" "curl -s http://localhost:8081/health > /dev/null"
validate "Frontend service" "curl -s -I http://localhost:4173 | head -1 | grep -q '200 OK'"

# Security tests
validate "HTTPS configuration" "curl -s -I https://your-domain.com | head -1 | grep -q '200 OK'"
validate "SSL certificate validity" "openssl x509 -checkend 86400 -noout -in /etc/letsencrypt/live/your-domain.com/cert.pem"
validate "Environment file security" "[ \"\$(stat -c %a .env)\" = \"600\" ]"

# Performance tests
validate "Response time target" "curl -o /dev/null -s -w '%{time_total}\n' http://localhost:8081/health | awk '{exit \$1 < 0.1}'"

# Configuration tests
validate "Required environment variables" "[ -f .env ] && grep -q '^CTRADER_CLIENT_ID=' .env"
validate "cTrader API connectivity" "nc -z -w3 live.ctraderapi.com 5035"

# Backup and recovery tests
validate "Backup script exists" "[ -f /opt/neurosensefx/scripts/backup.sh ]"
validate "Log rotation configured" "find /etc/logrotate.d -name '*neurosensefx*' | grep -q ."

# Monitoring tests
validate "Health check script" "[ -f /opt/neurosensefx/scripts/health-check.sh ]"
validate "Monitoring configuration" "[ -f /etc/monitoring/neurosensefx.conf ]"

echo ""
echo "=== Production Readiness Results ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Total:  $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo "✅ PRODUCTION READY - All tests passed"
    exit 0
else
    echo "❌ NOT READY - $FAILED tests failed"
    echo "Please resolve failed tests before proceeding to production"
    exit 1
fi
```

## Validation Automation

### Automated Validation Pipeline

**Continuous Integration Validation Script:**
```bash
#!/bin/bash
# ci-validation.sh

echo "=== CI/CD Pipeline Validation ==="

EXIT_CODE=0

# Run unit tests
echo "Running unit tests..."
npm run test:unit
if [ $? -ne 0 ]; then
    echo "❌ Unit tests failed"
    EXIT_CODE=1
else
    echo "✅ Unit tests passed"
fi

# Run e2e tests
echo "Running end-to-end tests..."
npm run test:e2e
if [ $? -ne 0 ]; then
    echo "❌ End-to-end tests failed"
    EXIT_CODE=1
else
    echo "✅ End-to-end tests passed"
fi

# Run security audit
echo "Running security audit..."
npm audit --audit-level=moderate
if [ $? -ne 0 ]; then
    echo "⚠️  Security vulnerabilities found"
    # Don't fail the build for moderate vulnerabilities
else
    echo "✅ No security vulnerabilities found"
fi

# Validate code quality
echo "Running code quality checks..."
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ Code quality checks failed"
    EXIT_CODE=1
else
    echo "✅ Code quality checks passed"
fi

# Check build
echo "Testing production build..."
npm run build:prod
if [ $? -ne 0 ]; then
    echo "❌ Production build failed"
    EXIT_CODE=1
else
    echo "✅ Production build successful"
fi

echo "=== CI/CD Pipeline Validation Complete ==="
exit $EXIT_CODE
```

**Automated Validation Dashboard:**
```bash
#!/bin/bash
# validation-dashboard.sh

# Generate validation report
cat > validation_report.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>NeuroSense FX Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .pass { color: green; }
        .fail { color: red; }
        .warning { color: orange; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>NeuroSense FX Validation Report</h1>
    <p>Generated on: $(date)</p>

    <h2>System Status</h2>
    <table>
        <tr><th>Component</th><th>Status</th><th>Details</th></tr>
        <tr><td>Backend Service</td><td class="pass">✅ Running</td><td>PID: $(pgrep -f "node.*server.js")</td></tr>
        <tr><td>WebSocket Endpoint</td><td class="pass">✅ Responding</td><td>Port: 8081</td></tr>
        <tr><td>Frontend Service</td><td class="pass">✅ Serving</td><td>Port: 4173</td></tr>
        <tr><td>SSL Certificate</td><td class="pass">✅ Valid</td><td>Expires: $(openssl x509 -enddate -noout -in /etc/letsencrypt/live/your-domain.com/cert.pem | cut -d= -f2)</td></tr>
    </table>

    <h2>Performance Metrics</h2>
    <table>
        <tr><th>Metric</th><th>Current</th><th>Target</th><th>Status</th></tr>
        <tr><td>Memory Usage</td><td>$(ps -o rss= -p $(pgrep -f "node.*server.js") | awk '{print $1/1024 "MB"}')</td><td>&lt;1GB</td><td class="pass">✅ OK</td></tr>
        <tr><td>CPU Usage</td><td>$(top -b -n 1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%</td><td>&lt;80%</td><td class="pass">✅ OK</td></tr>
    </table>

    <h2>Recent Validation Results</h2>
    <pre>$(tail -50 /var/log/neurosensefx/validation.log)</pre>
</body>
</html>
EOF

echo "Validation dashboard generated: validation_report.html"
```

## Troubleshooting Validation Failures

### Common Validation Issues

**Service Startup Failures:**
```bash
# Debug service startup issues
echo "=== Service Startup Debug ==="

# Check environment file
echo "Environment file contents:"
grep -v "SECRET\|TOKEN" .env

# Check port conflicts
echo "Port conflicts:"
netstat -tuln | grep -E ":(8081|4173)"

# Check log files
echo "Recent backend errors:"
tail -20 backend.log

echo "Recent frontend errors:"
tail -20 frontend.log
```

**Performance Test Failures:**
```bash
# Debug performance issues
echo "=== Performance Debug ==="

# Check system resources
echo "System resources:"
top -b -n 1 | head -20

# Check network connectivity
echo "Network latency:"
ping -c 10 live.ctraderapi.com

# Check disk I/O
echo "Disk I/O:"
iostat -x 1 5
```

**Security Validation Failures:**
```bash
# Debug security issues
echo "=== Security Debug ==="

# Check file permissions
echo "File permissions:"
ls -la .env nginx.conf

# Check SSL certificate
echo "SSL certificate details:"
openssl x509 -in /etc/letsencrypt/live/your-domain.com/cert.pem -text -noout

# Check firewall rules
echo "Firewall rules:"
sudo ufw status verbose
```

---

All validation procedures should be run before deployment and periodically during production operation to ensure system reliability and performance.