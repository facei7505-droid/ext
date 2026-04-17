/**
 * Контракт структурированного визита (LLM Structured Output).
 *
 * Используется:
 *   - extension/ai/llmClient — фактически возвращает StructuredVisit.
 *   - extension/background/visitMapper — маппит в FillFieldMsg.
 *   - (потенциально) crm-mock — preview модального превью перед заполнением.
 *
 * При расширении схемы — обновить и system prompt в ai/systemPrompt.ts.
 */

export type IsoDate = string; // YYYY-MM-DD

export interface StructuredPatient {
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  birthDate: IsoDate | null;
  gender: 'male' | 'female' | 'other' | null;
  phone: string | null;
}

export interface StructuredObjectiveStatus {
  /** Свободно-текстовое описание ("Кожные покровы чистые..."). */
  summary: string | null;
  /** "120/80". */
  bloodPressure: string | null;
  /** "72". */
  pulse: string | null;
  /** "36.6". */
  temperature: string | null;
}

export interface StructuredDiagnosis {
  /** МКБ-10, напр. "J06.9". */
  icd10: string | null;
  /** Человекочитаемое название. */
  text: string | null;
}

export interface StructuredPrescription {
  kind: 'medication' | 'procedure' | 'regimen' | 'referral' | 'other';
  text: string;
}

export interface StructuredVisit {
  patient: StructuredPatient;
  complaints: string | null;
  anamnesis: string | null;
  objectiveStatus: StructuredObjectiveStatus;
  diagnosis: StructuredDiagnosis;
  recommendations: StructuredPrescription[];
  /** Уверенность модели 0..1. */
  confidence: number;
}

export interface LlmRequestInput {
  /** Сырой транскрипт Web Speech API. */
  transcript: string;
  /** Доп. контекст (напр. ФИО из карточки). */
  hints?: Partial<StructuredPatient>;
}

export interface LlmClientConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}
