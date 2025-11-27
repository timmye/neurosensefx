/**
 * Trading Operations Monitoring and Analytics Dashboard
 *
 * Real-time monitoring of critical trading workflows and user interactions
 * for operational excellence and user experience optimization.
 *
 * Features:
 * - Real-time trading workflow monitoring
 * - User interaction responsiveness tracking
 * - Keyboard shortcut performance monitoring
 * - WebSocket data connection stability monitoring
 * - Trading session performance analytics
 * - User behavior and interaction analysis
 */

/**
 * Trading operations monitoring configuration
 */
export const TRADING_OPERATIONS_CONFIG = {
  // Workflow monitoring
  MONITOR_DISPLAY_CREATION: true,
  MONITOR_DISPLAY_INTERACTIONS: true,
  MONITOR_KEYBOARD_SHORTCUTS: true,
  MONITOR_DATA_UPDATES: true,
  MONITOR_USER_SESSIONS: true,

  // Performance thresholds
  KEYBOARD_SHORTCUT_LATENCY_MS: 50,    // <50ms for instant response
  DISPLAY_CREATION_LATENCY_MS: 200,    // <200ms for display creation
  DATA_UPDATE_LATENCY_MS: 100,         // <100ms for data updates
  USER_INTERACTION_LATENCY_MS: 100,    // <100ms for UI responses

  // Session monitoring
  SESSION_TIMEOUT_MINUTES: 30,         // 30 minutes of inactivity
  MAX_IDLE_TIME_MINUTES: 15,           // 15 minutes before warning
  MIN_ACTIVE_TIME_MINUTES: 5,          // 5 minutes for meaningful session

  // Trading-specific monitoring
  MONITOR_MARKET_DATA_FLOW: true,
  MONITOR_SYMBOL_CHANGES: true,
  MONITOR_WORKFLOW_COMPLETION: true,
  MONITOR_ERROR_RECOVERY: true,

  // Analytics settings
  TRACK_USER_PATTERNS: true,
  TRACK_WORKFLOW_EFFICIENCY: true,
  TRACK_FEATURE_ADOPTION: true,
  TRACK_PERFORMANCE_METRICS: true,

  // Data retention
  SESSION_RETENTION_DAYS: 7,
  WORKFLOW_RETENTION_DAYS: 30,
  ANALYTICS_RETENTION_DAYS: 90,

  // Privacy settings
  ANONYMIZE_USER_DATA: true,
  GDPR_COMPLIANT: true
};

/**
 * Trading operation types
 */
export const TRADING_OPERATIONS = {
  // Display operations
  DISPLAY_CREATE: 'DISPLAY_CREATE',
  DISPLAY_DESTROY: 'DISPLAY_DESTROY',
  DISPLAY_RESIZE: 'DISPLAY_RESIZE',
  DISPLAY_MOVE: 'DISPLAY_MOVE',
  DISPLAY_CONFIGURE: 'DISPLAY_CONFIGURE',

  // User interactions
  KEYBOARD_SHORTCUT: 'KEYBOARD_SHORTCUT',
  MOUSE_CLICK: 'MOUSE_CLICK',
  DRAG_START: 'DRAG_START',
  DRAG_END: 'DRAG_END',
  CONTEXT_MENU: 'CONTEXT_MENU',

  // Data operations
  SYMBOL_CHANGE: 'SYMBOL_CHANGE',
  DATA_UPDATE: 'DATA_UPDATE',
  CONFIG_CHANGE: 'CONFIG_CHANGE',
  WORKSPACE_SAVE: 'WORKSPACE_SAVE',
  WORKSPACE_LOAD: 'WORKSPACE_LOAD',

  // Session operations
  SESSION_START: 'SESSION_START',
  SESSION_END: 'SESSION_END',
  USER_IDLE: 'USER_IDLE',
  USER_ACTIVE: 'USER_ACTIVE',

  // Workflow operations
  WORKFLOW_START: 'WORKFLOW_START',
  WORKFLOW_STEP: 'WORKFLOW_STEP',
  WORKFLOW_COMPLETE: 'WORKFLOW_COMPLETE',
  WORKFLOW_ABORT: 'WORKFLOW_ABORT'
};

