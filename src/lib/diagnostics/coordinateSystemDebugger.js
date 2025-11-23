/**
 * [DEBUGGER] Coordinate System and Geometry Analysis Tool
 *
 * TEMPORARY DEBUG FILE - TO BE REMOVED BEFORE FINAL REPORT
 *
 * This utility injects debugging capabilities into FloatingDisplay to analyze:
 * 1. Canvas vs container coordinate system mismatches
 * 2. interact.js coordinate transformations
 * 3. DPR scaling issues
 * 4. Mouse interaction problems
 * 5. Initial positioning offsets
 */

class CoordinateSystemDebugger {
  constructor() {
    this.debugLogs = [];
    this.elementData = new Map();
    this.interactionHistory = [];
    this.active = false;
    this.debugPanel = null;

    console.log('[DEBUGGER:COORDINATE_SYSTEM] Coordinate system debugger initialized');
  }

  /**
   * Activate debugging for a specific FloatingDisplay element
   */
  activateElement(displayId, element, canvas) {
    if (!this.active) {
      this.createDebugPanel();
      this.active = true;
    }

    const elementData = {
      displayId,
      element,
      canvas,
      ctx: canvas?.getContext('2d'),
      initialPosition: null,
      currentPosition: null,
      initialCanvasRect: null,
      currentCanvasRect: null,
      dpr: window.devicePixelRatio || 1,
      interactInstance: null
    };

    this.elementData.set(displayId, elementData);

    this.log(`[DEBUGGER:COORDINATE_SYSTEM] Activated debugging for display: ${displayId}`, 'success');

    // Initial state capture
    this.captureElementState(displayId, 'initial');

    // Add monitoring
    this.addCoordinateMonitoring(displayId);

    return {
      setInteractInstance: (interactInstance) => {
        elementData.interactInstance = interactInstance;
        this.addInteractionMonitoring(displayId, interactInstance);
      }
    };
  }

  /**
   * Create floating debug panel
   */
  createDebugPanel() {
    // Remove existing panel if present
    if (this.debugPanel) {
      this.debugPanel.remove();
    }

    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'coordinate-debugger-panel';
    this.debugPanel.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      width: 400px;
      max-height: 600px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #00ff00;
      border-radius: 5px;
      padding: 10px;
      font-family: 'Courier New', monospace;
      font-size: 10px;
      color: #00ff00;
      z-index: 99999;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
    `;

    this.debugPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #00ff00; padding-bottom: 5px;">
        <h3 style="margin: 0; color: #00ff00;">🔍 COORDINATE DEBUGGER</h3>
        <button onclick="this.parentElement.parentElement.remove()" style="background: #ff0000; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">✕</button>
      </div>
      <div id="coordinate-debug-output"></div>
      <div style="margin-top: 10px; border-top: 1px solid #00ff00; padding-top: 5px;">
        <small>📊 Real-time coordinate system analysis</small>
      </div>
    `;

    document.body.appendChild(this.debugPanel);
    this.log('[DEBUGGER:COORDINATE_SYSTEM] Debug panel created', 'success');
  }

  /**
   * Log message to debug panel and console
   */
  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const color = {
      'info': '#00ff00',
      'warning': '#ffff00',
      'error': '#ff6600',
      'success': '#00ff00'
    }[type] || '#00ff00';

    console.log(message);

    if (this.debugPanel) {
      const output = this.debugPanel.querySelector('#coordinate-debug-output');
      if (output) {
        const logEntry = document.createElement('div');
        logEntry.style.cssText = `margin-bottom: 3px; color: ${color}; white-space: pre-wrap;`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        output.appendChild(logEntry);

        // Auto-scroll to bottom
        output.scrollTop = output.scrollHeight;

        // Limit log entries
        while (output.children.length > 50) {
          output.removeChild(output.firstChild);
        }
      }
    }

