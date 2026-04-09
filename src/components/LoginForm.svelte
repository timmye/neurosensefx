<!--
  Login/Register form. Tabbed UI with client-side validation.
  Server errors displayed via authStore.error. Renders before Workspace when unauthenticated.
-->
<script>
    import { authStore, login, register } from '../stores/authStore.js';
    let tab = 'login';
    let email = '';
    let password = '';
    let displayName = '';
    let localError = '';
    let formEl;

    $: isLoading = $authStore.isLoading;
    $: serverError = $authStore.error;

    async function handleSubmit() {
        localError = '';
        if (!email.trim()) { localError = 'Email is required'; return; }
        if (!password || password.length < 8) { localError = 'Password must be at least 8 characters'; return; }

        if (tab === 'login') {
            await login(email, password);
        } else {
            await register(email, password, displayName);
        }
    }

    function switchTab(t) {
        tab = t;
        localError = '';
        tick().then(() => formEl.querySelector('input')?.focus());
    }

    function onTabKeydown(e) {
        const tabs = ['login', 'register'];
        const idx = tabs.indexOf(tab);
        let next = idx;
        if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
        else return;
        e.preventDefault();
        switchTab(tabs[next]);
        e.target.focus();
    }

    import { tick } from 'svelte';
</script>

<div class="login-container">
    <div class="login-card">
        <h1>NeuroSense FX</h1>
        <p class="subtitle">Trading Visualization Platform</p>

        <div class="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'login'} class:active={tab === 'login'}
                on:click={() => switchTab('login')} on:keydown={onTabKeydown}>Login</button>
            <button role="tab" aria-selected={tab === 'register'} class:active={tab === 'register'}
                on:click={() => switchTab('register')} on:keydown={onTabKeydown}>Register</button>
        </div>

        <form bind:this={formEl} on:submit|preventDefault={handleSubmit}>
            <label>
                Email
                <input type="email" bind:value={email} disabled={isLoading} required autofocus />
            </label>

            <label>
                Password
                <input type="password" bind:value={password} disabled={isLoading} required minlength="8" />
            </label>

            {#if tab === 'register'}
                <label>
                    Display Name
                    <input type="text" bind:value={displayName} disabled={isLoading} maxlength="128" />
                </label>
            {/if}

            {#if localError}
                <p class="error">{localError}</p>
            {/if}
            {#if serverError}
                <p class="error">{serverError}</p>
            {/if}

            <button type="submit" disabled={isLoading}>
                {isLoading ? 'Please wait...' : (tab === 'login' ? 'Login' : 'Create Account')}
            </button>
        </form>
    </div>
</div>

<style>
    .login-container {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: #1a0a1a;
    }
    .login-card {
        background: #2a1a2a;
        border: 1px solid #3a2a3a;
        border-radius: 8px;
        padding: 2rem;
        width: 360px;
        color: #e0d0e0;
    }
    .login-card h1 { margin: 0 0 0.25rem 0; font-size: 1.5rem; }
    .subtitle { margin: 0 0 1.5rem 0; color: #a090a0; font-size: 0.875rem; }
    .tabs { display: flex; gap: 0; margin-bottom: 1.5rem; border-bottom: 1px solid #3a2a3a; }
    .tabs button {
        flex: 1; padding: 0.5rem; border: none; background: none;
        color: #a090a0; cursor: pointer; font-size: 0.875rem;
        border-bottom: 2px solid transparent;
    }
    .tabs button.active { color: #e0d0e0; border-bottom-color: #7c5caf; }
    .tabs button:focus-visible { outline: 2px solid #7c5caf; outline-offset: -2px; border-radius: 2px; }
    form label { display: block; margin-bottom: 1rem; font-size: 0.875rem; color: #a090a0; }
    form input {
        width: 100%; padding: 0.5rem; margin-top: 0.25rem;
        background: #1a0a1a; border: 1px solid #3a2a3a; border-radius: 4px;
        color: #e0d0e0; box-sizing: border-box;
    }
    form input:focus-visible { outline: 2px solid #7c5caf; outline-offset: -2px; }
    form input:disabled { opacity: 0.6; }
    .error { color: #e74c3c; font-size: 0.8rem; margin-bottom: 0.5rem; }
    form button[type="submit"] {
        width: 100%; padding: 0.75rem; margin-top: 0.5rem;
        background: #7c5caf; border: none; border-radius: 4px;
        color: white; cursor: pointer; font-size: 0.875rem;
    }
    form button[type="submit"]:focus-visible { outline: 2px solid #e0d0e0; outline-offset: 2px; }
    form button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
