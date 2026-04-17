/**
 * Фасад AI-слоя. Конструирует LlmClient из ключа/модели, хранимых в chrome.storage.local.
 * background/orchestrator использует только этот модуль, не зная деталей провайдера.
 */

import { LlmClient, LlmError } from './llmClient';
import type { LlmRequestInput, StructuredVisit } from './types';

const STORAGE_KEYS = {
  apiKey: 'rpa.llm.apiKey',
  baseUrl: 'rpa.llm.baseUrl',
  model: 'rpa.llm.model',
} as const;

export async function getLlmClient(): Promise<LlmClient> {
  const cfg = await chrome.storage.local.get([
    STORAGE_KEYS.apiKey,
    STORAGE_KEYS.baseUrl,
    STORAGE_KEYS.model,
  ]);
  const apiKey = cfg[STORAGE_KEYS.apiKey] as string | undefined;
  if (!apiKey) {
    throw new LlmError('LLM apiKey is not configured (open Options page)', 'CONFIG');
  }
  return new LlmClient({
    apiKey,
    baseUrl: cfg[STORAGE_KEYS.baseUrl] as string | undefined,
    model: cfg[STORAGE_KEYS.model] as string | undefined,
  });
}

export async function structureVisit(input: LlmRequestInput): Promise<StructuredVisit> {
  const client = await getLlmClient();
  return client.structureVisit(input);
}

export { LlmClient, LlmError };
export * from './types';
