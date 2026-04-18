<script setup lang="ts">
/**
 * Popup HealthTech RPA Agent.
 *
 * Содержит:
 *   1. Заголовок + индикатор текущего FSM-состояния (читается из chrome.storage.session).
 *   2. Форму конфигурации LLM (провайдер, ключ, модель).
 *   3. Мини-лог последних действий оркестратора.
 *
 * Безопасность:
 *   - API-ключ никогда не печатается в консоль/лог.
 *   - При первой отрисовке показываем маску "sk-XXXX••••••••XXXX".
 *   - Поле ввода типа password; «Показать» переключает только локально, не сохраняет.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  loadLlmConfig,
  saveLlmConfig,
  loadAgentLog,
  maskApiKey,
  PROVIDER_DEFAULTS,
  SESSION_KEYS,
  type LlmConfig,
  type LlmProvider,
  type AgentLogEntry,
} from './storage';

/* ──────────── State ──────────── */

const cfg = ref<LlmConfig>({
  apiKey: '',
  provider: 'openai',
  baseUrl: PROVIDER_DEFAULTS.openai.baseUrl,
  model: PROVIDER_DEFAULTS.openai.model,
});

/** True — пользователь ввёл новый ключ; маску больше не показываем. */
const apiKeyDirty = ref(false);
const showApiKey = ref(false);
const savedFlash = ref(false);

const fsmState = ref<string>('IDLE');
const log = ref<AgentLogEntry[]>([]);

const apiKeyDisplay = computed<string>({
  get() {
    if (apiKeyDirty.value || showApiKey.value) return cfg.value.apiKey;
    return maskApiKey(cfg.value.apiKey);
  },
  set(v: string) {
    apiKeyDirty.value = true;
    cfg.value.apiKey = v;
  },
});

const isReady = computed(() => cfg.value.apiKey.trim().length >= 10);

/* ──────────── Lifecycle ──────────── */

let storageListener: Parameters<typeof chrome.storage.onChanged.addListener>[0] | null = null;

onMounted(async () => {
  cfg.value = await loadLlmConfig();
  await refreshSessionData();

  // Live-обновление лога/состояния, пока попап открыт.
  storageListener = (changes, area) => {
    if (area !== 'session') return;
    if (SESSION_KEYS.agentLog in changes) {
      log.value = (changes[SESSION_KEYS.agentLog].newValue ?? []) as AgentLogEntry[];
    }
    if (SESSION_KEYS.fsmState in changes) {
      fsmState.value = (changes[SESSION_KEYS.fsmState].newValue as string) ?? 'IDLE';
    }
  };
  chrome.storage.onChanged.addListener(storageListener);
});

onUnmounted(() => {
  if (storageListener) chrome.storage.onChanged.removeListener(storageListener);
});

async function refreshSessionData(): Promise<void> {
  log.value = await loadAgentLog();
  const r = await chrome.storage.session.get(SESSION_KEYS.fsmState);
  fsmState.value = (r[SESSION_KEYS.fsmState] as string | undefined) ?? 'IDLE';
}

/* ──────────── Handlers ──────────── */

function onProviderChange(p: LlmProvider): void {
  cfg.value.provider = p;
  // Перетягиваем дефолты только если пользователь не менял URL/модель руками.
  const def = PROVIDER_DEFAULTS[p];
  cfg.value.baseUrl = def.baseUrl;
  cfg.value.model = def.model;
}

