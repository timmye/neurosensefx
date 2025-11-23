<script>
  import { shortcutStore, setShowHelp } from '../stores/shortcutStore.js';
  import { onMount } from 'svelte';

  // Only use reactive statement - no manual subscription to avoid conflicts
  $: showHelp = $shortcutStore.showHelp;

  // Debug logging
  $: {
    console.log('🧪 TestSimpleOverlay: Reactive statement showHelp =', showHelp);
  }

  // Test manual function
  function testManualShow() {
    console.log('🧪 TestSimpleOverlay: Manual setShowHelp(true) called');
    setShowHelp(true);
  }
</script>

<!-- Test button for manual triggering -->
<button on:click={testManualShow} style="
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 99998;
  padding: 10px;
  background: green;
  color: white;
  border: none;
  cursor: pointer;
">TEST MANUAL SHOW</button>

<!-- Simple test overlay -->
{#if showHelp}
  <div class="test-overlay" style="
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 0, 0, 0.8);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <h1 style="color: white; font-size: 48px;">TEST OVERLAY WORKING!</h1>
  </div>
{/if}