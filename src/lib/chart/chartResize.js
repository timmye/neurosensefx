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
