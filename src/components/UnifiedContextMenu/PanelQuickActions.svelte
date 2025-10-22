<script>
  export let panelId = null;
  export let onAction = () => {};
</script>

<div class="panel-quick-actions">
  <div class="menu-section">
    <div class="menu-item" on:click={() => onAction('bringToFront')}>
      Bring to Front
    </div>
  </div>
  
  <div class="menu-divider"></div>
  
  <div class="menu-section">
    <div class="menu-item" on:click={() => onAction('reset')}>
      Reset Panel
    </div>
    <div class="menu-item danger" on:click={() => onAction('close')}>
      Close Panel
    </div>
  </div>
</div>

<style>
  .panel-quick-actions {
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
  
  .menu-item.danger {
    color: #ef4444;
  }
  
  .menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }
  
  .menu-divider {
    height: 1px;
    background: #374151;
    margin: 4px 0;
  }
</style>
