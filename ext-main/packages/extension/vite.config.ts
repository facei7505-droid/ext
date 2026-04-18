import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import manifest from './manifest.config';

/**
 * Сборка MV3 через @crxjs/vite-plugin.
 * Плагин сам генерирует dist/manifest.json, разносит background/content,
 * подставляет HMR-совместимые loader-скрипты и уважает CSP MV3.
 */
export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  resolve: {
    alias: [
      // Точный матч @shared → barrel; префикс @shared/ → подмодули. Регэкспы matched first.
      { find: /^@shared$/, replacement: fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) },
      { find: /^@shared\//, replacement: fileURLToPath(new URL('../shared/src/', import.meta.url)) },
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      // Запрещаем минификацию имён для удобства отладки в store-ревью.
      output: { chunkFileNames: 'assets/[name]-[hash].js' },
    },
  },
});
