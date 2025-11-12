<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { Environment } from '../../lib/utils/environmentUtils.js';
  import copyUtils from '../../utils/crossEnvironmentCopy.js';
  import { displayActions } from '../../stores/displayStore.js';

  export let onClose = () => {};
  export let onShowNotification = () => {};

  const dispatch = createEventDispatcher();

  // Component state
  let activeSection = 'copy'; // 'copy', 'backup', 'compare'
  let copyOperation = {
    direction: Environment.isDevelopment ? 'from-production' : 'to-production',
    preset: 'SAFE_COPY',
    customItems: ['layout', 'config', 'settings', 'sizes'],
    createBackup: true,
    validateData: true,
    mergeMode: false
  };

  let operationState = {
    isRunning: false,
    currentOperation: null,
    progress: 0,
    result: null,
    error: null
  };

  let backupState = {
    backups: [],
    selectedBackup: null,
    isCreating: false,
    isRestoring: false
  };

  let compareState = {
    comparison: null,
    isLoading: false,
    lastComparison: null
  };

  let selectedItems = new Set();
  let showCustomItems = false;

  // Computed properties
  $: isDevelopment = Environment.isDevelopment;
  $: copyDirectionText = copyOperation.direction === 'from-production'
    ? 'From Production → Development'
    : 'From Development → Production';
  $: canStartCopy = !operationState.isRunning && (
    copyOperation.preset !== 'CUSTOM' || selectedItems.size > 0
  );

  // Initialize component
  onMount(async () => {
    await loadBackups();
    await performComparison();
  });

  // Copy operations
  async function startCopyOperation() {
    if (operationState.isRunning) return;

    operationState.isRunning = true;
    operationState.currentOperation = 'copy';
    operationState.progress = 0;
    operationState.result = null;
    operationState.error = null;

    try {
      // Determine items to copy
      let itemsToCopy;
      if (copyOperation.preset === 'CUSTOM') {
        itemsToCopy = Array.from(selectedItems);
      } else {
        itemsToCopy = copyUtils.COPY_PRESETS[copyOperation.preset].items;
      }

      // Determine source and target environments
      const sourceEnv = copyOperation.direction === 'from-production' ? 'production' : 'development';
      const targetEnv = copyOperation.direction === 'from-production' ? 'development' : 'production';

      dispatch('copy-started', { direction: copyOperation.direction, items: itemsToCopy });

      const result = await copyUtils.copyBetweenEnvironments({
        sourceEnv,
        targetEnv,
        items: itemsToCopy,
        createBackup: copyOperation.createBackup,
        validateData: copyOperation.validateData,
        mergeMode: copyOperation.mergeMode
      });

      operationState.result = result;
      operationState.progress = 100;

      if (result.success) {
        onShowNotification({
          type: 'success',
          title: 'Copy Completed Successfully',
          message: `Copied ${result.items.copied.length} items from ${sourceEnv} to ${targetEnv}`,
          duration: 5000
        });

        // Refresh displays if layout was copied
        if (itemsToCopy.includes('layout')) {
          await displayActions.initializeWorkspace();
        }

        // Refresh comparison and backups
        await performComparison();
        await loadBackups();

        dispatch('copy-completed', result);
      } else {
        operationState.error = result.error || 'Copy operation failed';
        onShowNotification({
          type: 'error',
          title: 'Copy Operation Failed',
          message: operationState.error,
          duration: 8000
        });

        dispatch('copy-failed', { error: operationState.error, result });
      }

    } catch (error) {
      operationState.error = `Copy operation crashed: ${error.message}`;
      onShowNotification({
        type: 'error',
        title: 'Copy Operation Crashed',
        message: operationState.error,
        duration: 8000
      });

      dispatch('copy-failed', { error: operationState.error });
    } finally {
      operationState.isRunning = false;
      operationState.currentOperation = null;
    }
  }

  function toggleItemSelection(item) {
    if (selectedItems.has(item)) {
      selectedItems.delete(item);
    } else {
      selectedItems.add(item);
    }
    selectedItems = selectedItems; // Trigger reactivity
  }

  function selectPreset(presetKey) {
    copyOperation.preset = presetKey;
    if (presetKey !== 'CUSTOM') {
      selectedItems.clear();
      showCustomItems = false;
    }
  }

  // Backup operations
  async function createManualBackup() {
    if (backupState.isCreating) return;

    backupState.isCreating = true;

    try {
      const result = copyUtils.createBackup(`manual-${Date.now()}`);

      if (result.success) {
        onShowNotification({
          type: 'success',
          title: 'Backup Created',
          message: `Backup created with ${result.items} items`,
          duration: 3000
        });
        await loadBackups();
      } else {
        onShowNotification({
          type: 'error',
          title: 'Backup Failed',
          message: result.error,
          duration: 5000
        });
      }
    } catch (error) {
      onShowNotification({
        type: 'error',
        title: 'Backup Failed',
        message: error.message,
        duration: 5000
      });
    } finally {
      backupState.isCreating = false;
    }
  }

  async function restoreBackup(backupId) {
    if (backupState.isRestoring) return;

    backupState.isRestoring = true;

    try {
      const result = copyUtils.restoreFromBackup(backupId);

      if (result.success) {
        onShowNotification({
          type: 'success',
          title: 'Backup Restored',
          message: `Restored ${result.restored.length} items from backup`,
          duration: 3000
        });

        // Refresh the workspace
        await displayActions.initializeWorkspace();
        await performComparison();
        await loadBackups();
      } else {
        onShowNotification({
          type: 'error',
          title: 'Restore Failed',
          message: result.error || 'Backup restoration failed',
          duration: 5000
        });
      }
    } catch (error) {
      onShowNotification({
        type: 'error',
        title: 'Restore Failed',
        message: error.message,
        duration: 5000
      });
    } finally {
      backupState.isRestoring = false;
      backupState.selectedBackup = null;
    }
  }

  async function deleteBackup(backupId) {
    try {
      const success = copyUtils.deleteBackup(backupId);

      if (success) {
        onShowNotification({
          type: 'info',
          title: 'Backup Deleted',
          message: 'Backup has been permanently deleted',
          duration: 3000
        });
        await loadBackups();
      } else {
        onShowNotification({
          type: 'error',
          title: 'Delete Failed',
          message: 'Failed to delete backup',
          duration: 3000
        });
      }
    } catch (error) {
      onShowNotification({
        type: 'error',
        title: 'Delete Failed',
        message: error.message,
        duration: 3000
      });
    }
  }

  async function loadBackups() {
    try {
      backupState.backups = copyUtils.listBackups();
    } catch (error) {
      console.error('Failed to load backups:', error);
      backupState.backups = [];
    }
  }

  async function cleanupOldBackups() {
    try {
      const result = copyUtils.cleanupOldBackups(5);

      if (result.success) {
        onShowNotification({
          type: 'info',
          title: 'Backup Cleanup',
          message: result.message,
          duration: 3000
        });
        await loadBackups();
      } else {
        onShowNotification({
          type: 'error',
          title: 'Cleanup Failed',
          message: result.error,
          duration: 3000
        });
      }
    } catch (error) {
      onShowNotification({
        type: 'error',
        title: 'Cleanup Failed',
        message: error.message,
        duration: 3000
      });
    }
  }

  // Comparison operations
  async function performComparison() {
    compareState.isLoading = true;

    try {
      const comparison = await copyUtils.compareEnvironments();
      compareState.comparison = comparison;
      compareState.lastComparison = new Date();
    } catch (error) {
      console.error('Comparison failed:', error);
      compareState.comparison = { error: error.message };
    } finally {
      compareState.isLoading = false;
    }
  }

  // Validation operations
  async function validateCurrentEnvironment() {
    operationState.isRunning = true;
    operationState.currentOperation = 'validate';

    try {
      const validation = copyUtils.validateCurrentEnvironment();

      if (validation.isValid) {
        onShowNotification({
          type: 'success',
          title: 'Validation Passed',
          message: `All ${validation.summary.valid} items are valid`,
          duration: 3000
        });
      } else {
        onShowNotification({
          type: 'warning',
          title: 'Validation Issues Found',
          message: `${validation.summary.invalid} items have issues, ${validation.summary.missing} items missing`,
          duration: 6000
        });
      }

      operationState.result = validation;
    } catch (error) {
      onShowNotification({
        type: 'error',
        title: 'Validation Failed',
        message: error.message,
        duration: 5000
      });
    } finally {
      operationState.isRunning = false;
      operationState.currentOperation = null;
    }
  }

  // UI helpers
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  function getItemIcon(itemKey) {
    const icons = {
      layout: '📐',
      config: '⚙️',
      preferences: '👤',
      settings: '🔧',
      sizes: '📏'
    };
    return icons[itemKey] || '📄';
  }

  function getEnvironmentColor(env) {
    return env === 'development' ? '#10b981' : '#3b82f6';
  }

  function getOperationTypeColor(status) {
    const colors = {
      copied: '#10b981',
      skipped: '#6b7280',
      failed: '#ef4444',
      validated: '#3b82f6'
    };
    return colors[status] || '#6b7280';
  }
