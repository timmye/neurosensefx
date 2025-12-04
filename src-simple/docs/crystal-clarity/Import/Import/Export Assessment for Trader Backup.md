

---

## **Trader Workspace Backup/Restore**

### **Objective**
Implement a simple, full-workspace backup and restore system accessible via a right-click context menu.

---

### **Implementation**

The backup/restore functionality is added directly to the main workspace component, triggered by a right-click context menu.

#### **File**: `components/Workspace.svelte`

```svelte
<script>
  // ... existing workspace code ...
  
  let showContextMenu = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  
  function handleContextMenu(event) {
    event.preventDefault();
    contextMenuX = event.clientX;
    contextMenuY = event.clientY;
    showContextMenu = true;
  }
  
  function handleClick() {
    showContextMenu = false;
  }
  
  function exportBackup() {
    const state = localStorage.getItem('workspace-state');
    const blob = new Blob([state], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neurosense-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showContextMenu = false;
  }
  
  function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        localStorage.setItem('workspace-state', JSON.stringify(data));
        alert('Backup imported! Page will reload.');
        location.reload();
      } catch (err) {
        alert('Invalid backup file');
      }
    };
    reader.readAsText(file);
    showContextMenu = false;
  }
</script>

<div class="workspace" on:contextmenu={handleContextMenu} on:click={handleClick}>
  <!-- ... existing workspace content ... -->
  
  {#if showContextMenu}
    <div class="context-menu" style="left: {contextMenuX}px; top: {contextMenuY}px;">
      <button on:click={exportBackup}>💾 Export Backup</button>
      <label>
        📁 Import Backup
        <input type="file" accept=".json" on:change={importBackup} hidden />
      </label>
    </div>
  {/if}
</div>

<style>
  .workspace {
    /* ... existing workspace styles ... */
    position: relative; /* Required for context menu positioning */
  }
  
  .context-menu {
    position: fixed;
    background: #1a1a1a;
    border: 1px solid #333;
    padding: 8px;
    z-index: 1000;
    box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
  }
  
  .context-menu button,
  .context-menu label {
    display: block;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: #fff;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
  }
  
  .context-menu button:hover,
  .context-menu label:hover {
    background: #2a2a2a;
  }
</style>
```

---

### **Trader Workflow**

**Export (Backup)**
1.  Right-click anywhere on the workspace.
2.  Select "💾 Export Backup" from the context menu.
3.  The file `neurosense-backup-YYYY-MM-DD.json` is downloaded.

**Import (Restore)**
1.  Right-click anywhere on the workspace.
2.  Select "📁 Import Backup" from the context menu.
3.  Choose your backup file.
4.  The page reloads with the full workspace restored.

---

### **Backup Data Structure**

The exported JSON file contains the complete workspace state, including all displays, their positions, sizes, and associated markers.

```json
{
  "displays": [
    {
      "id": "display-123",
      "symbol": "EURUSD",
      "position": { "x": 100, "y": 100 },
      "size": { "width": 600, "height": 400 },
      "markers": [
        { "id": "marker-1", "price": 1.0850, "type": "big" },
        { "id": "marker-2", "price": 1.0900, "type": "normal" }
      ]
    }
  ],
  "nextZIndex": 5,
  "config": { /* workspace settings */ }
}
```

---

### **Future Enhancement: Auto-Backup Reminder**

A notification can be added to remind traders to back up their workspace if it has been more than a week since their last export. This would be implemented by checking a `last-backup` timestamp in localStorage.