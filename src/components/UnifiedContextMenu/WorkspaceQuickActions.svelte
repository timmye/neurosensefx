<script>
  export let onAction = () => {};
</script>

<div class="workspace-quick-actions">
  <div class="menu-section">
    <div class="menu-item" on:click={() => onAction('addDisplay')}>
      Add Display
    </div>
    <div class="menu-item" on:click={() => onAction('showSymbolPalette')}>
      Show Symbol Palette
    </div>
    <div class="menu-item" on:click={() => onAction('workspaceSettings')}>
      Workspace Settings
    </div>
  </div>
</div>

<style>
  .workspace-quick-actions {
    padding: 4px 0;
  }
  
  .menu-section {
    padding: 2px 0;
  }
  
  .menu-item {
    padding: 8px 16px;
    color: #d1d5db;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s ease;
  }
  
  .menu-item:hover {
    background: #374151;
  }
</style>
