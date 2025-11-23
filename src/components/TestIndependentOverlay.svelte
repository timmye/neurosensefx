<script>
  import { writable } from 'svelte/store';

  // Create our own independent store to test Svelte reactivity
  const testStore = writable(false);
  let showHelp = false;

  // Subscribe to our own store
  testStore.subscribe(value => {
    console.log('🔬 Independent test store update:', value);
    showHelp = value;
  });

  // Test function
  function testToggle() {
    console.log('🔬 Toggling independent test store');
    testStore.update(n => !n);
  }

  // Auto-show after 2 seconds for testing
  setTimeout(() => {
    console.log('🔬 Auto-showing independent overlay');
    testStore.set(true);
  }, 2000);
</script>

<!-- Test button -->
<button on:click={testToggle} style="
  position: fixed;
  top: 60px;
  right: 10px;
  z-index: 99997;
  padding: 10px;
  background: blue;
  color: white;
  border: none;
  cursor: pointer;
">TEST INDEPENDENT TOGGLE</button>

<!-- Independent test overlay -->
{#if showHelp}
  <div class="independent-test-overlay" style="
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 255, 0, 0.8);
    z-index: 99996;
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <h1 style="color: white; font-size: 48px;">INDEPENDENT OVERLAY WORKING!</h1>
  </div>
{/if}