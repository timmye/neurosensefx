<script>
  import { onMount, onDestroy } from 'svelte';
  import interact from 'interactjs';
  import { workspaceActions } from '../stores/workspace.js';
  import { setupCanvas, renderDayRange } from '../lib/visualizers.js';
  export let display;
  let element, interactable, canvas, ctx, ws;

  onMount(() => {
    ctx = setupCanvas(canvas);
    interactable = interact(element).draggable({
      onmove: (e) => workspaceActions.updatePosition(display.id, {x: e.rect.left, y: e.rect.top})
    }).on('tap', () => workspaceActions.bringToFront(display.id));

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:${import.meta.env.DEV ? 8080 : 8081}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => ws.send(JSON.stringify({
      type: 'get_symbol_data_package',
      symbol: display.symbol,
      adrLookbackDays: 14
    }));

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data && (data.high !== undefined || data.bid !== undefined)) {
        const displayData = data.high !== undefined ? data : {
          high: data.bid, low: data.bid, current: data.bid, open: data.bid,
          adrHigh: data.adrHigh || data.bid * 1.01, adrLow: data.adrLow || data.bid * 0.99
        };
        renderDayRange(ctx, displayData, {
          width: canvas.width / window.devicePixelRatio,
          height: canvas.height / window.devicePixelRatio
        });
      }
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

<div class="floating-display" bind:this={element} data-display-id={display.id} style="left: {display.position.x}px; top: {display.position.y}px; z-index: {display.zIndex}; width: {display.size.width}px; height: {display.size.height}px;">
  <div class="header"><span class="symbol">{display.symbol}</span><button class="close" on:click={handleClose}>×</button></div>
  <canvas bind:this={canvas} />
</div>

<style>
  .floating-display{position:absolute;background:#1a1a1a;border:1px solid #333;border-radius:4px;overflow:hidden;user-select:none}
  .header{display:flex;justify-content:space-between;align-items:center;height:40px;background:#2a2a2a;padding:0 12px;cursor:move}
  .symbol{color:#fff;font-weight:bold;font-size:14px}
  .close{background:none;border:none;color:#999;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:3px}
  .close:hover{background:#3a3a3a;color:#fff}
  canvas{display:block;background:#0a0a0a;width:100%;height:calc(100% - 40px)}
</style>