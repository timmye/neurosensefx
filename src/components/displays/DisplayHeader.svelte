<script>
  import IconButton from '../IconButton.svelte';

  export let symbol, connectionStatus, showMarketProfile, onClose, onFocus, onRefresh, initiallyVisible = false, source = 'ctrader';
  export let minimal = false; // symbol + close only (e.g. Headlines widget)

  let showHeader = initiallyVisible;
  let hideTimeout = null;

  function handleKeydown(e) { (e.key.toLowerCase() === 'enter' || e.key === ' ') && (e.preventDefault(), onFocus()); }

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

  $: vizIndicator = showMarketProfile ? 'MP' : 'DR';
  $: vizTitle = showMarketProfile ? 'Market Profile ON' : 'Day Range';
  $: sourceLabel = source === 'tradingview' ? 'TV' : 'cT';
  $: sourceTitle = source === 'tradingview' ? 'TradingView' : 'cTrader';
  // Combined badge: "MP-cT" or "DR-TV"
  $: combinedBadge = `${vizIndicator}/${sourceLabel}`;
  $: combinedTitle = `${vizTitle} • ${sourceTitle}`;
</script>

{#if minimal}
  <!-- Minimal header: symbol + close only, always visible (no trigger/badge/dot/refresh) -->
  <div class="header minimal">
    <span class="symbol">{symbol}</span>
    <IconButton variant="subtle" label="Close" title="Close" on:click={onClose}>×</IconButton>
  </div>
{:else}
  <!-- 20px invisible trigger zone -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="trigger-zone" role="presentation" on:mouseenter={handleTriggerEnter} on:mouseleave={handleTriggerLeave}></div>

  <!-- 40px visible header display -->
  {#if showHeader}
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
      <span class="combined-badge" title={combinedTitle}>{combinedBadge}</span>
      <div class="connection-status"
           class:connected={connectionStatus === 'connected'}
           class:connecting={connectionStatus === 'connecting'}
           class:disconnected={connectionStatus === 'disconnected'}
           class:error={connectionStatus === 'error'}
           title="Connection status: {connectionStatus}"></div>
      <IconButton variant="ghost" label="Refresh display" title="Refresh canvas" fontSize="var(--fs-11)" on:click={onRefresh}>↻</IconButton>
      <IconButton variant="subtle" label="Close display" on:click={onClose}>×</IconButton>
    </div>
  {/if}
{/if}

<style>
  :root{--font-symbol:16px;--font-viz-indicator:11px;--font-ui-elements:12px;--font-buttons:14px}
  .trigger-zone{position:absolute;top:0;left:0;right:0;height:20px;z-index:5;font-family:var(--font-ui)}
  .header{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;height:40px;background:var(--bg-header);backdrop-filter:blur(4px);padding:0 4px;cursor:move;outline:none;z-index:10;transition:opacity .2s ease,transform .2s ease;font-family:var(--font-ui)}
  .header > * {pointer-events:auto}
  .symbol{color:var(--text-primary);font-weight:600;font-size:var(--font-symbol);pointer-events:none}
  .combined-badge{color:var(--accent);font-size:10px;font-weight:600;background:var(--bg-frame);padding:2px 4px;border-radius:var(--r-sm);margin-left:6px;text-transform:uppercase;letter-spacing:0;white-space:nowrap}
  .connection-status{width:6px;height:6px;border-radius:50%;margin-right:6px;flex-shrink:0;transition:background-color .3s ease}
  .connection-status.connected{background-color:var(--status-ok);box-shadow:0 0 4px rgba(76,175,80,.5)}
  .connection-status.connecting{background-color:var(--status-warn);box-shadow:0 0 4px rgba(255,152,0,.5);animation:pulse 1s infinite}
  .connection-status.disconnected{background-color:var(--status-idle)}
  .connection-status.error{background-color:var(--status-bad);box-shadow:0 0 4px rgba(244,67,54,.5)}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
</style>
