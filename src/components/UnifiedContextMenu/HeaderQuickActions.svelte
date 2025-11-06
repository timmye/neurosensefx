<script>
  export let displayId = null;
  export let onAction = () => {};
</script>

<div class="header-quick-actions">
  <div class="menu-section">
    <div class="menu-item" on:click={() => onAction('bringToFront')}>
      Bring to Front
    </div>
    <div class="menu-item refresh" on:click={() => onAction('refresh')}>
      Refresh Canvas
    </div>
  </div>
  
  <div class="menu-divider"></div>
  
  <div class="menu-section">
    <div class="menu-item danger" on:click={() => onAction('close')}>
      Close Display
    </div>
  </div>
</div>

<style>
  .header-quick-actions {
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
  
  .menu-item.refresh {
    color: #10b981;
  }
  
  .menu-item.refresh:hover {
    background: rgba(16, 185, 129, 0.1);
  }
  
  .menu-divider {
    height: 1px;
    background: #374151;
    margin: 4px 0;
  }
</style>
