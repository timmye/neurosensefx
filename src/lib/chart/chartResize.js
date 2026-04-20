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
 * Debug helper: logs canvas dimensions AND ctx transform inside a chart container.
 * The ctx transform is the key diagnostic — if it diverges from identity at DPR=1,
 * KLineCharts' internal rendering is corrupted.
 */
export function debugCanvasState(chartContainer, label) {
  if (!chartContainer) return;
  const dpr = window.devicePixelRatio || 1;

  console.group(`[CANVAS-DPR] ${label}`);

  console.log(`devicePixelRatio: ${dpr}`);
  console.log(
    `container: clientWidth=${chartContainer.clientWidth}, clientHeight=${chartContainer.clientHeight}, ` +
    `style.width="${chartContainer.style.width}", style.height="${chartContainer.style.height}"`
  );

  const canvases = chartContainer.querySelectorAll('canvas');
  console.log(`canvas count: ${canvases.length}`);

  canvases.forEach((c, i) => {
    const expectedW = c.clientWidth * dpr;
    const expectedH = c.clientHeight * dpr;
    const wOk = c.width === expectedW;
    const hOk = c.height === expectedH;

    // Check ctx transform — at DPR=1 this should be identity {a:1,b:0,c:0,d:1,e:0,f:0}
    const ctx = c.getContext('2d');
    const t = ctx.getTransform();

    console.log(
      `canvas[${i}]: clientW=${c.clientWidth} clientH=${c.clientHeight} ` +
      `bufW=${c.width} bufH=${c.height} ` +
      `transform={a:${t.a.toFixed(3)} b:${t.b} c:${t.c} d:${t.d.toFixed(3)} e:${t.e.toFixed(1)} f:${t.f.toFixed(1)}}`
    );

    if (!wOk || !hOk) {
      console.warn(`  DIMS MISMATCH: got ${c.width}x${c.height} expected ${expectedW}x${expectedH}`);
    }
    if (Math.abs(t.a - dpr) > 0.01 || Math.abs(t.d - dpr) > 0.01) {
      console.warn(`  TRANSFORM CORRUPTED: scale (${t.a}, ${t.d}) expected (${dpr}, ${dpr})`);
    }
  });

  console.groupEnd();
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
    console.log(`[CANVAS-DPR] forceCanvasDPRRefresh: ${fixed}/${canvases.length} canvases fixed`);
  }
}
