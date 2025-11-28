/**
 * State Change Correlation System
 *
 * Provides comprehensive visibility into the state-to-render pipeline
 * by tracking state changes, correlating them with visual updates,
 * and monitoring pipeline performance.
 *
 * Features:
 * - Unique tracking IDs for state changes
 * - State transition logging with detailed context
 * - State-to-render correlation analysis
 * - Pipeline performance tracking
 * - Bottleneck identification and optimization opportunities
 */

// Development mode detection
const isDevelopment = import.meta.env.DEV;

// Global state tracking registry
const stateChangeRegistry = new Map();
const renderTriggerRegistry = new Map();
const pipelinePerformanceRegistry = new Map();

// Counter for unique tracking IDs
let stateChangeCounter = 0;
let renderTriggerCounter = 0;

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  STATE_TO_RENDER: 100,  // Max allowed latency from state change to render
  RENDER_CYCLE: 16.67,   // 60fps target
  WORKER_UPDATE: 50,     // Max worker state update latency
  WEBSOCKET_TO_STATE: 75 // Max WebSocket data to state propagation latency
};

// Emoji-based classification system
const EMOJI_CLASSIFIERS = {
  STATE_CHANGE: '🔄',
  RENDER_TRIGGER: '🎨',
  PIPELINE_PERFORMANCE: '📊',
  BOTTLENECK: '🔥',
  WARNING: '⚠️',
  SUCCESS: '✅',
  DEBUG: '🔍',
  WORKER: '👷',
  WEBSOCKET: '🌐'
};

/**
 * Generate unique tracking IDs
 */
function generateStateChangeId() {
  return `STATE_${Date.now()}_${++stateChangeCounter}_${Math.random().toString(36).substr(2, 6)}`;
}

