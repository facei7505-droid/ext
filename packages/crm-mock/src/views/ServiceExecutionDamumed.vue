<script setup lang="ts">
/**
 * Журнал выполнения процедур (Модуль 4 — тайм-менеджмент статусов).
 *
 * Источник данных — стор курса (courseStore): слоты генерируются на вкладке
 * "Первичный осмотр" → SmartScheduleSection и автоматически попадают сюда.
 *
 * Врач/массажист отмечает процедуру как выполненную в момент/сразу после услуги
 * — агент автоматически фиксирует реальный таймстамп и запрашивает дневник.
 *
 * Семантика data-rpa-*:
 *  - data-rpa-action="markCompleted:<procedureId>" — клик ставит галочку +
 *    timestamp. Если для одной процедуры несколько слотов в день — атрибут
 *    висит ТОЛЬКО на первом невыполненном, чтобы голосовая команда
 *    "Массаж выполнен" однозначно попала в правильный слот.
 *  - data-rpa-field="service.<procedureId>.diary" — поле короткого дневника.
 */
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useCourseStore, slotKey, type Completion } from '@/stores/courseStore';
import type { ScheduledSlot } from '@/scheduling/scheduler';

const courseStore = useCourseStore();
const { slots, dayDates, completions, totalSlots, totalCompleted } = storeToRefs(courseStore);

/** Дата, по которой сейчас отображается журнал. Дефолт: сегодня. */
const today = (): string => new Date().toISOString().slice(0, 10);
const selectedDate = ref<string>(today());

/**
 * Если расписание сгенерировано, но выбранная дата в нём отсутствует —
 * переключаемся на первый день курса. Это позволяет голосовой команде
 * "Массаж выполнен" сразу попасть в нужный слот без ручного выбора даты.
 */
watch(
  dayDates,
  (days) => {
    if (days.length === 0) return;
    if (!days.some((d) => d.date === selectedDate.value)) {
      selectedDate.value = days[0].date;
    }
  },
  { immediate: true },
);

/** Фоллбэк-расписание (если врач ещё не сгенерировал курс). */
const FALLBACK_SLOTS: ScheduledSlot[] = [
  { day: 1, date: today(), dayOfWeek: new Date().getDay(), time: '09:00',
    procedureId: 'lfk', procedureName: 'ЛФК',
    specialistId: 'specialist1', specialistName: 'Иванов И.И.', duration: 30 },
  { day: 1, date: today(), dayOfWeek: new Date().getDay(), time: '09:30',
    procedureId: 'massage', procedureName: 'Массаж',
    specialistId: 'specialist2', specialistName: 'Петров П.П.', duration: 30 },
  { day: 1, date: today(), dayOfWeek: new Date().getDay(), time: '10:00',
    procedureId: 'psychology', procedureName: 'Психолог',
    specialistId: 'specialist3', specialistName: 'Сидорова А.А.', duration: 40 },
  { day: 1, date: today(), dayOfWeek: new Date().getDay(), time: '11:00',
    procedureId: 'physiotherapy', procedureName: 'Физиотерапия',
    specialistId: 'specialist4', specialistName: 'Козлов В.В.', duration: 30 },
  { day: 1, date: today(), dayOfWeek: new Date().getDay(), time: '11:30',
    procedureId: 'speech', procedureName: 'Логопед',
    specialistId: 'specialist5', specialistName: 'Никитина О.Л.', duration: 30 },
];

const hasGeneratedSchedule = computed(() => slots.value.length > 0);

/** Слоты, отображаемые в таблице на выбранный день. */
const visibleSlots = computed<ScheduledSlot[]>(() => {
  if (!hasGeneratedSchedule.value) return FALLBACK_SLOTS;
  return slots.value
    .filter((s) => s.date === selectedDate.value)
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time));
});

