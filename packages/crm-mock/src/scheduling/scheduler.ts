/**
 * Smart Scheduler — алгоритм автогенерации расписания процедур
 * на 9 рабочих дней с учётом доступности специалистов и временных слотов.
 *
 * Ограничения (бутылочное горлышко):
 *  - Один специалист = один слот в момент времени (конфликты не допускаются).
 *  - Процедура вмещается только в слот подходящей длительности.
 *  - Рабочие дни = Пн–Пт (Сб/Вс исключаются).
 *  - Специалист может быть доступен не каждый день (weeklyAvailability).
 */

export interface Procedure {
  id: string;
  name: string;
  /** Длительность в минутах (обычно 30 или 40). */
  duration: number;
  /** Какой тип специалиста нужен (matches Specialist.specialty). */
  specialty: string;
}

export interface Specialist {
  id: string;
  name: string;
  specialty: string;
  /**
   * Доступность по дням недели (0=Вс, 1=Пн, ..., 6=Сб).
   * Каждый день — массив стартов слотов в формате "HH:MM".
   */
  weeklyAvailability: Record<number, string[]>;
}

export interface PrescribedProcedure {
  procedureId: string;
  /** Сколько сеансов назначено всего (обычно 9). */
  sessions: number;
}

export interface ScheduledSlot {
  day: number;              // 1..9
  date: string;             // ISO YYYY-MM-DD
  dayOfWeek: number;        // 0..6
  time: string;             // "HH:MM"
  procedureId: string;
  procedureName: string;
  specialistId: string;
  specialistName: string;
  duration: number;
}

export interface ScheduleResult {
  slots: ScheduledSlot[];
  /** Процедуры, которые не удалось разместить (нет свободных слотов). */
  unplaced: Array<{ procedureId: string; reason: string }>;
  /** Даты 9 рабочих дней. */
  dayDates: Array<{ day: number; date: string; dayOfWeek: number }>;
}

/** Генерирует список из N рабочих дней (Пн-Пт) начиная с startDate. */
export function generateWorkingDays(startDate: Date, count = 9): Array<{ day: number; date: string; dayOfWeek: number }> {
  const result: Array<{ day: number; date: string; dayOfWeek: number }> = [];
  const cursor = new Date(startDate);
  let day = 1;
  while (result.length < count) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      result.push({
        day,
        date: formatDate(cursor),
        dayOfWeek: dow,
      });
      day++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Преобразует "HH:MM" → минуты с начала дня. */
function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Преобразует минуты → "HH:MM". */
function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Жадный алгоритм распределения процедур по дням и слотам.
 *
 * Стратегия:
 *  1) Строим сетку рабочих дней (9 дней, без выходных).
 *  2) Для каждой назначенной процедуры создаём N сеансов (обычно 9).
 *  3) Round-robin по дням: каждый сеанс процедуры идёт в следующий день.
 *  4) Для каждого сеанса ищем подходящего свободного специалиста:
 *     - Подходит по specialty.
 *     - Доступен в этот день недели.
 *     - Есть свободный слот длительности >= procedure.duration.
 *     - Этот слот ещё не занят другим сеансом.
 *  5) Если слот не найден — пытаемся следующий день; если вообще не влезает — unplaced.
 */
export function generateSchedule(params: {
  startDate: Date;
  prescribed: PrescribedProcedure[];
  procedures: Procedure[];
  specialists: Specialist[];
  daysCount?: number;
}): ScheduleResult {
  const { startDate, prescribed, procedures, specialists, daysCount = 9 } = params;

  const dayDates = generateWorkingDays(startDate, daysCount);

  // Занятость: specialistId -> date -> Set<"HH:MM"> (начальные минуты занятых слотов).
  const busy: Map<string, Map<string, Set<number>>> = new Map();

  const bookSlot = (specId: string, date: string, startMin: number, duration: number): void => {
    let perDate = busy.get(specId);
    if (!perDate) {
      perDate = new Map();
      busy.set(specId, perDate);
    }
    let set = perDate.get(date);
    if (!set) {
      set = new Set();
      perDate.set(date, set);
    }
    // Резервируем все 30-минутные блоки в диапазоне
    for (let m = startMin; m < startMin + duration; m += 30) {
      set.add(m);
    }
  };

  const isSlotFree = (specId: string, date: string, startMin: number, duration: number): boolean => {
    const perDate = busy.get(specId);
    if (!perDate) return true;
    const set = perDate.get(date);
    if (!set) return true;
    for (let m = startMin; m < startMin + duration; m += 30) {
      if (set.has(m)) return false;
    }
    return true;
  };

  const slots: ScheduledSlot[] = [];
  const unplaced: Array<{ procedureId: string; reason: string }> = [];

  // Для каждой назначенной процедуры планируем каждый сеанс
  for (const p of prescribed) {
    const proc = procedures.find((x) => x.id === p.procedureId);
    if (!proc) {
      unplaced.push({ procedureId: p.procedureId, reason: 'Процедура не найдена' });
      continue;
    }

    const matchingSpecialists = specialists.filter((s) => s.specialty === proc.specialty);
    if (matchingSpecialists.length === 0) {
      for (let i = 0; i < p.sessions; i++) {
        unplaced.push({ procedureId: p.procedureId, reason: `Нет специалиста по "${proc.specialty}"` });
      }
      continue;
    }

    // Round-robin: распределяем сеансы по дням (1 сеанс в день если sessions <= daysCount)
    for (let session = 0; session < p.sessions; session++) {
      const startDayIdx = session % dayDates.length;
      let placed = false;

      // Пробуем дни начиная со startDayIdx, обходим весь массив
      for (let offset = 0; offset < dayDates.length && !placed; offset++) {
        const dayInfo = dayDates[(startDayIdx + offset) % dayDates.length];

        for (const spec of matchingSpecialists) {
          const availableStarts = spec.weeklyAvailability[dayInfo.dayOfWeek];
          if (!availableStarts || availableStarts.length === 0) continue;

          for (const startStr of availableStarts) {
            const startMin = timeToMinutes(startStr);
            if (!isSlotFree(spec.id, dayInfo.date, startMin, proc.duration)) continue;

            // Свободный слот — бронируем
            bookSlot(spec.id, dayInfo.date, startMin, proc.duration);
            slots.push({
              day: dayInfo.day,
              date: dayInfo.date,
              dayOfWeek: dayInfo.dayOfWeek,
              time: minutesToTime(startMin),
              procedureId: proc.id,
              procedureName: proc.name,
              specialistId: spec.id,
              specialistName: spec.name,
              duration: proc.duration,
            });
            placed = true;
            break;
          }
          if (placed) break;
        }
      }

      if (!placed) {
        unplaced.push({
          procedureId: p.procedureId,
          reason: `Нет свободного слота для сеанса ${session + 1}`,
        });
      }
    }
  }

  // Сортируем слоты по дню и времени для красивого отображения
  slots.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return timeToMinutes(a.time) - timeToMinutes(b.time);
  });

  return { slots, unplaced, dayDates };
}
