import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite-конфиг SPA-мокапа КМИС.
 * - Чистый клиентский билд (никакого SSR).
 * - Код делится на чанки vendor/vue-router/pinia для быстрого первичного рендера (Lighthouse >95).
 * - Alias '@' → ./src для совместимости с будущим packages/shared.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^@shared$/, replacement: fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) },
      { find: /^@shared\//, replacement: fileURLToPath(new URL('../shared/src/', import.meta.url)) },
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
        },
      },
    },
  },
});
