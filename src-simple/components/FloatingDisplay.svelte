<script>
  import { onMount, onDestroy } from 'svelte';
  import interact from 'interactjs';
  import { workspaceActions } from '../stores/workspace.js';
  import { setupCanvas, renderDayRange } from '../lib/visualizers.js';
  export let display;
  let element, interactable, canvas, ctx, ws, lastData = null;

  onMount(() => {
    ctx = setupCanvas(canvas);
    const formattedSymbol = display.symbol.replace('/', '');

    interactable = interact(element).draggable({
      onmove: (e) => workspaceActions.updatePosition(display.id, {x: e.rect.left, y: e.rect.top})
    }).resizable({
      edges: { right: true, bottom: true },
      listeners: {
        move (event) {
          const newSize = { width: event.rect.width, height: event.rect.height };
          workspaceActions.updateSize(display.id, newSize);
          canvas.width = newSize.width; canvas.height = newSize.height - 40;
          ctx = setupCanvas(canvas);
          if (lastData) renderDayRange(ctx, lastData, {
            width: canvas.width / window.devicePixelRatio,
            height: canvas.height / window.devicePixelRatio
          });
        }
      },
      modifiers: [interact.modifiers.restrictSize({ min: { width: 150, height: 80 } })],
      inertia: true
    }).on('tap', () => workspaceActions.bringToFront(display.id));

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:${import.meta.env.DEV ? 8080 : 8081}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => ws.send(JSON.stringify({
      type: 'get_symbol_data_package', symbol: formattedSymbol, adrLookbackDays: 14
    }));

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      const displayData = data.type === 'symbolDataPackage' ? {
        high: data.todaysHigh, low: data.todaysLow, current: data.initialPrice, open: data.todaysOpen,
        adrHigh: data.projectedAdrHigh, adrLow: data.projectedAdrLow
      } : data.type === 'tick' && data.symbol === formattedSymbol ? {
        high: data.bid, low: data.bid, current: data.bid, open: data.bid,
        adrHigh: data.bid * 1.01, adrLow: data.bid * 0.99
      } : null;

      if (displayData) {
        lastData = displayData;
        renderDayRange(ctx, displayData, {
          width: canvas.width / window.devicePixelRatio,
          height: canvas.height / window.devicePixelRatio
        });
      }
    };

    ws.onerror = () => {
      lastData = { high: 1.1000, low: 1.0900, current: 1.0950, open: 1.0925, adrHigh: 1.1100, adrLow: 1.0800 };
      renderDayRange(ctx, lastData, {
        width: canvas.width / window.devicePixelRatio,
        height: canvas.height / window.devicePixelRatio
      });
    };

    if (canvas) {
      canvas.width = display.size.width;
      canvas.height = display.size.height - 40;
    }
  });

  onDestroy(() => {
    interactable?.unset();
    ws?.close();
  });

  function handleClose() { workspaceActions.removeDisplay(display.id); }
</script>

<div class="floating-display" bind:this={element} data-display-id={display.id}
     style="left: {display.position.x}px; top: {display.position.y}px; z-index: {display.zIndex};
            width: {display.size.width}px; height: {display.size.height}px;">
  <div class="header"><span class="symbol">{display.symbol}</span><button class="close" on:click={handleClose}>×</button></div>
  <canvas bind:this={canvas} />
  <div class="resize-handle"></div>
</div>

<style>
  .floating-display{position:absolute;background:#1a1a1a;border:1px solid #333;border-radius:4px;overflow:hidden;user-select:none}
  .header{display:flex;justify-content:space-between;align-items:center;height:40px;background:#2a2a2a;padding:0 12px;cursor:move}
  .symbol{color:#fff;font-weight:bold;font-size:14px}
  .close{background:none;border:none;color:#999;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:3px}
  .close:hover{background:#3a3a3a;color:#fff}
  canvas{display:block;background:#0a0a0a;width:100%;height:calc(100% - 40px)}
  .resize-handle{position:absolute;right:0;bottom:0;width:16px;height:16px;background:linear-gradient(135deg,transparent 50%,#555 50%);cursor:se-resize;opacity:0.6}
  .resize-handle:hover{opacity:1}
</style>