/**
 * procedureId → ключ первого невыполненного слота на выбранный день.
 * Голосовая команда вроде "Массаж выполнен" найдёт ровно один элемент
 * с data-rpa-action="markCompleted:massage" (у остальных этого атрибута нет).
 */
const firstPendingKeyByProc = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {};
  for (const s of visibleSlots.value) {
    const k = slotKey(s);
    if (completions.value[k]) continue;
    if (!map[s.procedureId]) map[s.procedureId] = k;
  }
  return map;
});

const getCompletion = (s: ScheduledSlot): Completion | undefined =>
  completions.value[slotKey(s)];

const dayProgress = computed(() => {
  const done = visibleSlots.value.filter((s) => !!getCompletion(s)).length;
  return { done, total: visibleSlots.value.length };
});

const currentTime = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const speak = (text: string): void => {
  window.dispatchEvent(new CustomEvent('rpa:tts-request', { detail: { text } }));
  window.postMessage({ __rpa_tts: true, text }, '*');
};

const toggle = (s: ScheduledSlot): void => {
  const key = slotKey(s);
  const existing = completions.value[key];
  if (existing) {
    courseStore.clearCompletion(key);
    speak(`${s.procedureName} возвращена в статус "запланировано"`);
    return;
  }
  const at = currentTime();
  courseStore.markCompleted(key, at, today(), '');
  speak(
    `${s.procedureName} отмечена как выполненная в ${at}. ` +
      'Продиктуйте короткий дневник процедуры или скажите "пропусти".',
  );
};

const updateDiary = (s: ScheduledSlot, text: string): void => {
  const key = slotKey(s);
  // Если процедура ещё не выполнена — создаём completion без времени (черновик)
  if (!completions.value[key]) {
    courseStore.markCompleted(key, '', today(), text);
  } else {
    courseStore.updateDiary(key, text);
  }
};

const weekdayName = (dow: number): string =>
  ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dow] || '';
</script>

<template>
  <div class="service-execution" data-rpa-form="services">
    <div class="panel panel-default">
      <div class="panel-heading">
        <div>
          <h2>Журнал выполнения процедур</h2>
          <div class="subtitle">
            Курс: <strong>{{ totalCompleted }} / {{ totalSlots || FALLBACK_SLOTS.length }}</strong>
            выполнено ·
            День: <strong>{{ dayProgress.done }} / {{ dayProgress.total }}</strong>
          </div>
        </div>
        <div v-if="hasGeneratedSchedule" class="day-selector">
          <label for="dayPick">Дата:</label>
          <select
            id="dayPick"
            v-model="selectedDate"
            class="form-control"
            data-rpa-field="services.selectedDate"
          >
            <option
              v-for="d in dayDates"
              :key="d.date"
              :value="d.date"
              :data-rpa-action="`selectDate:day${d.day}`"
            >
              День {{ d.day }} · {{ weekdayName(d.dayOfWeek) }}, {{ d.date }}
            </option>
          </select>
        </div>
      </div>

      <div class="panel-body">
        <div v-if="!hasGeneratedSchedule" class="no-schedule">
          ⚠ Расписание ещё не сгенерировано — показан демо-набор.
          Сгенерируйте курс на вкладке <strong>"Первичный осмотр"</strong> —
          здесь автоматически появятся реальные процедуры.
        </div>

        <table class="services-table">
          <thead>
            <tr>
              <th style="width:50px">#</th>
              <th style="width:90px">План</th>
              <th>Процедура</th>
              <th>Специалист</th>
              <th style="width:130px">Статус</th>
              <th style="width:90px">Факт</th>
              <th>Дневник процедуры</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="visibleSlots.length === 0">
              <td colspan="7" class="empty-row">
                На выбранную дату нет процедур.
              </td>
            </tr>
            <tr
              v-for="(s, idx) in visibleSlots"
              :key="slotKey(s)"
              :class="{ 'row-done': !!getCompletion(s) }"
            >
              <td>{{ idx + 1 }}</td>
              <td class="time-col">{{ s.time }}</td>
              <td class="proc-name">{{ s.procedureName }}</td>
              <td>{{ s.specialistName }}</td>
              <td>
                <button
                  type="button"
                  class="btn-status"
                  :class="getCompletion(s) ? 'btn-done' : 'btn-pending'"
                  :data-rpa-action="
                    firstPendingKeyByProc[s.procedureId] === slotKey(s)
                      ? `markCompleted:${s.procedureId}`
                      : undefined
                  "
                  :data-rpa-field="`service.${s.procedureId}.completed`"
                  @click="toggle(s)"
                >
                  <span v-if="getCompletion(s)">✓ Выполнено</span>
                  <span v-else>☐ Запланировано</span>
                </button>
              </td>
              <td class="time-col fact-col">
                {{ getCompletion(s)?.completedAt || '—' }}
              </td>
              <td>
                <textarea
                  :value="getCompletion(s)?.diary || ''"
                  @input="updateDiary(s, ($event.target as HTMLTextAreaElement).value)"
                  class="form-control diary-cell"
                  rows="2"
                  placeholder="Запишите результат процедуры голосом"
                  :data-rpa-field="`service.${s.procedureId}.diary`"
                ></textarea>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="hint">
          <strong>Голосовые команды:</strong>
          <em>"ЛФК выполнена"</em> ·
          <em>"Массаж выполнен, пациент перенёс хорошо"</em> ·
          <em>"Запиши в дневник психолога: ребёнок активен"</em>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.service-execution {
  padding: 16px;
}

