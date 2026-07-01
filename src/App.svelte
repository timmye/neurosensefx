<script>
  // Auth gate: checks session on mount. Shows loading, then either Workspace or LoginForm (ref: DL-011).
  // Hard cutover — no anonymous mode. All users must register after auth deployment.
  import { authStore, checkSession } from './stores/authStore.js';
  import { themeStore } from './stores/themeStore.js';
  import Workspace from './components/Workspace.svelte';
  import LoginForm from './components/LoginForm.svelte';
  import './lib/visualizers.js';

  let authenticated = false;
  let loading = true;

  authStore.subscribe(state => {
    authenticated = state.isAuthenticated;
    loading = state.isLoading;
  });

  checkSession();

  // Theme DOM wiring (net-new): drive <html data-theme> from the store so the
  // token layer ([data-theme="dark|light"] in tokens.css) re-skins the shell.
  $: if (typeof document !== 'undefined') document.documentElement.dataset.theme = $themeStore;
</script>

<main>
  {#if loading}
    <div class="loading">Loading...</div>
  {:else if authenticated}
    <Workspace />
  {:else}
    <LoginForm />
  {/if}
</main>

<style>
  main {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: var(--bg-app);
  }
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: var(--text-label);
    font-size: 1.25rem;
  }
</style>
