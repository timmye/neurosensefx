import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // KLineCharts async devicePixelContentBox check (line 6698) causes a DPR
    // race during chart init — the ResizeObserver path silently drops buffer
    // updates via _executeListener coalescing. Forcing the manual (synchronous)
    // DPR path eliminates the race. Remove this plugin if upgrading KLineCharts
    // to a version that fixes the init DPR race internally.
    {
      name: 'force-klinecharts-manual-dpr',
      transform(code, id) {
        if (id.includes('klinecharts') && id.endsWith('.esm.js')) {
          const target = 'isSupportedDevicePixelContentBox().then';
          if (!code.includes(target)) {
            console.warn('[force-klinecharts-manual-dpr] Target string not found in', id, '— plugin may be obsolete');
            return;
          }
          return code.replace(target, 'Promise.resolve(false).then');
        }
      }
    },
    svelte({
      onwarn: (warning, handler) => {
        // Ignore a11y warnings for focusable, interactive containers
        if (warning.code?.startsWith('a11y-')) return;
        handler(warning);
      }
    })
  ],
  root: 'src',
  server: {
    port: 5174,
    strictPort: true,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true
  }
});