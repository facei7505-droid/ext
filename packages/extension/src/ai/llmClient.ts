/**
 * LLM-клиент: транскрипт → StructuredFormResponse (JSON).
 *
 * Используем OpenAI-совместимый endpoint /v1/chat/completions с
 *   response_format = { type: 'json_schema', json_schema: { strict: true, ... } }.
 * Работает для OpenAI и Groq (последний поддерживает совместимое JSON-mode).
 *
 * Почему не streaming: для заполнения формы нам нужен полный JSON атомарно,
 * а стриминг частичного JSON усложняет парсинг без ощутимого выигрыша.
 *
 * Безопасность:
 *  - apiKey читается из chrome.storage.local (options-страница), не хардкодится.
 *  - Запускается ТОЛЬКО в background service worker — content-script не имеет
 *    доступа к ключу, даже если страница КМИС будет скомпрометирована.
 */

import { RESPONSE_JSON_SCHEMA, SYSTEM_PROMPT } from './systemPrompt';
import type { LlmClientConfig, LlmRequestInput, StructuredFormResponse } from '@shared/visit';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_TIMEOUT = 20_000;

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code: 'HTTP' | 'TIMEOUT' | 'PARSE' | 'SHAPE' | 'CONFIG',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export class LlmClient {
  private readonly cfg: Required<LlmClientConfig>;

  constructor(cfg: LlmClientConfig) {
    if (!cfg.apiKey) throw new LlmError('apiKey is required', 'CONFIG');
    this.cfg = {
      apiKey: cfg.apiKey,
      baseUrl: (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
      model: cfg.model ?? DEFAULT_MODEL,
      timeoutMs: cfg.timeoutMs ?? DEFAULT_TIMEOUT,
    };
  }

  /**
   * Основной метод: превращает транскрипт в StructuredFormResponse.
   * Гарантирует, что вернётся объект, соответствующий схеме (или LlmError).
   */
  async structureForm(input: LlmRequestInput): Promise<StructuredFormResponse> {
    const userContent = buildUserMessage(input);

    const baseBody = {
      model: this.cfg.model,
      temperature: 0,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    };

    // Сначала пробуем строгую json_schema (OpenAI / новейшие модели Groq).
    // При HTTP 400 «model does not support response format `json_schema`»
    // делаем fallback на json_object — он поддерживается всеми OpenAI-совместимыми
    // провайдерами; валидность гарантируем нашим assertStructuredVisit.
    let raw: unknown;
    try {
      raw = await this.call('/chat/completions', {
        ...baseBody,
        response_format: { type: 'json_schema', json_schema: RESPONSE_JSON_SCHEMA },
      });
    } catch (err) {
      if (
        err instanceof LlmError &&
        err.code === 'HTTP' &&
        err.status === 400 &&
        /json_schema|response_format/i.test(err.message)
      ) {
        console.info('[llm] json_schema not supported, retrying with json_object');
        raw = await this.call('/chat/completions', {
          ...baseBody,
          response_format: { type: 'json_object' },
        });
      } else {
        throw err;
      }
    }

    const content = extractContent(raw);
    console.log('[llm] Raw content from LLM:', content);
    const parsed = safeJsonParse(content);
    console.log('[llm] Parsed JSON:', parsed);
    const normalized = normalizeForm(parsed);
    console.log('[llm] Normalized response:', JSON.stringify(normalized, null, 2));
    return normalized;
  }

  private async call(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetch(`${this.cfg.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new LlmError(`LLM HTTP ${res.status}: ${text.slice(0, 500)}`, 'HTTP', res.status);
      }
      return (await res.json()) as unknown;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new LlmError(`LLM timeout after ${this.cfg.timeoutMs}ms`, 'TIMEOUT');
      }
      if (err instanceof LlmError) throw err;
      throw new LlmError((err as Error).message, 'HTTP');
    } finally {
      clearTimeout(timer);
    }
  }
}

/* -------------------- helpers -------------------- */

function buildUserMessage(input: LlmRequestInput): string {
  // Компактная сериализация подсказок: минус токены, плюс стабильный KV-cache.
  const hints = input.hints && Object.keys(input.hints).length ? JSON.stringify(input.hints) : null;
  return [
    hints ? `HINTS: ${hints}` : null,
    'TRANSCRIPT:',
    input.transcript.trim(),
  ]
    .filter(Boolean)
    .join('\n');
}

function extractContent(raw: unknown): string {
  const r = raw as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = r.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new LlmError('empty content in LLM response', 'PARSE');
  }
  return content;
}

function safeJsonParse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // Иногда модели оборачивают в ```json ... ``` вопреки инструкции — вырежем.
    const m = content.match(/\{[\s\S]*\}$/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fallthrough */
      }
    }
    throw new LlmError('LLM returned non-JSON content', 'PARSE');
  }
}

/**
 * Нормализует ответ LLM в строгий StructuredFormResponse.
 *
 * Модели в json_object режиме (а иногда и в json_schema fallback'е у Groq)
 * могут пропускать поля или возвращать null вместо вложенных объектов.
 * Чтобы не падать на каждом таком случае — приводим к канонической форме,
 * подставляя null/пустые объекты для отсутствующих полей.
 *
 * Бросает LlmError только если сам корень — не объект.
 */
function normalizeForm(v: unknown): StructuredFormResponse {
  if (!v || typeof v !== 'object') {
    throw new LlmError('response is not an object', 'SHAPE');
  }
  const o = v as Record<string, unknown>;

  const asStr = (x: unknown): string | null =>
    typeof x === 'string' && x.trim() ? x : null;
  const asObj = (x: unknown): Record<string, unknown> =>
    x && typeof x === 'object' ? (x as Record<string, unknown>) : {};

  const formType = asStr(o.formType) === 'intake' || asStr(o.formType) === 'epicrisis'
    ? (asStr(o.formType) as 'intake' | 'epicrisis')
    : 'intake'; // fallback по умолчанию

  const intake = asObj(o.intake);
  const epicrisis = asObj(o.epicrisis);

  const normalizeIntake = (i: Record<string, unknown>) => {
    const p = asObj(i.patient);
    const os = asObj(i.objectiveStatus);
    const dx = asObj(i.diagnosis);

    const recs = Array.isArray(i.recommendations)
      ? (i.recommendations as unknown[])
          .map((r) => {
            const ro = asObj(r);
            const text = asStr(ro.text);
            if (!text) return null;
            const kindRaw = typeof ro.kind === 'string' ? ro.kind : 'other';
            const kind = (
              ['medication', 'procedure', 'regimen', 'referral', 'other'] as const
            ).includes(kindRaw as 'other')
              ? (kindRaw as 'medication' | 'procedure' | 'regimen' | 'referral' | 'other')
              : 'other';
            return { kind, text } as const;
          })
          .filter((r): r is { kind: 'medication' | 'procedure' | 'regimen' | 'referral' | 'other'; text: string } => r !== null)
      : [];

    const allergies = Array.isArray(i.allergies)
      ? (i.allergies as unknown[])
          .map((a) => asStr(a))
          .filter((a): a is string => a !== null)
      : [];

    const chronicDiseases = Array.isArray(i.chronicDiseases)
      ? (i.chronicDiseases as unknown[])
          .map((d) => asStr(d))
          .filter((d): d is string => d !== null)
      : [];

    const gender = asStr(p.gender);
    const validGender: 'male' | 'female' | 'other' | null =
      gender === 'male' || gender === 'female' || gender === 'other'
        ? (gender as 'male' | 'female' | 'other')
        : null;

    return {
      patient: {
        lastName: asStr(p.lastName),
        firstName: asStr(p.firstName),
        middleName: asStr(p.middleName),
        birthDate: asStr(p.birthDate),
        gender: validGender,
        phone: asStr(p.phone),
      },
      complaints: asStr(i.complaints),
      anamnesis: asStr(i.anamnesis),
      allergies,
      chronicDiseases,
      objectiveStatus: {
        summary: asStr(os.summary),
        bloodPressure: asStr(os.bloodPressure),
        pulse: asStr(os.pulse),
        temperature: asStr(os.temperature),
      },
      diagnosis: {
        icd10: asStr(dx.icd10),
        text: asStr(dx.text),
      },
      recommendations: recs,
      confidence: typeof o.confidence === 'number' ? o.confidence : 0.5,
    };
  };

  const normalizeEpicrisis = (e: Record<string, unknown>) => {
    const department = asStr(e.department);
    const validDepartment = ['therapy', 'cardiology', 'neurology', 'surgery'].includes(department ?? '')
      ? (department as 'therapy' | 'cardiology' | 'neurology' | 'surgery')
      : null;
    const outcome = asStr(e.outcome);
    const validOutcome = ['recovery', 'improvement', 'no_change', 'deterioration'].includes(outcome ?? '')
      ? (outcome as 'recovery' | 'improvement' | 'no_change' | 'deterioration')
      : null;

    return {
      patientId: asStr(e.patientId),
      admissionDate: asStr(e.admissionDate),
      dischargeDate: asStr(e.dischargeDate),
      department: validDepartment,
      doctor: asStr(e.doctor),
      outcome: validOutcome,
      clinicalDiagnosis: asStr(e.clinicalDiagnosis),
      comorbidities: asStr(e.comorbidities),
      treatmentSummary: asStr(e.treatmentSummary),
      labResults: asStr(e.labResults),
      recommendations: asStr(e.recommendations),
      confidence: typeof o.confidence === 'number' ? o.confidence : 0.5,
    };
  };

  const result: StructuredFormResponse = {
    formType,
  };

  if (formType === 'intake' && Object.keys(intake).length > 0) {
    result.intake = normalizeIntake(intake);
  } else if (formType === 'epicrisis' && Object.keys(epicrisis).length > 0) {
    result.epicrisis = normalizeEpicrisis(epicrisis);
  }

  return result;
}
