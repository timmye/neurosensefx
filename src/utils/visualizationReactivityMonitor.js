/**
 * Visualization Reactivity Monitoring System
 *
 * Monitors how visualizations respond to state changes and provides visibility
 * into the effectiveness of visualization parameter binding and update propagation.
 *
 * Features:
 * - Visualization responsiveness tracking
 * - Parameter binding effectiveness analysis
 * - Render cycle timing analysis
 * - Update propagation delay monitoring
 * - Visualization performance profiling
 */

// Development mode detection
const isDevelopment = import.meta.env.DEV;

// Reactivity tracking registry
const reactivityRegistry = new Map();
const visualizationProfiles = new Map();

// Performance thresholds
const REACTIVITY_THRESHOLDS = {
  PARAMETER_UPDATE_LATENCY: 10,   // Max allowed parameter update latency (ms)
  VISUALIZATION_RESPONSE: 25,     // Max visualization response time (ms)
  UPDATE_PROPAGATION_DELAY: 5,    // Max update propagation delay (ms)
  STALE_VISUALIZATION_THRESHOLD: 100 // Max time for stale visualization (ms)
};

// Emoji-based classification system
const EMOJI_CLASSIFIERS = {
  REACTIVITY: '🔄',
  VISUALIZATION: '🎨',
  PARAMETER: '⚙️',
  PERFORMANCE: '📊',
  WARNING: '⚠️',
  SUCCESS: '✅',
  DEBUG: '🔍',
  STALE: '🗑️'
};

/**
 * Create visualization reactivity monitor
 */