/**
 * Trading workflow types
 */
export const TRADING_WORKFLOWS = {
  DISPLAY_CREATION_WORKFLOW: 'DISPLAY_CREATION_WORKFLOW',
  SYMBOL_SWITCH_WORKFLOW: 'SYMBOL_SWITCH_WORKFLOW',
  WORKSPACE_MANAGEMENT_WORKFLOW: 'WORKSPACE_MANAGEMENT_WORKFLOW',
  DATA_ANALYSIS_WORKFLOW: 'DATA_ANALYSIS_WORKFLOW',
  KEYBOARD_NAVIGATION_WORKFLOW: 'KEYBOARD_NAVIGATION_WORKFLOW'
};

/**
 * Trading operations monitor
 */
export class TradingOperationsMonitor {
  constructor(config = {}) {
    this.config = { ...TRADING_OPERATIONS_CONFIG, ...config };
    this.isMonitoring = false;
    this.startTime = Date.now();

    // Session tracking
    this.currentSession = null;
    this.sessions = [];
    this.userActivity = [];
    this.idleTimer = null;
    this.isIdle = false;

    // Workflow tracking
    this.activeWorkflows = new Map();
    this.completedWorkflows = [];
    this.workflowMetrics = new Map();

    // Operations tracking
    this.operations = [];
    this.operationMetrics = new Map();
    this.operationCounts = new Map();

    // Performance tracking
    this.performanceMetrics = {
      keyboardShortcuts: [],
      displayOperations: [],
      dataUpdates: [],
      userInteractions: []
    };

    // User patterns
    this.userPatterns = {
      keyboardUsage: new Map(),
      mouseUsage: new Map(),
      workflowPreferences: new Map(),
      featureUsage: new Map()
    };

    // Real-time metrics
    this.realTimeMetrics = {
      activeDisplays: 0,
      activeSymbols: new Set(),
      recentOperations: [],
      currentWorkflow: null,
      lastActivity: Date.now()
    };

    // Initialize monitoring
    this.initializeEventListeners();
  }

