<script>
  export let symbol, connectionStatus, showMarketProfile, onClose, onFocus, onRefresh, showHeader = true;
  function handleKeydown(e) { (e.key.toLowerCase() === 'enter' || e.key === ' ') && (e.preventDefault(), onFocus()); }

  $: vizIndicator = showMarketProfile ? 'MP' : 'DR';
  $: vizTitle = showMarketProfile ? 'Market Profile ON' : 'Day Range';
</script>

{#if showHeader}
<div class="header" role="button" tabindex="0" on:click={onFocus} on:keydown={handleKeydown}>
  <span class="symbol">{symbol}</span>
  <span class="viz-indicator" title={vizTitle}>{vizIndicator}</span>
  <div class="connection-status"
       class:connected={connectionStatus === 'connected'}
       class:connecting={connectionStatus === 'connecting'}
       class:disconnected={connectionStatus === 'disconnected'}
       class:error={connectionStatus === 'error'}
       title="Connection status: {connectionStatus}"></div>
  <button class="refresh" on:click={onRefresh} aria-label="Refresh display" title="Refresh canvas">↻</button>
  <button class="close" on:click={onClose} aria-label="Close display">×</button>
</div>
{/if}

<style>
  :root{--font-symbol:14px;--font-viz-indicator:10px;--font-ui-elements:12px;--font-buttons:14px}
  .header{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;height:40px;background:rgba(42,42,42,0.95);backdrop-filter:blur(4px);padding:0 12px;cursor:move;outline:none;z-index:10;transition:opacity .2s ease,transform .2s ease}
  .symbol{color:#fff;font-weight:bold;font-size:var(--font-symbol);pointer-events:none}
  .viz-indicator{color:#4a9eff;font-size:var(--font-viz-indicator);font-weight:bold;background:#1a1a1a;padding:2px 4px;border-radius:2px;margin-left:8px;text-transform:uppercase;letter-spacing:0.5px}
  .refresh{background:none;border:none;color:#999;font-size:var(--font-buttons);cursor:pointer;padding:4px 6px;border-radius:3px;transition:background .2s ease,color .2s ease;margin-right:4px}
  .refresh:hover,.refresh:focus{background:#3a3a3a;color:#4a9eff}
  .refresh:focus{outline:1px solid #4a9eff}
  .close{background:none;border:none;color:#999;font-size:var(--font-buttons);cursor:pointer;padding:4px 8px;border-radius:3px;transition:background .2s ease,color .2s ease}
  .close:hover,.close:focus{background:#3a3a3a;color:#fff}
  .close:focus{outline:1px solid #4a9eff}
  .connection-status{width:8px;height:8px;border-radius:50%;margin-right:8px;flex-shrink:0;transition:background-color .3s ease}
  .connection-status.connected{background-color:#4CAF50;box-shadow:0 0 4px rgba(76,175,80,.5)}
  .connection-status.connecting{background-color:#FF9800;box-shadow:0 0 4px rgba(255,152,0,.5);animation:pulse 1s infinite}
  .connection-status.disconnected{background-color:#9E9E9E}
  .connection-status.error{background-color:#F44336;box-shadow:0 0 4px rgba(244,67,54,.5)}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
</style>