.panel {
  background: #fff;
  border: 1px solid #e0e4ea;
  border-radius: 6px;
}

.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 18px;
  border-bottom: 1px solid #e0e4ea;
  background: #f8f9fa;
  gap: 16px;
}

.panel-heading h2 {
  margin: 0;
  font-size: 18px;
  color: #2c3e50;
}

.subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: #555;
}

.subtitle strong {
  color: #0b5394;
}

.day-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.day-selector label {
  font-size: 13px;
  color: #555;
  white-space: nowrap;
}

.day-selector select {
  padding: 6px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  min-width: 240px;
}

.panel-body {
  padding: 16px 18px;
}

.no-schedule {
  padding: 10px 14px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #713f12;
  border-radius: 4px;
  margin-bottom: 14px;
  font-size: 13px;
}

.services-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.services-table th,
.services-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
  text-align: left;
  vertical-align: middle;
}

.services-table th {
  background: #f3f5f8;
  font-weight: 600;
  color: #555;
  font-size: 13px;
}

.services-table tr.row-done {
  background: #f0fdf4;
}

.empty-row {
  text-align: center;
  color: #999;
  padding: 24px 0;
  font-style: italic;
}

.proc-name {
  font-weight: 600;
  color: #1f2937;
}

.time-col {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #3098a1;
  text-align: center;
}

.fact-col {
  color: #16a34a;
}

.btn-status {
  width: 100%;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.btn-pending {
  background: #f3f4f6;
  color: #6b7280;
  border-color: #d1d5db;
}

.btn-pending:hover {
  background: #e5e7eb;
}

.btn-done {
  background: #16a34a;
  color: #fff;
  border-color: #15803d;
}

.btn-done:hover {
  background: #15803d;
}

.diary-cell {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
}

.diary-cell:focus {
  border-color: #3098a1;
  outline: none;
  box-shadow: 0 0 0 2px rgba(48, 152, 161, 0.15);
}

.hint {
  margin-top: 18px;
  padding: 12px 14px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 4px;
  font-size: 13px;
  color: #713f12;
}

.hint strong {
  color: #92400e;
}

.hint em {
  font-style: italic;
  color: #6b4423;
  background: #fef3c7;
  padding: 1px 6px;
  border-radius: 3px;
  margin: 0 2px;
  white-space: nowrap;
}
</style>