    this.debugLogs.push({ timestamp, message, type });
  }

  /**
   * Capture element state for analysis
   */
  captureElementState(displayId, phase = 'current') {
    const elementData = this.elementData.get(displayId);
    if (!elementData) return;

    const { element, canvas, dpr } = elementData;
    const elementRect = element.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    const state = {
      phase,
      timestamp: performance.now(),
      elementRect: {
        left: elementRect.left,
        top: elementRect.top,
        width: elementRect.width,
        height: elementRect.height,
        right: elementRect.right,
        bottom: elementRect.bottom
      },
      canvasRect: canvasRect ? {
        left: canvasRect.left,
        top: canvasRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
        right: canvasRect.right,
        bottom: canvasRect.bottom
      } : null,
      cssStyle: {
        position: style.position,
        left: style.left,
        top: style.top,
        width: style.width,
        height: style.height,
        transform: style.transform,
        zIndex: style.zIndex
      },
      dpr,
      canvasProperties: canvas ? {
        width: canvas.width,
        height: canvas.height,
        styleWidth: canvas.style.width,
        styleHeight: canvas.style.height
      } : null
    };

    // Store state
    if (phase === 'initial') {
      elementData.initialPosition = state;
    } else {
      elementData.currentPosition = state;
    }

    // Analyze for issues
    this.analyzeElementState(displayId, state);

    return state;
  }

  /**
   * Analyze element state for positioning issues
   */
  analyzeElementState(displayId, state) {
    const { elementRect, canvasRect, cssStyle, canvasProperties, dpr } = state;
    const issues = [];

    // Check 1: Canvas offset from container
    if (canvasRect) {
      const canvasOffsetX = canvasRect.left - elementRect.left;
      const canvasOffsetY = canvasRect.top - elementRect.top;

      if (Math.abs(canvasOffsetX) > 2) {
        issues.push(`🔴 Canvas X offset: ${canvasOffsetX.toFixed(2)}px (should be 0)`);
      }
      if (Math.abs(canvasOffsetY) > 2) {
        issues.push(`🔴 Canvas Y offset: ${canvasOffsetY.toFixed(2)}px (should be 0)`);
      }

      if (Math.abs(canvasOffsetX) <= 2 && Math.abs(canvasOffsetY) <= 2) {
        this.log(`[DEBUGGER:${displayId}:ALIGNMENT] ✅ Canvas properly aligned with container`, 'success');
      }
    }

    // Check 2: CSS vs actual position consistency
    const cssLeft = parseFloat(cssStyle.left);
    const cssTop = parseFloat(cssStyle.top);

    if (Math.abs(elementRect.left - cssLeft) > 1) {
      issues.push(`🔴 CSS left mismatch: CSS=${cssLeft}, Actual=${elementRect.left.toFixed(2)}`);
    }
    if (Math.abs(elementRect.top - cssTop) > 1) {
      issues.push(`🔴 CSS top mismatch: CSS=${cssTop}, Actual=${elementRect.top.toFixed(2)}`);
    }

    // Check 3: DPR scaling issues
    if (canvasProperties) {
      const expectedCanvasWidth = elementRect.width * dpr;
      const expectedCanvasHeight = elementRect.height * dpr;

      const widthDiff = Math.abs(canvasProperties.width - expectedCanvasWidth);
      const heightDiff = Math.abs(canvasProperties.height - expectedCanvasHeight);

      if (widthDiff > 1) {
        issues.push(`🔴 Canvas width DPR scaling: Actual=${canvasProperties.width}, Expected=${expectedCanvasWidth.toFixed(2)}, Diff=${widthDiff.toFixed(2)}`);
      }
      if (heightDiff > 1) {
        issues.push(`🔴 Canvas height DPR scaling: Actual=${canvasProperties.height}, Expected=${expectedCanvasHeight.toFixed(2)}, Diff=${heightDiff.toFixed(2)}`);
      }
    }

    // Check 4: Transform issues
    if (cssStyle.transform && cssStyle.transform !== 'none') {
      issues.push(`🔡 Active transform detected: ${cssStyle.transform}`);
    }

    // Report issues
    if (issues.length > 0) {
      this.log(`[DEBUGGER:${displayId}:ISSUES] ${state.phase.toUpperCase()} state problems detected:\n${issues.join('\n')}`, 'error');
    } else if (state.phase === 'initial') {
      this.log(`[DEBUGGER:${displayId}:INITIAL] ✅ No positioning issues detected in initial state`, 'success');
    }
  }

  /**
   * Add coordinate monitoring to element
   */
  addCoordinateMonitoring(displayId) {
    const elementData = this.elementData.get(displayId);
    if (!elementData) return;

    // Monitor position changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' &&
            (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
          this.captureElementState(displayId, 'mutation');
        }
      });
    });

    observer.observe(elementData.element, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    // Store observer for cleanup
    elementData.observer = observer;

    // Periodic position monitoring
    elementData.monitoringInterval = setInterval(() => {
      this.captureElementState(displayId, 'periodic');
    }, 1000);
  }

  /**
   * Add interaction monitoring for interact.js
   */
  addInteractionMonitoring(displayId, interactInstance) {
    const elementData = this.elementData.get(displayId);
    if (!elementData || !interactInstance) return;

    // Store original interact.js event handlers
    const originalOnstart = interactInstance.options.drag.onstart;
    const originalOnmove = interactInstance.options.drag.onmove;
    const originalOnend = interactInstance.options.drag.onend;

    // Wrap handlers with debugging
    interactInstance.options.drag.onstart = (event) => {
      this.log(`[DEBUGGER:${displayId}:DRAG_START] Interact.js drag start:
        Target: ${event.target.tagName}
        Client: (${event.clientX}, ${event.clientY})
        Page: (${event.pageX}, ${event.pageY})
        Element: ${JSON.stringify(event.rect)}`, 'info');

      // Capture state before drag
      this.captureElementState(displayId, 'drag-start');

      // Call original handler
      if (originalOnstart) originalOnstart(event);
    };

    interactInstance.options.drag.onmove = (event) => {
      // Log every few moves to avoid spam
      if (Math.random() < 0.1) {
        this.log(`[DEBUGGER:${displayId}:DRAG_MOVE] Interact.js drag move:
          Delta: (${event.dx.toFixed(1)}, ${event.dy.toFixed(1)})
          Position: (${event.rect.left.toFixed(1)}, ${event.rect.top.toFixed(1)})
          Snap target: ${event.snap?.target || 'none'}`, 'info');
      }

      // Call original handler
      if (originalOnmove) originalOnmove(event);
    };

    interactInstance.options.drag.onend = (event) => {
      this.log(`[DEBUGGER:${displayId}:DRAG_END] Interact.js drag end:
        Final position: (${event.rect.left.toFixed(1)}, ${event.rect.top.toFixed(1)})
        Duration: ${(performance.now() - this.interactionHistory[0]?.timestamp || 0).toFixed(0)}ms`, 'info');

      // Capture state after drag
      setTimeout(() => {
        this.captureElementState(displayId, 'drag-end');
      }, 100);

      // Call original handler
      if (originalOnend) originalOnend(event);
    };

    this.log(`[DEBUGGER:${displayId}:INTERACT] Interaction monitoring enabled`, 'success');
  }

  /**
   * Check ADR vs canvas alignment issues
   */
  checkAdrAlignment(displayId) {
    const elementData = this.elementData.get(displayId);
    if (!elementData || !elementData.canvas || !elementData.ctx) return;

    const { canvas, ctx } = elementData;

    // Try to read rendered content to detect ADR positioning
    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);

    // Sample pixels at center (where ADR 0 should be)
    try {
      const centerPixel = ctx.getImageData(centerX - 5, centerY - 5, 10, 10);
      const hasCenterContent = centerPixel.data.some((channel, index) => {
        return index % 4 === 3 && channel > 0; // Check alpha channel
      });

      this.log(`[DEBUGGER:${displayId}:ADR_ALIGNMENT] Center area analysis:
        Canvas center: (${centerX}, ${centerY})
        Has content at center: ${hasCenterContent}
        Canvas dimensions: ${canvas.width} × ${canvas.height}`, 'info');

      if (!hasCenterContent) {
        this.log(`[DEBUGGER:${displayId}:ADR_ALIGNMENT] ⚠️ No content detected at canvas center - ADR 0 may be misaligned`, 'warning');
      }

    } catch (error) {
      this.log(`[DEBUGGER:${displayId}:ADR_ALIGNMENT] Error reading canvas content: ${error.message}`, 'error');
    }
  }

  /**
   * Test mouse interaction functionality
   */
  testMouseInteraction(displayId) {
    const elementData = this.elementData.get(displayId);
    if (!elementData) return;

    const { element, canvas } = elementData;

    // Add temporary mouse event listeners
    const mouseHandler = (event) => {
      const rect = element.getBoundingClientRect();
      const canvasRect = canvas?.getBoundingClientRect();

      this.log(`[DEBUGGER:${displayId}:MOUSE] ${event.type}:
        Mouse: (${event.clientX}, ${event.clientY})
        Element: (${rect.left.toFixed(0)}, ${rect.top.toFixed(0)})
        Relative: (${(event.clientX - rect.left).toFixed(0)}, ${(event.clientY - rect.top).toFixed(0)})
        Canvas: ${canvasRect ? `(${canvasRect.left.toFixed(0)}, ${canvasRect.top.toFixed(0)})` : 'N/A'}
        Target: ${event.target.tagName}`, 'info');
    };

    element.addEventListener('click', mouseHandler, true);
    element.addEventListener('mousemove', mouseHandler, true);
    canvas?.addEventListener('click', mouseHandler, true);

    this.log(`[DEBUGGER:${displayId}:MOUSE] Mouse interaction testing enabled - click/move over element`, 'success');

    // Auto-remove after 30 seconds
    setTimeout(() => {
      element.removeEventListener('click', mouseHandler, true);
      element.removeEventListener('mousemove', mouseHandler, true);
      canvas?.removeEventListener('click', mouseHandler, true);
      this.log(`[DEBUGGER:${displayId}:MOUSE] Mouse interaction testing disabled`, 'info');
    }, 30000);
  }

  /**
   * Deactivate debugging for an element
   */
  deactivateElement(displayId) {
    const elementData = this.elementData.get(displayId);
    if (!elementData) return;

    // Clear monitoring
    if (elementData.observer) {
      elementData.observer.disconnect();
    }
    if (elementData.monitoringInterval) {
      clearInterval(elementData.monitoringInterval);
    }

    this.elementData.delete(displayId);
    this.log(`[DEBUGGER:COORDINATE_SYSTEM] Deactivated debugging for display: ${displayId}`, 'info');
  }

  /**
   * Generate analysis report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      elementCount: this.elementData.size,
      elements: [],
      issues: [],
      summary: {
        totalIssues: 0,
        issueTypes: {
          canvasOffset: 0,
          cssMismatch: 0,
          dprScaling: 0,
          transformIssues: 0
        }
      }
    };

    this.elementData.forEach((elementData, displayId) => {
      const elementReport = {
        displayId,
        hasInitialPosition: !!elementData.initialPosition,
        hasCurrentPosition: !!elementData.currentPosition,
        dpr: elementData.dpr,
        hasInteractInstance: !!elementData.interactInstance
      };

      // Analyze issues
      if (elementData.currentPosition) {
        const state = elementData.currentPosition;
        const elementRect = state.elementRect;
        const canvasRect = state.canvasRect;
        const cssStyle = state.cssStyle;

        // Check canvas offset
        if (canvasRect) {
          const canvasOffsetX = canvasRect.left - elementRect.left;
          const canvasOffsetY = canvasRect.top - elementRect.top;

          if (Math.abs(canvasOffsetX) > 2 || Math.abs(canvasOffsetY) > 2) {
            elementReport.canvasOffset = { x: canvasOffsetX, y: canvasOffsetY };
            report.summary.issueTypes.canvasOffset++;
            report.issues.push(`${displayId}: Canvas offset (${canvasOffsetX.toFixed(1)}, ${canvasOffsetY.toFixed(1)})`);
          }
        }

        // Check CSS mismatch
        const cssLeft = parseFloat(cssStyle.left);
        const cssTop = parseFloat(cssStyle.top);

        if (Math.abs(elementRect.left - cssLeft) > 1 || Math.abs(elementRect.top - cssTop) > 1) {
          elementReport.cssMismatch = {
            css: { left: cssLeft, top: cssTop },
            actual: { left: elementRect.left, top: elementRect.top }
          };
          report.summary.issueTypes.cssMismatch++;
          report.issues.push(`${displayId}: CSS position mismatch`);
        }

        // Check DPR scaling
        if (state.canvasProperties) {
          const expectedWidth = elementRect.width * elementData.dpr;
          const expectedHeight = elementRect.height * elementData.dpr;

          const widthDiff = Math.abs(state.canvasProperties.width - expectedWidth);
          const heightDiff = Math.abs(state.canvasProperties.height - expectedHeight);

          if (widthDiff > 1 || heightDiff > 1) {
            elementReport.dprScalingIssue = { widthDiff, heightDiff };
            report.summary.issueTypes.dprScaling++;
            report.issues.push(`${displayId}: DPR scaling issue`);
          }
        }

        // Check transform
        if (cssStyle.transform && cssStyle.transform !== 'none') {
          elementReport.transformIssue = cssStyle.transform;
          report.summary.issueTypes.transformIssues++;
          report.issues.push(`${displayId}: Active transform`);
        }
      }

      report.elements.push(elementReport);
    });

    report.summary.totalIssues = report.issues.length;

    return report;
  }

  /**
   * Clean up all debugging resources
   */
  cleanup() {
    // Deactivate all elements
    this.elementData.forEach((_, displayId) => {
      this.deactivateElement(displayId);
    });

    // Remove debug panel
    if (this.debugPanel) {
      this.debugPanel.remove();
      this.debugPanel = null;
    }

    this.active = false;
    console.log('[DEBUGGER:COORDINATE_SYSTEM] Debugger cleaned up');
  }
}

// Global instance for easy access
window.coordinateDebugger = window.coordinateDebugger || new CoordinateSystemDebugger();

export { CoordinateSystemDebugger };