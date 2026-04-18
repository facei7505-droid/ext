/**
 * Единый стор курса пациента — связывает Модуль 3 (расписание) с Модулем 4 (журнал).
 *
 * Хранит:
 *  - Сгенерированные слоты расписания на 9 рабочих дней.
 *  - Отметки выполнения процедур (реальные таймстампы + короткий дневник).
 *  - Список дат курса для навигации по дням.
 *
 * Дизайн: SmartScheduleSection пишет в стор при генерации, ServiceExecutionDamumed
 * читает слоты на выбранный день и рендерит динамический журнал выполнения.
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ScheduledSlot } from '@/scheduling/scheduler';

export interface Completion {
  /** Время отметки в формате "HH:MM" (реальный таймстамп выполнения). */
  completedAt: string;
  /** Дата отметки YYYY-MM-DD (обычно = slot.date, но может отличаться). */
  completedDate: string;
  /** Короткий дневник процедуры (диктуется голосом сразу после выполнения). */
  diary: string;
}

export interface DayInfo {
  day: number;
  date: string;
  dayOfWeek: number;
}

/**
 * Стабильный ключ слота. Пара (date, time, procedureId, specialistId) уникальна
 * по построению алгоритма scheduler.ts — один специалист не может иметь два
 * наложенных слота, а процедура не может быть в один слот дважды.
 */
export const slotKey = (s: ScheduledSlot): string =>
  `${s.date}_${s.time}_${s.procedureId}_${s.specialistId}`;

export const useCourseStore = defineStore('course', () => {
  const slots = ref<ScheduledSlot[]>([]);
  const dayDates = ref<DayInfo[]>([]);
  const completions = ref<Record<string, Completion>>({});

  const setSchedule = (newSlots: ScheduledSlot[], newDays: DayInfo[]): void => {
    slots.value = newSlots;
    dayDates.value = newDays;
    completions.value = {};
  };

  const slotsForDate = (date: string): ScheduledSlot[] =>
    slots.value.filter((s) => s.date === date);

  const markCompleted = (
    key: string,
    at: string,
    date: string,
    diary = '',
  ): void => {
    completions.value = {
      ...completions.value,
      [key]: { completedAt: at, completedDate: date, diary },
    };
  };

  const updateDiary = (key: string, diary: string): void => {
    const c = completions.value[key];
    if (!c) return;
    completions.value = { ...completions.value, [key]: { ...c, diary } };
  };

  const clearCompletion = (key: string): void => {
    const copy = { ...completions.value };
    delete copy[key];
    completions.value = copy;
  };

  const totalSlots = computed(() => slots.value.length);
  const totalCompleted = computed(() => Object.keys(completions.value).length);
  const progressRatio = computed(() =>
    totalSlots.value ? totalCompleted.value / totalSlots.value : 0,
  );

  return {
    slots,
    dayDates,
    completions,
    setSchedule,
    slotsForDate,
    markCompleted,
    updateDiary,
    clearCompletion,
    totalSlots,
    totalCompleted,
    progressRatio,
  };
});
