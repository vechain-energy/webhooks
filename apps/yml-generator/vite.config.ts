import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

function resolveBase(command: 'build' | 'serve'): string {
  const explicitBase = process.env.YML_GENERATOR_BASE_PATH?.trim();
  if (explicitBase) {
    return normalizeBase(explicitBase);
  }

  if (command !== 'build') {
    return '/';
  }

  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
  return repositoryName ? `/${repositoryName}/` : '/';
}

function normalizeBase(value: string): string {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig(({ command }) => ({
  root: __dirname,
  base: resolveBase(command),
  plugins: [react()],
  resolve: {
    alias: {
      '@app': resolve(__dirname, './src'),
      '@generator': resolve(__dirname, '../../src/generator')
    }
  },
  build: {
    outDir: resolve(__dirname, './dist'),
    emptyOutDir: true
  }
}));
