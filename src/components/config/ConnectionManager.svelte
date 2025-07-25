<script>
  import {
      wsStatus,
      availableSymbols,
      subscriptions,
      connect,
      disconnect,
      subscribe,
      unsubscribe,
  } from '../../data/wsClient.js';

  let symbolInput = 'EURUSD';

  function handleConnect() {
      connect();
  }

  function handleDisconnect() {
      disconnect();
  }

  function handleSubscribe() {
      // Only allow subscribing if a symbol is entered AND the WebSocket is connected
      if (symbolInput && $wsStatus === 'connected') {
          subscribe([symbolInput.toUpperCase()]);
          symbolInput = '';
      } else if ($wsStatus !== 'connected') {
          console.warn('Cannot subscribe, live data source not connected. Current status:', $wsStatus);
      }
  }

  function handleUnsubscribe(symbol) {
      // Only allow unsubscribing if the WebSocket is connected
       if ($wsStatus === 'connected') {
        unsubscribe([symbol]);
       } else {
           console.warn('Cannot unsubscribe, live data source not connected. Current status:', $wsStatus);
       }
  }
</script>

<div class="control-group-container">
    <div class="title-bar">
        <h2 class="group-title">Live Connection</h2>
        <div class="connection-status status-{$wsStatus}">
            {$wsStatus}
        </div>
    </div>
    <div class="control-group">
        {#if $wsStatus === 'disconnected' || $wsStatus === 'error'}
            <button class="action-button connect" on:click={handleConnect}>Connect</button>
        {:else if $wsStatus === 'ws-connecting' || $wsStatus === 'ws-open' || $wsStatus === 'ctrader-connecting'}
            <button class="action-button" disabled>Connecting...</button>
        {:else if $wsStatus === 'connected'}
            <button class="action-button disconnect" on:click={handleDisconnect}>Disconnect</button>
        {/if}
    </div>

    {#if $wsStatus === 'connected'}
        <div class="control-group">
            <label for="symbolInput">Subscribe to Symbol</label>
            <div class="subscription-input">
                <input list="availableSymbols" id="symbolInput" name="symbolInput" bind:value={symbolInput} placeholder="e.g., EURUSD" />
                <datalist id="availableSymbols">
                    {#each $availableSymbols as symbol}
                        <option value={symbol}>{symbol}</option>
                    {/each}
                </datalist>
                <button on:click={handleSubscribe} disabled={!symbolInput}>Subscribe</button>
            </div>
            <div class="subscriptions-list">
                <h4>Active Subscriptions:</h4>
                <ul>
                    {#each $subscriptions as sub (sub)}
                        <li>
                            {sub}
                            <button class="unsubscribe-btn" on:click={() => handleUnsubscribe(sub)}>x</button>
                        </li>
                    {:else}
                        <li>None</li>
                    {/each}
                </ul>
            </div>
        </div>
    {/if}
</div>

<style>
  /* Control Groups and Titles */
  .title-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .group-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #a5b4fc;
  }
  .control-group-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .control-group label {
    font-weight: 500;
    color: #9ca3af;
    font-size: 0.875rem;
    display: flex;
    justify-content: space-between;
  }

  /* Connection Status & Buttons */
  .connection-status {
    padding: 4px 12px;
    border-radius: 12px;
    font-weight: 600;
    text-transform: capitalize;
  }
  .status-disconnected { background-color: #4b5563; color: #d1d5db; }
  .status-ws-connecting { background-color: #f59e0b; color: #1f2937; }
  .status-ws-open { background-color: #f59e0b; color: #1f2937; }
  .status-ctrader-connecting { background-color: #f59e0b; color: #1f2937; }
  .status-connected { background-color: #10b981; color: #d1d5db; }
  .status-error { background-color: #ef4444; color: #fee2e2; }

  .action-button {
    width: 100%;
    padding: 10px;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .action-button.connect { background-color: #2563eb; color: white; }
  .action-button.connect:hover { background-color: #1d4ed8; }
  .action-button.disconnect { background-color: #9ca3af; color: #1f2937; }
  .action-button.disconnect:hover { background-color: #d1d5db; }
  .action-button:disabled { background-color: #374151; color: #9ca3af; cursor: not-allowed; }

  /* Subscription styles */
  .subscription-input {
      display: flex;
  }
  .subscription-input input {
      flex-grow: 1;
      padding: 8px;
      background-color: #374151;
      border: 1px solid #4b5563;
      border-radius: 4px;
      color: #d1d5db;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
  }
  .subscription-input button {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      padding: 8px 12px;
      background-color: #4f46e5;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
  }
  .subscription-input button:disabled {
      background-color: #374151;
      cursor: not-allowed;
  }
  
  .subscriptions-list ul {
      list-style: none;
      padding: 0;
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
  }
  .subscriptions-list li {
      background-color: #374151;
      padding: 5px 10px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.875rem;
  }
  .unsubscribe-btn {
      background-color: #ef4444;
      color: white;
      border: none;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      cursor: pointer;
      line-height: 20px;
      text-align: center;
  }
</style>
