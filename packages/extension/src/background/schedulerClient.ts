/**
 * HTTP-клиент к scheduler-service (Модуль 4).
 *
 * Контракт зеркалит pydantic-модели из packages/scheduler-service/app/models.py.
 * Дублируем типы намеренно (а не импортируем) — extension и backend независимы;
 * shared-пакет с OpenAPI-генерацией планируется в будущем.
 */

const DEFAULT_BASE_URL = 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 5_000;

export type ProcedureKind =
  | 'lfk'
  | 'massage'
  | 'physio'
  | 'injection'
  | 'consultation'
  | 'lab';

export interface ProcedureRequestDto {
  kind: ProcedureKind;
  name: string;
  sessions: number;
  duration_min: number;
  preferred_time?: string | null; // HH:MM:SS
  start_after_days?: number;
}

export interface ScheduleGenerateRequestDto {
  patient_id: string;          // ^P-\d{6}$
  procedures: ProcedureRequestDto[];
  start_date: string;          // YYYY-MM-DD
  include_saturday?: boolean;
}

export interface SlotInfoDto {
  date: string;
  start: string;
  end: string;
  procedure_name: string;
  procedure_kind: ProcedureKind;
  specialist: string;
  room: string;
  session_number: number;
  total_sessions: number;
  status: 'free' | 'booked' | 'break';
}

export interface ScheduleGenerateResponseDto {
  patient_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  slots: SlotInfoDto[];
  warnings: string[];
}

export class SchedulerError extends Error {
  constructor(
    message: string,
    readonly kind: 'NETWORK' | 'HTTP' | 'TIMEOUT' | 'PARSE',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SchedulerError';
  }
}

/**
 * Генерация расписания. Бросает SchedulerError при любом сбое.
 */
export async function generateSchedule(
  payload: ScheduleGenerateRequestDto,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ScheduleGenerateResponseDto> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/v1/schedule/generate`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new SchedulerError('Таймаут ожидания scheduler-service', 'TIMEOUT');
    }
    throw new SchedulerError(
      `Сеть недоступна: ${(err as Error).message}`,
      'NETWORK',
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new SchedulerError(
      `HTTP ${res.status}: ${body.slice(0, 200)}`,
      'HTTP',
      res.status,
    );
  }

  try {
    return (await res.json()) as ScheduleGenerateResponseDto;
  } catch (err) {
    throw new SchedulerError(`Невалидный JSON ответа: ${(err as Error).message}`, 'PARSE');
  }
}
