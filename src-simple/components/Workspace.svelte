<script>
  import { workspaceStore, workspaceActions, workspacePersistence } from '../stores/workspace.js';
  import FloatingDisplay from './FloatingDisplay.svelte';
  import { onMount, onDestroy } from 'svelte';

  let keyboardHandler;
  let escPressCount = 0;
  let escTimer = null;

  function handleKeydown(event) {
    // Alt+A: Create display (Crystal Clarity compliant - single entry point)
    if (event.altKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      const symbol = prompt('Enter symbol:');
      if (symbol) workspaceActions.addDisplay(symbol.replace('/', '').trim().toUpperCase());
      return;
    }

    // ESC: Progressive escape pattern
    if (event.key === 'Escape') {
      event.preventDefault();
      escPressCount++;

      // Reset timer for progressive pattern
      clearTimeout(escTimer);
      escTimer = setTimeout(() => { escPressCount = 0; }, 1000);

      if (escPressCount === 1) {
        // First ESC: Close overlays/modals
        document.querySelectorAll('.modal, .overlay, .dropdown').forEach(el => {
          el.close ? el.close() : el.remove();
        });
      } else if (escPressCount === 2) {
        // Second ESC: Clear display focus
        document.querySelectorAll('.focused').forEach(el =>
          el.classList.remove('focused'));
        escPressCount = 0;
      }
    }
  }

  onMount(() => {
    // Initialize workspace (no automatic display creation)
    workspacePersistence.loadFromStorage();
    workspacePersistence.saveToStorage();

    // Ensure workspace can receive keyboard events
    const workspaceEl = document.querySelector('.workspace');
    if (workspaceEl) {
      workspaceEl.focus();
      console.log('[WORKSPACE] Workspace focused and ready for keyboard shortcuts');
    }

    console.log('[WORKSPACE] Workspace initialized - use Alt+A to create displays');
  });

  onDestroy(() => {
    clearTimeout(escTimer);
    console.log('[WORKSPACE] Workspace cleaned up');
  });
</script>

<div class="workspace-container" role="application">
  <div class="flow-layer"></div>
  <div class="flow-layer"></div>
  <div class="flow-layer"></div>
  <div class="workspace" role="main" tabindex="0" on:keydown={handleKeydown}>
    {#each Array.from($workspaceStore.displays.values()) as display (display.id)}
      <FloatingDisplay {display} />
    {/each}
  </div>
</div>

<style>
  .workspace-container {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: radial-gradient(rgb(26, 26, 46), rgb(15, 15, 30));
    isolation: isolate;
  }

  .workspace-container .flow-layer {
    position: absolute;
    top: -25%;
    left: -25%;
    width: 150%;
    height: 150%;
    opacity: 0.25;
    pointer-events: none;
    will-change: transform;
  }

  .workspace-container .flow-layer:nth-child(1) {
    background: radial-gradient(rgb(79, 70, 229) 0%, transparent 40%);
    filter: blur(50px);
    animation: 27.3s ease-in-out 0s infinite normal none running perlinMove1;
  }

  .workspace-container .flow-layer:nth-child(2) {
    background: radial-gradient(at 30% 70%, rgb(59, 130, 246) 0%, transparent 35%);
    filter: blur(45px);
    animation: 31.7s ease-in-out -11.2s infinite normal none running perlinMove2;
  }

  .workspace-container .flow-layer:nth-child(3) {
    background: radial-gradient(at 70% 30%, rgb(99, 102, 241) 0%, transparent 38%);
    filter: blur(55px);
    animation: 23.9s ease-in-out -7.8s infinite normal none running perlinMove3;
  }

  .workspace {
    position: relative;
    height: 100%;
    width: 100%;
    outline: none;
  }

  @keyframes perlinMove1 {
    0%, 100% {
      transform: translate3d(0, 0, 0) scale(1);
    }
    33% {
      transform: translate3d(30px, -50px, 0) scale(1.1);
    }
    66% {
      transform: translate3d(-20px, 20px, 0) scale(0.9);
    }
  }

  @keyframes perlinMove2 {
    0%, 100% {
      transform: translate3d(0, 0, 0) scale(1);
    }
    33% {
      transform: translate3d(-40px, 30px, 0) scale(1.2);
    }
    66% {
      transform: translate3d(25px, -30px, 0) scale(0.8);
    }
  }

  @keyframes perlinMove3 {
    0%, 100% {
      transform: translate3d(0, 0, 0) scale(1);
    }
    33% {
      transform: translate3d(35px, 25px, 0) scale(0.85);
    }
    66% {
      transform: translate3d(-25px, -40px, 0) scale(1.15);
    }
  }

  /* Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .workspace-container .flow-layer {
      animation: none;
    }
  }
</style>