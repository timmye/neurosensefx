/**
 * Build Log Capture Utility
 *
 * Captures and forwards Vite dev server logs to the unified console system
 * with proper correlation and real-time streaming.
 */

const { spawn } = require('child_process');
const EventEmitter = require('events');

class BuildLogCapture extends EventEmitter {
  constructor(unifiedReporter, correlationManager) {
    super();

    this.unifiedReporter = unifiedReporter;
    this.correlationManager = correlationManager;
    this.activeProcesses = new Map();
    this.logBuffer = [];
    this.buildCorrelation = null;
  }

  /**
   * Start capturing build logs for a command
   */
  async startBuildCapture(command, options = {}) {
    const buildId = this.generateBuildId();
    const correlationId = this.correlationManager.createCorrelation(
      `BUILD: ${command}`,
      'build',
      `Build process: ${command}`
    ).id;

    this.buildCorrelation = correlationId;

    const buildProcess = {
      id: buildId,
      command,
      correlationId,
      startTime: Date.now(),
      process: null,
      logs: [],
      status: 'starting'
    };

    // Parse command and arguments
    const [cmd, ...args] = command.split(' ');

    // Setup process with enhanced logging
    const processSpawn = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: {
        ...process.env,
        FORCE_COLOR: '1', // Ensure colored output
        DEBUG: '*' // Enable debug logging
      }
    });

    buildProcess.process = processSpawn;
    this.activeProcesses.set(buildId, buildProcess);

    // Log build start
    this.unifiedReporter.log('BUILD', `🚀 Starting build: ${command}`, 'info', correlationId);
    this.correlationManager.addEvent(correlationId, 'build_started', { command, buildId });

    // Setup stdout monitoring
    processSpawn.stdout.on('data', (data) => {
      const output = data.toString().trim();
      const lines = output.split('\n');

      lines.forEach(line => {
        if (line.trim()) {
          this.handleBuildOutput(buildProcess, line, 'stdout');
        }
      });
    });

    // Setup stderr monitoring
    processSpawn.stderr.on('data', (data) => {
      const output = data.toString().trim();
      const lines = output.split('\n');

      lines.forEach(line => {
        if (line.trim()) {
          this.handleBuildOutput(buildProcess, line, 'stderr');
        }
      });
    });

    // Handle process exit
    processSpawn.on('close', (code, signal) => {
      this.handleBuildExit(buildProcess, code, signal);
    });

    // Handle process errors
    processSpawn.on('error', (error) => {
      this.handleBuildError(buildProcess, error);
    });

    return buildProcess;
  }

  generateBuildId() {
    return `BUILD-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  handleBuildOutput(buildProcess, line, stream) {
    const timestamp = Date.now();
    const logEntry = {
      timestamp,
      line,
      stream,
      buildId: buildProcess.id,
      correlationId: buildProcess.correlationId
    };

    buildProcess.logs.push(logEntry);
    this.addToGlobalBuffer(logEntry);

    // Categorize and enhance logging
    const { category, severity, metadata } = this.categorizeBuildLog(line, stream);

    // Forward to unified reporter
    this.unifiedReporter.log('BUILD', line, severity, buildProcess.correlationId);

    // Add correlation event
    this.correlationManager.addEvent(
      buildProcess.correlationId,
      `build_${category}`,
      { line, stream, metadata },
      severity
    );

    // Handle special build events
    this.handleSpecialBuildEvents(buildProcess, line, category, metadata);

    // Emit for other listeners
    this.emit('buildOutput', logEntry);
  }

  categorizeBuildLog(line, stream) {
    const lowerLine = line.toLowerCase();

    // Determine severity based on stream and content
    let severity = stream === 'stderr' ? 'error' : 'info';

    // Check for specific patterns
    if (lowerLine.includes('error:') || lowerLine.includes('failed') || lowerLine.includes('exception')) {
      severity = 'error';
    } else if (lowerLine.includes('warning:') || lowerLine.includes('deprecated')) {
      severity = 'warning';
    } else if (lowerLine.includes('success') || lowerLine.includes('completed') || lowerLine.includes('ready')) {
      severity = 'success';
    } else if (lowerLine.includes('debug') || lowerLine.includes('trace')) {
      severity = 'debug';
    }

    // Determine category
    let category = 'general';
    let metadata = {};

    if (lowerLine.includes('vite')) {
      category = 'vite';
      metadata.framework = 'vite';
    } else if (lowerLine.includes('hmr') || lowerLine.includes('hot module')) {
      category = 'hmr';
      metadata.type = 'hot_reload';
    } else if (lowerLine.includes('build') || lowerLine.includes('bundle')) {
      category = 'build';
      metadata.type = 'bundling';
    } else if (lowerLine.includes('localhost') || lowerLine.includes('port')) {
      category = 'server';
      metadata.type = 'server_start';
    } else if (lowerLine.includes('warning')) {
      category = 'warning';
      metadata.type = 'warning';
    } else if (lowerLine.includes('error')) {
      category = 'error';
      metadata.type = 'error';
    } else if (lowerLine.includes('dependency') || lowerLine.includes('node_modules')) {
      category = 'dependency';
      metadata.type = 'dependency_resolution';
    }

    return { category, severity, metadata };
  }

  handleSpecialBuildEvents(buildProcess, line, category, metadata) {
    const lowerLine = line.toLowerCase();

    // Server ready event
    if (lowerLine.includes('localhost') && lowerLine.includes('ready')) {
      const serverUrlMatch = line.match(/(https?:\/\/localhost:\d+)/);
      if (serverUrlMatch) {
        const serverUrl = serverUrlMatch[1];
        this.unifiedReporter.log('BUILD', `🌐 Server ready at: ${serverUrl}`, 'success', buildProcess.correlationId);
        this.correlationManager.addEvent(
          buildProcess.correlationId,
          'server_ready',
          { url: serverUrl },
          'success'
        );
      }
    }

    // HMR events
    if (category === 'hmr') {
      this.unifiedReporter.log('BUILD', `🔥 Hot Module Reload: ${line}`, 'info', buildProcess.correlationId);
    }

    // Build completion
    if (lowerLine.includes('built') && lowerLine.includes('ms')) {
      const timeMatch = line.match(/(\d+)ms/);
      if (timeMatch) {
        const buildTime = parseInt(timeMatch[1]);
        this.unifiedReporter.log('BUILD', `⚡ Build completed in ${buildTime}ms`, 'success', buildProcess.correlationId);
      }
    }

    // Dependency resolution
    if (category === 'dependency') {
      this.unifiedReporter.log('BUILD', `📦 Dependency: ${line}`, 'info', buildProcess.correlationId);
    }

    // Error handling
    if (category === 'error') {
      this.unifiedReporter.log('BUILD', `❌ Build error: ${line}`, 'error', buildProcess.correlationId);
    }
  }

  handleBuildExit(buildProcess, code, signal) {
    const duration = Date.now() - buildProcess.startTime;
    buildProcess.endTime = Date.now();
    buildProcess.status = code === 0 ? 'success' : 'failed';
    buildProcess.exitCode = code;
    buildProcess.signal = signal;
    buildProcess.duration = duration;

    const success = code === 0;

    // Log completion
    this.unifiedReporter.log(
      'BUILD',
      `${success ? '✅' : '❌'} Build ${success ? 'completed' : 'failed'} with code ${code} (${duration}ms)`,
      success ? 'success' : 'error',
      buildProcess.correlationId
    );

    // End correlation
    this.correlationManager.endCorrelation(
      buildProcess.correlationId,
      success ? 'completed' : 'failed',
      {
        exitCode: code,
        signal,
        duration,
        logCount: buildProcess.logs.length
      }
    );

    // Emit for other listeners
    this.emit('buildExit', buildProcess);
  }

  handleBuildError(buildProcess, error) {
    buildProcess.status = 'error';
    buildProcess.endTime = Date.now();
    buildProcess.error = error;

    this.unifiedReporter.log('BUILD', `💥 Build process error: ${error.message}`, 'error', buildProcess.correlationId);

    // Add error to correlation
    this.correlationManager.addEvent(
      buildProcess.correlationId,
      'build_process_error',
      { error: error.message, stack: error.stack },
      'error'
    );

    this.emit('buildError', buildProcess, error);
  }

  addToGlobalBuffer(logEntry) {
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > 1000) {
      this.logBuffer.shift();
    }
  }

  /**
   * Stop a specific build process
   */
  stopBuild(buildId) {
    const buildProcess = this.activeProcesses.get(buildId);
    if (!buildProcess || !buildProcess.process) return false;

    buildProcess.process.kill('SIGTERM');
    buildProcess.status = 'stopped';

    this.unifiedReporter.log('BUILD', `🛑 Build stopped: ${buildId}`, 'warning', buildProcess.correlationId);

    return true;
  }

  /**
   * Stop all active build processes
   */
  stopAllBuilds() {
    const stopped = [];
    for (const [buildId, buildProcess] of this.activeProcesses) {
      if (buildProcess.process && buildProcess.status === 'running') {
        this.stopBuild(buildId);
        stopped.push(buildId);
      }
    }
    return stopped;
  }

  /**
   * Get build logs by pattern
   */
  getLogsByPattern(pattern, buildId = null) {
    const logs = buildId
      ? this.activeProcesses.get(buildId)?.logs || []
      : this.logBuffer;

    return logs.filter(log =>
      log.line.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Get errors from build logs
   */
  getBuildErrors(buildId = null) {
    return this.getLogsByPattern('error', buildId)
      .concat(this.getLogsByPattern('failed', buildId))
      .concat(this.getLogsByPattern('exception', buildId));
  }

  /**
   * Get HMR events
   */
  getHMREvents(buildId = null) {
    return this.getLogsByPattern('hmr', buildId)
      .concat(this.getLogsByPattern('hot module', buildId));
  }

  /**
   * Export build session data
   */
  exportBuildSession(buildId) {
    const buildProcess = this.activeProcesses.get(buildId);
    if (!buildProcess) return null;

    return {
      buildId: buildProcess.id,
      command: buildProcess.command,
      correlationId: buildProcess.correlationId,
      startTime: buildProcess.startTime,
      endTime: buildProcess.endTime,
      duration: buildProcess.duration,
      status: buildProcess.status,
      exitCode: buildProcess.exitCode,
      signal: buildProcess.signal,
      logs: buildProcess.logs,
      errorCount: this.getBuildErrors(buildId).length,
      hmrEventCount: this.getHMREvents(buildId).length
    };
  }

  /**
   * Get build summary statistics
   */
  getBuildSummary() {
    const builds = Array.from(this.activeProcesses.values());
    const completed = builds.filter(b => b.status === 'success' || b.status === 'failed');
    const running = builds.filter(b => b.status === 'running');
    const failed = builds.filter(b => b.status === 'failed');

    return {
      total: builds.length,
      completed: completed.length,
      running: running.length,
      failed: failed.length,
      averageDuration: completed.length > 0
        ? completed.reduce((sum, b) => sum + (b.duration || 0), 0) / completed.length
        : 0
    };
  }

  /**
   * Clean up old build processes
   */
  cleanup(maxAge = 300000) { // 5 minutes
    const cutoffTime = Date.now() - maxAge;
    const toRemove = [];

    for (const [buildId, buildProcess] of this.activeProcesses) {
      if (buildProcess.endTime && buildProcess.endTime < cutoffTime) {
        toRemove.push(buildId);
      }
    }

    toRemove.forEach(id => this.activeProcesses.delete(id));

    return toRemove.length;
  }
}

module.exports = BuildLogCapture;