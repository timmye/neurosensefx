import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Mock klinecharts so xAxisCustom.js can be imported without a runtime
      klinecharts: new URL('./src/lib/chart/__tests__/__mocks__/klinecharts.js', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