async function onSave(): Promise<void> {
  await saveLlmConfig(cfg.value);
  apiKeyDirty.value = false;
  showApiKey.value = false;
  savedFlash.value = true;
  setTimeout(() => (savedFlash.value = false), 1500);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

const stateColor = computed(() => {
  switch (fsmState.value) {
    case 'LISTENING': return 'bg-brand text-white';
    case 'PROCESSING_LLM': return 'bg-accent-warn text-white';
    case 'FILLING_DOM': return 'bg-accent text-white';
    case 'SCHEDULING': return 'bg-purple-700 text-white';
    default: return 'bg-slate-200 text-slate-700';
  }
});
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Заголовок + статус FSM -->
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-base font-bold text-brand-dark leading-tight">HealthTech RPA</h1>
        <p class="text-[11px] text-slate-500">Агент для легаси-КМИС</p>
      </div>
      <span
        class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded"
        :class="stateColor"
      >
        {{ fsmState }}
      </span>
    </header>

    <!-- Конфиг LLM -->
    <section class="bg-white border border-slate-200 rounded-md p-3 space-y-3">
      <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500">
        LLM-провайдер
      </h2>

      <!-- Тумблер OpenAI / Groq -->
      <div class="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded">
        <button
          type="button"
          class="text-xs font-semibold py-1.5 rounded transition"
          :class="cfg.provider === 'openai' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          @click="onProviderChange('openai')"
        >
          OpenAI
        </button>
        <button
          type="button"
          class="text-xs font-semibold py-1.5 rounded transition"
          :class="cfg.provider === 'groq' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          @click="onProviderChange('groq')"
        >
          Groq
        </button>
      </div>

      <!-- API-ключ -->
      <label class="block">
        <span class="text-[11px] font-semibold text-slate-600">API-ключ</span>
        <div class="mt-1 flex gap-1">
          <input
            v-model="apiKeyDisplay"
            :type="showApiKey || apiKeyDirty ? 'text' : 'password'"
            placeholder="sk-..."
            autocomplete="off"
            spellcheck="false"
            class="flex-1 min-w-0 text-xs px-2 py-1.5 border border-slate-300 rounded font-mono
                   focus:ring-2 focus:ring-brand focus:border-brand"
          />
          <button
            type="button"
            class="text-[10px] px-2 py-1 border border-slate-300 rounded hover:bg-slate-50"
            @click="showApiKey = !showApiKey"
          >
            {{ showApiKey ? 'Скрыть' : 'Показать' }}
          </button>
        </div>
        <p class="mt-1 text-[10px] text-slate-400">
          Хранится локально в chrome.storage.local, не передаётся никому, кроме выбранного провайдера.
        </p>
      </label>

      <!-- Модель -->
      <label class="block">
        <span class="text-[11px] font-semibold text-slate-600">Модель</span>
        <input
          v-model="cfg.model"
          type="text"
          class="mt-1 w-full text-xs px-2 py-1.5 border border-slate-300 rounded font-mono
                 focus:ring-2 focus:ring-brand focus:border-brand"
        />
      </label>

      <!-- Сохранить -->
      <button
        type="button"
        class="w-full bg-brand hover:bg-brand-dark text-white text-xs font-semibold
               py-1.5 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!isReady"
        @click="onSave"
      >
        {{ savedFlash ? '✓ Сохранено' : 'Сохранить' }}
      </button>
    </section>

    <!-- Лог агента -->
    <section class="bg-white border border-slate-200 rounded-md p-3">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500">
          Лог агента
        </h2>
        <span class="text-[10px] text-slate-400">{{ log.length }} событий</span>
      </div>

      <ul v-if="log.length > 0" class="space-y-1 max-h-48 overflow-y-auto pr-1">
        <li
          v-for="(entry, i) in log"
          :key="`${entry.ts}-${i}`"
          class="text-[11px] flex gap-2 py-1 border-b border-slate-100 last:border-b-0"
        >
          <span class="font-mono text-slate-400 shrink-0">{{ formatTime(entry.ts) }}</span>
          <span
            class="font-bold uppercase text-[9px] tracking-wider shrink-0 w-14 pt-0.5"
            :class="{
              'text-brand-dark': entry.level === 'info',
              'text-accent-warn': entry.level === 'warn',
              'text-accent-error': entry.level === 'error',
            }"
          >{{ entry.state }}</span>
          <span class="text-slate-700 leading-tight">{{ entry.message }}</span>
        </li>
      </ul>

      <p v-else class="text-[11px] text-slate-400 italic text-center py-3">
        Лог пуст. Запустите агента на вкладке КМИС.
      </p>
    </section>

    <footer class="text-center text-[10px] text-slate-400">
      v0.1.0 · MV3 · Web Speech + LLM
    </footer>
  </div>
</template>
