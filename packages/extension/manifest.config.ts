import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

/**
 * Manifest V3 для RPA-агента.
 *
 * CSP по умолчанию MV3 уже запрещает 'unsafe-inline' и 'unsafe-eval' —
 * мы не ослабляем политику. Никаких remote-скриптов: весь код упакован.
 *
 * Content script работает в ISOLATED world — это исключает конфликт
 * переменных с нативным JS страницы (по требованию ТЗ).
 *
 * host_permissions ограничиваем localhost (КМИС-мокап) + позднее реальными
 * доменами клиник. Никакого "<all_urls>" без явной нужды.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'HealthTech RPA Agent',
  version: pkg.version,
  description: pkg.description,
  minimum_chrome_version: '116',
  action: {
    default_title: 'HealthTech RPA Agent',
    default_popup: 'src/popup/popup.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: [
        'http://localhost:5173/*',
        'http://127.0.0.1:5173/*',
        'http://localhost:5174/*',
        'http://127.0.0.1:5174/*',
      ],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: false,
      world: 'ISOLATED',
    },
  ],
  permissions: ['storage', 'scripting', 'activeTab', 'tabs'],
  host_permissions: [
    'http://localhost:5173/*',
    'http://127.0.0.1:5173/*',
    'http://localhost:5174/*',
    'http://127.0.0.1:5174/*',
    // Scheduler service (Модуль 4).
    'http://localhost:8000/*',
    'http://127.0.0.1:8000/*',
    // LLM провайдеры (Модуль 3).
    'https://api.openai.com/*',
    'https://api.groq.com/*',
  ],
  web_accessible_resources: [
    {
      resources: ['assets/*'],
      matches: ['<all_urls>'],
    },
  ],
});
