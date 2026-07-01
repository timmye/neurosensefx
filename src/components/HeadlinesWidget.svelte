<script>
  import { onMount, onDestroy } from 'svelte';
  import { workspaceActions, headlinesStore } from '../stores/workspace.js';
  import DisplayFrame from './displays/DisplayFrame.svelte';
  import DisplayHeader from './displays/DisplayHeader.svelte';

  let scriptTag;
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

  // interact.js drag/resize/snap — handed to <DisplayFrame>, which owns the setup.
  // ignoreFrom lets pointer events reach the news widget; resize debounces widget recreation.
  const interactCallbacks = {
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
  };

  onMount(() => {
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
      createWidget($headlinesStore.headlinesSize.width, $headlinesStore.headlinesSize.height);
    };
    document.head.appendChild(scriptTag);
  });

  onDestroy(() => {
    clearTimeout(resizeTimeout);
    if (scriptTag && scriptTag.parentNode) {
      scriptTag.parentNode.removeChild(scriptTag);
    }
    const container = document.getElementById('financialjuice-news-widget-container');
    if (container) container.innerHTML = '';
  });
</script>

<DisplayFrame
  position={$headlinesStore.headlinesPosition}
  size={$headlinesStore.headlinesSize}
  interactCallbacks={interactCallbacks}>
  <DisplayHeader slot="header" minimal symbol="HEADLINES" onClose={workspaceActions.toggleHeadlines} />
  <div id="financialjuice-news-widget-container" class="financialjuice-container"></div>
</DisplayFrame>

<style>
  .financialjuice-container{width:100%;height:calc(100% - 36px);overflow:hidden}
</style>
