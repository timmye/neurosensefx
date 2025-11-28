<script>
  import { onMount, onDestroy } from 'svelte';
  import { displayStore, displayActions, displays, icons, panels, defaultConfig, contextMenu } from './stores/displayStore.js';
  import { shortcutStore, initializeShortcuts } from './stores/shortcutStore.js';
import { keyboardAction, initializeKeyboardSystem } from './actions/keyboardAction.js';
  import { subscribe, unsubscribe } from './data/wsClient.js';
  import FloatingDisplay from './components/FloatingDisplay.svelte';
  import FloatingIcon from './components/FloatingIcon.svelte';
  import UnifiedContextMenu from './components/UnifiedContextMenu.svelte';
  import SymbolPalette from './components/SymbolPalette.svelte';
  import StatusPanel from './components/StatusPanel/StatusPanel.svelte';
  import StatusIcon from './components/StatusPanel/StatusIcon.svelte';
  import ShortcutHelp from './components/ShortcutHelp.svelte';
      import symbolService from './services/symbolService.js';
  import { Environment, EnvironmentConfig, initializeEnvironment, getEnvironmentInfo } from './lib/utils/environmentUtils.js';

  // Error Boundary Components
  import ErrorBoundary from './components/shared/ErrorBoundary.svelte';
  import TradingWorkflowErrorBoundary from './components/shared/TradingWorkflowErrorBoundary.svelte';
  import UserErrorExperience from './components/shared/UserErrorExperience.svelte';
  import { withErrorBoundary, withAsyncErrorBoundary } from './utils/errorBoundaryUtils.js';

  // ✅ LAZY LOADING: Production build optimization for heavy components
  import { initializeVisualizationPreloading } from './lib/viz/LazyVisualizationManager.js';
  // import { preloadCriticalComponents } from './components/lazy/componentLoaders.js'; // Temporarily disabled due to Vite issues

  
  // 📝 Window Type Extension: contextMenuRef will be available globally
  
  // Store subscriptions - DEFENSIVE: Handle undefined stores during initialization
  // DEFENSIVE: Add initialization guard to prevent race conditions
  let storesInitialized = false;

  $: if ($displays && $icons && $panels && !storesInitialized) {
    storesInitialized = true;
  }

  // CRITICAL FIX: Add deduplication to prevent duplicate component creation causing two canvases
  $: displayList = storesInitialized && $displays ?
    Array.from($displays.values())
      .filter((display, index, array) =>
        // Remove duplicates by display.id - maintain first occurrence
        array.findIndex(d => d.id === display.id) === index
      ) : [];
  $: iconList = storesInitialized && $icons ? Array.from($icons.values()) : [];
  $: panelList = storesInitialized && $panels ? Array.from($panels.values()) : [];

  // 🔧 DEBUG: Enhanced display list logging for diagnosis - DEFENSIVE: Guard against undefined lists
  // DEFENSIVE: Only log when stores are properly initialized
  $: if (storesInitialized) {
    console.log('[APP] Display list update:', {
      displaysCount: $displays?.size || 0,
      displayListCount: displayList?.length || 0,
      displayIds: Array.from($displays?.keys() || []),
      displays: displayList?.map?.(d => ({
        id: d.id,
        symbol: d.symbol,
        ready: d.ready,
        hasState: !!d.state,
        stateReady: d.state?.ready
      })) || []
    });
  }

  // 🔧 DEBUG: Log display list changes - DEFENSIVE: Guard against undefined displayList
  // DEFENSIVE: Only track changes when stores are initialized
  $: if (storesInitialized && displayList?.length !== (previousDisplayCount || 0)) {
    console.log('[APP] Display list changed:', {
      count: displayList?.length || 0,
      previousCount: previousDisplayCount || 0,
      displays: displayList?.map?.(d => ({ id: d.id, symbol: d.symbol, ready: d.ready })) || []
    });
    previousDisplayCount = displayList?.length || 0;
  }

  let previousDisplayCount = 0;

  // DEFENSIVE: Store initialization health check
  function validateStoreInitialization() {
    if (!$displays || !$icons || !$panels) {
      console.warn('[APP] Store initialization incomplete - some stores are undefined');
      return false;
    }
    return true;
  }

  let symbolPaletteRef;
  let contextMenuRef; // Reference to UnifiedContextMenu for intelligent context detection

  // Make contextMenuRef globally available for components
  $: if (contextMenuRef && typeof window !== 'undefined') {
    window.contextMenuRef = contextMenuRef;
  }

  // 🌍 ENVIRONMENT AWARENESS: Global environment state and initialization
  let environmentInfo = null;
  let showGlobalEnvironmentIndicator = false;
  let environmentInitialized = false;
  
  
  // Legacy keyboard shortcuts maintained for compatibility
  // New centralized shortcut system handles most shortcuts

  // Focus symbol palette (expand if collapsed) - kept for compatibility
  function focusSymbolPalette() {
    const iconId = 'symbol-palette-icon';
    const icon = $icons.get(iconId);

    // Expand icon if collapsed
    if (icon && !icon.isExpanded) {
      displayActions.expandIcon(iconId);
    }

    // Focus search input with longer delay for animation
    setTimeout(() => {
      if (symbolPaletteRef && symbolPaletteRef.focusSearch) {
        symbolPaletteRef.focusSearch();
      }
    }, 600); // Increased from 300ms to 600ms
  }

  // Toggle symbol palette visibility - kept for compatibility
  function toggleSymbolPalette() {
    const iconId = 'symbol-palette-icon';
    const icon = $icons.get(iconId);

    if (icon) {
      if (icon.isExpanded) {
        displayActions.collapseIcon(iconId);
      } else {
        displayActions.expandIcon(iconId);
      }
    }
  }

  // REMOVED: handleShortcutEvents function - conflicting system
