/**
 * Correlation Manager
 *
 * Provides synchronized timestamps and correlation IDs across all log sources
 * to enable unified timeline correlation and causal relationship tracking.
 */

class CorrelationManager {
  constructor() {
    this.startTime = Date.now();
    this.correlationSequence = 0;
    this.activeCorrelations = new Map();
    this.eventTimeline = [];
    this.maxTimelineSize = 5000;

    // Initialize with system startup event
    this.createCorrelation('SYSTEM_STARTUP', 'system', 'System initialization');
  }

  /**
   * Create a new correlation context for tracking related events
   */
  createCorrelation(name, type = 'test', description = '') {
    const correlation = {
      id: `CORR-${++this.correlationSequence}`,
      name,
      type, // 'system', 'test', 'browser', 'build', 'user'
      description,
      startTime: Date.now(),
      endTime: null,
      events: [],
      parentCorrelation: null,
      childCorrelations: [],
      metadata: {}
    };

    this.activeCorrelations.set(correlation.id, correlation);

    // Add to timeline
    this.addTimelineEvent({
      type: 'correlation_created',
      correlationId: correlation.id,
      timestamp: correlation.startTime,
      data: { name, type, description }
    });

    return correlation;
  }

  /**
   * Start a test correlation with optional parent correlation
   */
  startTestCorrelation(testTitle, parentCorrelationId = null) {
    const correlation = this.createCorrelation(
      `TEST: ${testTitle}`,
      'test',
      `Test execution: ${testTitle}`
    );

    if (parentCorrelationId) {
      const parent = this.activeCorrelations.get(parentCorrelationId);
      if (parent) {
        correlation.parentCorrelation = parentCorrelationId;
        parent.childCorrelations.push(correlation.id);
      }
    }

    return correlation;
  }

  /**
   * Create a browser session correlation
   */
  startBrowserCorrelation(pageId, userAgent = '') {
    return this.createCorrelation(
      `BROWSER: ${pageId}`,
      'browser',
      `Browser session: ${pageId} (${userAgent})`
    );
  }

  /**
   * Create a build process correlation
   */
  startBuildCorrelation(buildCommand = '') {
    return this.createCorrelation(
      'BUILD: Vite Dev Server',
      'build',
      `Build process: ${buildCommand}`
    );
  }

  /**
   * Add an event to a correlation context
   */
  addEvent(correlationId, eventType, eventData, severity = 'info') {
    const correlation = this.activeCorrelations.get(correlationId);
    if (!correlation) {
      console.warn(`Correlation not found: ${correlationId}`);
      return null;
    }

    const eventTimestamp = Date.now();
    const event = {
      id: this.generateEventId(),
      correlationId,
      eventType,
      severity,
      timestamp: eventTimestamp,
      relativeTime: eventTimestamp - correlation.startTime,
      data: eventData,
      metadata: {
        thread: 'main', // Can be extended for multi-threaded scenarios
        source: 'correlation_manager'
      }
    };

    correlation.events.push(event);

    // Add to global timeline
    this.addTimelineEvent({
      type: 'correlation_event',
      correlationId,
      eventId: event.id,
      timestamp: event.timestamp,
      eventType,
      severity,
      data: eventData
    });

    return event;
  }

  /**
   * End a correlation context
   */
  endCorrelation(correlationId, result = 'completed', finalData = {}) {
    const correlation = this.activeCorrelations.get(correlationId);
    if (!correlation) return null;

    correlation.endTime = Date.now();
    correlation.duration = correlation.endTime - correlation.startTime;
    correlation.result = result;

    this.addEvent(correlationId, 'correlation_ended', {
      result,
      duration: correlation.duration,
      eventCount: correlation.events.length,
      ...finalData
    });

    // Add to timeline
    this.addTimelineEvent({
      type: 'correlation_ended',
      correlationId,
      timestamp: correlation.endTime,
      data: { result, duration: correlation.duration }
    });

    return correlation;
  }