function generateRenderTriggerId() {
  return `RENDER_${Date.now()}_${++renderTriggerCounter}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Deep state comparison to detect meaningful changes
 */
function deepStateCompare(oldState, newState, path = '') {
  const changes = [];

  if (!oldState || !newState) {
    if (oldState !== newState) {
      changes.push({
        path: path || 'root',
        type: 'structural',
        oldValue: oldState,
        newValue: newState,
        significance: 'high'
      });
    }
    return changes;
  }

  // Compare all properties
  for (const key in newState) {
    const currentPath = path ? `${path}.${key}` : key;
    const oldValue = oldState[key];
    const newValue = newState[key];

    if (oldValue === newValue) continue;

    if (typeof oldValue !== typeof newValue) {
      changes.push({
        path: currentPath,
        type: 'type_change',
        oldValue,
        newValue,
        significance: 'high'
      });
    } else if (typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue)) {
      // Recurse into nested objects
      changes.push(...deepStateCompare(oldValue, newValue, currentPath));
    } else {
      // Determine significance based on property and change magnitude
      let significance = 'medium';
      if (key === 'ready' || key === 'symbol' || key === 'currentPrice') {
        significance = 'high';
      } else if (key === 'timestamp' || key.includes('Time')) {
        significance = 'low';
      }

      changes.push({
        path: currentPath,
        type: 'value_change',
        oldValue,
        newValue,
        significance,
        magnitude: typeof newValue === 'number' && typeof oldValue === 'number'
          ? Math.abs(newValue - oldValue)
          : undefined
      });
    }
  }

  return changes;
}

/**
 * Create a state change tracker with comprehensive logging
 */
export function createStateTracker(displayId, symbol) {
  const trackerId = `TRACKER_${displayId}_${symbol}`;
  let lastStateSnapshot = null;
  let stateChangeHistory = [];

  return {
    /**
     * Track a state change and analyze its impact
     */
    trackStateChange: (newState, context = {}) => {
      if (!isDevelopment) return null;

      const stateChangeId = generateStateChangeId();
      const timestamp = performance.now();

      // Analyze what changed
      const changes = deepStateCompare(lastStateSnapshot, newState);
      const significantChanges = changes.filter(c => c.significance === 'high');

      if (changes.length === 0) {
        console.log(`${EMOJI_CLASSIFIERS.DEBUG} [STATE_TRACKER:${displayId}] No meaningful state changes detected`);
        return null;
      }

      // Create state change record
      const stateChange = {
        id: stateChangeId,
        displayId,
        symbol,
        timestamp,
        changes,
        significantChanges: significantChanges.length,
        context,
        hasRenderTriggered: false,
        renderTriggerId: null,
        renderLatency: null,
        pipelineStages: {
          stateChange: timestamp,
          workerUpdate: null,
          componentUpdate: null,
          renderTrigger: null,
          visualUpdate: null
        }
      };

      // Store in registry
      stateChangeRegistry.set(stateChangeId, stateChange);

      // Add to history (keep last 50 changes)
      stateChangeHistory.push(stateChange);
      if (stateChangeHistory.length > 50) {
        stateChangeHistory = stateChangeHistory.slice(-50);
      }

      // Log the state change
      console.group(`${EMOJI_CLASSIFIERS.STATE_CHANGE} [STATE_CHANGE:${displayId}] ${stateChangeId}`);
      console.log(`📊 Symbol: ${symbol}`);
      console.log(`⏱️ Timestamp: ${timestamp.toFixed(2)}ms`);
      console.log(`🔄 Total changes: ${changes.length}`);
      console.log(`⚡ Significant changes: ${significantChanges.length}`);

      if (significantChanges.length > 0) {
        console.log('🔥 Significant changes:', significantChanges);
      }

      console.log('📋 All changes:', changes);
      console.log('🎯 Context:', context);
      console.groupEnd();

      // Update last state snapshot
      lastStateSnapshot = JSON.parse(JSON.stringify(newState));

      return stateChangeId;
    },

    /**
     * Correlate a render trigger with a state change
     */
    correlateRenderTrigger: (renderContext = {}) => {
      if (!isDevelopment) return null;

      const renderTriggerId = generateRenderTriggerId();
      const timestamp = performance.now();

      // Find the most recent uncorrelated state change
      let recentStateChange = null;
      let minLatency = Infinity;

      for (const [changeId, change] of stateChangeRegistry.entries()) {
        if (change.displayId === displayId && !change.hasRenderTriggered) {
          const latency = timestamp - change.timestamp;
          if (latency < minLatency && latency < 1000) { // Within 1 second
            minLatency = latency;
            recentStateChange = change;
          }
        }
      }

      // Create render trigger record
      const renderTrigger = {
        id: renderTriggerId,
        displayId,
        symbol,
        timestamp,
        stateChangeId: recentStateChange?.id || null,
        latency: recentStateChange ? minLatency : null,
        context: renderContext,
        renderType: renderContext.renderType || 'unknown',
        triggerSource: renderContext.triggerSource || 'reactive'
      };

      // Update state change if correlated
      if (recentStateChange) {
        recentStateChange.hasRenderTriggered = true;
        recentStateChange.renderTriggerId = renderTriggerId;
        recentStateChange.renderLatency = minLatency;
        recentStateChange.pipelineStages.renderTrigger = timestamp;

        // Log the correlation
        const meetsThreshold = minLatency <= PERFORMANCE_THRESHOLDS.STATE_TO_RENDER;
        const emoji = meetsThreshold ? EMOJI_CLASSIFIERS.SUCCESS : EMOJI_CLASSIFIERS.WARNING;

        console.group(`${emoji} [RENDER_CORRELATION:${displayId}] ${renderTriggerId}`);
        console.log(`🎨 State change correlated: ${recentStateChange.id}`);
        console.log(`⏱️ State-to-render latency: ${minLatency.toFixed(2)}ms`);
        console.log(`📊 Performance threshold: ${PERFORMANCE_THRESHOLDS.STATE_TO_RENDER}ms`);
        console.log(`✅ Meets threshold: ${meetsThreshold}`);
        console.log(`🎯 Render context:`, renderContext);
        console.groupEnd();

        if (!meetsThreshold) {
          console.warn(`${EMOJI_CLASSIFIERS.BOTTLENECK} [PERFORMANCE:${displayId}] State-to-render latency exceeds threshold: ${minLatency.toFixed(2)}ms`);
        }
      } else {
        console.log(`${EMOJI_CLASSIFIERS.DEBUG} [RENDER_CORRELATION:${displayId}] ${renderTriggerId} - No correlated state change found`);
      }

      // Store render trigger
      renderTriggerRegistry.set(renderTriggerId, renderTrigger);

      return renderTriggerId;
    },

    /**
     * Get state change history for analysis
     */
    getStateHistory: (limit = 20) => {
      return stateChangeHistory.slice(-limit);
    },

    /**
     * Get performance statistics
     */
    getPerformanceStats: () => {
      const recentChanges = stateChangeHistory.slice(-20);
      const correlatedChanges = recentChanges.filter(c => c.hasRenderTriggered);

      if (correlatedChanges.length === 0) {
        return {
          sampleSize: 0,
          avgLatency: null,
          maxLatency: null,
          minLatency: null,
          throughputThreshold: null
        };
      }

      const latencies = correlatedChanges.map(c => c.renderLatency);
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);
      const throughputThreshold = correlatedChanges.filter(c => c.renderLatency <= PERFORMANCE_THRESHOLDS.STATE_TO_RENDER).length / correlatedChanges.length;

      return {
        sampleSize: correlatedChanges.length,
        avgLatency: avgLatency.toFixed(2),
        maxLatency: maxLatency.toFixed(2),
        minLatency: minLatency.toFixed(2),
        throughputThreshold: (throughputThreshold * 100).toFixed(1)
      };
    },

    /**
     * Clear tracking data
     */
    clear: () => {
      stateChangeHistory = [];
      lastStateSnapshot = null;
    }
  };
}

/**
 * Pipeline performance tracker for end-to-end monitoring
 */
export function createPipelineTracker(pipelineName) {
  const pipelineId = `PIPELINE_${pipelineName}_${Date.now()}`;
  let activeStages = new Map();

  return {
    /**
     * Start tracking a pipeline stage
     */
    startStage: (stageName, context = {}) => {
      if (!isDevelopment) return null;

      const stageId = `STAGE_${stageName}_${Date.now()}`;
      const startTime = performance.now();

      activeStages.set(stageId, {
        name: stageName,
        startTime,
        context,
        pipelineId
      });

      console.log(`${EMOJI_CLASSIFIERS.DEBUG} [PIPELINE:${pipelineName}] Starting stage: ${stageName}`, context);

      return stageId;
    },

    /**
     * Complete a pipeline stage
     */
    completeStage: (stageId, result = null) => {
      if (!isDevelopment || !stageId) return null;

      const stage = activeStages.get(stageId);
      if (!stage) {
        console.warn(`${EMOJI_CLASSIFIERS.WARNING} [PIPELINE:${pipelineName}] Stage not found: ${stageId}`);
        return null;
      }

      const endTime = performance.now();
      const duration = endTime - stage.startTime;

      activeStages.delete(stageId);

      // Store in performance registry
      const performanceRecord = {
        pipelineId,
        stageName: stage.name,
        startTime: stage.startTime,
        endTime,
        duration,
        result,
        context: stage.context
      };

      if (!pipelinePerformanceRegistry.has(pipelineId)) {
        pipelinePerformanceRegistry.set(pipelineId, []);
      }
      pipelinePerformanceRegistry.get(pipelineId).push(performanceRecord);

      console.log(`${EMOJI_CLASSIFIERS.SUCCESS} [PIPELINE:${pipelineName}] Completed stage: ${stage.name} in ${duration.toFixed(2)}ms`);

      return duration;
    },

    /**
     * Get pipeline performance summary
     */
    getPerformanceSummary: () => {
      const records = pipelinePerformanceRegistry.get(pipelineId) || [];
      if (records.length === 0) return null;

      const totalDuration = records.reduce((sum, r) => sum + r.duration, 0);
      const stageStats = {};

      records.forEach(record => {
        if (!stageStats[record.stageName]) {
          stageStats[record.stageName] = {
            count: 0,
            totalDuration: 0,
            avgDuration: 0,
            minDuration: Infinity,
            maxDuration: 0
          };
        }

        const stats = stageStats[record.stageName];
        stats.count++;
        stats.totalDuration += record.duration;
        stats.avgDuration = stats.totalDuration / stats.count;
        stats.minDuration = Math.min(stats.minDuration, record.duration);
        stats.maxDuration = Math.max(stats.maxDuration, record.duration);
      });

      return {
        pipelineId,
        totalRecords: records.length,
        totalDuration: totalDuration.toFixed(2),
        avgDuration: (totalDuration / records.length).toFixed(2),
        stageBreakdown: stageStats
      };
    }
  };
}

/**
 * Worker communication analyzer
 */
export function createWorkerCommunicationAnalyzer(displayId) {
  const analyzerId = `WORKER_ANALYZER_${displayId}`;
  let messageHistory = [];
  let pendingMessages = new Map();

  return {
    /**
     * Track outgoing message to worker
     */
    trackOutgoingMessage: (messageType, payload, messageId = null) => {
      if (!isDevelopment) return null;

      const msgId = messageId || `MSG_OUT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const timestamp = performance.now();

      const message = {
        id: msgId,
        type: 'outgoing',
        messageType,
        payload,
        timestamp,
        displayId,
        responseReceived: false,
        responseTimestamp: null,
        responseLatency: null
      };

      messageHistory.push(message);
      pendingMessages.set(msgId, message);

      console.log(`${EMOJI_CLASSIFIERS.WORKER} [WORKER_MSG:${displayId}] Outgoing: ${messageType} (${msgId})`);

      return msgId;
    },

    /**
     * Track incoming message from worker
     */
    trackIncomingMessage: (messageType, payload, correlationId = null) => {
      if (!isDevelopment) return null;

      const timestamp = performance.now();
      const msgId = correlationId || `MSG_IN_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      // Check if this is a response to a pending message
      if (correlationId && pendingMessages.has(correlationId)) {
        const outgoingMessage = pendingMessages.get(correlationId);
        outgoingMessage.responseReceived = true;
        outgoingMessage.responseTimestamp = timestamp;
        outgoingMessage.responseLatency = timestamp - outgoingMessage.timestamp;

        pendingMessages.delete(correlationId);

        console.log(`${EMOJI_CLASSIFIERS.WORKER} [WORKER_MSG:${displayId}] Response: ${messageType} (${correlationId}) in ${outgoingMessage.responseLatency.toFixed(2)}ms`);
      } else {
        const message = {
          id: msgId,
          type: 'incoming',
          messageType,
          payload,
          timestamp,
          displayId,
          correlationId
        };

        messageHistory.push(message);
        console.log(`${EMOJI_CLASSIFIERS.WORKER} [WORKER_MSG:${displayId}] Incoming: ${messageType} (${msgId})`);
      }

      return msgId;
    },

    /**
     * Get communication statistics
     */
    getCommunicationStats: () => {
      const outgoingMessages = messageHistory.filter(m => m.type === 'outgoing');
      const incomingMessages = messageHistory.filter(m => m.type === 'incoming');
      const respondedMessages = outgoingMessages.filter(m => m.responseReceived);

      const avgResponseLatency = respondedMessages.length > 0
        ? respondedMessages.reduce((sum, m) => sum + m.responseLatency, 0) / respondedMessages.length
        : null;

      return {
        totalOutgoing: outgoingMessages.length,
        totalIncoming: incomingMessages.length,
        totalResponded: respondedMessages.length,
        responseRate: outgoingMessages.length > 0 ? (respondedMessages.length / outgoingMessages.length * 100).toFixed(1) : 0,
        avgResponseLatency: avgResponseLatency ? avgResponseLatency.toFixed(2) : null,
        pendingMessages: pendingMessages.size
      };
    }
  };
}

/**
 * WebSocket data flow tracker
 */
export function createWebSocketFlowTracker(displayId, symbol) {
  const trackerId = `WS_FLOW_${displayId}_${symbol}`;
  let flowHistory = [];

  return {
    /**
     * Track WebSocket data reception
     */
    trackDataReception: (dataType, rawData, timestamp = null) => {
      if (!isDevelopment) return null;

      const receptionTime = timestamp || performance.now();
      const flowId = `WS_FLOW_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      const flowRecord = {
        id: flowId,
        stage: 'websocket_reception',
        dataType,
        timestamp: receptionTime,
        displayId,
        symbol,
        rawDataSize: JSON.stringify(rawData).length,
        stateUpdateTriggered: false,
        stateUpdateTime: null,
        visualUpdateTriggered: false,
        visualUpdateTime: null,
        endToEndLatency: null
      };

      flowHistory.push(flowRecord);

      console.log(`${EMOJI_CLASSIFIERS.WEBSOCKET} [WS_FLOW:${displayId}] Data received: ${dataType} (${flowId})`);

      return flowId;
    },

    /**
     * Track state update from WebSocket data
     */
    trackStateUpdate: (flowId, stateUpdateResult) => {
      if (!isDevelopment || !flowId) return null;

      const flowRecord = flowHistory.find(r => r.id === flowId);
      if (!flowRecord) {
        console.warn(`${EMOJI_CLASSIFIERS.WARNING} [WS_FLOW:${displayId}] Flow record not found: ${flowId}`);
        return null;
      }

      const stateUpdateTime = performance.now();
      const stateLatency = stateUpdateTime - flowRecord.timestamp;

      flowRecord.stateUpdateTriggered = true;
      flowRecord.stateUpdateTime = stateUpdateTime;
      flowRecord.stateUpdateLatency = stateLatency;
      flowRecord.stateUpdateResult = stateUpdateResult;

      const meetsThreshold = stateLatency <= PERFORMANCE_THRESHOLDS.WEBSOCKET_TO_STATE;
      const emoji = meetsThreshold ? EMOJI_CLASSIFIERS.SUCCESS : EMOJI_CLASSIFIERS.WARNING;

      console.log(`${emoji} [WS_FLOW:${displayId}] State update: ${stateLatency.toFixed(2)}ms (${flowId})`);

      if (!meetsThreshold) {
        console.warn(`${EMOJI_CLASSIFIERS.BOTTLENECK} [WS_FLOW:${displayId}] WebSocket-to-state latency exceeds threshold: ${stateLatency.toFixed(2)}ms`);
      }

      return stateLatency;
    },

    /**
     * Track visual update completion
     */
    trackVisualUpdate: (flowId, visualUpdateResult) => {
      if (!isDevelopment || !flowId) return null;

      const flowRecord = flowHistory.find(r => r.id === flowId);
      if (!flowRecord || !flowRecord.stateUpdateTriggered) {
        console.warn(`${EMOJI_CLASSIFIERS.WARNING} [WS_FLOW:${displayId}] Cannot track visual update without state update: ${flowId}`);
        return null;
      }

      const visualUpdateTime = performance.now();
      const visualLatency = visualUpdateTime - flowRecord.stateUpdateTime;
      const endToEndLatency = visualUpdateTime - flowRecord.timestamp;

      flowRecord.visualUpdateTriggered = true;
      flowRecord.visualUpdateTime = visualUpdateTime;
      flowRecord.visualUpdateLatency = visualLatency;
      flowRecord.endToEndLatency = endToEndLatency;
      flowRecord.visualUpdateResult = visualUpdateResult;

      const meetsThreshold = endToEndLatency <= PERFORMANCE_THRESHOLDS.STATE_TO_RENDER;
      const emoji = meetsThreshold ? EMOJI_CLASSIFIERS.SUCCESS : EMOJI_CLASSIFIERS.BOTTLENECK;

      console.log(`${emoji} [WS_FLOW:${displayId}] Complete flow: ${endToEndLatency.toFixed(2)}ms (${flowId})`);
      console.log(`  📊 WebSocket→State: ${flowRecord.stateUpdateLatency.toFixed(2)}ms`);
      console.log(`  🎨 State→Visual: ${visualLatency.toFixed(2)}ms`);
      console.log(`  🏁 End-to-End: ${endToEndLatency.toFixed(2)}ms`);

      return { visualLatency, endToEndLatency };
    },

    /**
     * Get flow performance statistics
     */
    getFlowStats: () => {
      const completedFlows = flowHistory.filter(f => f.visualUpdateTriggered);
      if (completedFlows.length === 0) {
        return {
          sampleSize: 0,
          avgEndToEndLatency: null,
          avgStateUpdateLatency: null,
          avgVisualUpdateLatency: null,
          throughputThreshold: null
        };
      }

      const endToEndLatencies = completedFlows.map(f => f.endToEndLatency);
      const stateUpdateLatencies = completedFlows.map(f => f.stateUpdateLatency);
      const visualUpdateLatencies = completedFlows.map(f => f.visualUpdateLatency);

      const avgEndToEndLatency = endToEndLatencies.reduce((sum, lat) => sum + lat, 0) / endToEndLatencies.length;
      const avgStateUpdateLatency = stateUpdateLatencies.reduce((sum, lat) => sum + lat, 0) / stateUpdateLatencies.length;
      const avgVisualUpdateLatency = visualUpdateLatencies.reduce((sum, lat) => sum + lat, 0) / visualUpdateLatencies.length;

      const throughputThreshold = completedFlows.filter(f => f.endToEndLatency <= PERFORMANCE_THRESHOLDS.STATE_TO_RENDER).length / completedFlows.length;

      return {
        sampleSize: completedFlows.length,
        avgEndToEndLatency: avgEndToEndLatency.toFixed(2),
        avgStateUpdateLatency: avgStateUpdateLatency.toFixed(2),
        avgVisualUpdateLatency: avgVisualUpdateLatency.toFixed(2),
        throughputThreshold: (throughputThreshold * 100).toFixed(1)
      };
    }
  };
}

