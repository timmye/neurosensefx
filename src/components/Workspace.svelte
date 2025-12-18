<script>
  import { workspaceStore, workspaceActions, workspacePersistence } from '../stores/workspace.js';
  import FloatingDisplay from './FloatingDisplay.svelte';
  import WorkspaceModal from './WorkspaceModal.svelte';
  import { onMount, onDestroy } from 'svelte';
  import './Workspace.css';

  let keyboardHandler;
  let escPressCount = 0;
  let escTimer = null;
  let fileInput;

  // Export/Import functions using workspace actions
  function exportWorkspace() {
    try {
      workspaceActions.exportWorkspace();
      console.log('✅ Workspace export initiated');
    } catch (error) {
      console.error('❌ Failed to export workspace:', error);
    }
  }

  function importWorkspace() {
    fileInput.click();
  }

  async function handleFileChange(event) {
    const file = event.target.files[0];
    if (file) {
      try {
        console.log('📥 Importing workspace...');
        await workspaceActions.importWorkspace(file);
        console.log('✅ Workspace imported successfully');
      } catch (error) {
        console.error('❌ Failed to import workspace:', error);
      } finally {
        event.target.value = ''; // Reset input
      }
    }
  }

  // Workspace dialog state and functions
  let showWorkspaceModal = false;

  function showWorkspaceDialog() {
    showWorkspaceModal = true;
  }

  function handleExportClick() {
    showWorkspaceModal = false;
    exportWorkspace();
  }

  function handleImportClick() {
    showWorkspaceModal = false;
    fileInput.click();
  }

  function handleModalCancel() {
    showWorkspaceModal = false;
  }

  function handleKeydown(event) {
    // Alt+A: Create display (Crystal Clarity compliant - single entry point)
    if (event.altKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      const symbol = prompt('Enter symbol:');
      if (symbol) workspaceActions.addDisplay(symbol.replace('/', '').trim().toUpperCase());
      return;
    }

    // Alt+W: Workspace controls
    if (event.altKey && event.key.toLowerCase() === 'w') {
      event.preventDefault();
      showWorkspaceDialog();
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

<!-- Hidden file input for import -->
<input
  type="file"
  accept=".json"
  bind:this={fileInput}
  on:change={handleFileChange}
  style="display: none"
/>

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

<!-- Workspace Modal -->
<WorkspaceModal
  bind:show={showWorkspaceModal}
  on:export={handleExportClick}
  on:import={handleImportClick}
  on:cancel={handleModalCancel}
/>

