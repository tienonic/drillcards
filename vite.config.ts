/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { VitePWA } from 'vite-plugin-pwa';
import { openFolderPlugin } from './vite-plugins/open-folder.ts';
import { aiBridgePlugin } from './vite-plugins/ai-bridge.ts';
import { debugLogPlugin } from './vite-plugins/debug-log.ts';
import { exportPlugin } from './vite-plugins/export-data.ts';

const coopCoepHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [
    solid({ hot: !process.env.VITEST }),
    openFolderPlugin(),
    debugLogPlugin(),
    aiBridgePlugin(),
    exportPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,wasm,png,svg}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Drill',
        short_name: 'Drill',
        description: 'Spaced repetition flashcards and quizzes',
        theme_color: '#4a7fb5',
        background_color: '#f5f0e8',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
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
