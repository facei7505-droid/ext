/**
 * Клиент для связи с Python scheduler-service (FastAPI).
 * POST http://localhost:8000/api/v1/schedule/generate
 */

export interface ProcedureReq {
  kind: 'lfk' | 'massage' | 'physio' | 'injection' | 'consultation' | 'lab';
  name: string;
  sessions: number;
  duration_min: number;
}

export interface ScheduleRequest {
  patient_id: string;
  procedures: ProcedureReq[];
  start_date: string; // YYYY-MM-DD
  include_saturday?: boolean;
}

export interface SlotInfo {
  date: string;
  start: string;
  end: string;
  procedure_name: string;
  procedure_kind: string;
  specialist: string;
  room: string;
  session_number: number;
  total_sessions: number;
  status: string;
}

export interface ScheduleResponse {
  patient_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  slots: SlotInfo[];
  warnings: string[];
}

const SCHEDULER_BASE = 'http://localhost:8000';

/** Название процедуры → тип (kind) для Python API */
function guessProcedureKind(name: string): ProcedureReq['kind'] {
  const n = name.toLowerCase();
  if (n.includes('массаж')) return 'massage';
  if (n.includes('лфк') || n.includes('физкультур')) return 'lfk';
  if (n.includes('физиотерап')) return 'physio';
  if (n.includes('инъекц') || n.includes('укол')) return 'injection';
  if (n.includes('консульт')) return 'consultation';
  return 'lfk';
}

/**
 * Сгенерировать расписание через вызов Python FastAPI.
 * prescriptions — список назначений, пришедших из LLM (Модуль 1)
 */
export async function generateSchedule(
  prescriptions: string[],
  patientId = 'P-000001',
  startDate?: string,
): Promise<ScheduleResponse> {
  const today = startDate ?? new Date().toISOString().slice(0, 10);

  // Если врач ничего не продиктовал — используем демо-набор для показа на хакатоне
  const procs: ProcedureReq[] = prescriptions.length > 0
    ? prescriptions.map((name) => ({
        kind: guessProcedureKind(name),
        name,
        sessions: 9,
        duration_min: 30,
      }))
    : [
        { kind: 'massage', name: 'Массаж воротниковой зоны', sessions: 9, duration_min: 30 },
        { kind: 'lfk',     name: 'ЛФК',                     sessions: 9, duration_min: 30 },
        { kind: 'physio',  name: 'Физиотерапия',             sessions: 5, duration_min: 30 },
      ];

  const body: ScheduleRequest = {
    patient_id: patientId,
    procedures: procs,
    start_date: today,
    include_saturday: false,
  };

  const res = await fetch(`${SCHEDULER_BASE}/api/v1/schedule/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Scheduler error ${res.status}: ${text}`);
  }

  return (await res.json()) as ScheduleResponse;
}

/**
 * Fallback: локальная генерация расписания без Питона (если сервис не запущен).
 * Нужен только для демонстрации без установленного Python окружения.
 */
export function generateScheduleLocal(startDate?: string): ScheduleResponse {
  const BASE = startDate ? new Date(startDate) : new Date();
  const slots: SlotInfo[] = [];
  const procs = [
    { name: 'Массаж воротниковой зоны', kind: 'massage', specialist: 'Петров П.П.',  room: 'Кабинет 3' },
    { name: 'ЛФК',                      kind: 'lfk',     specialist: 'Иванов И.И.',  room: 'Спортзал'   },
    { name: 'Физиотерапия',              kind: 'physio',  specialist: 'Сидорова А.А.',room: 'Кабинет 5'  },
  ];

  let dayOffset = 0;
  let sessionNum = 1;
  for (let day = 1; day <= 9; day++) {
    // Пропускаем выходные
    while (true) {
      const d = new Date(BASE);
      d.setDate(BASE.getDate() + dayOffset);
      const wd = d.getDay(); // 0=sun,6=sat
      if (wd !== 0 && wd !== 6) break;
      dayOffset++;
    }
    const curDate = new Date(BASE);
    curDate.setDate(BASE.getDate() + dayOffset);
    const dateStr = curDate.toISOString().slice(0, 10);

    let hourMinute = 9 * 60; // старт с 09:00
    for (const p of procs) {
      const startH = Math.floor(hourMinute / 60).toString().padStart(2, '0');
      const startM = (hourMinute % 60).toString().padStart(2, '0');
      hourMinute += 30;
      const endH = Math.floor(hourMinute / 60).toString().padStart(2, '0');
      const endM = (hourMinute % 60).toString().padStart(2, '0');
      slots.push({
        date: dateStr,
        start: `${startH}:${startM}`,
        end:   `${endH}:${endM}`,
        procedure_name: p.name,
        procedure_kind: p.kind,
        specialist: p.specialist,
        room: p.room,
        session_number: sessionNum,
        total_sessions: 9,
        status: 'booked',
      });
    }
    sessionNum++;
    dayOffset++;
  }

  const endDate = new Date(BASE);
  endDate.setDate(BASE.getDate() + dayOffset - 1);

  return {
    patient_id: 'P-000001',
    start_date: BASE.toISOString().slice(0, 10),
    end_date: endDate.toISOString().slice(0, 10),
    total_days: 9,
    slots,
    warnings: [],
  };
}