</script>

<div class="copy-environment-container">
  <!-- Section Tabs -->
  <div class="section-tabs">
    <button
      class="tab-button {activeSection === 'copy' ? 'active' : ''}"
      on:click={() => activeSection = 'copy'}
    >
      📋 Copy Data
    </button>
    <button
      class="tab-button {activeSection === 'backup' ? 'active' : ''}"
      on:click={() => activeSection = 'backup'}
    >
      💾 Backups
    </button>
    <button
      class="tab-button {activeSection === 'compare' ? 'active' : ''}"
      on:click={() => activeSection = 'compare'}
    >
      🔍 Compare
    </button>
  </div>

  <!-- Copy Section -->
  {#if activeSection === 'copy'}
    <div class="section-content">
      <!-- Environment Info -->
      <div class="environment-info">
        <div class="current-env" style="border-left-color: {getEnvironmentColor(Environment.current)}">
          <strong>Current:</strong> {Environment.current}
        </div>
        <div class="copy-direction">
          {copyDirectionText}
        </div>
      </div>

      <!-- Copy Direction -->
      <div class="form-group">
        <label>Copy Direction</label>
        <div class="direction-options">
          <label class="radio-option">
            <input
              type="radio"
              bind:group={copyOperation.direction}
              value="from-production"
              disabled={operationState.isRunning}
            />
            <span>Production → Development</span>
          </label>
          <label class="radio-option">
            <input
              type="radio"
              bind:group={copyOperation.direction}
              value="to-production"
              disabled={operationState.isRunning}
            />
            <span>Development → Production</span>
          </label>
        </div>
      </div>

      <!-- Copy Preset -->
      <div class="form-group">
        <label>What to Copy</label>
        <div class="preset-grid">
          {#each Object.entries(copyUtils.COPY_PRESETS) as [key, preset]}
            <button
              class="preset-button {copyOperation.preset === key ? 'active' : ''}"
              on:click={() => selectPreset(key)}
              disabled={operationState.isRunning}
            >
              <div class="preset-name">{preset.name}</div>
              <div class="preset-description">{preset.description}</div>
            </button>
          {/each}
          <button
            class="preset-button {copyOperation.preset === 'CUSTOM' ? 'active' : ''}"
            on:click={() => { selectPreset('CUSTOM'); showCustomItems = true; }}
            disabled={operationState.isRunning}
          >
            <div class="preset-name">Custom Selection</div>
            <div class="preset-description">Choose specific items to copy</div>
          </button>
        </div>
      </div>

      <!-- Custom Item Selection -->
      {#if showCustomItems && copyOperation.preset === 'CUSTOM'}
        <div class="form-group">
          <label>Select Items to Copy</label>
          <div class="items-grid">
            {#each Object.entries(copyUtils.COPY_ITEMS) as [key, item]}
              <label class="item-checkbox">
                <input
                  type="checkbox"
                  checked={selectedItems.has(key)}
                  on:change={() => toggleItemSelection(key)}
                  disabled={operationState.isRunning}
                />
                <span class="item-icon">{getItemIcon(key)}</span>
                <div class="item-details">
                  <div class="item-name">{item.name}</div>
                  <div class="item-description">{item.description}</div>
                </div>
              </label>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Copy Options -->
      <div class="form-group">
        <label>Copy Options</label>
        <div class="checkbox-options">
          <label class="checkbox-option">
            <input
              type="checkbox"
              bind:checked={copyOperation.createBackup}
              disabled={operationState.isRunning}
            />
            <span>Create backup before copying</span>
          </label>
          <label class="checkbox-option">
            <input
              type="checkbox"
              bind:checked={copyOperation.validateData}
              disabled={operationState.isRunning}
            />
            <span>Validate data before copying</span>
          </label>
          <label class="checkbox-option">
            <input
              type="checkbox"
              bind:checked={copyOperation.mergeMode}
              disabled={operationState.isRunning}
            />
            <span>Merge with existing data (config only)</span>
          </label>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button
          class="primary-button"
          on:click={startCopyOperation}
          disabled={!canStartCopy}
        >
          {#if operationState.isRunning}
            {#if operationState.currentOperation === 'copy'}
              🔄 Copying...
            {:else}
              ⏳ Processing...
            {/if}
          {:else}
            📋 Start Copy Operation
          {/if}
        </button>

        <button
          class="secondary-button"
          on:click={validateCurrentEnvironment}
          disabled={operationState.isRunning}
        >
          ✅ Validate Current Data
        </button>
      </div>

      <!-- Operation Result -->
      {#if operationState.result}
        <div class="operation-result">
          <h4>Operation Result</h4>
          <div class="result-summary {operationState.result.success ? 'success' : 'error'}">
            {#if operationState.result.success}
              ✅ Copy completed successfully
            {:else}
              ❌ Copy operation failed
            {/if}
          </div>

          <div class="result-details">
            {#if operationState.result.items}
              <div class="result-items">
                {#each Object.entries(operationState.result.items) as [status, items]}
                  {#if items.length > 0}
                    <div class="result-group" style="border-left-color: {getOperationTypeColor(status)}">
                      <strong>{status} ({items.length}):</strong>
                      <ul>
                        {#each items as item}
                          <li>
                            {getItemIcon(item.item)} {item.item}
                            {#if item.size}
                              <span class="item-size">({formatBytes(item.size)})</span>
                            {/if}
                            {#if item.reason}
                              <span class="item-reason">- {item.reason}</span>
                            {/if}
                            {#if item.error}
                              <span class="item-error">- {item.error}</span>
                            {/if}
                          </li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}

            {#if operationState.result.duration}
              <div class="result-duration">
                Duration: {operationState.result.duration}ms
              </div>
            {/if}

            {#if operationState.result.backupId}
              <div class="result-backup">
                Backup ID: {operationState.result.backupId}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Backup Section -->
  {#if activeSection === 'backup'}
    <div class="section-content">
      <div class="backup-header">
        <h3>Backup Management</h3>
        <div class="backup-actions">
          <button
            class="secondary-button"
            on:click={createManualBackup}
            disabled={backupState.isCreating}
          >
            {#if backupState.isCreating}
              🔄 Creating...
            {:else}
              💾 Create Backup
            {/if}
          </button>
          <button
            class="secondary-button"
            on:click={cleanupOldBackups}
          >
            🗑️ Cleanup Old Backups
          </button>
        </div>
      </div>

      <!-- Backup List -->
      <div class="backup-list">
        {#if backupState.backups.length === 0}
          <div class="empty-state">
            <p>No backups found. Create your first backup to get started.</p>
          </div>
        {:else}
          {#each backupState.backups as backup}
            <div class="backup-item">
              <div class="backup-info">
                <div class="backup-header-info">
                  <strong>{backup.id}</strong>
                  <span class="backup-env" style="background-color: {getEnvironmentColor(backup.environment)}">
                    {backup.environment}
                  </span>
                </div>
                <div class="backup-meta">
                  Created: {formatDate(backup.timestamp)} |
                  Items: {backup.items.length} |
                  Size: {formatBytes(backup.size)}
                </div>
                <div class="backup-items">
                  Items: {backup.items.join(', ')}
                </div>
              </div>
              <div class="backup-actions-row">
                <button
                  class="small-button restore-button"
                  on:click={() => backupState.selectedBackup = backup.id}
                  disabled={backupState.isRestoring}
                >
                  {#if backupState.isRestoring && backupState.selectedBackup === backup.id}
                    🔄 Restoring...
                  {:else}
                    ↩️ Restore
                  {/if}
                </button>
                <button
                  class="small-button delete-button"
                  on:click={() => deleteBackup(backup.id)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Restore Confirmation -->
      {#if backupState.selectedBackup}
        <div class="restore-confirmation">
          <div class="confirmation-content">
            <h4>Confirm Restore</h4>
            <p>Are you sure you want to restore from backup {backupState.selectedBackup}?</p>
            <p>This will replace your current workspace data.</p>
            <div class="confirmation-actions">
              <button
                class="primary-button"
                on:click={() => restoreBackup(backupState.selectedBackup)}
                disabled={backupState.isRestoring}
              >
                Yes, Restore Backup
              </button>
              <button
                class="secondary-button"
                on:click={() => backupState.selectedBackup = null}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Compare Section -->
  {#if activeSection === 'compare'}
    <div class="section-content">
      <div class="compare-header">
        <h3>Environment Comparison</h3>
        <button
          class="secondary-button"
          on:click={performComparison}
          disabled={compareState.isLoading}
        >
          {#if compareState.isLoading}
            🔄 Comparing...
          {:else}
            🔍 Refresh Comparison
          {/if}
        </button>
      </div>

      {#if compareState.lastComparison}
        <div class="last-updated">
          Last comparison: {formatDate(compareState.lastComparison)}
        </div>
      {/if}

      {#if compareState.comparison}
        <div class="comparison-content">
          {#if compareState.comparison.error}
            <div class="error-message">
              Comparison failed: {compareState.comparison.error}
            </div>
          {:else}
            <!-- Summary -->
            <div class="comparison-summary">
              <div class="summary-item">
                <strong>Development Only:</strong>
                <span class="count">{compareState.comparison.summary.devOnly.length}</span>
                {compareState.comparison.summary.devOnly.length > 0 ?
                  `(${compareState.comparison.summary.devOnly.join(', ')})` :
                  '(none)'
                }
              </div>
              <div class="summary-item">
                <strong>Production Only:</strong>
                <span class="count">{compareState.comparison.summary.prodOnly.length}</span>
                {compareState.comparison.summary.prodOnly.length > 0 ?
                  `(${compareState.comparison.summary.prodOnly.join(', ')})` :
                  '(none)'
                }
              </div>
              <div class="summary-item">
                <strong>Both Present:</strong>
                <span class="count">{compareState.comparison.summary.bothPresent.length}</span>
                {compareState.comparison.summary.bothPresent.length > 0 ?
                  `(${compareState.comparison.summary.bothPresent.join(', ')})` :
                  '(none)'
                }
              </div>
              <div class="summary-item">
                <strong>Both Missing:</strong>
                <span class="count">{compareState.comparison.summary.bothMissing.length}</span>
                {compareState.comparison.summary.bothMissing.length > 0 ?
                  `(${compareState.comparison.summary.bothMissing.join(', ')})` :
                  '(none)'
                }
              </div>
            </div>

            <!-- Detailed Comparison -->
            <div class="detailed-comparison">
              <h4>Detailed Comparison</h4>

              <!-- Development Environment -->
              <div class="env-comparison">
                <h5 style="color: {getEnvironmentColor('development')}">Development Environment</h5>
                {#each Object.entries(compareState.comparison.development.items) as [itemKey, itemInfo]}
                  <div class="comparison-item">
                    <span class="item-icon">{getItemIcon(itemKey)}</span>
                    <span class="item-name">{copyUtils.COPY_ITEMS[itemKey]?.name || itemKey}</span>
                    <span class="item-status">
                      {#if itemInfo.hasData}
                        ✅ {formatBytes(itemInfo.size)}
                      {:else}
                        ❌ No data
                      {/if}
                    </span>
                  </div>
                {/each}
              </div>

              <!-- Production Environment -->
              <div class="env-comparison">
                <h5 style="color: {getEnvironmentColor('production')}">Production Environment</h5>
                {#each Object.entries(compareState.comparison.production.items) as [itemKey, itemInfo]}
                  <div class="comparison-item">
                    <span class="item-icon">{getItemIcon(itemKey)}</span>
                    <span class="item-name">{copyUtils.COPY_ITEMS[itemKey]?.name || itemKey}</span>
                    <span class="item-status">
                      {#if itemInfo.hasData}
                        ✅ {formatBytes(itemInfo.size)}
                      {:else}
                        ❌ No data
                      {/if}
                    </span>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Size Differences -->
            {#if compareState.comparison.differences.length > 0}
              <div class="size-differences">
                <h4>Size Differences</h4>
                {#each compareState.comparison.differences as diff}
                  <div class="difference-item">
                    <span class="item-icon">{getItemIcon(diff.item)}</span>
                    <span class="item-name">{copyUtils.COPY_ITEMS[diff.item]?.name || diff.item}</span>
                    <div class="size-comparison">
                      <span>Dev: {formatBytes(diff.devSize)}</span>
                      <span>Prod: {formatBytes(diff.prodSize)}</span>
                      <span class="diff-size">Δ {formatBytes(diff.diff)}</span>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .copy-environment-container {
    width: 100%;
    max-width: 800px;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* Section Tabs */
  .section-tabs {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 20px;
  }

  .tab-button {
    padding: 12px 20px;
    border: none;
    background: none;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
    font-size: 14px;
    font-weight: 500;
  }

  .tab-button:hover {
    background-color: #f9fafb;
  }

  .tab-button.active {
    border-bottom-color: #3b82f6;
    color: #3b82f6;
  }

  .section-content {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Environment Info */
  .environment-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .current-env {
    font-weight: 600;
    padding: 8px 12px;
    background: white;
    border-radius: 4px;
    border-left: 4px solid;
  }

  .copy-direction {
    font-weight: 500;
    color: #4b5563;
  }

  /* Form Groups */
  .form-group {
    margin-bottom: 24px;
  }

  .form-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 8px;
    color: #374151;
  }

  /* Radio and Checkbox Options */
  .direction-options, .checkbox-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .radio-option, .checkbox-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .radio-option:hover, .checkbox-option:hover {
    background-color: #f3f4f6;
  }

  .radio-option input, .checkbox-option input {
    margin: 0;
  }

  /* Preset Grid */
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 12px;
  }

  .preset-button {
    padding: 16px;
    border: 2px solid #e5e7eb;
    background: white;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .preset-button:hover {
    border-color: #d1d5db;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .preset-button.active {
    border-color: #3b82f6;
    background-color: #eff6ff;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .preset-name {
    font-weight: 600;
    margin-bottom: 4px;
    color: #1f2937;
  }

  .preset-description {
    font-size: 13px;
    color: #6b7280;
    line-height: 1.4;
  }

  /* Items Grid */
  .items-grid {
    display: grid;
    gap: 12px;
  }

  .item-checkbox {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .item-checkbox:hover {
    border-color: #d1d5db;
    background-color: #f9fafb;
  }

  .item-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .item-details {
    flex: 1;
  }

  .item-name {
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 2px;
  }

  .item-description {
    font-size: 13px;
    color: #6b7280;
    line-height: 1.3;
  }

  /* Action Buttons */
  .action-buttons {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }

  .primary-button, .secondary-button, .small-button {
    padding: 12px 20px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .primary-button {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
  }

  .primary-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .primary-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .secondary-button {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .secondary-button:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .small-button {
    padding: 6px 12px;
    font-size: 13px;
  }

  .restore-button {
    background: #10b981;
    color: white;
  }

  .delete-button {
    background: #ef4444;
    color: white;
  }

  /* Operation Result */
  .operation-result {
    margin-top: 24px;
    padding: 20px;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .operation-result h4 {
    margin: 0 0 12px 0;
    color: #1f2937;
  }

  .result-summary {
    padding: 12px;
    border-radius: 6px;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .result-summary.success {
    background: #dcfce7;
    color: #166534;
    border: 1px solid #bbf7d0;
  }

  .result-summary.error {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  .result-group {
    padding: 8px 0;
    border-left-width: 3px;
    border-left-style: solid;
    padding-left: 12px;
    margin-bottom: 8px;
  }

  .result-group ul {
    margin: 8px 0 0 0;
    padding-left: 20px;
  }

  .result-group li {
    margin-bottom: 4px;
    font-size: 13px;
  }

  .item-size {
    color: #6b7280;
    font-size: 12px;
  }

  .item-reason {
    color: #f59e0b;
    font-size: 12px;
  }

  .item-error {
    color: #ef4444;
    font-size: 12px;
  }

  .result-duration, .result-backup {
    font-size: 13px;
    color: #6b7280;
    margin-top: 8px;
  }

  /* Backup Section */
  .backup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .backup-header h3 {
    margin: 0;
    color: #1f2937;
  }

  .backup-actions {
    display: flex;
    gap: 8px;
  }

  .backup-list {
    margin-bottom: 20px;
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: #6b7280;
  }

  .backup-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 12px;
    background: white;
  }

  .backup-info {
    flex: 1;
  }

  .backup-header-info {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 4px;
  }

  .backup-env {
    padding: 2px 8px;
    border-radius: 12px;
    color: white;
    font-size: 12px;
    font-weight: 500;
  }

  .backup-meta {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 4px;
  }

  .backup-items {
    font-size: 12px;
    color: #6b7280;
  }

  .backup-actions-row {
    display: flex;
    gap: 8px;
  }

  .restore-confirmation {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .confirmation-content {
    background: white;
    padding: 24px;
    border-radius: 12px;
    max-width: 400px;
    text-align: center;
  }

  .confirmation-content h4 {
    margin: 0 0 12px 0;
    color: #1f2937;
  }

  .confirmation-content p {
    margin: 8px 0;
    color: #6b7280;
  }

  .confirmation-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 20px;
  }

  /* Compare Section */
  .compare-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .compare-header h3 {
    margin: 0;
    color: #1f2937;
  }

  .last-updated {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 16px;
  }

  .comparison-summary {
    display: grid;
    gap: 12px;
    margin-bottom: 24px;
    padding: 16px;
    background: #f8fafc;
    border-radius: 8px;
  }

  .summary-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .count {
    padding: 2px 8px;
    background: #e5e7eb;
    border-radius: 12px;
    font-weight: 600;
    font-size: 12px;
  }

  .detailed-comparison {
    margin-bottom: 24px;
  }

  .detailed-comparison h4 {
    margin: 0 0 16px 0;
    color: #1f2937;
  }

  .env-comparison {
    margin-bottom: 24px;
  }

  .env-comparison h5 {
    margin: 0 0 12px 0;
    font-size: 16px;
  }

  .comparison-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .comparison-item:last-child {
    border-bottom: none;
  }

  .item-status {
    margin-left: auto;
    font-size: 13px;
  }

  .size-differences {
    padding: 16px;
    background: #fef3c7;
    border-radius: 8px;
    border: 1px solid #fde68a;
  }

  .size-differences h4 {
    margin: 0 0 12px 0;
    color: #92400e;
  }

  .difference-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
  }

  .size-comparison {
    display: flex;
    gap: 16px;
    margin-left: auto;
    font-size: 13px;
  }

  .diff-size {
    color: #dc2626;
    font-weight: 600;
  }

  .error-message {
    padding: 16px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #991b1b;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .copy-environment-container {
      padding: 12px;
    }

    .preset-grid {
      grid-template-columns: 1fr;
    }

    .environment-info {
      flex-direction: column;
      gap: 12px;
      text-align: center;
    }

    .action-buttons {
      flex-direction: column;
    }

    .backup-item {
      flex-direction: column;
      gap: 12px;
    }

    .backup-actions-row {
      align-self: stretch;
    }

    .detailed-comparison {
      display: none; /* Hide detailed comparison on mobile */
    }
  }
</style>