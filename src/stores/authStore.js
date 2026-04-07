/**
 * Client-side authentication state management.
 * Stores user/session state in a Svelte writable store.
 * On first login, migrates existing localStorage/IndexedDB data to server (ref: DL-007).
 * All API calls use credentials: 'include' to send session cookies (ref: DL-005).
 */
import { writable, get } from 'svelte/store';
import Dexie from 'dexie';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const initialState = {
    user: null,
    isLoading: true,
    error: null,
    isAuthenticated: false
};

export const authStore = writable(initialState);

/** Check if any local browser data exists for migration. */
function hasLocalData() {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem('workspace-state')) return true;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('price-markers-')) return true;
    }
    return false;
}

/**
 * Collect all local browser data for migration upload.
 * Reads localStorage for workspace and markers, IndexedDB (Dexie) for drawings.
 */
async function collectLocalData() {
    const data = { drawings: [], markers: [] };
    if (typeof localStorage === 'undefined') return data;

    const ws = localStorage.getItem('workspace-state');
    if (ws) data.workspace = JSON.parse(ws);

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('price-markers-')) {
            data.markers.push({
                symbol: key.replace('price-markers-', ''),
                data: JSON.parse(localStorage.getItem(key))
            });
        }
    }

    try {
        const db = new Dexie('NeuroSenseDrawings');
        db.version(1).stores({ drawings: '++id, [symbol+resolution], overlayType, createdAt' });
        db.version(2).stores({ drawings: '++id, [symbol+resolution], symbol, overlayType, createdAt' });
        const allDrawings = await db.drawings.toArray();
        const byKey = new Map();
        for (const d of allDrawings) {
            const k = d.symbol + '/' + d.resolution;
            if (!byKey.has(k)) byKey.set(k, []);
            byKey.get(k).push(d);
        }
        for (const [key, items] of byKey) {
            const [symbol, resolution] = key.split('/');
            data.drawings.push({ symbol, resolution, data: items });
        }
        await db.close();
    } catch (err) {
        console.warn('[Auth] Could not read IndexedDB drawings:', err);
    }

    return data;
}

/**
 * Upload local browser data to server. Copy-not-move: local data is preserved
 * regardless of upload outcome (ref: DL-007). Only runs if local data exists.
 */
async function migrateLocalData() {
    if (localStorage.getItem('data-migrated')) return;
    if (!hasLocalData()) return;
    try {
        const data = await collectLocalData();
        const resp = await fetch(API_BASE + '/api/migrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        if (resp.ok) {
            console.log('[Auth] Local data migrated to server');
            localStorage.setItem('data-migrated', 'true');
        } else {
            console.warn('[Auth] Migration upload failed, local data preserved:', resp.status);
        }
    } catch (err) {
        console.warn('[Auth] Migration upload error, local data preserved:', err);
    }
}

/** Check existing session via GET /api/me. Updates authStore state accordingly. */
export async function checkSession() {
    try {
        const resp = await fetch(API_BASE + '/api/me', { credentials: 'include' });
        if (resp.ok) {
            const { user } = await resp.json();
            authStore.set({ user, isLoading: false, error: null, isAuthenticated: true });
            return true;
        }
    } catch (err) {
        console.warn('[Auth] Session check failed:', err);
    }
    authStore.set({ ...initialState, isLoading: false });
    return false;
}

/** Login and trigger local data migration on success. */
export async function login(email, password) {
    authStore.update(s => ({ ...s, isLoading: true, error: null }));
    try {
        const resp = await fetch(API_BASE + '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        const data = await resp.json();
        if (!resp.ok) {
            authStore.set({ ...initialState, isLoading: false, error: data.error?.message || 'Login failed' });
            return false;
        }
        authStore.set({ user: data.user, isLoading: false, error: null, isAuthenticated: true });
        // Migrate local data on first login (ref: DL-007)
        await migrateLocalData();
        return true;
    } catch (err) {
        authStore.set({ ...initialState, isLoading: false, error: 'Network error' });
        return false;
    }
}

/** Register and trigger local data migration on success. */
export async function register(email, password, displayName) {
    authStore.update(s => ({ ...s, isLoading: true, error: null }));
    try {
        const resp = await fetch(API_BASE + '/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password, display_name: displayName })
        });
        const data = await resp.json();
        if (!resp.ok) {
            authStore.set({ ...initialState, isLoading: false, error: data.error?.message || 'Registration failed' });
            return false;
        }
        authStore.set({ user: data.user, isLoading: false, error: null, isAuthenticated: true });
        // Migrate local data on first registration (ref: DL-007)
        await migrateLocalData();
        return true;
    } catch (err) {
        authStore.set({ ...initialState, isLoading: false, error: 'Network error' });
        return false;
    }
}

/** Logout and reload to clear all client state. */
export async function logout() {
    try {
        await fetch(API_BASE + '/api/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
    }
    authStore.set({ ...initialState, isLoading: false });
    window.location.reload();
}
