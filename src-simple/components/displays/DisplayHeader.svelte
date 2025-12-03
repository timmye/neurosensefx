<script>
  export let symbol, connectionStatus, showMarketProfile, onClose, onFocus;
  function handleKeydown(e) { (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onFocus()); }

  $: vizIndicator = showMarketProfile ? 'MP' : 'DR';
  $: vizTitle = showMarketProfile ? 'Market Profile ON' : 'Day Range';
</script>

<div class="header" role="button" tabindex="0" on:click={onFocus} on:keydown={handleKeydown}>
  <span class="symbol">{symbol}</span>
  <span class="viz-indicator" title={vizTitle}>{vizIndicator}</span>
  <div class="connection-status"
       class:connected={connectionStatus === 'connected'}
       class:connecting={connectionStatus === 'connecting'}
       class:disconnected={connectionStatus === 'disconnected'}
       class:error={connectionStatus === 'error'}
       title="Connection status: {connectionStatus}"></div>
  <button class="close" on:click={onClose} aria-label="Close display">×</button>
</div>

<style>
  .header{display:flex;justify-content:space-between;align-items:center;height:40px;background:#2a2a2a;padding:0 12px;cursor:move;outline:none}
  .symbol{color:#fff;font-weight:bold;font-size:14px;pointer-events:none}
  .viz-indicator{color:#4a9eff;font-size:10px;font-weight:bold;background:#1a1a1a;padding:2px 4px;border-radius:2px;margin-left:8px;text-transform:uppercase;letter-spacing:0.5px}
  .close{background:none;border:none;color:#999;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:3px;transition:background .2s ease,color .2s ease}
  .close:hover,.close:focus{background:#3a3a3a;color:#fff}
  .close:focus{outline:1px solid #4a9eff}
  .connection-status{width:8px;height:8px;border-radius:50%;margin-right:8px;flex-shrink:0;transition:background-color .3s ease}
  .connection-status.connected{background-color:#4CAF50;box-shadow:0 0 4px rgba(76,175,80,.5)}
  .connection-status.connecting{background-color:#FF9800;box-shadow:0 0 4px rgba(255,152,0,.5);animation:pulse 1s infinite}
  .connection-status.disconnected{background-color:#9E9E9E}
  .connection-status.error{background-color:#F44336;box-shadow:0 0 4px rgba(244,67,54,.5)}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
</style>