/**
 * Global system overview for debugging
 */
export function getStateCorrelationOverview() {
  if (!isDevelopment) return null;

  const totalStateChanges = stateChangeRegistry.size;
  const totalRenderTriggers = renderTriggerRegistry.size;
  const correlatedRenders = Array.from(renderTriggerRegistry.values()).filter(r => r.stateChangeId).length;

  let totalLatency = 0;
  let correlatedCount = 0;

  renderTriggerRegistry.forEach(render => {
    if (render.stateChangeId && render.latency) {
      totalLatency += render.latency;
      correlatedCount++;
    }
  });

  const avgLatency = correlatedCount > 0 ? totalLatency / correlatedCount : 0;

  return {
    stateChanges: totalStateChanges,
    renderTriggers: totalRenderTriggers,
    correlatedRenders,
    correlationRate: totalRenderTriggers > 0 ? (correlatedRenders / totalRenderTriggers * 100).toFixed(1) : 0,
    avgLatency: avgLatency.toFixed(2),
    performanceThreshold: PERFORMANCE_THRESHOLDS.STATE_TO_RENDER,
    meetsPerformanceThreshold: avgLatency <= PERFORMANCE_THRESHOLDS.STATE_TO_RENDER
  };
}

/**
 * Development-only system health check
 */