  /**
   * Add event to global timeline
   */
  addTimelineEvent(timelineEvent) {
    timelineEvent.globalSequence = this.eventTimeline.length;
    this.eventTimeline.push(timelineEvent);

    // Trim timeline if it gets too large
    if (this.eventTimeline.length > this.maxTimelineSize) {
      this.eventTimeline.shift();
    }
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `EVENT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Get formatted timestamp with correlation context
   */
  getFormattedTimestamp(includeRelative = false) {
    const now = Date.now();
    const elapsed = now - this.startTime;
    const isoTime = new Date(now).toISOString();

    if (includeRelative) {
      return `[${isoTime}][+${elapsed}ms]`;
    }

    return `[${isoTime}][+${elapsed}ms]`;
  }

  /**
   * Get correlation chain for context
   */
  getCorrelationChain(correlationId) {
    const chain = [];
    let current = this.activeCorrelations.get(correlationId);

    while (current) {
      chain.unshift({
        id: current.id,
        name: current.name,
        type: current.type,
        startTime: current.startTime
      });
      current = current.parentCorrelation
        ? this.activeCorrelations.get(current.parentCorrelation)
        : null;
    }

    return chain;
  }

  /**
   * Find overlapping correlations (useful for debugging concurrency)
   */
  getOverlappingCorrelations(timestamp) {
    const overlapping = [];

    for (const [id, correlation] of this.activeCorrelations) {
      if (correlation.startTime <= timestamp &&
          (!correlation.endTime || correlation.endTime >= timestamp)) {
        overlapping.push(correlation);
      }
    }

    return overlapping;
  }

  /**
   * Get events in a time range
   */
  getEventsInTimeRange(startTime, endTime) {
    return this.eventTimeline.filter(event =>
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  /**
   * Get correlation summary statistics
   */
  getCorrelationSummary(correlationId) {
    const correlation = this.activeCorrelations.get(correlationId);
    if (!correlation) return null;

    const eventsByType = {};
    const eventsBySeverity = {};

    correlation.events.forEach(event => {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    });

    return {
      id: correlation.id,
      name: correlation.name,
      type: correlation.type,
      startTime: correlation.startTime,
      endTime: correlation.endTime,
      duration: correlation.duration,
      eventCount: correlation.events.length,
      eventsByType,
      eventsBySeverity,
      childCorrelationCount: correlation.childCorrelations.length
    };
  }

  /**
   * Find causal relationships between events
   */
  findCausalRelationships(sourceCorrelationId, maxDelay = 5000) {
    const source = this.activeCorrelations.get(sourceCorrelationId);
    if (!source || !source.endTime) return [];

    const causalEvents = [];
    const thresholdTime = source.endTime + maxDelay;

    // Find events that happened after this correlation ended
    this.eventTimeline.forEach(event => {
      if (event.timestamp > source.endTime && event.timestamp <= thresholdTime) {
        // Check if this could be causally related
        const delay = event.timestamp - source.endTime;
        causalEvents.push({
          ...event,
          causalDelay: delay,
          confidence: this.calculateCausalConfidence(source, event, delay)
        });
      }
    });

    return causalEvents.sort((a, b) => a.causalDelay - b.causalDelay);
  }

  /**
   * Calculate confidence score for causal relationship
   */
  calculateCausalConfidence(sourceCorrelation, event, delay) {
    let confidence = 1.0;

    // Reduce confidence for longer delays
    if (delay > 1000) confidence -= 0.2;
    if (delay > 3000) confidence -= 0.3;

    // Boost confidence for related event types
    const relatedEventTypes = {
      'test': ['browser', 'user'],
      'build': ['browser', 'system'],
      'browser': ['user', 'system']
    };

    const sourceType = sourceCorrelation.type;
    if (relatedEventTypes[sourceType] &&
        relatedEventTypes[sourceType].includes(event.correlationId?.split('-')[0])) {
      confidence += 0.2;
    }

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Export correlation data for analysis
   */
  exportCorrelationData() {
    const correlations = Array.from(this.activeCorrelations.values()).map(correlation => ({
      ...correlation,
      summary: this.getCorrelationSummary(correlation.id),
      causalEvents: correlation.endTime ? this.findCausalRelationships(correlation.id) : []
    }));

    return {
      metadata: {
        startTime: this.startTime,
        totalCorrelations: correlations.length,
        totalEvents: this.eventTimeline.length,
        exportTime: Date.now()
      },
      correlations,
      timeline: this.eventTimeline
    };
  }

  /**
   * Clean up old correlations to prevent memory leaks
   */
  cleanup(maxAge = 300000) { // 5 minutes default
    const cutoffTime = Date.now() - maxAge;
    const toRemove = [];

    for (const [id, correlation] of this.activeCorrelations) {
      if (correlation.endTime && correlation.endTime < cutoffTime) {
        toRemove.push(id);
      }
    }

    toRemove.forEach(id => this.activeCorrelations.delete(id));

    return toRemove.length;
  }

  /**
   * Get system health metrics
   */
  getHealthMetrics() {
    const activeCorrelations = Array.from(this.activeCorrelations.values()).filter(c => !c.endTime);
    const completedCorrelations = Array.from(this.activeCorrelations.values()).filter(c => c.endTime);

    return {
      uptime: Date.now() - this.startTime,
      totalCorrelations: this.activeCorrelations.size,
      activeCorrelations: activeCorrelations.length,
      completedCorrelations: completedCorrelations.length,
      totalEvents: this.eventTimeline.length,
      averageEventsPerCorrelation: completedCorrelations.length > 0
        ? completedCorrelations.reduce((sum, c) => sum + c.events.length, 0) / completedCorrelations.length
        : 0
    };
  }
}

module.exports = CorrelationManager;