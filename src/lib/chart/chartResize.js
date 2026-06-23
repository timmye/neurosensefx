/**
 * Chart resize coalescing — coalesces resize/applyBarSpace/scrollToRealTime
 * into a single rAF. Applies pending data in the same frame instead of
 * deferring to a second rAF.
 *
 * Per-instance: each chart gets its own resizeState ref, so multiple charts
 * don't clobber each other's rAF guards.
 */

export function createResizeState() {
  return { rafId: null };
}

export function scheduleResize(chart, applyBarSpace, pendingDataApplyRef, resizeState) {
  if (resizeState.rafId) return;
  resizeState.rafId = requestAnimationFrame(() => {
    resizeState.rafId = null;
    if (!chart) return;
    if (pendingDataApplyRef.value) {
      const data = pendingDataApplyRef.value;
      pendingDataApplyRef.value = null;
      chart.applyNewData(data);
    } else {
      chart.resize();
    }
    applyBarSpace();
    chart.scrollToRealTime();
  });
}

export function cancelScheduledResize(resizeState) {
  if (resizeState.rafId) {
    cancelAnimationFrame(resizeState.rafId);
    resizeState.rafId = null;
  }
}

/**
 * Fix canvas buffer/CSS dimension mismatches after KLineCharts' rAF coalescing
 * guard drops buffer updates during rapid layout changes.
 *
 * KLineCharts' Canvas.update() takes the `else` branch (repaint-only, no buffer
 * recalculation) when _width === w, even if canvas.width is stale. This function
 * bypasses KLineCharts entirely by directly setting canvas.width/height to match
 * clientWidth/clientHeight and resetting the transform to identity.
 *
 * At DPR=1 this is safe: buffer dimensions must equal CSS dimensions, and the
 * transform must be identity. KLineCharts' internal _width/_height already hold
 * the correct CSS values — only the buffer and transform are wrong.
 */
export function forceCanvasDPRRefresh(chartContainer) {
  if (!chartContainer) return;
  const canvases = chartContainer.querySelectorAll('canvas');
  const dpr = window.devicePixelRatio || 1;
  let fixed = 0;
  canvases.forEach((c) => {
    const expectedW = Math.round(c.clientWidth * dpr);
    const expectedH = Math.round(c.clientHeight * dpr);
    if (c.width !== expectedW || c.height !== expectedH) {
      c.width = expectedW;
      c.height = expectedH;
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fixed++;
    }
  });
  if (fixed > 0) {
    if (import.meta.env.DEV) {
      console.log(`[CANVAS-DPR] forceCanvasDPRRefresh: ${fixed}/${canvases.length} canvases fixed`);
    }
  }
}
