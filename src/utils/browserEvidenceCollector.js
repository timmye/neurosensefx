/**
 * Browser-Based Evidence Collection System
 *
 * Real browser measurements for canvas sizing accuracy validation.
 * Collects concrete evidence from actual browser DOM and canvas measurements.
 *
 * Evidence Types:
 * - Real DOM measurements of containers and canvases
 * - Actual browser canvas dimensions (CSS vs backing store)
 * - Live coordinate system measurements
 * - Real-time responsiveness validation
 *
 * Replaces fake utilization metrics with actual browser evidence.
 */

/**
 * Real browser evidence collector with concrete measurements
 */
export class BrowserEvidenceCollector {
  constructor(displayId, symbol) {
    this.displayId = displayId;
    this.symbol = symbol;
    this.collectionStartTime = performance.now();
    this.evidenceSnapshots = [];
  }

  /**
   * Collect real browser DOM measurements
   *
   * CRITICAL: Actual browser measurements, not simulated or calculated
   */
  collectBrowserEvidence(container, canvas) {
    const snapshot = {
      timestamp: performance.now(),
      displayId: this.displayId,
      symbol: this.symbol,
      evidenceType: 'browser_dom_measurements',
      measurements: {},
      browserInfo: this.getBrowserContext()
    };

    try {
      // Real DOM measurements - these are actual browser values
      snapshot.measurements = {
        // Container measurements from actual DOM
        container: {
          element: !!container,
          offsetWidth: container?.offsetWidth,
          offsetHeight: container?.offsetHeight,
          clientWidth: container?.clientWidth,
          clientHeight: container?.clientHeight,
          scrollWidth: container?.scrollWidth,
          scrollHeight: container?.scrollHeight,
          getBoundingClientRect: container?.getBoundingClientRect ?
            {
              x: container.getBoundingClientRect().x,
              y: container.getBoundingClientRect().y,
              width: container.getBoundingClientRect().width,
              height: container.getBoundingClientRect().height,
              top: container.getBoundingClientRect().top,
              left: container.getBoundingClientRect().left,
              right: container.getBoundingClientRect().right,
              bottom: container.getBoundingClientRect().bottom
            } : null
        },

        // Canvas measurements from actual browser canvas
        canvas: {
          element: !!canvas,
          // Backing store (actual pixel buffer)
          width: canvas?.width,
          height: canvas?.height,
          // CSS dimensions (rendered size)
          clientWidth: canvas?.clientWidth,
          clientHeight: canvas?.clientHeight,
          offsetWidth: canvas?.offsetWidth,
          offsetHeight: canvas?.offsetHeight,
          // Canvas context information
          context2d: canvas?.getContext('2d') ? true : false,
          contextAttributes: canvas?.getContext('2d') ?
            canvas.getContext('2d').canvasAttributes : null
        },

        // Real browser viewport information
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          outerWidth: window.outerWidth,
          outerHeight: window.outerHeight,
          devicePixelRatio: window.devicePixelRatio,
          pageXOffset: window.pageXOffset,
          pageYOffset: window.pageYOffset
        },

        // Real computed styles
        computedStyles: container ? {
          position: window.getComputedStyle(container).position,
          display: window.getComputedStyle(container).display,
          width: window.getComputedStyle(container).width,
          height: window.getComputedStyle(container).height,
          margin: window.getComputedStyle(container).margin,
          padding: window.getComputedStyle(container).padding,
          transform: window.getComputedStyle(container).transform,
          transformOrigin: window.getComputedStyle(container).transformOrigin
        } : null
      };

      // Calculate actual precision from real browser measurements
      snapshot.precisionAnalysis = this.analyzeBrowserPrecision(snapshot.measurements);

      console.log(`📏 [EVIDENCE:${this.displayId}] Browser measurements collected:`);
      console.log(`  Container CSS: ${snapshot.measurements.container.clientWidth}×${snapshot.measurements.container.clientHeight}`);
      console.log(`  Canvas CSS: ${snapshot.measurements.canvas.clientWidth}×${snapshot.measurements.canvas.clientHeight}`);
      console.log(`  Canvas Backing: ${snapshot.measurements.canvas.width}×${snapshot.measurements.canvas.height}`);
      console.log(`  DPR: ${snapshot.measurements.viewport.devicePixelRatio}`);
      console.log(`  CSS Match: ${snapshot.precisionAnalysis.cssMatchExact}`);
      console.log(`  Backing Match: ${snapshot.precisionAnalysis.backingMatchExact}`);

      this.evidenceSnapshots.push(snapshot);
      return snapshot;

    } catch (error) {
      console.error(`❌ [EVIDENCE:${this.displayId}] Browser evidence collection failed:`, error);
      snapshot.error = error.message;
      this.evidenceSnapshots.push(snapshot);
      return snapshot;
    }
  }

  /**
   * Analyze precision from real browser measurements
   */
  analyzeBrowserPrecision(measurements) {
    const { container, canvas, viewport } = measurements;

    if (!container.element || !canvas.element) {
      return {
        isValid: false,
        error: 'Missing container or canvas element',
        cssMatchExact: false,
        backingMatchExact: false
      };
    }

    // CRITICAL: Exact matching criteria - zero tolerance
    const cssMatchExact =
      container.clientWidth === canvas.clientWidth &&
      container.clientHeight === canvas.clientHeight;

    // Calculate expected backing store dimensions
    const dpr = viewport.devicePixelRatio || 1;
    const expectedBackingWidth = canvas.clientWidth * dpr;
    const expectedBackingHeight = canvas.clientHeight * dpr;

    const backingMatchExact =
      Math.abs(canvas.width - expectedBackingWidth) < 1 && // Allow 1px rounding tolerance
      Math.abs(canvas.height - expectedBackingHeight) < 1;

    // Real browser precision analysis
    return {
      cssMatchExact,
      backingMatchExact,
      dimensions: {
        container: { width: container.clientWidth, height: container.clientHeight },
        canvasCss: { width: canvas.clientWidth, height: canvas.clientHeight },
        canvasBacking: { width: canvas.width, height: canvas.height },
        expectedBacking: { width: expectedBackingWidth, height: expectedBackingHeight }
      },
      dprScaleFactors: {
        horizontal: canvas.width / canvas.clientWidth,
        vertical: canvas.height / canvas.clientHeight
      },
      isValid: cssMatchExact && backingMatchExact
    };
  }

  /**
   * Get browser context information
   */
  getBrowserContext() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth
      },
      performance: {
        now: performance.now(),
        timing: performance.timing ? {
          navigationStart: performance.timing.navigationStart,
          loadEventEnd: performance.timing.loadEventEnd,
          domContentLoaded: performance.timing.domContentLoadedEventEnd
        } : null
      }
    };
  }

  /**
   * Collect live coordinate system evidence
   *
   * Tests actual coordinate transformations in real browser context
   */
  collectCoordinateEvidence(canvas, yScale, priceRange) {
    const snapshot = {
      timestamp: performance.now(),
      displayId: this.displayId,
      symbol: this.symbol,
      evidenceType: 'coordinate_system_measurements',
      measurements: {}
    };

    try {
      // Test real coordinate transformations in browser
      const testPrices = [
        priceRange.low,
        priceRange.high,
        (priceRange.low + priceRange.high) / 2,
        priceRange.low + (priceRange.high - priceRange.low) * 0.25,
        priceRange.low + (priceRange.high - priceRange.low) * 0.75
      ];

      snapshot.measurements = {
        canvasArea: {
          width: canvas.clientWidth,
          height: canvas.clientHeight
        },
        priceRange,
        coordinateTransforms: testPrices.map(price => {
          const y = yScale(price);
          return {
            price,
            y,
            isValid: typeof y === 'number' && !isNaN(y) && isFinite(y),
            inBounds: y >= 0 && y <= canvas.clientHeight,
            percentage: ((y / canvas.clientHeight) * 100).toFixed(2)
          };
        })
      };

      // Analyze coordinate precision
      const validTransforms = snapshot.measurements.coordinateTransforms.filter(t => t.isValid);
      const inBoundsTransforms = snapshot.measurements.coordinateTransforms.filter(t => t.inBounds);

      snapshot.measurements.precisionAnalysis = {
        totalTests: testPrices.length,
        validTransforms: validTransforms.length,
        inBoundsTransforms: inBoundsTransforms.length,
        precisionRate: (validTransforms.length / testPrices.length) * 100,
        boundsRate: (inBoundsTransforms.length / testPrices.length) * 100,
        isPrecise: validTransforms.length === testPrices.length && inBoundsTransforms.length === testPrices.length
      };

      console.log(`📐 [EVIDENCE:${this.displayId}] Coordinate system evidence:`);
      console.log(`  Canvas Area: ${snapshot.measurements.canvasArea.width}×${snapshot.measurements.canvasArea.height}`);
      console.log(`  Price Range: ${priceRange.low} - ${priceRange.high}`);
      console.log(`  Precision Rate: ${snapshot.measurements.precisionAnalysis.precisionRate.toFixed(1)}%`);
      console.log(`  Bounds Rate: ${snapshot.measurements.precisionAnalysis.boundsRate.toFixed(1)}%`);
      console.log(`  Is Precise: ${snapshot.measurements.precisionAnalysis.isPrecise}`);

      this.evidenceSnapshots.push(snapshot);
      return snapshot;

    } catch (error) {
      console.error(`❌ [EVIDENCE:${this.displayId}] Coordinate evidence collection failed:`, error);
      snapshot.error = error.message;
      this.evidenceSnapshots.push(snapshot);
      return snapshot;
    }
  }

  /**
   * Collect responsiveness evidence by simulating browser resize
   */
  collectResponsivenessEvidence(container, canvas, resizeCallback) {
    const snapshot = {
      timestamp: performance.now(),
      displayId: this.displayId,
      symbol: this.symbol,
      evidenceType: 'responsiveness_measurements',
      measurements: {
        before: this.collectBrowserEvidence(container, canvas).measurements,
        after: null,
        resizeData: null
      }
    };

    try {
      // Simulate resize if callback provided
      if (resizeCallback && typeof resizeCallback === 'function') {
        const resizeStartTime = performance.now();
        resizeCallback();
        const resizeEndTime = performance.now();

        // Collect measurements after resize
        const afterEvidence = this.collectBrowserEvidence(container, canvas);
        snapshot.measurements.after = afterEvidence.measurements;
        snapshot.measurements.resizeData = {
          duration: resizeEndTime - resizeStartTime,
          maintainedPrecision: afterEvidence.precisionAnalysis?.isValid || false
        };

        console.log(`🔄 [EVIDENCE:${this.displayId}] Responsiveness evidence:`);
        console.log(`  Resize Duration: ${snapshot.measurements.resizeData.duration.toFixed(2)}ms`);
        console.log(`  Precision Maintained: ${snapshot.measurements.resizeData.maintainedPrecision}`);
      }

      this.evidenceSnapshots.push(snapshot);
      return snapshot;

    } catch (error) {
      console.error(`❌ [EVIDENCE:${this.displayId}] Responsiveness evidence collection failed:`, error);
      snapshot.error = error.message;
      this.evidenceSnapshots.push(snapshot);
      return snapshot;
    }
  }

  /**
   * Generate evidence compliance report
   */
  generateEvidenceReport() {
    const totalCollectionTime = performance.now() - this.collectionStartTime;
    const snapshots = this.evidenceSnapshots;

    // Analyze evidence types
    const browserSnapshots = snapshots.filter(s => s.evidenceType === 'browser_dom_measurements');
    const coordinateSnapshots = snapshots.filter(s => s.evidenceType === 'coordinate_system_measurements');
    const responsivenessSnapshots = snapshots.filter(s => s.evidenceType === 'responsiveness_measurements');

    // Calculate compliance rates
    const browserCompliance = browserSnapshots.length > 0 ?
      browserSnapshots.filter(s => s.precisionAnalysis?.isValid).length / browserSnapshots.length * 100 : 0;

    const coordinateCompliance = coordinateSnapshots.length > 0 ?
      coordinateSnapshots.filter(s => s.measurements?.precisionAnalysis?.isPrecise).length / coordinateSnapshots.length * 100 : 0;

    const overallCompliance = (browserCompliance + coordinateCompliance) / 2;

    const report = {
      displayId: this.displayId,
      symbol: this.symbol,
      collectionDuration: totalCollectionTime,
      evidenceSummary: {
        totalSnapshots: snapshots.length,
        browserMeasurements: browserSnapshots.length,
        coordinateMeasurements: coordinateSnapshots.length,
        responsivenessMeasurements: responsivenessSnapshots.length
      },
      complianceRates: {
        browser: browserCompliance,
        coordinate: coordinateCompliance,
        overall: overallCompliance
      },
      overallCompliance: overallCompliance === 100,
      snapshots,
      timestamp: Date.now()
    };

    console.group(`🔬 [EVIDENCE:${this.displayId}] Browser Evidence Report`);
    console.log('Symbol:', this.symbol);
    console.log('Collection Duration:', `${totalCollectionTime.toFixed(2)}ms`);
    console.log('Browser Compliance:', `${browserCompliance.toFixed(1)}%`);
    console.log('Coordinate Compliance:', `${coordinateCompliance.toFixed(1)}%`);
    console.log('Overall Compliance:', `${overallCompliance.toFixed(1)}%`);
    console.log('Overall Result:', report.overallCompliance ? '✅ PERFECT EVIDENCE' : '❌ INSUFFICIENT EVIDENCE');

    if (report.overallCompliance) {
      console.log('🎉 All browser evidence requirements satisfied');
    } else {
      console.warn('⚠️ Browser evidence issues detected');
    }

    console.groupEnd();

    return report;
  }
}

