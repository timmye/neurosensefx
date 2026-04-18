<script>
  import { onMount, onDestroy } from 'svelte';
  import { createInteractConfig } from '../lib/interactSetup.js';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';

  let element, interactable, scriptTag;
  let resizeTimeout;

  function createWidget(width, height) {
    if (window.FJWidgets) {
      // FJWidgets.createWidget expects container as a string ID, not a DOM element
      window.FJWidgets.createWidget({
        container: 'financialjuice-news-widget-container',
        mode: 'Dark',
        width,
        height,
        backColor: '1e222d',
        fontColor: 'b2b5be',
        widgetType: 'NEWS'
      });
    }
  }

  onMount(() => {
    interactable = createInteractConfig(element, {
      ignoreFrom: '.financialjuice-container',
      onDragMove: (e) => workspaceActions.updateHeadlinesPosition({ x: e.rect.left, y: e.rect.top }),
      onResizeMove: (e) => {
        workspaceActions.updateHeadlinesSize({ width: e.rect.width, height: e.rect.height });
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          const container = document.getElementById('financialjuice-news-widget-container');
          if (container && window.FJWidgets) {
            container.innerHTML = '';
            createWidget(e.rect.width, e.rect.height);
          }
        }, 300);
      }
    });

    scriptTag = document.createElement('script');
    scriptTag.src = `https://feed.financialjuice.com/widgets/widgets.js?r=${Date.now()}`;
    scriptTag.onerror = () => {
      console.warn('[HeadlinesWidget] FinancialJuice script failed to load');
    };
    scriptTag.onload = () => {
      if (!window.FJWidgets) {
        console.warn('[HeadlinesWidget] FJWidgets global not defined after script load');
        return;
      }
      createWidget($workspaceStore.headlinesSize.width, $workspaceStore.headlinesSize.height);
    };
    document.head.appendChild(scriptTag);
  });

  onDestroy(() => {
    clearTimeout(resizeTimeout);
    interactable?.unset();
    if (scriptTag && scriptTag.parentNode) {
      scriptTag.parentNode.removeChild(scriptTag);
    }
    const container = document.getElementById('financialjuice-news-widget-container');
    if (container) container.innerHTML = '';
  });
</script>

<div class="floating-display" bind:this={element}
  style="left: {$workspaceStore.headlinesPosition.x}px; top: {$workspaceStore.headlinesPosition.y}px; width: {$workspaceStore.headlinesSize.width}px; height: {$workspaceStore.headlinesSize.height}px;">
  <div class="display-header">
    <span class="display-symbol">HEADLINES</span>
    <button class="display-close-btn" on:click={workspaceActions.toggleHeadlines}>×</button>
  </div>
  <div id="financialjuice-news-widget-container" class="financialjuice-container"></div>
  <div class="resize-handle"></div>
</div>

<style>
  .floating-display{position:absolute;background:#1a1a1a;border:1px solid #333;border-radius:4px;overflow:hidden;user-select:none;outline:none;transition:border-color .2s ease,box-shadow .2s ease;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .display-header{display:flex;justify-content:space-between;align-items:center;height:40px;background:rgba(42,42,42,0.95);backdrop-filter:blur(4px);padding:0 4px;cursor:move}
  .display-symbol{color:#fff;font-weight:600;font-size:16px}
  .display-close-btn{background:none;border:none;color:#999;font-size:14px;cursor:pointer;padding:2px 3px;border-radius:2px;transition:background .2s ease,color .2s ease;line-height:1}
  .display-close-btn:hover,.display-close-btn:focus{background:#3a3a3a;color:#fff}
  .display-close-btn:focus{outline:1px solid #4a9eff}
  .floating-display:focus{border-color:#4a9eff;box-shadow:0 0 8px rgba(74,158,255,.4)}
  .floating-display:focus-visible{border-color:#4a9eff;box-shadow:0 0 12px rgba(74,158,255,.6);outline:2px solid rgba(74,158,255,.3);outline-offset:2px}
  .financialjuice-container{width:100%;height:calc(100% - 36px);overflow:hidden}
  .resize-handle{position:absolute;right:0;bottom:0;width:16px;height:16px;background:linear-gradient(135deg,transparent 50%,#555 50%);cursor:se-resize;opacity:.6;transition:opacity .2s ease}
  .resize-handle:hover{opacity:1}
</style>
