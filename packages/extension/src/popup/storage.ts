/**
 * Тонкая обёртка над chrome.storage для попапа.
 *
 * Промисифицирует API + ключи в одной точке (без рассинхрона
 * с background/orchestrator).
 */

export const STORAGE_KEYS = {
  apiKey: 'rpa.llm.apiKey',
  baseUrl: 'rpa.llm.baseUrl',
  model: 'rpa.llm.model',
  provider: 'rpa.llm.provider',
} as const;

export const SESSION_KEYS = {
  fsmState: 'rpa.fsm.state',
  agentLog: 'rpa.fsm.log',
  lastSchedule: 'rpa.lastSchedule',
} as const;

export type LlmProvider = 'openai' | 'groq';

export interface LlmConfig {
  apiKey: string;
  provider: LlmProvider;
  baseUrl: string;
  model: string;
}

/** Дефолты для каждого провайдера. */
export const PROVIDER_DEFAULTS: Record<LlmProvider, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  groq:   { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.1-70b-versatile' },
};

export async function loadLlmConfig(): Promise<LlmConfig> {
  const r = await chrome.storage.local.get([
    STORAGE_KEYS.apiKey,
    STORAGE_KEYS.provider,
    STORAGE_KEYS.baseUrl,
    STORAGE_KEYS.model,
  ]);
  const provider = ((r[STORAGE_KEYS.provider] as LlmProvider | undefined) ?? 'openai');
  const def = PROVIDER_DEFAULTS[provider];
  return {
    apiKey: (r[STORAGE_KEYS.apiKey] as string | undefined) ?? '',
    provider,
    baseUrl: (r[STORAGE_KEYS.baseUrl] as string | undefined) ?? def.baseUrl,
    model: (r[STORAGE_KEYS.model] as string | undefined) ?? def.model,
  };
}

export async function saveLlmConfig(cfg: LlmConfig): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.apiKey]: cfg.apiKey,
    [STORAGE_KEYS.provider]: cfg.provider,
    [STORAGE_KEYS.baseUrl]: cfg.baseUrl,
    [STORAGE_KEYS.model]: cfg.model,
  });
}

/** Маска ключа для отображения: "sk-prov••••••••wxyz" — никогда не возвращаем чистый ключ в UI. */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

/* ──────────────────── Лог агента ──────────────────── */

export interface AgentLogEntry {
  /** Unix ms. */
  ts: number;
  /** Состояние FSM (см. orchestrator). */
  state: string;
  /** Короткое описание события. */
  message: string;
  level: 'info' | 'warn' | 'error';
}

export async function loadAgentLog(): Promise<AgentLogEntry[]> {
  const r = await chrome.storage.session.get(SESSION_KEYS.agentLog);
  const list = r[SESSION_KEYS.agentLog] as AgentLogEntry[] | undefined;
  return Array.isArray(list) ? list : [];
}
