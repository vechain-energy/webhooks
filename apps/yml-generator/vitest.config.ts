import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': resolve(__dirname, './src'),
      '@generator': resolve(__dirname, '../../src/generator')
    }
  },
  test: {
    name: 'yml-generator',
    environment: 'jsdom',
    include: ['./src/**/*.test.ts', './src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    restoreMocks: true
  }
});
