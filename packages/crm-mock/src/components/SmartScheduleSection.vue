<script setup lang="ts">
/**
 * Переиспользуемый блок умного расписания.
 * Встраивается в первичный осмотр для автогенерации 9-дневной сетки процедур.
 */
import { ref, computed } from 'vue';
import {
  generateSchedule as runScheduler,
  type Procedure as AlgProcedure,
  type Specialist as AlgSpecialist,
  type PrescribedProcedure,
  type ScheduledSlot,
} from '@/scheduling/scheduler';

const startDate = ref(new Date().toISOString().slice(0, 10));
const endDate = ref('');

const availableProcedures: AlgProcedure[] = [
  { id: 'lfk', name: 'ЛФК', duration: 30, specialty: 'ЛФК' },
  { id: 'massage', name: 'Массаж', duration: 30, specialty: 'Массаж' },
  { id: 'psychology', name: 'Психолог', duration: 40, specialty: 'Психолог' },
  { id: 'physiotherapy', name: 'Физиотерапия', duration: 30, specialty: 'Физиотерапия' },
  { id: 'speech', name: 'Логопед', duration: 30, specialty: 'Логопед' },
];

const specialists: AlgSpecialist[] = [
  {
    id: 'specialist1',
    name: 'Иванов И.И.',
    specialty: 'ЛФК',
    weeklyAvailability: {
      1: ['09:00', '09:30', '10:00', '10:30', '11:00'],
      2: ['09:00', '09:30', '10:00', '10:30', '11:00'],
      3: ['09:00', '09:30', '10:00', '10:30', '11:00'],
      4: ['09:00', '09:30', '10:00'],
      5: ['09:00', '09:30', '10:00', '10:30', '11:00'],
    },
  },
  {
    id: 'specialist2',
    name: 'Петров П.П.',
    specialty: 'Массаж',
    weeklyAvailability: {
      1: ['09:30', '10:30', '11:30', '13:00', '13:30'],
      2: ['09:30', '10:30', '11:30'],
      3: ['09:30', '10:30', '11:30', '13:00', '13:30'],
      4: ['09:30', '10:30', '11:30', '13:00', '13:30'],
      5: ['09:30', '10:30', '11:30'],
    },
  },
  {
    id: 'specialist3',
    name: 'Сидорова А.А.',
    specialty: 'Психолог',
    weeklyAvailability: {
      1: ['10:00', '11:00', '12:00'],
      2: ['10:00', '11:00', '12:00', '14:00'],
      3: ['10:00', '11:00', '12:00'],
      4: ['10:00', '11:00', '12:00', '14:00'],
      5: ['10:00', '11:00'],
    },
  },
  {
    id: 'specialist4',
    name: 'Козлов В.В.',
    specialty: 'Физиотерапия',
    weeklyAvailability: {
      1: ['09:00', '09:30', '13:00', '13:30', '14:00'],
      2: ['09:00', '09:30', '13:00', '13:30', '14:00'],
      3: ['09:00', '09:30', '13:00', '13:30'],
      4: ['09:00', '09:30', '13:00', '13:30', '14:00'],
      5: ['09:00', '09:30', '13:00'],
    },
  },
  {
    id: 'specialist5',
    name: 'Никитина О.Л.',
    specialty: 'Логопед',
    weeklyAvailability: {
      1: ['11:00', '11:30', '12:00'],
      2: ['11:00', '11:30', '12:00'],
      3: ['11:00', '11:30'],
      4: ['11:00', '11:30', '12:00'],
      5: ['11:00', '11:30', '12:00'],
    },
  },
];

interface PrescribedRow extends PrescribedProcedure {
  enabled: boolean;
}

const prescribed = ref<PrescribedRow[]>(
  availableProcedures.map((p) => ({
    procedureId: p.id,
    sessions: 9,
    enabled: false,
  })),
);

const generatedSlots = ref<ScheduledSlot[]>([]);
const unplacedList = ref<Array<{ procedureId: string; reason: string }>>([]);
const dayDatesRef = ref<Array<{ day: number; date: string; dayOfWeek: number }>>([]);

const slotsByDay = computed(() => {
  const map: Record<number, ScheduledSlot[]> = {};
  for (const slot of generatedSlots.value) {
    if (!map[slot.day]) map[slot.day] = [];
    map[slot.day].push(slot);
  }
  return map;
});

const weekdayName = (dow: number): string => {
  return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dow] || '';
};

const procedureName = (id: string): string => {
  return availableProcedures.find((p) => p.id === id)?.name || id;
};

/** Попросить расширение озвучить фразу голосом агента. */
const speak = (text: string) => {
  window.dispatchEvent(new CustomEvent('rpa:tts-request', { detail: { text } }));
};

const handleGenerate = () => {
  const enabled = prescribed.value.filter((r) => r.enabled && r.sessions > 0);
  if (enabled.length === 0) {
    speak('Отметьте хотя бы одну процедуру и укажите количество сеансов');
    return;
  }
  const parsed = startDate.value ? new Date(startDate.value) : new Date();
  const result = runScheduler({
    startDate: parsed,
    prescribed: enabled.map(({ procedureId, sessions }) => ({ procedureId, sessions })),
    procedures: availableProcedures,
    specialists,
    daysCount: 9,
  });
  generatedSlots.value = result.slots;
  unplacedList.value = result.unplaced;
  dayDatesRef.value = result.dayDates;
  if (result.dayDates.length > 0) {
    endDate.value = result.dayDates[result.dayDates.length - 1].date;
  }

  if (result.unplaced.length > 0) {
    speak(
      `Расписание сгенерировано. Размещено ${result.slots.length} процедур. ` +
        `Не удалось разместить ${result.unplaced.length} сеансов.`,
    );
  } else {
    speak(`Расписание сгенерировано на 9 рабочих дней. Всего ${result.slots.length} процедур.`);
  }
};
</script>

