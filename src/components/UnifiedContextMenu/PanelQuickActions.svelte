<script>
  export let onAction = () => {};
</script>

<div class="panel-quick-actions" role="menu">
  <div class="menu-section" role="none">
    <button 
      class="menu-item" 
      type="button"
      role="menuitem"
      on:click={() => onAction('bringToFront')}
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAction('bringToFront');
        }
      }}
    >
      Bring to Front
    </button>
  </div>
  
  <div class="menu-divider" role="separator"></div>
  
  <div class="menu-section" role="none">
    <button 
      class="menu-item" 
      type="button"
      role="menuitem"
      on:click={() => onAction('reset')}
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAction('reset');
        }
      }}
    >
      Reset Panel
    </button>
    <button 
      class="menu-item danger" 
      type="button"
      role="menuitem"
      on:click={() => onAction('close')}
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAction('close');
        }
      }}
    >
      Close Panel
    </button>
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