export function runStateCorrelationHealthCheck() {
  if (!isDevelopment) return null;

  console.group(`${EMOJI_CLASSIFIERS.HEALTH_CHECK} 🏥 State Correlation System Health Check`);

  const overview = getStateCorrelationOverview();
  console.log('📊 System Overview:', overview);

  // Check correlation rate
  if (overview.correlationRate < 80) {
    console.warn(`${EMOJI_CLASSIFIERS.WARNING} Low correlation rate: ${overview.correlationRate}%`);
  } else {
    console.log(`${EMOJI_CLASSIFIERS.SUCCESS} Good correlation rate: ${overview.correlationRate}%`);
  }

  // Check performance
  if (!overview.meetsPerformanceThreshold) {
    console.warn(`${EMOJI_CLASSIFIERS.BOTTLENECK} Performance threshold exceeded: ${overview.avgLatency}ms`);
  } else {
    console.log(`${EMOJI_CLASSIFIERS.SUCCESS} Performance within threshold: ${overview.avgLatency}ms`);
  }

  // Registry sizes
  console.log(`📋 Registry sizes:`, {
    stateChanges: stateChangeRegistry.size,
    renderTriggers: renderTriggerRegistry.size,
    pipelinePerformances: pipelinePerformanceRegistry.size
  });

  console.groupEnd();

  return overview;
}