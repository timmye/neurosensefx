<script>
  import { createEventDispatcher } from 'svelte';
  import { shortcutStore, shortcutsByCategory, shortcutsByWorkflow, setShowHelp } from '../stores/shortcutStore.js';
  import { formatKeyForDisplay } from '../utils/shortcutConfig.js';
  import { keyboardEventStore } from '../actions/keyboardAction.js';
  import { onMount, onDestroy } from 'svelte';

  // Note: visible prop removed to prevent conflicts with shortcutStore.showHelp

  const dispatch = createEventDispatcher();

  // Reactive store subscriptions
  $: showHelp = $shortcutStore.showHelp;
  $: shortcutsByCat = filterImplementedShortcuts($shortcutsByCategory);
  $: shortcutsByWork = filterImplementedShortcuts($shortcutsByWorkflow);

  
  // Filter shortcuts to show only implemented ones
  function filterImplementedShortcuts(shortcutsObj) {
    const filtered = {};
    Object.entries(shortcutsObj).forEach(([category, shortcutList]) => {
      filtered[category] = shortcutList.filter(shortcut => shortcut.implemented !== false);
    });
    return filtered;
  }

  // Close help overlay
  function closeHelp() {
    setShowHelp(false);
  }

  // Get icon for category
  function getCategoryIcon(category) {
    const icons = {
      'symbol': '🔍',
      'navigation': '🧭',
      'display': '📊',
      'configuration': '⚙️',
      'system': '🖥️',
      'general': '📝'
    };
    return icons[category] || '📝';
  }

  // Get icon for workflow
  function getWorkflowIcon(workflow) {
    const icons = {
      'core': '⚡',
      'quick-actions': '🚀',
      'professional': '🎯',
      'system': '🔧',
      'legacy': '📚'
    };
    return icons[workflow] || '📝';
  }

  // Get workflow display name
  function getWorkflowName(workflow) {
    const names = {
      'core': 'Core Trading',
      'quick-actions': 'Quick Actions',
      'professional': 'Professional',
      'system': 'System & Help',
      'legacy': 'Legacy'
    };
    return names[workflow] || workflow;
  }

  // Get category display name
  function getCategoryName(category) {
    const names = {
      'symbol': 'Symbol Management',
      'navigation': 'Display Navigation',
      'display': 'Display Controls',
      'configuration': 'Configuration',
      'system': 'System Functions',
      'general': 'General'
    };
    return names[category] || category;
  }

  // Track current view mode
  let viewMode = 'workflow'; // 'workflow' or 'category'

  // Search functionality
  let searchQuery = '';
  let filteredShortcuts = [];

  // Unified keyboard event handling
  let unsubscribeKeyboardEvents;

  // Subscribe to unified keyboard events when component mounts
  onMount(() => {
    unsubscribeKeyboardEvents = keyboardEventStore.subscribe((event) => {
      if (event && showHelp && event.type === 'escape') {
        // Handle escape event for closing help overlay
        closeHelp();
      }
    });
  });

  // Cleanup subscription when component unmounts
  onDestroy(() => {
    if (unsubscribeKeyboardEvents) {
      unsubscribeKeyboardEvents();
    }
  });

  // Filter shortcuts based on search
  $: if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredShortcuts = [];

    Object.values(shortcutsByCat).forEach(categoryShortcuts => {
      categoryShortcuts.forEach(shortcut => {
        if (
          shortcut.description.toLowerCase().includes(query) ||
          shortcut.key.toLowerCase().includes(query) ||
          shortcut.category.toLowerCase().includes(query) ||
          (shortcut.workflow && shortcut.workflow.toLowerCase().includes(query))
        ) {
          // ✅ CRITICAL FIX: Ensure every shortcut has a valid unique ID
          filteredShortcuts.push({
            ...shortcut,
            id: shortcut.id || `search-${shortcut.key}-${Math.random().toString(36).substr(2, 9)}`
          });
        }
      });
    });
  } else {
    filteredShortcuts = [];
  }

  // ✅ CRITICAL FIX: Helper function to ensure unique keys for shortcuts
  function getSafeShortcutKey(shortcut, index, category = '') {
    // Defensive check for undefined shortcuts
    if (!shortcut) {
      return `undefined-shortcut-${category || 'unknown'}-${index}-${Math.random().toString(36).substr(2, 6)}`;
    }

    if (shortcut.id && shortcut.id !== undefined) {
      return shortcut.id;
    }
    // Fallback key generation using multiple properties to ensure uniqueness
    return `${category || 'unknown'}-${shortcut.key || 'no-key'}-${index}-${Math.random().toString(36).substr(2, 6)}`;
  }