// Keyboard shortcuts are now handled by the unified keyboardAction.js system
  
  // Initialize displays on mount with enhanced sequential initialization
  onMount(async () => {
    console.log('[APP] Starting initialization with error boundary protection...');

    try {
      // ⌨️ KEYBOARD SHORTCUTS: Enhanced sequential initialization
      console.log('[APP] Starting enhanced keyboard system initialization...');

      // Phase 1: Initialize core keyboard system with sequencing guarantees
      await initializeKeyboardSystem();

      // Phase 2: Initialize shortcut system with proper dependencies
      await initializeShortcuts();

      console.log('[APP] Enhanced keyboard system initialization completed');

      // 🌍 ENVIRONMENT AWARENESS: Initialize environment system first
      console.log('[APP] Initializing environment system...');
      const envInit = initializeEnvironment();
      if (envInit.success) {
        environmentInitialized = true;
        environmentInfo = getEnvironmentInfo();
        showGlobalEnvironmentIndicator = EnvironmentConfig.current.showEnvironmentIndicator;

        console.log('[APP] Environment initialized successfully:', {
          environment: Environment.current,
          showIndicator: showGlobalEnvironmentIndicator,
          config: EnvironmentConfig.current
        });

        // Show environment-specific console message
        if (Environment.isDevelopment) {
          console.log('%c🔧 NeuroSense FX Development Mode', 'color: #a855f7; font-weight: bold; font-size: 14px;');
          console.log('%cDebug logging and development features are enabled', 'color: #a855f7; font-style: italic;');
        } else {
          console.log('%c🚀 NeuroSense FX Production Mode', 'color: #0891b2; font-weight: bold; font-size: 14px;');
        }
      } else {
        console.warn('[APP] Environment initialization failed:', envInit);
      }

      // 🚀 PRODUCTION OPTIMIZATION: Initialize lazy loading and preloading
      if (!Environment.isDevelopment) {
        console.log('[APP] Initializing production lazy loading...');

        // Preload critical components after initial render
        // setTimeout(() => {
        //   preloadCriticalComponents().catch(error => {
        //     console.warn('[APP] Critical component preloading failed:', error);
        //   });
        // }, 500); // Temporarily disabled due to Vite issues

        // Initialize visualization preloading
        initializeVisualizationPreloading();
      }

      // Initialize workspace from persisted data first
      await displayActions.initializeWorkspace();

      // Ensure symbol palette starts collapsed (override any saved state)
      setTimeout(() => {
        // Force collapse and remove any existing panel
        displayActions.collapseIcon('symbol-palette-icon');

        // Remove any existing symbol palette panel from previous sessions
        displayStore.update(store => {
          const newPanels = new Map(store.panels);
          newPanels.delete('symbol-palette');
          return {
            ...store,
            panels: newPanels
          };
        });
      }, 100);

      // Initialize symbol service
      await symbolService.initialize();
      const symbols = symbolService.getSymbols();
      const firstSymbol = symbolService.getFirstSymbol();
      
      // Create symbol palette floating icon (panel is created when icon is clicked)
      displayActions.addIcon('symbol-palette-icon', 'symbol-palette', { x: 20, y: 20 }, {
        title: 'Symbol Palette',
        status: 'online'
      });

      // Create status icon (following symbol palette pattern)
      console.log('[APP] Creating status icon...');
      displayActions.addIcon('status-icon', 'status-icon', { x: window.innerWidth - 100, y: 20 }, {
        title: 'System Status',
        status: 'online'
      });
      console.log('[APP] Status icon created');

    } catch (error) {
      console.error('[APP] Initialization failed:', error);
      // Fallback: try to create display with default symbol
      try {
        const fallbackSymbol = 'EURUSD';
        const validation = symbolService.validateSymbol(fallbackSymbol);
        if (validation.valid) {
          const displayId = displayActions.addDisplay(validation.symbol, { x: 100, y: 100 });
        }
      } catch (fallbackError) {
        console.error('[APP] Fallback display creation also failed:', fallbackError);
        // Emergency fallback - create minimal working state
        console.warn('[APP] Emergency fallback activated - minimal functionality mode');
      }
    }

    // 🎨 CONTEXT MENU: Setup global context menu reference after components are mounted
    setTimeout(() => {
      if (contextMenuRef && typeof window !== 'undefined') {
        window.contextMenuRef = contextMenuRef;
      } else {
        // Try again after additional delay
        setTimeout(() => {
          if (contextMenuRef && typeof window !== 'undefined') {
            window.contextMenuRef = contextMenuRef;
          }
        }, 1000);
      }
    }, 1000); // Increase delay to ensure components are fully mounted

    // REMOVED: KEYBOARD SHORTCUTS: Add event listeners for custom shortcut events - conflicting system
    // Keyboard shortcuts are now handled by the unified keyboardAction.js system


  // Handle workspace right-click with error boundary
  function handleWorkspaceContextMenu(e) {
    return withErrorBoundary(() => {
      if (e.target === e.currentTarget) {
        e.preventDefault();

        // Use unified context menu system
        const context = {
          type: 'workspace',
          targetId: null,
          targetType: 'workspace'
        };

        displayActions.showContextMenu(e.clientX, e.clientY, null, 'workspace', context);
      }
    }, null, 'handleWorkspaceContextMenu');
  }
</script>


<TradingWorkflowErrorBoundary criticalMode={true} workflowName="Main Application">
  <main use:keyboardAction>
    <!-- Workspace Background -->
    <div
      class="workspace"
      on:contextmenu={handleWorkspaceContextMenu}
    >
      <!-- 🌍 Global Environment Indicator -->
      {#if showGlobalEnvironmentIndicator && environmentInfo}
        <div class="global-environment-indicator" class:env-dev={Environment.isDevelopment} class:env-prod={Environment.isProduction}>
          <div class="env-icon">
            {Environment.isDevelopment ? '🔧' : '🚀'}
          </div>
          <div class="env-text">
            <span class="env-mode">{Environment.current.toUpperCase()}</span>
            {#if Environment.isDevelopment}
              <span class="env-details">DEV MODE</span>
            {/if}
          </div>
          {#if Environment.isDevelopment && EnvironmentConfig.current.debugLogging}
            <div class="env-debug-indicator" title="Debug Logging Enabled"></div>
          {/if}
        </div>
      {/if}
    </div>
  
      <!-- Floating Icons (Layer 3) - DEFENSIVE: Only iterate if iconList exists -->
      {#if iconList?.length > 0}
        <ErrorBoundary errorMessage="Failed to load floating icons" fallbackComponent={null}>
          {#each iconList as icon (icon.id)}
            <ErrorBoundary
              errorMessage={`Failed to load icon: ${icon.type}`}
              showRetry={true}
            >
              <FloatingIcon
                id={icon.id}
                type={icon.type}
                position={icon.position}
                config={icon.config}
                title={icon.config?.title}
                on:toggleExpansion={(e) => {
                  const { id, isExpanded } = e.detail;
                  if (isExpanded) {
                    displayActions.expandIcon(id);
                  } else {
                    displayActions.collapseIcon(id);
                  }
                }}
              >
                {#if icon.type === 'status-icon'}
                  <ErrorBoundary errorMessage="Status icon unavailable">
                    <StatusIcon />
                  </ErrorBoundary>
                {/if}
              </FloatingIcon>
            </ErrorBoundary>
          {/each}
        </ErrorBoundary>
      {/if}

  <!-- Floating Displays (Layer 1) - DEFENSIVE: Only iterate if displayList exists -->
  {#if displayList?.length > 0}
    <ErrorBoundary errorMessage="Failed to load trading displays" fallbackComponent={null}>
      {#each displayList as display (display.id)}
        <ErrorBoundary
          errorMessage={`Failed to load display: ${display.symbol}`}
          showRetry={true}
        >
          <FloatingDisplay
            id={display.id}
            symbol={display.symbol}
            position={display.position}
          />
        </ErrorBoundary>
      {/each}
    </ErrorBoundary>
  {/if}

  <!-- Symbol Palette (Layer 2) - DEFENSIVE: Only iterate if panelList exists -->
  {#if panelList?.length > 0}
    <ErrorBoundary errorMessage="Failed to load panels" fallbackComponent={null}>
      {#each panelList as panel (panel.id)}
        {#if panel.id === 'symbol-palette'}
          <ErrorBoundary errorMessage="Symbol palette unavailable" showRetry={true}>
            <SymbolPalette bind:this={symbolPaletteRef} />
          </ErrorBoundary>
        {/if}
      {/each}
    </ErrorBoundary>
  {/if}

  <!-- Status Panel (Layer 2 - Expanded when icon is clicked) - DEFENSIVE: Only iterate if panelList exists -->
  {#if panelList?.length > 0}
    <ErrorBoundary errorMessage="Failed to load status panels" fallbackComponent={null}>
      {#each panelList as panel (panel.id)}
        {#if panel.id === 'status-panel'}
          <ErrorBoundary errorMessage="Status panel unavailable" showRetry={true}>
            <StatusPanel position={panel.position} config={panel.config} isFromIconExpansion={true} />
          </ErrorBoundary>
        {/if}
      {/each}
    </ErrorBoundary>
  {/if}

  <!-- Unified Context Menu (Layer 4) -->
  <ErrorBoundary errorMessage="Context menu unavailable">
    <UnifiedContextMenu bind:this={contextMenuRef} />
  </ErrorBoundary>

  <!-- Keyboard Shortcut Help Overlay (Layer 5) -->
  <ErrorBoundary errorMessage="Keyboard help unavailable">
    <ShortcutHelp />
  </ErrorBoundary>

  <!-- User Error Experience (Global Error Notifications) -->
  <ErrorBoundary errorMessage="Error notifications unavailable">
    <UserErrorExperience />
  </ErrorBoundary>

</main>
</TradingWorkflowErrorBoundary>

<style>
  :global(body) {
    background-color: #111827;
    margin: 0;
    /* overflow: hidden; ← REMOVED to allow expanded content visibility */
  }
  
  main {
    width: 100vw;
    height: 100vh;
    position: relative;
  }
  
  .workspace {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #111827;
    background-image:
      radial-gradient(circle at 20% 50%, rgba(79, 70, 229, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 40% 20%, rgba(239, 68, 68, 0.1) 0%, transparent 50%);
  }

  /* 🌍 Global Environment Indicator Styles */
  .global-environment-indicator {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid;
    background: rgba(15, 23, 42, 0.9);
    backdrop-filter: blur(12px);
    z-index: 1000;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .global-environment-indicator.env-dev {
    border-color: rgba(168, 85, 247, 0.4);
    background: rgba(168, 85, 247, 0.15);
    color: #a855f7;
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
  }

  .global-environment-indicator.env-prod {
    border-color: rgba(8, 145, 178, 0.4);
    background: rgba(8, 145, 178, 0.15);
    color: #0891b2;
    box-shadow: 0 4px 12px rgba(8, 145, 178, 0.2);
  }

  .env-icon {
    font-size: 16px;
    line-height: 1;
    animation: env-icon-pulse 2s infinite ease-in-out;
  }

  @keyframes env-icon-pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }

  .env-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .env-mode {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1;
  }

  .env-details {
    font-size: 9px;
    font-weight: 500;
    opacity: 0.8;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .env-debug-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f59e0b;
    flex-shrink: 0;
    animation: debug-pulse 1.5s infinite ease-in-out;
  }

  @keyframes debug-pulse {
    0%, 100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  /* Responsive adjustments for global environment indicator */
  @media (max-width: 768px) {
    .global-environment-indicator {
      top: 8px;
      left: 8px;
      padding: 6px 8px;
      font-size: 11px;
      gap: 6px;
    }

    .env-icon {
      font-size: 14px;
    }

    .env-details {
      font-size: 8px;
    }

    .env-debug-indicator {
      width: 5px;
      height: 5px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .global-environment-indicator,
    .env-icon,
    .env-debug-indicator {
      transition: none;
      animation: none;
    }
  }

  /* High contrast support */
  @media (prefers-contrast: high) {
    .global-environment-indicator {
      border-width: 2px;
      background: #000;
    }

    .global-environment-indicator.env-dev {
      border-color: #a855f7;
      color: #a855f7;
    }

    .global-environment-indicator.env-prod {
      border-color: #0891b2;
      color: #0891b2;
    }
  }
</style>