/**
 * Evidence collector registry
 */
const evidenceCollectors = new Map();

/**
 * Get or create evidence collector
 */
export function getEvidenceCollector(displayId, symbol) {
  if (!evidenceCollectors.has(displayId)) {
    evidenceCollectors.set(displayId, new BrowserEvidenceCollector(displayId, symbol));
  }
  return evidenceCollectors.get(displayId);
}

/**
 * Remove evidence collector and generate final report
 */
export function removeEvidenceCollector(displayId) {
  const collector = evidenceCollectors.get(displayId);
  if (collector) {
    const report = collector.generateEvidenceReport();
    evidenceCollectors.delete(displayId);
    return report;
  }
  return null;
}

/**
 * Generate global evidence report
 */
export function generateGlobalEvidenceReport() {
  const collectors = Array.from(evidenceCollectors.values());
  const reports = collectors.map(collector => collector.generateEvidenceReport());

  const globalReport = {
    timestamp: Date.now(),
    totalDisplays: collectors.length,
    perfectDisplays: reports.filter(r => r.overallCompliance).length,
    averageBrowserCompliance: reports.length > 0 ?
      reports.reduce((sum, r) => sum + r.complianceRates.browser, 0) / reports.length : 0,
    averageCoordinateCompliance: reports.length > 0 ?
      reports.reduce((sum, r) => sum + r.complianceRates.coordinate, 0) / reports.length : 0,
    overallAverageCompliance: reports.length > 0 ?
      reports.reduce((sum, r) => sum + r.complianceRates.overall, 0) / reports.length : 0,
    displayReports: reports
  };

  console.group(`🌐 [GLOBAL] Browser Evidence Summary`);
  console.log('Total Displays:', globalReport.totalDisplays);
  console.log('Perfect Displays:', globalReport.perfectDisplays);
  console.log('Average Browser Compliance:', `${globalReport.averageBrowserCompliance.toFixed(1)}%`);
  console.log('Average Coordinate Compliance:', `${globalReport.averageCoordinateCompliance.toFixed(1)}%`);
  console.log('Overall Average Compliance:', `${globalReport.overallAverageCompliance.toFixed(1)}%`);
  console.groupEnd();

  return globalReport;
}

/**
 * Convenience functions for evidence collection
 */
export function collectBrowserEvidence(displayId, container, canvas) {
  const collector = getEvidenceCollector(displayId);
  return collector.collectBrowserEvidence(container, canvas);
}

export function collectCoordinateEvidence(displayId, canvas, yScale, priceRange) {
  const collector = getEvidenceCollector(displayId);
  return collector.collectCoordinateEvidence(canvas, yScale, priceRange);
}