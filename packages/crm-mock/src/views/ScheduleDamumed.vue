<script setup lang="ts">
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

// Каталог процедур (длительности в минутах, 30-40).
const availableProcedures: AlgProcedure[] = [
  { id: 'lfk', name: 'ЛФК', duration: 30, specialty: 'ЛФК' },
  { id: 'massage', name: 'Массаж', duration: 30, specialty: 'Массаж' },
  { id: 'psychology', name: 'Психолог', duration: 40, specialty: 'Психолог' },
  { id: 'physiotherapy', name: 'Физиотерапия', duration: 30, specialty: 'Физиотерапия' },
  { id: 'speech', name: 'Логопед', duration: 30, specialty: 'Логопед' },
];

// Каталог специалистов с недельной доступностью (0=Вс ... 6=Сб).
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

// Назначенные процедуры (врач отмечает что и сколько сеансов).
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

// Результат генерации: слоты, сгруппированные по дням.
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

const handleGenerate = () => {
  const enabled = prescribed.value.filter((r) => r.enabled && r.sessions > 0);
  if (enabled.length === 0) {
    alert('Отметьте хотя бы одну процедуру и укажите количество сеансов');
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
  // Обновляем endDate по последнему рабочему дню
  if (result.dayDates.length > 0) {
    endDate.value = result.dayDates[result.dayDates.length - 1].date;
  }
};

const handleSubmit = () => {
  console.log('Schedule submitted:', generatedSlots.value);
  alert(`Расписание сохранено: ${generatedSlots.value.length} процедур`);
};

// Экспонируем метод для голосовой команды из расширения
(window as unknown as { __rpaGenerateSchedule?: () => void }).__rpaGenerateSchedule = handleGenerate;
</script>

<template>
  <div class="schedule-form">
    <div class="panel panel-default">
      <div class="panel-heading">
        <h2>Умное расписание процедур</h2>
      </div>
      <div class="panel-body">
        <form @submit.prevent="handleSubmit">
          <!-- Период лечения -->
          <div class="section-title">Период лечения</div>
          <div class="row form-group">
            <div class="col-md-3">
              <label for="dtStartDate">Начало курса</label>
            </div>
            <div class="col-md-3">
              <input
                id="dtStartDate"
                v-model="startDate"
                name="dtStartDate"
                type="date"
                class="form-control"
                data-rpa-field="schedule.startDate"
              />
            </div>
            <div class="col-md-3">
              <label for="dtEndDate">Окончание курса</label>
            </div>
            <div class="col-md-3">
              <input
                id="dtEndDate"
                v-model="endDate"
                name="dtEndDate"
                type="date"
                class="form-control"
                data-rpa-field="schedule.endDate"
              />
            </div>
          </div>

          <!-- Назначенные процедуры -->
          <div class="section-title">Назначенные процедуры</div>
          <table class="prescribed-table">
            <thead>
              <tr>
                <th style="width:40px"></th>
                <th>Процедура</th>
                <th style="width:100px">Длительность</th>
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

          <!-- Кнопка генерации -->
          <div class="form-actions" style="margin-top:16px">
            <button
              type="button"
              class="btn btn-info"
              data-rpa-action="generateSchedule"
              @click="handleGenerate"
            >
              Автоматически сгенерировать расписание
            </button>
          </div>

          <!-- Сгенерированное расписание -->
          <template v-if="generatedSlots.length > 0 || dayDatesRef.length > 0">
            <div class="section-title" style="margin-top:24px">
              Сгенерированное расписание ({{ generatedSlots.length }} процедур за 9 рабочих дней)
            </div>
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

          <!-- Кнопки -->
          <div class="form-actions">
            <button
              type="submit"
              class="btn btn-primary"
              data-rpa-action="submit"
              :disabled="generatedSlots.length === 0"
            >
              Сохранить расписание
            </button>
            <button type="button" class="btn btn-default">Отмена</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.schedule-form {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.panel {
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 20px;
  background: #fff;
}

.panel-heading {
  background: #f5f5f5;
  padding: 15px;
  border-bottom: 1px solid #ddd;
  border-radius: 4px 4px 0 0;
}

.panel-heading h2 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.panel-body {
  padding: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #3098a1;
  margin: 20px 0 10px 0;
  padding-bottom: 5px;
  border-bottom: 2px solid #3098a1;
}

.section-title:first-child {
  margin-top: 0;
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
select,
textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.5;
  transition: border-color 0.15s ease-in-out;
}

input[type="text"]:focus,
input[type="date"]:focus,
select:focus,
textarea:focus {
  border-color: #3098a1;
  outline: 0;
  box-shadow: 0 0 0 3px rgba(48, 152, 161, 0.1);
}

.schedule-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 20px;
}

.schedule-day {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 15px;
  background: #fafafa;
}

.day-header {
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ddd;
}

.day-header h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #333;
}

.procedures-list {
  min-height: 50px;
}

.no-procedures {
  color: #999;
  font-style: italic;
  padding: 10px 0;
}

.procedure-item {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 10px;
}

.procedure-item select {
  margin-bottom: 8px;
}

.procedure-item select:last-of-type {
  margin-bottom: 0;
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

.slot-item {
  display: flex;
  gap: 8px;
  align-items: center;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-left: 3px solid #3098a1;
  border-radius: 4px;
  padding: 8px 10px;
  margin-bottom: 6px;
  font-size: 13px;
}

.slot-time {
  font-weight: 700;
  color: #3098a1;
  min-width: 50px;
}

.slot-proc {
  font-weight: 500;
  flex: 1;
}

.slot-spec {
  color: #666;
  font-size: 12px;
}

.slot-dur {
  color: #999;
  font-size: 11px;
  white-space: nowrap;
}

.form-actions {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #ddd;
}

.btn {
  display: inline-block;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.btn-primary {
  background: #3098a1;
  color: #fff;
  border-color: #3098a1;
}

.btn-primary:hover {
  background: #287a82;
  border-color: #287a82;
}

.btn-default {
  background: #fff;
  color: #333;
  border-color: #ccc;
}

.btn-default:hover {
  background: #f5f5f5;
  border-color: #aaa;
}

.btn-info {
  background: #5bc0de;
  color: #fff;
  border-color: #5bc0de;
}

.btn-info:hover {
  background: #46b8da;
  border-color: #46b8da;
}

.btn-danger {
  background: #d9534f;
  color: #fff;
  border-color: #d9534f;
}

.btn-danger:hover {
  background: #c9302c;
  border-color: #c9302c;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
}

.btn + .btn {
  margin-left: 10px;
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