  /**
   * Start trading operations monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.warn('[TradingOpsMonitor] Trading operations monitoring already started');
      return;
    }

    this.isMonitoring = true;
    this.startTime = Date.now();

    console.log('[TradingOpsMonitor] Starting trading operations monitoring...');

    // Start session
    this.startSession();

    // Start real-time monitoring
    this.startRealTimeMonitoring();

    // Initialize user behavior tracking
    this.initializeUserBehaviorTracking();

    console.log('[TradingOpsMonitor] Trading operations monitoring started successfully');
  }

  /**
   * Stop trading operations monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.warn('[TradingOpsMonitor] Trading operations monitoring not started');
      return;
    }

    this.isMonitoring = false;

    // End current session
    if (this.currentSession) {
      this.endSession();
    }

    // Clear idle timer
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    // Remove event listeners
    this.removeEventListeners();

    console.log('[TradingOpsMonitor] Trading operations monitoring stopped');
  }

  /**
   * Initialize event listeners for trading operations
   */
  initializeEventListeners() {
    // Keyboard events
    this.keyboardHandler = (event) => {
      this.handleKeyboardShortcut(event);
    };

    // Mouse events
    this.mouseHandler = (event) => {
      this.handleMouseInteraction(event);
    };

    // Focus events for activity tracking
    this.focusHandler = () => {
      this.handleUserActive();
    };

    this.blurHandler = () => {
      this.handleUserIdle();
    };

    // Performance observer for operation timing
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.handlePerformanceEntry(entry);
      }
    });

    // Register event listeners
    this.registerEventListeners();
  }

  /**
   * Register event listeners
   */
  registerEventListeners() {
    document.addEventListener('keydown', this.keyboardHandler, true);
    document.addEventListener('click', this.mouseHandler, true);
    window.addEventListener('focus', this.focusHandler);
    window.addEventListener('blur', this.blurHandler);

    try {
      this.performanceObserver.observe({
        entryTypes: ['measure', 'navigation', 'paint']
      });
    } catch (error) {
      console.warn('[TradingOpsMonitor] Performance observer setup failed:', error);
    }
  }

  /**
   * Remove event listeners
   */
  removeEventListeners() {
    document.removeEventListener('keydown', this.keyboardHandler, true);
    document.removeEventListener('click', this.mouseHandler, true);
    window.removeEventListener('focus', this.focusHandler);
    window.removeEventListener('blur', this.blurHandler);

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }

  /**
   * Start real-time monitoring
   */
  startRealTimeMonitoring() {
    // Update real-time metrics every second
    this.realTimeInterval = setInterval(() => {
      this.updateRealTimeMetrics();
    }, 1000);

    // Analyze user patterns every minute
    this.patternAnalysisInterval = setInterval(() => {
      this.analyzeUserPatterns();
    }, 60000);

    // Check session health every 5 minutes
    this.sessionHealthInterval = setInterval(() => {
      this.checkSessionHealth();
    }, 300000);
  }

  /**
   * Start user session
   */
  startSession() {
    const sessionId = this.generateSessionId();

    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      startTimestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      environment: this.getEnvironment(),
      buildVersion: this.getBuildVersion()
    };

    this.sessions.push(this.currentSession);

    this.recordOperation(TRADING_OPERATIONS.SESSION_START, {
      sessionId,
      timestamp: Date.now()
    });

    console.log(`[TradingOpsMonitor] Session started: ${sessionId}`);
  }

  /**
   * End user session
   */
  endSession() {
    if (!this.currentSession) return;

    const endTime = Date.now();
    const session = this.currentSession;

    session.endTime = endTime;
    session.endTimestamp = new Date().toISOString();
    session.duration = endTime - session.startTime;
    session.operationCount = this.getOperationCountForSession(session.id);
    session.workflowCount = this.getWorkflowCountForSession(session.id);

    this.recordOperation(TRADING_OPERATIONS.SESSION_END, {
      sessionId: session.id,
      duration: session.duration,
      operationCount: session.operationCount,
      timestamp: endTime
    });

    console.log(`[TradingOpsMonitor] Session ended: ${session.id}, duration: ${session.duration}ms`);

    this.currentSession = null;
  }

  /**
   * Handle keyboard shortcut
   */
  handleKeyboardShortcut(event) {
    if (!this.config.MONITOR_KEYBOARD_SHORTCUTS) return;

    const startTime = performance.now();
    const key = this.getKeyboardShortcut(event);

    // Update user activity
    this.handleUserActive();

    // Record keyboard usage pattern
    this.updateKeyboardUsagePattern(key);

    // Record operation
    this.recordOperation(TRADING_OPERATIONS.KEYBOARD_SHORTCUT, {
      key,
      timestamp: Date.now(),
      target: event.target?.tagName,
      modifiers: {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey
      }
    });

    // Measure response time
    const responseTime = performance.now() - startTime;
    this.recordPerformanceMetric('keyboardShortcuts', {
      key,
      responseTime,
      timestamp: Date.now()
    });

    // Check latency threshold
    if (responseTime > this.config.KEYBOARD_SHORTCUT_LATENCY_MS) {
      console.warn(`[TradingOpsMonitor] Slow keyboard response: ${key} took ${responseTime.toFixed(2)}ms`);
    }
  }

  /**
   * Handle mouse interaction
   */
  handleMouseInteraction(event) {
    if (!this.config.MONITOR_USER_INTERACTIONS) return;

    const startTime = performance.now();

    // Update user activity
    this.handleUserActive();

    // Record mouse usage pattern
    this.updateMouseUsagePattern(event);

    // Record operation
    this.recordOperation(TRADING_OPERATIONS.MOUSE_CLICK, {
      x: event.clientX,
      y: event.clientY,
      target: event.target?.tagName,
      className: event.target?.className,
      timestamp: Date.now()
    });

    // Measure response time
    const responseTime = performance.now() - startTime;
    this.recordPerformanceMetric('userInteractions', {
      type: 'mouse',
      responseTime,
      timestamp: Date.now()
    });

    // Check latency threshold
    if (responseTime > this.config.USER_INTERACTION_LATENCY_MS) {
      console.warn(`[TradingOpsMonitor] Slow mouse response: ${responseTime.toFixed(2)}ms`);
    }
  }

  /**
   * Handle user active
   */
  handleUserActive() {
    const now = Date.now();
    this.realTimeMetrics.lastActivity = now;

    // Clear idle timer
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    // If was idle, mark as active
    if (this.isIdle) {
      this.isIdle = false;
      this.recordOperation(TRADING_OPERATIONS.USER_ACTIVE, {
        timestamp: now,
        idleDuration: now - this.lastActiveTime
      });
    }

    // Set idle timer
    this.idleTimer = setTimeout(() => {
      this.handleUserIdle();
    }, this.config.MAX_IDLE_TIME_MINUTES * 60 * 1000);

    this.lastActiveTime = now;
  }

  /**
   * Handle user idle
   */
  handleUserIdle() {
    if (this.isIdle) return;

    this.isIdle = true;
    const now = Date.now();

    this.recordOperation(TRADING_OPERATIONS.USER_IDLE, {
      timestamp: now,
      idleThreshold: this.config.MAX_IDLE_TIME_MINUTES * 60 * 1000
    });

    console.log(`[TradingOpsMonitor] User idle detected after ${this.config.MAX_IDLE_TIME_MINUTES} minutes`);
  }

  /**
   * Start workflow tracking
   */
  startWorkflow(workflowType, data = {}) {
    const workflowId = this.generateWorkflowId();
    const startTime = Date.now();

    const workflow = {
      id: workflowId,
      type: workflowType,
      startTime,
      data: this.anonymizeData(data),
      steps: [],
      status: 'ACTIVE'
    };

    this.activeWorkflows.set(workflowId, workflow);
    this.realTimeMetrics.currentWorkflow = workflow;

    this.recordOperation(TRADING_OPERATIONS.WORKFLOW_START, {
      workflowId,
      workflowType,
      timestamp: startTime
    });

    console.log(`[TradingOpsMonitor] Workflow started: ${workflowType} (${workflowId})`);

    return workflowId;
  }

  /**
   * Record workflow step
   */
  recordWorkflowStep(workflowId, stepType, data = {}) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    const step = {
      type: stepType,
      timestamp: Date.now(),
      data: this.anonymizeData(data),
      duration: Date.now() - workflow.startTime
    };

    workflow.steps.push(step);

    this.recordOperation(TRADING_OPERATIONS.WORKFLOW_STEP, {
      workflowId,
      stepType,
      stepIndex: workflow.steps.length - 1,
      timestamp: step.timestamp
    });
  }

  /**
   * Complete workflow
   */
  completeWorkflow(workflowId, result = {}) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    const endTime = Date.now();
    workflow.endTime = endTime;
    workflow.duration = endTime - workflow.startTime;
    workflow.result = this.anonymizeData(result);
    workflow.status = 'COMPLETED';

    // Move to completed workflows
    this.activeWorkflows.delete(workflowId);
    this.completedWorkflows.push(workflow);

    // Update workflow metrics
    this.updateWorkflowMetrics(workflow);

    // Clear current workflow if it was this one
    if (this.realTimeMetrics.currentWorkflow?.id === workflowId) {
      this.realTimeMetrics.currentWorkflow = null;
    }

    this.recordOperation(TRADING_OPERATIONS.WORKFLOW_COMPLETE, {
      workflowId,
      workflowType: workflow.type,
      duration: workflow.duration,
      stepCount: workflow.steps.length,
      timestamp: endTime
    });

    console.log(`[TradingOpsMonitor] Workflow completed: ${workflow.type} in ${workflow.duration}ms`);

    return workflow;
  }

  /**
   * Abort workflow
   */
  abortWorkflow(workflowId, reason = '') {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    const endTime = Date.now();
    workflow.endTime = endTime;
    workflow.duration = endTime - workflow.startTime;
    workflow.abortReason = reason;
    workflow.status = 'ABORTED';

    // Move to completed workflows
    this.activeWorkflows.delete(workflowId);
    this.completedWorkflows.push(workflow);

    // Clear current workflow if it was this one
    if (this.realTimeMetrics.currentWorkflow?.id === workflowId) {
      this.realTimeMetrics.currentWorkflow = null;
    }

    this.recordOperation(TRADING_OPERATIONS.WORKFLOW_ABORT, {
      workflowId,
      workflowType: workflow.type,
      duration: workflow.duration,
      reason,
      timestamp: endTime
    });

    console.log(`[TradingOpsMonitor] Workflow aborted: ${workflow.type} - ${reason}`);

    return workflow;
  }

  /**
   * Record trading operation
   */
  recordOperation(operationType, data) {
    const operation = {
      id: this.generateOperationId(),
      type: operationType,
      timestamp: data.timestamp || Date.now(),
      sessionId: this.currentSession?.id,
      data: this.anonymizeData(data)
    };

    this.operations.push(operation);

    // Update operation counts
    const count = this.operationCounts.get(operationType) || 0;
    this.operationCounts.set(operationType, count + 1);

    // Add to recent operations for real-time metrics
    this.realTimeMetrics.recentOperations.push(operation);
    if (this.realTimeMetrics.recentOperations.length > 100) {
      this.realTimeMetrics.recentOperations.shift();
    }

    // Update real-time metrics based on operation type
    this.updateRealTimeMetricsForOperation(operation);

    // Maintain operations history size
    if (this.operations.length > 10000) {
      this.operations.shift();
    }
  }

  /**
   * Record display operation
   */
  recordDisplayOperation(displayId, operationType, data = {}) {
    if (!this.config.MONITOR_DISPLAY_INTERACTIONS) return;

    const startTime = performance.now();

    this.recordOperation(operationType, {
      displayId,
      ...data,
      timestamp: Date.now()
    });

    const responseTime = performance.now() - startTime;
    this.recordPerformanceMetric('displayOperations', {
      operationType,
      displayId,
      responseTime,
      timestamp: Date.now()
    });

    // Update real-time metrics
    if (operationType === TRADING_OPERATIONS.DISPLAY_CREATE) {
      this.realTimeMetrics.activeDisplays++;
    } else if (operationType === TRADING_OPERATIONS.DISPLAY_DESTROY) {
      this.realTimeMetrics.activeDisplays = Math.max(0, this.realTimeMetrics.activeDisplays - 1);
    }
  }

  /**
   * Record symbol change
   */
  recordSymbolChange(displayId, oldSymbol, newSymbol) {
    if (!this.config.MONITOR_SYMBOL_CHANGES) return;

    this.recordOperation(TRADING_OPERATIONS.SYMBOL_CHANGE, {
      displayId,
      oldSymbol,
      newSymbol,
      timestamp: Date.now()
    });

    // Update active symbols
    this.realTimeMetrics.activeSymbols.add(newSymbol);
  }

  /**
   * Record data update
   */
  recordDataUpdate(displayId, symbol, updateType, data) {
    if (!this.config.MONITOR_DATA_UPDATES) return;

    const startTime = performance.now();

    this.recordOperation(TRADING_OPERATIONS.DATA_UPDATE, {
      displayId,
      symbol,
      updateType,
      dataSize: JSON.stringify(data).length,
      timestamp: Date.now()
    });

    const responseTime = performance.now() - startTime;
    this.recordPerformanceMetric('dataUpdates', {
      displayId,
      symbol,
      updateType,
      responseTime,
      timestamp: Date.now()
    });

    // Check latency threshold
    if (responseTime > this.config.DATA_UPDATE_LATENCY_MS) {
      console.warn(`[TradingOpsMonitor] Slow data update: ${symbol} ${updateType} took ${responseTime.toFixed(2)}ms`);
    }
  }

  /**
   * Record performance metric
   */
  recordPerformanceMetric(category, metric) {
    if (!this.performanceMetrics[category]) {
      this.performanceMetrics[category] = [];
    }

    this.performanceMetrics[category].push(metric);

    // Maintain performance metrics history
    if (this.performanceMetrics[category].length > 1000) {
      this.performanceMetrics[category].shift();
    }
  }

  /**
   * Update keyboard usage pattern
   */
  updateKeyboardUsagePattern(key) {
    const count = this.userPatterns.keyboardUsage.get(key) || 0;
    this.userPatterns.keyboardUsage.set(key, count + 1);
  }

  /**
   * Update mouse usage pattern
   */
  updateMouseUsagePattern(event) {
    const target = event.target?.tagName || 'unknown';
    const count = this.userPatterns.mouseUsage.get(target) || 0;
    this.userPatterns.mouseUsage.set(target, count + 1);
  }

  /**
   * Update workflow metrics
   */
  updateWorkflowMetrics(workflow) {
    const metrics = this.workflowMetrics.get(workflow.type) || {
      count: 0,
      totalDuration: 0,
      averageDuration: 0,
      completedCount: 0,
      abortedCount: 0
    };

    metrics.count++;
    metrics.totalDuration += workflow.duration;
    metrics.averageDuration = metrics.totalDuration / metrics.count;

    if (workflow.status === 'COMPLETED') {
      metrics.completedCount++;
    } else if (workflow.status === 'ABORTED') {
      metrics.abortedCount++;
    }

    this.workflowMetrics.set(workflow.type, metrics);
  }

  /**
   * Update real-time metrics
   */
  updateRealTimeMetrics() {
    // Update active displays (count from DOM)
    this.realTimeMetrics.activeDisplays = document.querySelectorAll('[data-display-id]').length;

    // Calculate recent operation rate
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentOps = this.realTimeMetrics.recentOperations.filter(op => op.timestamp >= oneMinuteAgo);
    this.realTimeMetrics.operationRate = recentOps.length;

    // Update user activity status
    this.realTimeMetrics.isIdle = this.isIdle;
    this.realTimeMetrics.idleDuration = this.isIdle ? now - this.lastActiveTime : 0;
  }

  /**
   * Update real-time metrics for specific operation
   */
  updateRealTimeMetricsForOperation(operation) {
    switch (operation.type) {
      case TRADING_OPERATIONS.SYMBOL_CHANGE:
        this.realTimeMetrics.activeSymbols.add(operation.data.newSymbol);
        break;
      // Add more operation-specific updates as needed
    }
  }

  /**
   * Initialize user behavior tracking
   */
  initializeUserBehaviorTracking() {
    if (!this.config.TRACK_USER_PATTERNS) return;

    console.log('[TradingOpsMonitor] User behavior tracking initialized');
  }

  /**
   * Analyze user patterns
   */
  analyzeUserPatterns() {
    if (!this.config.TRACK_USER_PATTERNS) return;

    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Analyze recent operations for patterns
    const recentOps = this.operations.filter(op => op.timestamp >= oneHourAgo);

    // Pattern analysis would go here
    // For now, just log that analysis occurred
    console.log(`[TradingOpsMonitor] User pattern analysis completed for ${recentOps.length} operations`);
  }

  /**
   * Check session health
   */
  checkSessionHealth() {
    if (!this.currentSession) return;

    const now = Date.now();
    const sessionAge = now - this.currentSession.startTime;
    const idleTime = now - this.lastActiveTime;

    // Check if session should be ended due to inactivity
    if (idleTime > this.config.SESSION_TIMEOUT_MINUTES * 60 * 1000) {
      console.log(`[TradingOpsMonitor] Session timeout - ending session`);
      this.endSession();
      this.startSession(); // Start new session
    }

    // Check if session is meaningful
    if (sessionAge > this.config.MIN_ACTIVE_TIME_MINUTES * 60 * 1000) {
      const operationCount = this.getOperationCountForSession(this.currentSession.id);
      if (operationCount === 0) {
        console.warn(`[TradingOpsMonitor] Session has no operations after ${sessionAge}ms`);
      }
    }
  }

  /**
   * Handle performance observer entries
   */
  handlePerformanceEntry(entry) {
    // Process performance entries relevant to trading operations
    if (entry.name.includes('trading') || entry.name.includes('display') || entry.name.includes('workflow')) {
      this.recordPerformanceMetric('customMeasures', {
        name: entry.name,
        duration: entry.duration,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get keyboard shortcut string
   */
  getKeyboardShortcut(event) {
    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');

    let key = event.key;
    if (key === ' ') key = 'Space';
    if (key === 'ArrowUp') key = 'Up';
    if (key === 'ArrowDown') key = 'Down';
    if (key === 'ArrowLeft') key = 'Left';
    if (key === 'ArrowRight') key = 'Right';

    parts.push(key);
    return parts.join('+');
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate workflow ID
   */
  generateWorkflowId() {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate operation ID
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get operation count for session
   */
  getOperationCountForSession(sessionId) {
    return this.operations.filter(op => op.sessionId === sessionId).length;
  }

  /**
   * Get workflow count for session
   */
  getWorkflowCountForSession(sessionId) {
    return this.completedWorkflows.filter(w =>
      w.startTime >= this.currentSession?.startTime &&
      w.data?.sessionId === sessionId
    ).length;
  }

  /**
   * Anonymize data for privacy
   */
  anonymizeData(data) {
    if (!this.config.ANONYMIZE_USER_DATA) {
      return data;
    }

    const anonymized = { ...data };
    // Remove sensitive fields here as needed
    return anonymized;
  }

  /**
   * Get environment
   */
  getEnvironment() {
    return process.env.NODE_ENV || 'production';
  }

  /**
   * Get build version
   */
  getBuildVersion() {
    return '1.0.0'; // Would be injected during build
  }

  /**
   * Get comprehensive trading operations report
   */
  getTradingOperationsReport() {
    const now = Date.now();
    const uptime = now - this.startTime;

    return {
      timestamp: now,
      uptime,
      isMonitoring: this.isMonitoring,
      config: this.config,

      // Session information
      session: {
        current: this.currentSession,
        totalSessions: this.sessions.length,
        averageSessionDuration: this.calculateAverageSessionDuration(),
        recentSessions: this.sessions.slice(-10)
      },

      // Real-time metrics
      realTime: {
        ...this.realTimeMetrics,
        activeSymbols: Array.from(this.realTimeMetrics.activeSymbols),
        isIdle: this.isIdle,
        idleDuration: this.isIdle ? now - this.lastActiveTime : 0
      },

      // Operations summary
      operations: {
        total: this.operations.length,
        byType: Object.fromEntries(this.operationCounts),
        recent: this.operations.slice(-100),
        rate: this.calculateOperationRate()
      },

      // Workflow analysis
      workflows: {
        active: Array.from(this.activeWorkflows.values()),
        completed: this.completedWorkflows.slice(-50),
        metrics: Object.fromEntries(this.workflowMetrics),
        completionRate: this.calculateWorkflowCompletionRate(),
        averageDuration: this.calculateAverageWorkflowDuration()
      },

      // Performance metrics
      performance: {
        keyboardShortcuts: this.analyzePerformanceMetrics('keyboardShortcuts'),
        displayOperations: this.analyzePerformanceMetrics('displayOperations'),
        dataUpdates: this.analyzePerformanceMetrics('dataUpdates'),
        userInteractions: this.analyzePerformanceMetrics('userInteractions')
      },

      // User behavior patterns
      userPatterns: {
        keyboardUsage: Object.fromEntries(this.userPatterns.keyboardUsage),
        mouseUsage: Object.fromEntries(this.userPatterns.mouseUsage),
        workflowPreferences: Object.fromEntries(this.userPatterns.workflowPreferences),
        featureUsage: Object.fromEntries(this.userPatterns.featureUsage)
      },

      // Health and quality metrics
      health: {
        errorRate: this.calculateErrorRate(),
        responseTimeP95: this.calculateResponseTimePercentile(95),
        userSatisfactionScore: this.calculateUserSatisfactionScore(),
        systemEfficiency: this.calculateSystemEfficiency()
      }
    };
  }

  /**
   * Calculate average session duration
   */
  calculateAverageSessionDuration() {
    const completedSessions = this.sessions.filter(s => s.endTime);
    if (completedSessions.length === 0) return 0;

    const totalDuration = completedSessions.reduce((sum, s) => sum + s.duration, 0);
    return totalDuration / completedSessions.length;
  }

  /**
   * Calculate operation rate
   */
  calculateOperationRate() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentOps = this.operations.filter(op => op.timestamp >= oneMinuteAgo);
    return recentOps.length;
  }

  /**
   * Calculate workflow completion rate
   */
  calculateWorkflowCompletionRate() {
    const totalWorkflows = this.completedWorkflows.length;
    const completedWorkflows = this.completedWorkflows.filter(w => w.status === 'COMPLETED').length;

    if (totalWorkflows === 0) return 100; // No workflows means 100% by default
    return (completedWorkflows / totalWorkflows) * 100;
  }

  /**
   * Calculate average workflow duration
   */
  calculateAverageWorkflowDuration() {
    const completedWorkflows = this.completedWorkflows.filter(w => w.status === 'COMPLETED');
    if (completedWorkflows.length === 0) return 0;

    const totalDuration = completedWorkflows.reduce((sum, w) => sum + w.duration, 0);
    return totalDuration / completedWorkflows.length;
  }

  /**
   * Analyze performance metrics
   */
  analyzePerformanceMetrics(category) {
    const metrics = this.performanceMetrics[category] || [];
    if (metrics.length === 0) {
      return {
        count: 0,
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0,
        p95ResponseTime: 0
      };
    }

    const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
    const sum = responseTimes.reduce((a, b) => a + b, 0);

    return {
      count: metrics.length,
      averageResponseTime: sum / metrics.length,
      maxResponseTime: Math.max(...responseTimes),
      minResponseTime: Math.min(...responseTimes),
      p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)]
    };
  }

  /**
   * Calculate error rate
   */
  calculateErrorRate() {
    // This would integrate with error monitoring system
    return 0; // Placeholder
  }

  /**
   * Calculate response time percentile
   */
  calculateResponseTimePercentile(percentile) {
    const allMetrics = [
      ...this.performanceMetrics.keyboardShortcuts,
      ...this.performanceMetrics.displayOperations,
      ...this.performanceMetrics.dataUpdates,
      ...this.performanceMetrics.userInteractions
    ];

    if (allMetrics.length === 0) return 0;

    const responseTimes = allMetrics.map(m => m.responseTime).sort((a, b) => a - b);
    return responseTimes[Math.floor(responseTimes.length * (percentile / 100))];
  }

  /**
   * Calculate user satisfaction score
   */
  calculateUserSatisfactionScore() {
    // Simplified calculation based on response times and error rates
    const avgResponseTime = this.calculateResponseTimePercentile(50);
    const errorRate = this.calculateErrorRate();

    let score = 100;

    // Deduct points for slow responses
    if (avgResponseTime > 100) score -= 20;
    else if (avgResponseTime > 50) score -= 10;

    // Deduct points for errors
    score -= errorRate * 10;

    return Math.max(0, score);
  }

  /**
   * Calculate system efficiency
   */
  calculateSystemEfficiency() {
    const workflowCompletionRate = this.calculateWorkflowCompletionRate();
    const avgResponseTime = this.calculateResponseTimePercentile(50);

    // Efficiency based on workflow completion and response times
    let efficiency = workflowCompletionRate;

    if (avgResponseTime < 50) efficiency += 10;
    else if (avgResponseTime < 100) efficiency += 5;

    return Math.min(100, efficiency);
  }

  /**
   * Cleanup and destroy trading operations monitor
   */
  destroy() {
    this.stopMonitoring();

    // Clear all data
    this.currentSession = null;
    this.sessions = [];
    this.operations = [];
    this.activeWorkflows.clear();
    this.completedWorkflows = [];
    this.userPatterns.keyboardUsage.clear();
    this.userPatterns.mouseUsage.clear();
    this.realTimeMetrics.activeSymbols.clear();

    console.log('[TradingOpsMonitor] Trading operations monitoring system destroyed');
  }
}

/**
 * Global trading operations monitor instance
 */
let globalTradingOpsMonitor = null;

/**
 * Get or create global trading operations monitor
 */
export function getTradingOperationsMonitor(config = {}) {
  if (!globalTradingOpsMonitor) {
    globalTradingOpsMonitor = new TradingOperationsMonitor(config);
  }
  return globalTradingOpsMonitor;
}

/**
 * Initialize trading operations monitoring with default configuration
 */
export function initializeTradingOperationsMonitoring(config = {}) {
  const monitor = getTradingOperationsMonitor(config);
  monitor.startMonitoring();
  return monitor;
}