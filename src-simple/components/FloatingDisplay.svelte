<script>
  import { onMount, onDestroy } from 'svelte';
  import interact from 'interactjs';
  import { workspaceActions } from '../stores/workspace.js';
  import { setupCanvas, renderDayRange, renderErrorMessage } from '../lib/visualizers.js';
  export let display;
  let element, interactable, canvas, ctx, ws, lastData = null;

  onMount(() => {
    const formattedSymbol = display.symbol.replace('/', '').toUpperCase();
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:${import.meta.env.DEV ? 8080 : 8081}`;

    // Set canvas dimensions FIRST, then setup
    if (canvas) {
      canvas.width = display.size.width;
      canvas.height = display.size.height - 40;
      ctx = setupCanvas(canvas);
    }

    // Show initial loading state with system transparency
    if (ctx) {
      const connectingMsg = `CONNECTING: ${formattedSymbol} -> ${wsUrl} [${new Date().toISOString()}]`;
      renderErrorMessage(ctx, connectingMsg, {
        width: display.size.width,
        height: display.size.height - 40
      });
    }

    interactable = interact(element).draggable({
      onmove: (e) => workspaceActions.updatePosition(display.id, {x: e.rect.left, y: e.rect.top})
    }).resizable({
      edges: { right: true, bottom: true },
      listeners: {
        move (event) {
          const newSize = { width: event.rect.width, height: event.rect.height };
          workspaceActions.updateSize(display.id, newSize);
          canvas.width = newSize.width;
          canvas.height = newSize.height - 40;
          ctx = setupCanvas(canvas);
          if (lastData) {
            renderDayRange(ctx, lastData, {
              width: newSize.width,
              height: newSize.height - 40
            });
          } else {
            renderErrorMessage(ctx, 'No data reaching display', {
              width: newSize.width,
              height: newSize.height - 40
            });
          }
        }
      },
      modifiers: [interact.modifiers.restrictSize({ min: { width: 150, height: 80 } })],
      inertia: true
    }).on('tap', () => workspaceActions.bringToFront(display.id));

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[SYSTEM] WebSocket OPEN - Requesting symbol:', formattedSymbol);
      const request = {
        type: 'get_symbol_data_package',
        symbol: formattedSymbol,
        adrLookbackDays: 14
      };
      ws.send(JSON.stringify(request));
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === 'error') {
          console.log('[SYSTEM] Backend ERROR - Message:', data.message);
          renderErrorMessage(ctx, `BACKEND_ERROR: ${data.message}`, {
            width: canvas.width,
            height: canvas.height
          });
          return;
        }

        const displayData = data.type === 'symbolDataPackage' ? {
          high: data.todaysHigh || data.projectedAdrHigh || 1.0,
          low: data.todaysLow || data.projectedAdrLow || 1.0,
          current: data.bid || data.ask || data.initialPrice || data.todaysOpen || 1.0,
          open: data.todaysOpen || data.initialPrice || 1.0,
          adrHigh: data.projectedAdrHigh || (data.todaysHigh || 1.0) * 1.01,
          adrLow: data.projectedAdrLow || (data.todaysLow || 1.0) * 0.99
        } : data.type === 'tick' && data.symbol === formattedSymbol ? {
          high: Math.max(lastData?.high || 0, data.ask || data.bid || 0),
          low: Math.min(lastData?.low || Infinity, data.bid || data.ask || Infinity),
          current: data.bid || data.ask || lastData?.current || 1.0,
          open: lastData?.open || data.bid || data.ask || 1.0,
          adrHigh: lastData?.adrHigh || (data.bid || data.ask || 1.0) * 1.01,
          adrLow: lastData?.adrLow || (data.bid || data.ask || 1.0) * 0.99
        } : null;

        if (displayData) {
          lastData = displayData;
          const canvasSize = {
            width: canvas.width,
            height: canvas.height
          };
          console.log('[SYSTEM] Rendering day range - Symbol:', displayData.symbol || formattedSymbol, 'High/Low:', displayData.high.toFixed(5), '/', displayData.low.toFixed(5));
          renderDayRange(ctx, displayData, canvasSize);
        } else if (data.type !== 'status' && data.type !== 'ready' && data.type !== 'error') {
          console.log('[SYSTEM] Unhandled message type - Type:', data.type);
        }
      } catch (error) {
        renderErrorMessage(ctx, `JSON_PARSE_ERROR: ${error.message}`, {
          width: canvas.width,
          height: canvas.height
        });
      }
    };

    ws.onerror = (error) => {
      const errorDetails = error ? {
        message: error.message || 'No message',
        type: error.type || 'Unknown type',
        code: error.code || 'No code',
        error: error.error || 'No error object'
      } : { error: 'No error object provided' };

      console.error('[SYSTEM] WebSocket ERROR - Details:', errorDetails);

      const canvasErrorMessage = `WEBSOCKET_ERROR: ${errorDetails.message} (Type: ${errorDetails.type}, Code: ${errorDetails.code})`;
      lastData = null;
      if (ctx) {
        renderErrorMessage(ctx, canvasErrorMessage, {
          width: canvas.width,
          height: canvas.height
        });
      }
    };

    ws.onclose = (event) => {
      const closeDetails = {
        code: event.code || 'Unknown code',
        reason: event.reason || 'No reason provided',
        wasClean: event.wasClean || false
      };

      console.log('[SYSTEM] WebSocket CLOSED - Code:', closeDetails.code, 'Reason:', closeDetails.reason, 'Clean:', closeDetails.wasClean);

      if (ctx && !lastData) {
        const canvasErrorMessage = `CONNECTION_CLOSED: Code ${closeDetails.code} - ${closeDetails.reason} (Clean: ${closeDetails.wasClean})`;
        renderErrorMessage(ctx, canvasErrorMessage, {
          width: canvas.width,
          height: canvas.height
        });
      }
    };
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