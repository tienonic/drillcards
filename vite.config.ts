/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { openFolderPlugin } from './vite-plugins/open-folder.ts';
import { aiBridgePlugin } from './vite-plugins/ai-bridge.ts';
import { debugLogPlugin } from './vite-plugins/debug-log.ts';
import { exportPlugin } from './vite-plugins/export-data.ts';
import { imgProxyPlugin } from './vite-plugins/img-proxy.ts';

const coopCoepHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

export default defineConfig({
  plugins: [
    solid({ hot: !process.env.VITEST }),
    openFolderPlugin(),
    debugLogPlugin(),
    aiBridgePlugin(),
    exportPlugin(),
    imgProxyPlugin(),
  ],
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    headers: coopCoepHeaders,
  },
  preview: {
    headers: coopCoepHeaders,
  },
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
