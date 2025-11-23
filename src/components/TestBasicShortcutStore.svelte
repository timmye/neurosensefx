<script>
  // Only import the basic store, no derived stores
  import { shortcutStore, setShowHelp } from '../stores/shortcutStore.js';

  // Simple reactive statement using only the base store
  $: showHelp = $shortcutStore.showHelp;

  // Debug logging
  $: {
    console.log('🔧 TestBasicShortcutStore: showHelp =', showHelp);
    console.log('🔧 TestBasicShortcutStore: $shortcutStore.showHelp =', $shortcutStore.showHelp);
    console.log('🔧 TestBasicShortcutStore: shortcutStore object =', !!$shortcutStore);
  }

  // Test manual function
  function testManualShow() {
    console.log('🔧 TestBasicShortcutStore: Manual setShowHelp(true) called');
    console.log('🔧 TestBasicShortcutStore: Before update - $shortcutStore.showHelp =', $shortcutStore.showHelp);
    setShowHelp(true);
    console.log('🔧 TestBasicShortcutStore: After update - $shortcutStore.showHelp =', $shortcutStore.showHelp);
  }
</script>

<!-- Test button -->
<button on:click={testManualShow} style="
  position: fixed;
  top: 110px;
  right: 10px;
  z-index: 99995;
  padding: 10px;
  background: purple;
  color: white;
  border: none;
  cursor: pointer;
">TEST BASIC STORE</button>

<!-- Basic shortcut store overlay -->
{#if showHelp}
  <div class="basic-test-overlay" style="
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(128, 0, 128, 0.8);
    z-index: 99995;
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <h1 style="color: white; font-size: 48px;">BASIC SHORTCUT STORE WORKS!</h1>
  </div>
{/if}