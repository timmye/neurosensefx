<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { workspaceStore } from '../../stores/workspaceStore.js';
  import { Button } from '../atoms/Button.svelte';
  import { Modal } from '../organisms/Modal.svelte';
  import { FormField } from '../molecules/FormField.svelte';
  import { Input } from '../atoms/Input.svelte';
  import { Badge } from '../atoms/Badge.svelte';
  import { Icon } from '../atoms/Icon.svelte';
  import { Toggle } from '../atoms/Toggle.svelte';
  
  const dispatch = createEventDispatcher();
  
  let versions = [];
  let showCreateVersionModal = false;
  let showCompareModal = false;
  let showRestoreModal = false;
  let selectedVersion = null;
  let compareVersions = [];
  let versionDiff = null;
  
  // Form data for creating version
  let versionFormData = {
    name: '',
    description: '',
    tags: [],
    isAutoSave: false,
    isMajor: false
  };
  
  onMount(() => {
    loadVersions();
    setupAutoSave();
  });
  
  function loadVersions() {
    const savedVersions = localStorage.getItem('neurosense_workspace_versions');
    if (savedVersions) {
      try {
        versions = JSON.parse(savedVersions);
        versions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } catch (error) {
        console.error('Failed to load versions:', error);
        versions = [];
      }
    }
  }
  
  function saveVersions() {
    localStorage.setItem('neurosense_workspace_versions', JSON.stringify(versions));
  }
  
  function setupAutoSave() {
    // Auto-save every 5 minutes
    setInterval(() => {
      createAutoSaveVersion();
    }, 300000);
  }
  
  function createAutoSaveVersion() {
    const workspace = getCurrentWorkspace();
    if (!workspace) return;
    
    const autoSave = {
      id: `autosave_${Date.now()}`,
      name: `Auto Save ${new Date().toLocaleString()}`,
      description: 'Automatically saved version',
      workspaceData: JSON.parse(JSON.stringify(workspace)),
      createdAt: new Date(),
      isAutoSave: true,
      isMajor: false,
      tags: ['auto-save'],
      size: JSON.stringify(workspace).length
    };
    
    // Keep only last 10 auto-saves
    const autoSaves = versions.filter(v => v.isAutoSave);
    if (autoSaves.length >= 10) {
      autoSaves.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const oldestAutoSave = autoSaves[0];
      versions = versions.filter(v => v.id !== oldestAutoSave.id);
    }
    
    versions.push(autoSave);
    saveVersions();
    dispatch('autoSaveCreated', autoSave);
  }
  
  function getCurrentWorkspace() {
    let workspace;
    workspaceStore.subscribe(w => workspace = w)();
    return workspace;
  }
  
  function openCreateVersionModal() {
    const workspace = getCurrentWorkspace();
    if (!workspace) return;
    
    versionFormData = {
      name: `Version ${versions.length + 1}`,
      description: '',
      tags: [],
      isAutoSave: false,
      isMajor: false
    };
    showCreateVersionModal = true;
  }
  
  function createVersion() {
    const workspace = getCurrentWorkspace();
    if (!workspace || !versionFormData.name.trim()) return;
    
    const version = {
      id: `version_${Date.now()}`,
      name: versionFormData.name,
      description: versionFormData.description,
      tags: versionFormData.tags,
      workspaceData: JSON.parse(JSON.stringify(workspace)),
      createdAt: new Date(),
      createdBy: 'current-user', // Would be actual user ID
      isAutoSave: versionFormData.isAutoSave,
      isMajor: versionFormData.isMajor,
      versionNumber: getNextVersionNumber(),
      size: JSON.stringify(workspace).length
    };
    
    versions.push(version);
    saveVersions();
    showCreateVersionModal = false;
    dispatch('versionCreated', version);
  }
  
  function getNextVersionNumber() {
    const majorVersions = versions.filter(v => v.isMajor).length;
    const minorVersions = versions.filter(v => !v.isMajor && !v.isAutoSave).length;
    return versionFormData.isMajor ? `v${majorVersions + 1}.0` : `v${majorVersions}.${minorVersions + 1}`;
  }
  
  function deleteVersion(versionId) {
    if (!confirm('Delete this version? This action cannot be undone.')) return;
    
    versions = versions.filter(v => v.id !== versionId);
    saveVersions();
    dispatch('versionDeleted', versionId);
  }
  
  function restoreVersion(version) {
    selectedVersion = version;
    showRestoreModal = true;
  }
  
  function confirmRestore() {
    if (!selectedVersion) return;
    
    workspaceStore.set(selectedVersion.workspaceData);
    showRestoreModal = false;
    
    // Create a version of the current state before restoring
    createAutoSaveVersion();
    
    dispatch('versionRestored', selectedVersion);
  }
  
  function openCompareModal() {
    if (versions.length < 2) return;
    compareVersions = [versions[0], versions[1]];
    calculateDiff();
    showCompareModal = true;
  }
  
  function calculateDiff() {
    if (compareVersions.length !== 2) return;
    
    const [version1, version2] = compareVersions;
    const data1 = version1.workspaceData;
    const data2 = version2.workspaceData;
    
    versionDiff = {
      canvases: {
        added: [],
        removed: [],
        modified: []
      },
      settings: {
        added: [],
        removed: [],
        modified: []
      },
      summary: {
        totalChanges: 0,
        canvasChanges: 0,
        settingChanges: 0
      }
    };
    
    // Compare canvases
    const canvases1 = data1.layout?.canvases || [];
    const canvases2 = data2.layout?.canvases || [];
    
    // Find added canvases
    canvases2.forEach(canvas2 => {
      const canvas1 = canvases1.find(c => c.id === canvas2.id);
      if (!canvas1) {
        versionDiff.canvases.added.push(canvas2);
      }
    });
    
    // Find removed canvases
    canvases1.forEach(canvas1 => {
      const canvas2 = canvases2.find(c => c.id === canvas1.id);
      if (!canvas2) {
        versionDiff.canvases.removed.push(canvas1);
      }
    });
    
    // Find modified canvases
    canvases2.forEach(canvas2 => {
      const canvas1 = canvases1.find(c => c.id === canvas2.id);
      if (canvas1 && JSON.stringify(canvas1) !== JSON.stringify(canvas2)) {
        versionDiff.canvases.modified.push({
          id: canvas2.id,
          symbol: canvas2.symbol,
          changes: getCanvasChanges(canvas1, canvas2)
        });
      }
    });
    
    // Compare global settings
    const settings1 = data1.globalSettings || {};
    const settings2 = data2.globalSettings || {};
    
    Object.keys(settings2).forEach(key => {
      if (!(key in settings1)) {
        versionDiff.settings.added.push({ key, value: settings2[key] });
      } else if (settings1[key] !== settings2[key]) {
        versionDiff.settings.modified.push({
          key,
          oldValue: settings1[key],
          newValue: settings2[key]
        });
      }
    });
    
    Object.keys(settings1).forEach(key => {
      if (!(key in settings2)) {
        versionDiff.settings.removed.push({ key, value: settings1[key] });
      }
    });
    
    // Calculate summary
    versionDiff.summary.totalChanges = 
      versionDiff.canvases.added.length + 
      versionDiff.canvases.removed.length + 
      versionDiff.canvases.modified.length +
      versionDiff.settings.added.length + 
      versionDiff.settings.removed.length + 
      versionDiff.settings.modified.length;
    
    versionDiff.summary.canvasChanges = 
      versionDiff.canvases.added.length + 
      versionDiff.canvases.removed.length + 
      versionDiff.canvases.modified.length;
    
    versionDiff.summary.settingChanges = 
      versionDiff.settings.added.length + 
      versionDiff.settings.removed.length + 
      versionDiff.settings.modified.length;
  }
  
  function getCanvasChanges(canvas1, canvas2) {
    const changes = [];
    
    if (canvas1.symbol !== canvas2.symbol) {
      changes.push(`Symbol: ${canvas1.symbol} → ${canvas2.symbol}`);
    }
    
    if (JSON.stringify(canvas1.position) !== JSON.stringify(canvas2.position)) {
      changes.push('Position changed');
    }
    
    if (JSON.stringify(canvas1.size) !== JSON.stringify(canvas2.size)) {
      changes.push('Size changed');
    }
    
    if (JSON.stringify(canvas1.indicators) !== JSON.stringify(canvas2.indicators)) {
      changes.push('Indicators changed');
    }
    
    return changes;
  }
  
  function downloadVersion(version) {
    const dataStr = JSON.stringify(version, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${version.name.replace(/\s+/g, '_')}_version.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  
  function getVersionSize(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  
  function getVersionBadgeVariant(version) {
    if (version.isAutoSave) return 'secondary';
    if (version.isMajor) return 'warning';
    return 'primary';
  }
</script>

<div class="workspace-version-manager">
  <div class="version-header">
    <h2>Workspace Version History</h2>
    <div class="version-controls">
      <Button onClick={openCreateVersionModal}>
        <Icon name="save" />
        Create Version
      </Button>
      <Button variant="outline" onClick={openCompareModal} disabled={versions.length < 2}>
        <Icon name="git-compare" />
        Compare Versions
      </Button>
    </div>
  </div>
  
  <div class="version-content">
    <div class="version-list">
      {#each versions as version}
        <div class="version-item" class:auto-save={version.isAutoSave}>
          <div class="version-info">
            <div class="version-title">
              <strong>{version.name}</strong>
              <Badge variant={getVersionBadgeVariant(version)}>
                {version.isAutoSave ? 'Auto Save' : (version.isMajor ? 'Major' : 'Minor')}
              </Badge>
              {version.versionNumber && (
                <Badge variant="outline" size="sm">{version.versionNumber}</Badge>
              )}
            </div>
            <div class="version-meta">
              <span class="version-date">
                <Icon name="calendar" size="sm" />
                {new Date(version.createdAt).toLocaleString()}
              </span>
              <span class="version-size">
                <Icon name="database" size="sm" />
                {getVersionSize(version.size)}
              </span>
              <span class="version-author">
                <Icon name="user" size="sm" />
                {version.createdBy || 'Unknown'}
              </span>
            </div>
            {version.description && (
              <p class="version-description">{version.description}</p>
            )}
            {version.tags && version.tags.length > 0 && (
              <div class="version-tags">
                {#each version.tags as tag}
                  <Badge variant="secondary" size="sm">{tag}</Badge>
                {/each}
              </div>
            )}
          </div>
          <div class="version-actions">
            <Button size="sm" variant="ghost" onClick={() => restoreVersion(version)} title="Restore">
              <Icon name="undo-2" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => downloadVersion(version)} title="Download">
              <Icon name="download" />
            </Button>
            {!version.isAutoSave && (
              <Button size="sm" variant="ghost" onClick={() => deleteVersion(version.id)} title="Delete">
                <Icon name="trash" />
              </Button>
            )}
          </div>
        </div>
      {/each}
      
      {#if versions.length === 0}
        <div class="empty-state">
          <Icon name="git-branch" size="lg" />
          <p>No versions yet</p>
          <p class="empty-description">Create a version to save your workspace state</p>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Create Version Modal -->
  <Modal bind:open={showCreateVersionModal} title="Create Workspace Version">
    <div class="version-form">
      <FormField label="Version Name" required>
        <Input bind:value={versionFormData.name} placeholder="Enter version name" />
      </FormField>
      
      <FormField label="Description">
        <Input bind:value={versionFormData.description} placeholder="Describe this version" />
      </FormField>
      
      <FormField label="Tags (comma-separated)">
        <Input bind:value={versionFormData.tags} placeholder="milestone, release, backup" />
      </FormField>
      
      <FormField label="Version Type">
        <div class="version-type-options">
          <label class="radio-option">
            <input
              type="radio"
              bind:group={versionFormData.isMajor}
              value={false}
            />
            <span>Minor Version</span>
            <small>Regular save point</small>
          </label>
          <label class="radio-option">
            <input
              type="radio"
              bind:group={versionFormData.isMajor}
              value={true}
            />
            <span>Major Version</span>
            <small>Important milestone</small>
          </label>
        </div>
      </FormField>
      
      <FormField label="Auto Save">
        <Toggle bind:checked={versionFormData.isAutoSave} />
        <p class="field-description">Auto-saves are created automatically and limited to 10 recent versions</p>
      </FormField>
      
      <div class="form-actions">
        <Button variant="outline" onClick={() => showCreateVersionModal = false}>
          Cancel
        </Button>
        <Button onClick={createVersion} disabled={!versionFormData.name.trim()}>
          Create Version
        </Button>
      </div>
    </div>
  </Modal>
  
  <!-- Restore Version Modal -->
  <Modal bind:open={showRestoreModal} title="Restore Workspace Version">
    <div class="restore-form">
      {#if selectedVersion}
        <div class="restore-info">
          <p>Are you sure you want to restore this version?</p>
          <div class="restore-details">
            <h4>{selectedVersion.name}</h4>
            <p class="restore-date">{new Date(selectedVersion.createdAt).toLocaleString()}</p>
            {selectedVersion.description && (
              <p class="restore-description">{selectedVersion.description}</p>
            )}
          </div>
          <p class="restore-warning">
            <strong>Note:</strong> A backup of the current workspace will be created automatically.
          </p>
        </div>
        
        <div class="form-actions">
          <Button variant="outline" onClick={() => showRestoreModal = false}>
            Cancel
          </Button>
          <Button onClick={confirmRestore}>
            Restore Version
          </Button>
        </div>
      {/if}
    </div>
  </Modal>
  
  <!-- Compare Versions Modal -->
  <Modal bind:open={showCompareModal} title="Compare Workspace Versions" size="lg">
    <div class="compare-form">
      <div class="compare-selections">
      <FormField label="Version 1">
        <select
          bind:value={compareVersions[0]}
          on:change={calculateDiff}
        >
          {#each versions as version}
            <option value={version}>
              {version.name} ({new Date(version.createdAt).toLocaleString()})
            </option>
          {/each}
        </select>
      </FormField>
      
      <FormField label="Version 2">
        <select
          bind:value={compareVersions[1]}
          on:change={calculateDiff}
        >
          {#each versions as version}
            <option value={version}>
              {version.name} ({new Date(version.createdAt).toLocaleString()})
            </option>
          {/each}
        </select>
      </FormField>
      </div>
      
      {#if versionDiff}
        <div class="compare-results">
          <div class="compare-summary">
            <h4>Summary</h4>
            <div class="summary-stats">
              <span class="stat">
                <strong>{versionDiff.summary.totalChanges}</strong> total changes
              </span>
              <span class="stat">
                <strong>{versionDiff.summary.canvasChanges}</strong> canvas changes
              </span>
              <span class="stat">
                <strong>{versionDiff.summary.settingChanges}</strong> setting changes
              </span>
            </div>
          </div>
          
          {versionDiff.canvases.added.length > 0 && (
            <div class="diff-section added">
              <h5>Added Canvases ({versionDiff.canvases.added.length})</h5>
              <ul>
                {#each versionDiff.canvases.added as canvas}
                  <li>{canvas.symbol} - {canvas.indicators?.join(', ') || 'No indicators'}</li>
                {/each}
              </ul>
            </div>
          )}
          
          {versionDiff.canvases.removed.length > 0 && (
            <div class="diff-section removed">
              <h5>Removed Canvases ({versionDiff.canvases.removed.length})</h5>
              <ul>
                {#each versionDiff.canvases.removed as canvas}
                  <li>{canvas.symbol} - {canvas.indicators?.join(', ') || 'No indicators'}</li>
                {/each}
              </ul>
            </div>
          )}
          
          {versionDiff.canvases.modified.length > 0 && (
            <div class="diff-section modified">
              <h5>Modified Canvases ({versionDiff.canvases.modified.length})</h5>
              <ul>
                {#each versionDiff.canvases.modified as canvas}
                  <li>
                    <strong>{canvas.symbol}</strong>
                    <ul>
                      {#each canvas.changes as change}
                        <li>{change}</li>
                      {/each}
                    </ul>
                  </li>
                {/each}
              </ul>
            </div>
          )}
          
          {versionDiff.settings.modified.length > 0 && (
            <div class="diff-section modified">
              <h5>Setting Changes ({versionDiff.settings.modified.length})</h5>
              <ul>
                {#each versionDiff.settings.modified as setting}
                  <li>
                    <strong>{setting.key}:</strong> {setting.oldValue} → {setting.newValue}
                  </li>
                {/each}
              </ul>
            </div>
          )}
        </div>
      {/if}
      
      <div class="form-actions">
        <Button variant="outline" onClick={() => showCompareModal = false}>
          Close
        </Button>
      </div>
    </div>
  </Modal>
</div>

<style>
  .workspace-version-manager {
    padding: var(--space-6);
  }
  
  .version-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6);
  }
  
  .version-header h2 {
    margin: 0;
    color: var(--text-primary);
  }
  
  .version-controls {
    display: flex;
    gap: var(--space-3);
  }
  
  .version-content {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }
  
  .version-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .version-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .version-item:hover {
    border-color: var(--border-default);
    box-shadow: var(--shadow-sm);
  }
  
  .version-item.auto-save {
    opacity: 0.8;
    border-color: var(--border-secondary);
  }
  
  .version-info {
    flex: 1;
  }
  
  .version-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  
  .version-meta {
    display: flex;
    gap: var(--space-4);
    margin-bottom: var(--space-2);
  }
  
  .version-date,
  .version-size,
  .version-author {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .version-description {
    margin: 0 0 var(--space-2) 0;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }
  
  .version-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  
  .version-actions {
    display: flex;
    gap: var(--space-1);
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    text-align: center;
    color: var(--text-secondary);
  }
  
  .empty-state p {
    margin: var(--space-2) 0 0 0;
  }
  
  .empty-description {
    font-size: var(--font-size-sm);
    margin-top: var(--space-1) !important;
  }
  
  .version-form,
  .restore-form,
  .compare-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 400px;
  }
  
  .version-type-options {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .radio-option {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .radio-option:hover {
    border-color: var(--border-default);
    background: var(--bg-secondary);
  }
  
  .radio-option input[type="radio"] {
    margin-top: var(--space-1);
  }
  
  .radio-option span {
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .radio-option small {
    display: block;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-top: var(--space-1);
  }
  
  .field-description {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin: var(--space-1) 0 0 0;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-default);
  }
  
  .restore-info {
    text-align: center;
  }
  
  .restore-details {
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    margin: var(--space-4) 0;
  }
  
  .restore-details h4 {
    margin: 0 0 var(--space-2) 0;
    color: var(--text-primary);
  }
  
  .restore-date {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin: 0 0 var(--space-2) 0;
  }
  
  .restore-description {
    margin: 0;
    color: var(--text-secondary);
  }
  
  .restore-warning {
    color: var(--text-warning);
    font-size: var(--font-size-sm);
  }
  
  .compare-selections {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }
  
  .compare-results {
    max-height: 400px;
    overflow-y: auto;
  }
  
  .compare-summary {
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
  }
  
  .compare-summary h4 {
    margin: 0 0 var(--space-3) 0;
    color: var(--text-primary);
  }
  
  .summary-stats {
    display: flex;
    gap: var(--space-4);
  }
  
  .stat {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .stat strong {
    color: var(--color-focus);
  }
  
  .diff-section {
    margin-bottom: var(--space-4);
  }
  
  .diff-section h5 {
    margin: 0 0 var(--space-2) 0;
    color: var(--text-primary);
  }
  
  .diff-section.added h5 {
    color: var(--color-success);
  }
  
  .diff-section.removed h5 {
    color: var(--color-danger);
  }
  
  .diff-section.modified h5 {
    color: var(--color-warning);
  }
  
  .diff-section ul {
    margin: 0;
    padding-left: var(--space-4);
  }
  
  .diff-section li {
    margin-bottom: var(--space-1);
    color: var(--text-secondary);
  }
  
  @media (max-width: 768px) {
    .version-header {
      flex-direction: column;
      gap: var(--space-4);
      align-items: stretch;
    }
    
    .version-controls {
      justify-content: center;
    }
    
    .version-item {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-3);
    }
    
    .version-actions {
      justify-content: flex-end;
    }
    
    .version-form,
    .restore-form,
    .compare-form {
      min-width: auto;
    }
    
    .compare-selections {
      grid-template-columns: 1fr;
    }
    
    .summary-stats {
      flex-direction: column;
      gap: var(--space-2);
    }
  }
</style>