export function createVisualizationReactivityMonitor(displayId, symbol) {
  const monitorId = `REACTIVITY_MONITOR_${displayId}_${symbol}`;
  let lastParameterSnapshot = null;
  let lastRenderSnapshot = null;
  let reactivityHistory = [];
  let parameterUpdateHistory = [];

  return {
    /**
     * Track parameter changes before visualization
     */
    trackParameterUpdate: (newParameters, context = {}) => {
      if (!isDevelopment) return null;

      const updateId = `PARAM_UPDATE_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const timestamp = performance.now();

      // Analyze parameter changes
      const changes = analyzeParameterChanges(lastParameterSnapshot, newParameters);

      if (changes.length === 0) {
        console.log(`${EMOJI_CLASSIFIERS.DEBUG} [REACTIVITY:${displayId}] No meaningful parameter changes detected`);
        return null;
      }

      const parameterUpdate = {
        id: updateId,
        displayId,
        symbol,
        timestamp,
        changes,
        context,
        visualizationResponded: false,
        visualizationResponseTime: null,
        renderTriggered: false,
        renderLatency: null,
        stages: {
          parameterUpdate: timestamp,
          visualizationResponse: null,
          renderTrigger: null,
          visualUpdate: null
        }
      };

      // Store in registry and history
      reactivityRegistry.set(updateId, parameterUpdate);
      parameterUpdateHistory.push(parameterUpdate);

      // Keep history limited
      if (parameterUpdateHistory.length > 50) {
        parameterUpdateHistory = parameterUpdateHistory.slice(-50);
      }

      console.group(`${EMOJI_CLASSIFIERS.PARAMETER} [PARAM_UPDATE:${displayId}] ${updateId}`);
      console.log(`📊 Symbol: ${symbol}`);
      console.log(`⏱️ Update timestamp: ${timestamp.toFixed(2)}ms`);
      console.log(`🔄 Parameter changes: ${changes.length}`);
      console.log('📋 Parameter changes:', changes);
      console.log('🎯 Context:', context);
      console.groupEnd();

      lastParameterSnapshot = JSON.parse(JSON.stringify(newParameters));
      return updateId;
    },

    /**
     * Track visualization response to parameter changes
     */
    trackVisualizationResponse: (parameterUpdateId, visualizationContext = {}) => {
      if (!isDevelopment || !parameterUpdateId) return null;

      const timestamp = performance.now();
      const parameterUpdate = reactivityRegistry.get(parameterUpdateId);

      if (!parameterUpdate) {
        console.warn(`${EMOJI_CLASSIFIERS.WARNING} [REACTIVITY:${displayId}] Parameter update not found: ${parameterUpdateId}`);
        return null;
      }

      const responseTime = timestamp - parameterUpdate.timestamp;

      parameterUpdate.visualizationResponded = true;
      parameterUpdate.visualizationResponseTime = responseTime;
      parameterUpdate.stages.visualizationResponse = timestamp;

      const meetsThreshold = responseTime <= REACTIVITY_THRESHOLDS.VISUALIZATION_RESPONSE;
      const emoji = meetsThreshold ? EMOJI_CLASSIFIERS.SUCCESS : EMOJI_CLASSIFIERS.WARNING;

      console.group(`${emoji} [VIZ_RESPONSE:${displayId}] ${parameterUpdateId}`);
      console.log(`🎨 Visualization responded to parameter update`);
      console.log(`⏱️ Response time: ${responseTime.toFixed(2)}ms`);
      console.log(`📊 Threshold: ${REACTIVITY_THRESHOLDS.VISUALIZATION_RESPONSE}ms`);
      console.log(`✅ Meets threshold: ${meetsThreshold}`);
      console.log('🎯 Visualization context:', visualizationContext);
      console.groupEnd();

      if (!meetsThreshold) {
        console.warn(`${EMOJI_CLASSIFIERS.WARNING} [REACTIVITY:${displayId}] Slow visualization response: ${responseTime.toFixed(2)}ms`);
      }

      return responseTime;
    },

    /**
     * Track render triggered by visualization changes
     */
    trackRenderTrigger: (parameterUpdateId, renderContext = {}) => {
      if (!isDevelopment || !parameterUpdateId) return null;

      const timestamp = performance.now();
      const parameterUpdate = reactivityRegistry.get(parameterUpdateId);

      if (!parameterUpdate) {
        console.warn(`${EMOJI_CLASSIFIERS.WARNING} [REACTIVITY:${displayId}] Parameter update not found: ${parameterUpdateId}`);
        return null;
      }

      const renderLatency = timestamp - parameterUpdate.timestamp;

      parameterUpdate.renderTriggered = true;
      parameterUpdate.renderLatency = renderLatency;
      parameterUpdate.stages.renderTrigger = timestamp;

      const meetsThreshold = renderLatency <= REACTIVITY_THRESHOLDS.PARAMETER_UPDATE_LATENCY;
      const emoji = meetsThreshold ? EMOJI_CLASSIFIERS.SUCCESS : EMOJI_CLASSIFIERS.WARNING;

      console.group(`${emoji} [RENDER_TRIGGER:${displayId}] ${parameterUpdateId}`);
      console.log(`🎨 Render triggered by parameter update`);
      console.log(`⏱️ Parameter-to-render latency: ${renderLatency.toFixed(2)}ms`);
      console.log(`📊 Threshold: ${REACTIVITY_THRESHOLDS.PARAMETER_UPDATE_LATENCY}ms`);
      console.log(`✅ Meets threshold: ${meetsThreshold}`);
      console.log('🎯 Render context:', renderContext);
      console.groupEnd();

      if (!meetsThreshold) {
        console.warn(`${EMOJI_CLASSIFIERS.WARNING} [REACTIVITY:${displayId}] Parameter update to render latency: ${renderLatency.toFixed(2)}ms`);
      }

      return renderLatency;
    },

    /**
     * Track final visual update completion
     */
    trackVisualUpdateComplete: (parameterUpdateId, visualUpdateResult = {}) => {
      if (!isDevelopment || !parameterUpdateId) return null;

      const timestamp = performance.now();
      const parameterUpdate = reactivityRegistry.get(parameterUpdateId);

      if (!parameterUpdate) {
        console.warn(`${EMOJI_CLASSIFIERS.WARNING} [REACTIVITY:${displayId}] Parameter update not found: ${parameterUpdateId}`);
        return null;
      }

      const endToEndLatency = timestamp - parameterUpdate.timestamp;

      parameterUpdate.stages.visualUpdate = timestamp;
      parameterUpdate.endToEndLatency = endToEndLatency;

      const meetsThreshold = endToEndLatency <= REACTIVITY_THRESHOLDS.STALE_VISUALIZATION_THRESHOLD;
      const emoji = meetsThreshold ? EMOJI_CLASSIFIERS.SUCCESS : EMOJI_CLASSIFIERS.STALE;

      console.group(`${emoji} [VISUAL_UPDATE:${displayId}] ${parameterUpdateId}`);
      console.log(`🎨 Visual update completed`);
      console.log(`⏱️ End-to-end latency: ${endToEndLatency.toFixed(2)}ms`);
      console.log(`📊 Stale visualization threshold: ${REACTIVITY_THRESHOLDS.STALE_VISUALIZATION_THRESHOLD}ms`);
      console.log(`✅ Meets threshold: ${meetsThreshold}`);
      console.log('🎯 Update result:', visualUpdateResult);
      console.groupEnd();

      if (!meetsThreshold) {
        console.warn(`${EMOJI_CLASSIFIERS.STALE} [REACTIVITY:${displayId}] Stale visualization detected: ${endToEndLatency.toFixed(2)}ms`);
      }

      return endToEndLatency;
    },

    /**
     * Profile individual visualization performance
     */
    profileVisualization: (visualizationName, renderContext, renderTime) => {
      if (!isDevelopment) return null;

      const profileId = `VIZ_PROFILE_${visualizationName}_${Date.now()}`;

      if (!visualizationProfiles.has(visualizationName)) {
        visualizationProfiles.set(visualizationName, {
          name: visualizationName,
          renderCount: 0,
          totalTime: 0,
          avgTime: 0,
          minTime: Infinity,
          maxTime: 0,
          lastRenderTime: null,
          performanceIssues: 0
        });
      }

      const profile = visualizationProfiles.get(visualizationName);
      profile.renderCount++;
      profile.totalTime += renderTime;
      profile.avgTime = profile.totalTime / profile.renderCount;
      profile.minTime = Math.min(profile.minTime, renderTime);
      profile.maxTime = Math.max(profile.maxTime, renderTime);
      profile.lastRenderTime = renderTime;

      const meets60fps = renderTime <= 16.67;
      if (!meets60fps) {
        profile.performanceIssues++;
      }

      const emoji = meets60fps ? EMOJI_CLASSIFIERS.SUCCESS : EMOJI_CLASSIFIERS.WARNING;

      console.log(`${emoji} [VIZ_PROFILE:${displayId}] ${visualizationName} in ${renderTime.toFixed(2)}ms`, {
        avgTime: profile.avgTime.toFixed(2),
        renderCount: profile.renderCount,
        meets60fps
      });

      return profileId;
    },

    /**
     * Get reactivity performance statistics
     */
    getReactivityStats: () => {
      const recentUpdates = parameterUpdateHistory.slice(-20);
      const completedUpdates = recentUpdates.filter(u => u.stages.visualUpdate);

      if (completedUpdates.length === 0) {
        return {
          sampleSize: 0,
          avgParameterToRender: null,
          avgEndToEndLatency: null,
          responsivenessScore: null,
          performanceGrade: 'N/A'
        };
      }

      const parameterToRenderTimes = completedUpdates
        .filter(u => u.renderLatency)
        .map(u => u.renderLatency);

      const endToEndTimes = completedUpdates
        .filter(u => u.endToEndLatency)
        .map(u => u.endToEndLatency);

      const avgParameterToRender = parameterToRenderTimes.length > 0
        ? parameterToRenderTimes.reduce((sum, time) => sum + time, 0) / parameterToRenderTimes.length
        : 0;

      const avgEndToEndLatency = endToEndTimes.length > 0
        ? endToEndTimes.reduce((sum, time) => sum + time, 0) / endToEndTimes.length
        : 0;

      const responsivenessScore = completedUpdates.filter(u =>
        u.renderLatency <= REACTIVITY_THRESHOLDS.PARAMETER_UPDATE_LATENCY
      ).length / completedUpdates.length;

      const performanceGrade = getPerformanceGrade(avgParameterToRender, avgEndToEndLatency, responsivenessScore);

      return {
        sampleSize: completedUpdates.length,
        avgParameterToRender: avgParameterToRender.toFixed(2),
        avgEndToEndLatency: avgEndToEndLatency.toFixed(2),
        responsivenessScore: (responsivenessScore * 100).toFixed(1),
        performanceGrade
      };
    },

    /**
     * Get visualization performance profiles
     */
    getVisualizationProfiles: () => {
      const profiles = {};
      visualizationProfiles.forEach((profile, name) => {
        profiles[name] = {
          ...profile,
          avgTime: profile.avgTime.toFixed(2),
          minTime: profile.minTime === Infinity ? 'N/A' : profile.minTime.toFixed(2),
          maxTime: profile.maxTime.toFixed(2),
          lastRenderTime: profile.lastRenderTime ? profile.lastRenderTime.toFixed(2) : 'N/A'
        };
      });
      return profiles;
    },

    /**
     * Clear monitoring data
     */
    clear: () => {
      reactivityHistory = [];
      parameterUpdateHistory = [];
      visualizationProfiles.clear();
      console.log(`${EMOJI_CLASSIFIERS.DEBUG} [REACTIVITY:${displayId}] Monitoring data cleared`);
    }
  };
}

/**
 * Analyze parameter changes for significance
 */
function analyzeParameterChanges(oldParameters, newParameters) {
  const changes = [];

  if (!oldParameters || !newParameters) {
    if (oldParameters !== newParameters) {
      changes.push({
        path: 'root',
        type: 'structural',
        oldValue: oldParameters,
        newValue: newParameters,
        significance: 'high'
      });
    }
    return changes;
  }

  // Compare all properties
  for (const key in newParameters) {
    const oldValue = oldParameters[key];
    const newValue = newParameters[key];

    if (oldValue === newValue) continue;

    if (typeof oldValue !== typeof newValue) {
      changes.push({
        path: key,
        type: 'type_change',
        oldValue,
        newValue,
        significance: 'high'
      });
    } else if (typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue)) {
      // Recursively analyze nested objects
      const nestedChanges = analyzeParameterChanges(oldValue, newValue);
      nestedChanges.forEach(change => {
        change.path = `${key}.${change.path}`;
      });
      changes.push(...nestedChanges);
    } else {
      // Determine significance based on parameter type
      let significance = 'medium';
      if (key.includes('Price') || key.includes('Scale') || key === 'symbol' || key === 'ready') {
        significance = 'high';
      } else if (key.includes('Color') || key.includes('Opacity') || key.includes('Width')) {
        significance = 'low';
      }

      changes.push({
        path: key,
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
 * Calculate performance grade based on metrics
 */
function getPerformanceGrade(avgParameterToRender, avgEndToEndLatency, responsivenessScore) {
  if (avgParameterToRender <= 5 && avgEndToEndLatency <= 25 && responsivenessScore >= 0.95) {
    return 'A+';
  } else if (avgParameterToRender <= 10 && avgEndToEndLatency <= 50 && responsivenessScore >= 0.90) {
    return 'A';
  } else if (avgParameterToRender <= 15 && avgEndToEndLatency <= 75 && responsivenessScore >= 0.80) {
    return 'B';
  } else if (avgParameterToRender <= 25 && avgEndToEndLatency <= 100 && responsivenessScore >= 0.70) {
    return 'C';
  } else if (avgParameterToRender <= 50 && avgEndToEndLatency <= 150 && responsivenessScore >= 0.50) {
    return 'D';
  } else {
    return 'F';
  }
}

/**
 * Global reactivity overview
 */
export function getGlobalReactivityOverview() {
  if (!isDevelopment) return null;

  const totalUpdates = reactivityRegistry.size;
  const completedUpdates = Array.from(reactivityRegistry.values()).filter(u => u.stages.visualUpdate);
  const responsiveUpdates = completedUpdates.filter(u =>
    u.renderLatency <= REACTIVITY_THRESHOLDS.PARAMETER_UPDATE_LATENCY
  );

  const totalVisualizations = visualizationProfiles.size;
  const slowVisualizations = Array.from(visualizationProfiles.values()).filter(v =>
    v.avgTime > 16.67
  );

  return {
    totalParameterUpdates: totalUpdates,
    completedReactivityCycles: completedUpdates.length,
    responsivenessRate: totalUpdates > 0 ? (responsiveUpdates.length / totalUpdates * 100).toFixed(1) : 0,
    visualizationProfiles: totalVisualizations,
    problematicVisualizations: slowVisualizations.length,
    performanceGrade: calculateGlobalGrade(responsiveUpdates.length, totalUpdates, slowVisualizations.length)
  };
}

/**
 * Calculate global performance grade
 */
function calculateGlobalGrade(responsiveCount, totalCount, problematicVizCount) {
  if (totalCount === 0) return 'N/A';

  const responsivenessRate = responsiveCount / totalCount;

  if (responsivenessRate >= 0.95 && problematicVizCount === 0) {
    return 'A+';
  } else if (responsivenessRate >= 0.90 && problematicVizCount <= 1) {
    return 'A';
  } else if (responsivenessRate >= 0.80 && problematicVizCount <= 2) {
    return 'B';
  } else if (responsivenessRate >= 0.70 && problematicVizCount <= 3) {
    return 'C';
  } else if (responsivenessRate >= 0.50) {
    return 'D';
  } else {
    return 'F';
  }
}

/**
 * Development-only reactivity health check
 */
export function runReactivityHealthCheck() {
  if (!isDevelopment) return null;

  console.group(`${EMOJI_CLASSIFIERS.HEALTH_CHECK} 🏥 Visualization Reactivity Health Check`);

  const overview = getGlobalReactivityOverview();
  console.log('📊 Global Overview:', overview);

  // Check responsiveness
  if (parseFloat(overview.responsivenessRate) >= 90) {
    console.log(`${EMOJI_CLASSIFIERS.SUCCESS} Excellent responsiveness: ${overview.responsivenessRate}%`);
  } else if (parseFloat(overview.responsibilityRate) >= 70) {
    console.log(`${EMOJI_CLASSIFIERS.WARNING} Acceptable responsiveness: ${overview.responsivenessRate}%`);
  } else {
    console.warn(`${EMOJI_CLASSIFIERS.STALE} Poor responsiveness: ${overview.responsivenessRate}%`);
  }

  // Check visualization performance
  if (overview.problematicVisualizations === 0) {
    console.log(`${EMOJI_CLASSIFIERS.SUCCESS} All visualizations performing well`);
  } else {
    console.warn(`${EMOJI_CLASSIFIERS.WARNING} ${overview.problematicVisualizations} problematic visualizations found`);
  }

  console.log(`📋 Performance Grade: ${overview.performanceGrade}`);
  console.groupEnd();

  return overview;
}