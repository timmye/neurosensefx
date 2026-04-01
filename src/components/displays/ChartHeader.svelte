<script>
  export let symbol, connectionStatus, isMinimized, onClose, onFocus, onRefresh, onMinimize;

  let showHeader = true;
  let hideTimeout = null;

  function handleKeydown(e) {
    (e.key.toLowerCase() === 'enter' || e.key === ' ') && (e.preventDefault(), onFocus());
  }

  function handleTriggerEnter() {
    clearTimeout(hideTimeout);
    showHeader = true;
  }

  function handleTriggerLeave() {
    hideTimeout = setTimeout(() => {
      showHeader = false;
    }, 800);
  }

  function handleHeaderEnter() {
    clearTimeout(hideTimeout);
  }

  function handleHeaderLeave() {
    hideTimeout = setTimeout(() => {
      showHeader = false;
    }, 100);
  }
</script>

<!-- 20px invisible trigger zone -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="trigger-zone" role="presentation" on:mouseenter={handleTriggerEnter} on:mouseleave={handleTriggerLeave}></div>

<!-- 40px visible header display -->
{#if showHeader || isMinimized}
  <div
    class="header"
    role="button"
    tabindex="0"
    on:click={onFocus}
    on:keydown={handleKeydown}
    on:mouseenter={handleHeaderEnter}
    on:mouseleave={handleHeaderLeave}
  >
    <span class="symbol">{symbol}</span>
    <div class="connection-status"
         class:connected={connectionStatus === 'connected'}
         class:connecting={connectionStatus === 'connecting'}
         class:disconnected={connectionStatus === 'disconnected'}
         class:error={connectionStatus === 'error'}
         title="Connection status: {connectionStatus}"></div>
    <button class="refresh" on:click={onRefresh} aria-label="Refresh chart" title="Refresh chart">↻</button>
    <button class="minimize" on:click={onMinimize} aria-label="Minimize chart" title="Minimize chart">
      {isMinimized ? '⎯' : '⌄'}
    </button>
    <button class="close" on:click={onClose} aria-label="Close chart">×</button>
  </div>
{/if}

<style>
  :root {
    --font-symbol: 16px;
    --font-ui-elements: 12px;
    --font-buttons: 14px;
  }

  .trigger-zone {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 20px;
    z-index: 5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 40px;
    background: rgba(42, 42, 42, 0.95);
    backdrop-filter: blur(4px);
    padding: 0 4px;
    cursor: move;
    outline: none;
    z-index: 10;
    transition: opacity 0.2s ease, transform 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .header > * {
    pointer-events: auto;
  }

  .symbol {
    color: #fff;
    font-weight: 600;
    font-size: var(--font-symbol);
    pointer-events: none;
  }

  .connection-status {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 6px;
    flex-shrink: 0;
    transition: background-color 0.3s ease;
  }

  .connection-status.connected {
    background-color: #4CAF50;
    box-shadow: 0 0 4px rgba(76, 175, 80, 0.5);
  }

  .connection-status.connecting {
    background-color: #FF9800;
    box-shadow: 0 0 4px rgba(255, 152, 0, 0.5);
    animation: pulse 1s infinite;
  }

  .connection-status.disconnected {
    background-color: #9E9E9E;
  }

  .connection-status.error {
    background-color: #F44336;
    box-shadow: 0 0 4px rgba(244, 67, 54, 0.5);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .refresh {
    background: none;
    border: none;
    color: #999;
    font-size: 11px;
    cursor: pointer;
    padding: 2px 3px;
    border-radius: 2px;
    transition: background 0.2s ease, color 0.2s ease;
    line-height: 1;
  }

  .refresh:hover,
  .refresh:focus {
    background: #3a3a3a;
    color: #4a9eff;
  }

  .refresh:focus {
    outline: 1px solid #4a9eff;
  }

  .minimize {
    background: none;
    border: none;
    color: #999;
    font-size: 14px;
    cursor: pointer;
    padding: 2px 3px;
    border-radius: 2px;
    transition: background 0.2s ease, color 0.2s ease;
    line-height: 1;
    margin-right: 2px;
  }

  .minimize:hover,
  .minimize:focus {
    background: #3a3a3a;
    color: #4a9eff;
  }

  .minimize:focus {
    outline: 1px solid #4a9eff;
  }

  .close {
    background: none;
    border: none;
    color: #999;
    font-size: 14px;
    cursor: pointer;
    padding: 2px 3px;
    border-radius: 2px;
    transition: background 0.2s ease, color 0.2s ease;
    line-height: 1;
  }

  .close:hover,
  .close:focus {
    background: #3a3a3a;
    color: #fff;
  }

  .close:focus {
    outline: 1px solid #4a9eff;
  }
</style>