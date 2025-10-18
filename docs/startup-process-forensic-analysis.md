# Startup Process Forensic Analysis

## Challenge Everything
The current run/stop system is fundamentally broken. Let's analyze why by examining the actual processes, dependencies, and behaviors.

## Forensic Investigation Plan

### 1. Current Process Analysis
- **What actually runs** when we execute commands
- **Process hierarchy** and parent-child relationships
- **Signal handling** and termination behavior
- **Resource utilization** and dependencies

### 2. Startup Sequence Deep Dive
- **Backend startup**: What happens when `node server.js` runs
- **Frontend startup**: What happens when `npm run dev` runs
- **Process interactions**: How do they communicate
- **Failure points**: Where does the process chain break

### 3. Terminal Interaction Analysis
- **Interactive vs non-interactive** execution differences
- **TTY attachment** and signal propagation
- **Background process** behavior in different shells
- **Environment variable** dependencies

### 4. Process Management Examination
- **PID file reliability** and synchronization issues
- **Port binding** and socket behavior
- **Zombie process** creation and cleanup
- **Process orphaning** and session management

## Investigation Steps

### Step 1: Process Tree Analysis
```bash
# Before starting anything
pstree -p

# Start backend manually
cd services/tick-backend
node server.js &
BACKEND_PID=$!
pstree -p | grep $BACKEND_PID

# Start frontend manually
cd ../../
npm run dev &
FRONTEND_PID=$!
pstree -p | grep $FRONTEND_PID

# Examine full process tree
pstree -p
```

### Step 2: Signal Handling Analysis
```bash
# Test signal responses
kill -TERM $BACKEND_PID
ps aux | grep $BACKEND_PID

kill -TERM $FRONTEND_PID
ps aux | grep $FRONTEND_PID

# Test SIGKILL
kill -KILL $BACKEND_PID
kill -KILL $FRONTEND_PID
```

### Step 3: Terminal Attachment Analysis
```bash
# Test in different terminal contexts
# 1. Direct terminal execution
./run.sh start

# 2. Script execution with explicit shell
bash ./run.sh start

# 3. Background execution
./run.sh start &

# 4. No-hup execution
nohup ./run.sh start
```

### Step 4: Resource and Dependency Analysis
```bash
# Check what processes are actually doing
lsof -p $BACKEND_PID
lsof -p $FRONTEND_PID

# Check network connections
netstat -tulpn | grep :8080
netstat -tulpn | grep :5173

# Check file descriptors
ls -la /proc/$BACKEND_PID/fd
ls -la /proc/$FRONTEND_PID/fd
```

### Step 5: Log and Output Analysis
```bash
# Check where output actually goes
find . -name "*.log" -exec echo "=== {} ===" \; -exec cat {} \;

# Check system logs for errors
journalctl -u systemd-user --since "1 hour ago" | grep -E "(node|npm|vite)"

# Check process-specific logs
strace -p $BACKEND_PID -e trace=write,exit 2>&1 | head -20
strace -p $FRONTEND_PID -e trace=write,exit 2>&1 | head -20
```

## Fundamental Issues to Investigate

### Issue 1: Process Orphaning
- Are processes becoming orphaned when the terminal closes?
- Are they properly detached from the controlling terminal?
- What happens to child processes when the parent dies?

### Issue 2: Signal Propagation
- Are signals properly reaching all processes?
- Are there signal handlers that interfere with termination?
- Do processes ignore certain signals?

### Issue 3: Resource Contention
- Are processes competing for the same resources?
- Are there file locks or port conflicts?
- Are there memory or CPU limitations?

### Issue 4: Environment Dependencies
- Do processes depend on specific environment variables?
- Are there path dependencies that break in different contexts?
- Are there user permission issues?

## Hypotheses to Test

### Hypothesis 1: npm run dev creates child processes
The `npm run dev` command might be spawning child processes that aren't being properly tracked or killed.

### Hypothesis 2: Terminal attachment prevents proper backgrounding
Processes might be attached to the terminal in a way that prevents them from properly running in the background.

### Hypothesis 3: Port binding issues
There might be port binding conflicts or issues with socket cleanup that prevent proper restarts.

### Hypothesis 4: Process session management
The processes might be creating new sessions that aren't being properly managed.

## Radical Simplification Approach

If the forensic analysis reveals fundamental issues with the current approach, consider these alternatives:

### Alternative 1: Direct Process Management
- Skip complex PID tracking
- Use direct port-based process identification
- Implement simple signal escalation

### Alternative 2: Systemd Service Management
- Create proper systemd service files
- Use system-level process management
- Implement proper service dependencies

### Alternative 3: Docker Containerization
- Run services in separate containers
- Use Docker's process management
- Implement proper container orchestration

### Alternative 4: Process Manager Integration
- Use existing process managers (PM2, nodemon, etc.)
- Leverage their process management capabilities
- Implement proper monitoring and restart policies

## Next Steps

1. **Execute forensic analysis** using the steps above
2. **Document findings** with specific evidence
3. **Identify root causes** of the failures
4. **Design solution** based on actual findings, not assumptions
5. **Test thoroughly** in different environments and contexts

The goal is to understand what's actually happening, not what we think is happening.