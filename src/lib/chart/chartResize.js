/**
 * Chart resize coalescing — debounces resize/applyBarSpace/scrollToRealTime
 * into a single rAF to prevent double-rendering when data apply coincides
 * with ResizeObserver fire.
 */

let _resizeRAF = null;

export function scheduleResize(chart, applyBarSpace, pendingDataApplyRef) {
  if (_resizeRAF) return;
  _resizeRAF = requestAnimationFrame(() => {
    _resizeRAF = null;
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

export function cancelScheduledResize() {
  if (_resizeRAF) {
    cancelAnimationFrame(_resizeRAF);
    _resizeRAF = null;
  }
}
