/**
 * Chart resize coalescing — debounces resize/applyBarSpace/scrollToRealTime
 * into a single rAF to prevent double-rendering when data apply coincides
 * with ResizeObserver fire.
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
    chart.resize();
    applyBarSpace();
    chart.scrollToRealTime();
    if (pendingDataApplyRef.value) {
      const data = pendingDataApplyRef.value;
      pendingDataApplyRef.value = null;
      chart.applyNewData(data);
      requestAnimationFrame(() => {
        if (chart) {
          chart.resize();
          applyBarSpace();
          chart.scrollToRealTime();
        }
      });
    }
  });
}

export function cancelScheduledResize(resizeState) {
  if (resizeState.rafId) {
    cancelAnimationFrame(resizeState.rafId);
    resizeState.rafId = null;
  }
}