<template>
  <div class="smart-schedule">
    <div class="row form-group">
      <div class="col-md-3">
        <label for="dtScheduleStartDate">Начало курса</label>
      </div>
      <div class="col-md-3">
        <input
          id="dtScheduleStartDate"
          v-model="startDate"
          type="date"
          class="form-control"
          data-rpa-field="schedule.startDate"
        />
      </div>
      <div class="col-md-3">
        <label for="dtScheduleEndDate">Окончание курса</label>
      </div>
      <div class="col-md-3">
        <input
          id="dtScheduleEndDate"
          v-model="endDate"
          type="date"
          class="form-control"
          data-rpa-field="schedule.endDate"
          readonly
        />
      </div>
    </div>

    <h4 class="subsection-title">Назначенные процедуры</h4>
    <table class="prescribed-table">
      <thead>
        <tr>
          <th style="width:40px"></th>
          <th>Процедура</th>
          <th style="width:110px">Длительность</th>
          <th>Специалист</th>
          <th style="width:120px">Сеансов</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, idx) in prescribed" :key="row.procedureId">
          <td>
            <input
              type="checkbox"
              v-model="row.enabled"
              :data-rpa-field="`schedule.prescribed.${row.procedureId}.enabled`"
            />
          </td>
          <td>{{ availableProcedures[idx].name }}</td>
          <td>{{ availableProcedures[idx].duration }} мин</td>
          <td>{{ availableProcedures[idx].specialty }}</td>
          <td>
            <input
              type="number"
              v-model.number="row.sessions"
              min="1"
              max="18"
              class="form-control"
              :data-rpa-field="`schedule.prescribed.${row.procedureId}.sessions`"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <div class="generate-actions">
      <button
        type="button"
        class="btn btn-info"
        data-rpa-action="generateSchedule"
        @click="handleGenerate"
      >
        Автоматически сгенерировать расписание
      </button>
    </div>

    <template v-if="generatedSlots.length > 0 || dayDatesRef.length > 0">
      <h4 class="subsection-title">
        Сгенерированное расписание ({{ generatedSlots.length }} процедур / 9 рабочих дней)
      </h4>
      <div v-if="unplacedList.length > 0" class="alert-warning">
        ⚠ Не удалось разместить {{ unplacedList.length }} сеансов:
        <ul>
          <li v-for="(u, i) in unplacedList" :key="i">
            {{ procedureName(u.procedureId) }}: {{ u.reason }}
          </li>
        </ul>
      </div>

      <div class="schedule-grid">
        <div v-for="info in dayDatesRef" :key="info.day" class="schedule-day">
          <div class="day-header">
            <h3>День {{ info.day }} — {{ weekdayName(info.dayOfWeek) }}, {{ info.date }}</h3>
          </div>
          <div class="procedures-list">
            <div v-if="!slotsByDay[info.day] || slotsByDay[info.day].length === 0" class="no-procedures">
              Нет процедур
            </div>
            <div
              v-for="(slot, i) in slotsByDay[info.day] || []"
              :key="i"
              class="slot-item"
              :data-rpa-field="`schedule.day${info.day}.slot${i}`"
            >
              <span class="slot-time">{{ slot.time }}</span>
              <span class="slot-proc">{{ slot.procedureName }}</span>
              <span class="slot-spec">{{ slot.specialistName }}</span>
              <span class="slot-dur">{{ slot.duration }} мин</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.smart-schedule {
  margin-top: 10px;
}

.subsection-title {
  font-size: 15px;
  font-weight: 600;
  color: #444;
  margin: 20px 0 10px 0;
}

.row {
  display: flex;
  margin: 0 -15px;
}

.form-group {
  margin-bottom: 15px;
}

.col-md-3 {
  flex: 0 0 25%;
  padding: 0 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #333;
}

input[type="text"],
input[type="date"],
input[type="number"],
select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.5;
}

input:focus {
  border-color: #3098a1;
  outline: 0;
  box-shadow: 0 0 0 3px rgba(48, 152, 161, 0.1);
}

.prescribed-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

.prescribed-table th,
.prescribed-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  text-align: left;
  font-size: 14px;
}

.prescribed-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #555;
}

.prescribed-table input[type="number"] {
  width: 80px;
  padding: 4px 8px;
}

.generate-actions {
  margin-top: 16px;
  margin-bottom: 16px;
}

.alert-warning {
  background: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 16px;
}

.alert-warning ul {
  margin: 8px 0 0;
  padding-left: 20px;
}

.schedule-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 12px;
}

.schedule-day {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 12px;
  background: #fafafa;
}

.day-header h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #333;
  font-weight: 600;
}

.no-procedures {
  color: #999;
  font-style: italic;
  padding: 6px 0;
  font-size: 13px;
}

.slot-item {
  display: flex;
  gap: 8px;
  align-items: center;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-left: 3px solid #3098a1;
  border-radius: 4px;
  padding: 6px 8px;
  margin-bottom: 5px;
  font-size: 12px;
}

.slot-time {
  font-weight: 700;
  color: #3098a1;
  min-width: 46px;
}

.slot-proc {
  font-weight: 500;
  flex: 1;
}

.slot-spec {
  color: #666;
  font-size: 11px;
}

.slot-dur {
  color: #999;
  font-size: 10px;
  white-space: nowrap;
}

.btn {
  display: inline-block;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}

.btn-info {
  background: #5bc0de;
  color: #fff;
  border-color: #5bc0de;
}

.btn-info:hover {
  background: #46b8da;
}

@media (max-width: 1200px) {
  .schedule-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .schedule-grid {
    grid-template-columns: 1fr;
  }
}
</style>