</script>


<!-- Help Overlay -->
{#if showHelp}
  <div class="shortcut-help-overlay" on:click={closeHelp}>
    <div class="shortcut-help-modal" on:click|stopPropagation>
      <!-- Header -->
      <div class="help-header">
        <h2 class="help-title">
          <span class="icon">⌨️</span>
          Keyboard Shortcuts
        </h2>
        <button class="close-button" on:click={closeHelp} title="Close (Escape)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Search Bar -->
      <div class="search-section">
        <div class="search-container">
          <input
            type="text"
            class="search-input"
            placeholder="Search shortcuts..."
            bind:value={searchQuery}
            autofocus
          />
          <div class="search-icon">🔍</div>
        </div>
      </div>

      <!-- View Mode Toggle -->
      {#if !searchQuery.trim()}
        <div class="view-mode-toggle">
          <button
            class="mode-button"
            class:active={viewMode === 'workflow'}
            on:click={() => viewMode = 'workflow'}
          >
            Workflow
          </button>
          <button
            class="mode-button"
            class:active={viewMode === 'category'}
            on:click={() => viewMode = 'category'}
          >
            Category
          </button>
        </div>
      {/if}

      <!-- Content -->
      <div class="help-content">
        {#if searchQuery.trim()}
          <!-- Search Results -->
          <div class="search-results">
            <h3 class="section-title">Search Results</h3>
            {#if filteredShortcuts.length > 0}
              <div class="shortcut-list">
                {#each filteredShortcuts as shortcut, index (getSafeShortcutKey(shortcut, index, 'search'))}
                  {#if shortcut && shortcut.description}
                    <div class="shortcut-item">
                      <div class="shortcut-info">
                        <div class="shortcut-description">{shortcut.description}</div>
                        <div class="shortcut-meta">
                          <span class="category">{getCategoryName(shortcut.category || 'general')}</span>
                          {#if shortcut.workflow}
                            <span class="workflow">• {getWorkflowName(shortcut.workflow)}</span>
                          {/if}
                        </div>
                      </div>
                      <div class="shortcut-key">{shortcut.formattedKey || shortcut.key}</div>
                    </div>
                  {/if}
                {/each}
              </div>
            {:else}
              <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <p>No shortcuts found matching "{searchQuery}"</p>
              </div>
            {/if}
          </div>
        {:else if viewMode === 'workflow'}
          <!-- Workflow View -->
          <div class="workflow-view">
            {#each Object.entries(shortcutsByWork) as [workflow, shortcuts] (workflow)}
              {#if shortcuts && shortcuts.length > 0}
                <div class="workflow-section">
                  <h3 class="workflow-title">
                    <span class="workflow-icon">{getWorkflowIcon(workflow)}</span>
                    {getWorkflowName(workflow)}
                  </h3>
                  <div class="shortcut-list">
                    {#each shortcuts as shortcut, index (getSafeShortcutKey(shortcut, index, workflow))}
                      {#if shortcut && shortcut.description}
                        <div class="shortcut-item">
                          <div class="shortcut-info">
                            <div class="shortcut-description">{shortcut.description}</div>
                            <div class="shortcut-category">{getCategoryName(shortcut.category || 'general')}</div>
                          </div>
                          <div class="shortcut-key">{shortcut.formattedKey || shortcut.key}</div>
                        </div>
                      {/if}
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {:else}
          <!-- Category View -->
          <div class="category-view">
            {#each Object.entries(shortcutsByCat) as [category, shortcuts] (category)}
              {#if shortcuts && shortcuts.length > 0}
                <div class="category-section">
                  <h3 class="category-title">
                    <span class="category-icon">{getCategoryIcon(category)}</span>
                    {getCategoryName(category)}
                  </h3>
                  <div class="shortcut-list">
                    {#each shortcuts as shortcut, index (getSafeShortcutKey(shortcut, index, category))}
                      {#if shortcut && shortcut.description}
                        <div class="shortcut-item">
                          <div class="shortcut-info">
                            <div class="shortcut-description">{shortcut.description}</div>
                            {#if shortcut.workflow}
                              <div class="shortcut-workflow">{getWorkflowName(shortcut.workflow)}</div>
                            {/if}
                          </div>
                          <div class="shortcut-key">{shortcut.formattedKey || shortcut.key}</div>
                        </div>
                      {/if}
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="help-footer">
        <div class="tip">
          <strong>💡 Tip:</strong> Press <kbd class="key">Ctrl</kbd> + <kbd class="key">/</kbd> anytime to show this help
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .shortcut-help-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
    box-sizing: border-box;
  }

  .shortcut-help-modal {
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 12px;
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  /* Header */
  .help-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid #374151;
    background: #111827;
  }

  .help-title {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #f9fafb;
  }

  .help-title .icon {
    font-size: 24px;
  }

  .close-button {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-button:hover {
    background: #374151;
    color: #f9fafb;
  }

  /* Search Section */
  .search-section {
    padding: 20px 24px;
    border-bottom: 1px solid #374151;
    background: #1f2937;
  }

  .search-container {
    position: relative;
  }

  .search-input {
    width: 100%;
    padding: 12px 16px 12px 44px;
    background: #111827;
    border: 1px solid #374151;
    border-radius: 8px;
    color: #f9fafb;
    font-size: 14px;
    outline: none;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .search-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    font-size: 16px;
  }

  /* View Mode Toggle */
  .view-mode-toggle {
    display: flex;
    gap: 8px;
    padding: 16px 24px;
    border-bottom: 1px solid #374151;
    background: #1f2937;
  }

  .mode-button {
    padding: 8px 16px;
    background: #374151;
    border: none;
    border-radius: 6px;
    color: #9ca3af;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .mode-button:hover {
    background: #4b5563;
    color: #f9fafb;
  }

  .mode-button.active {
    background: #3b82f6;
    color: white;
  }

  /* Content */
  .help-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
  }

  /* Sections */
  .workflow-section,
  .category-section {
    margin-bottom: 32px;
  }

  .workflow-section:last-child,
  .category-section:last-child {
    margin-bottom: 0;
  }

  .workflow-title,
  .category-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #f9fafb;
  }

  .workflow-icon,
  .category-icon {
    font-size: 18px;
  }

  /* Shortcut List */
  .shortcut-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #374151;
    border-radius: 8px;
    border: 1px solid #4b5563;
    transition: all 0.2s ease;
  }

  .shortcut-item:hover {
    background: #4b5563;
    border-color: #6b7280;
  }

  .shortcut-info {
    flex: 1;
    min-width: 0;
  }

  .shortcut-description {
    font-size: 14px;
    color: #f9fafb;
    margin-bottom: 2px;
  }

  .shortcut-meta,
  .shortcut-category,
  .shortcut-workflow {
    font-size: 12px;
    color: #9ca3af;
  }

  .shortcut-key {
    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
    font-size: 13px;
    color: #60a5fa;
    background: #1e40af;
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
    margin-left: 16px;
  }

  /* Search Results */
  .search-results .section-title {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #f9fafb;
  }

  .no-results {
    text-align: center;
    padding: 40px 20px;
    color: #9ca3af;
  }

  .no-results-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .no-results p {
    margin: 0;
    font-size: 14px;
  }

  /* Footer */
  .help-footer {
    padding: 16px 24px;
    border-top: 1px solid #374151;
    background: #111827;
  }

  .tip {
    font-size: 13px;
    color: #9ca3af;
    text-align: center;
  }

  .key {
    display: inline-block;
    padding: 2px 6px;
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 3px;
    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
    font-size: 12px;
    color: #f9fafb;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .shortcut-help-modal {
      max-width: 100%;
      max-height: 100vh;
      margin: 0;
      border-radius: 0;
    }

    .help-header,
    .search-section,
    .help-content,
    .help-footer {
      padding-left: 16px;
      padding-right: 16px;
    }

    .shortcut-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .shortcut-key {
      margin-left: 0;
      align-self: flex-end;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .shortcut-help-overlay,
    .shortcut-help-modal,
    .shortcut-item {
      transition: none;
    }
  }

  /* High Contrast */
  @media (prefers-contrast: high) {
    .shortcut-help-overlay {
      background: rgba(0, 0, 0, 0.9);
    }

    .shortcut-help-modal {
      border: 2px solid #f9fafb;
      background: #000;
    }

    .shortcut-item {
      border: 2px solid #f9fafb;
    }
  }
</style>