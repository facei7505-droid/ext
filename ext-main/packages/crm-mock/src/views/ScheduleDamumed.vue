<script setup lang="ts">
import { ref } from 'vue';

interface Procedure {
  procedureId: string;
  specialistId: string;
  time: string;
}

interface ScheduleDay {
  day: number;
  date: string;
  procedures: Procedure[];
}

const startDate = ref('');
const endDate = ref('');

// Процедуры на 9 рабочих дней
const schedule = ref<ScheduleDay[]>([
  { day: 1, date: '', procedures: [] },
  { day: 2, date: '', procedures: [] },
  { day: 3, date: '', procedures: [] },
  { day: 4, date: '', procedures: [] },
  { day: 5, date: '', procedures: [] },
  { day: 6, date: '', procedures: [] },
  { day: 7, date: '', procedures: [] },
  { day: 8, date: '', procedures: [] },
  { day: 9, date: '', procedures: [] },
]);

const availableProcedures = [
  { id: 'lfk', name: 'ЛФК', duration: 30 },
  { id: 'massage', name: 'Массаж', duration: 30 },
  { id: 'psychology', name: 'Психолог', duration: 40 },
  { id: 'physiotherapy', name: 'Физиотерапия', duration: 30 },
  { id: 'speech', name: 'Логопед', duration: 30 },
];

const specialists = [
  { id: 'specialist1', name: 'Иванов И.И.', specialty: 'ЛФК', available: ['09:00', '10:00', '11:00'] },
  { id: 'specialist2', name: 'Петров П.П.', specialty: 'Массаж', available: ['09:30', '10:30', '11:30'] },
  { id: 'specialist3', name: 'Сидорова А.А.', specialty: 'Психолог', available: ['10:00', '11:00', '12:00'] },
];

const addProcedure = (dayIndex: number) => {
  schedule.value[dayIndex].procedures.push({
    procedureId: '',
    specialistId: '',
    time: '',
  });
};

const removeProcedure = (dayIndex: number, procIndex: number) => {
  schedule.value[dayIndex].procedures.splice(procIndex, 1);
};

const generateSchedule = () => {
  console.log('Generating schedule:', schedule.value);
};

const handleSubmit = () => {
  console.log('Schedule submitted:', schedule.value);
};
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

          <!-- Расписание на 9 дней -->
          <div class="section-title">Расписание процедур (9 рабочих дней)</div>
          <div class="schedule-grid">
            <div v-for="(day, dayIndex) in schedule" :key="day.day" class="schedule-day">
              <div class="day-header">
                <h3>День {{ day.day }}</h3>
                <input
                  v-model="day.date"
                  type="date"
                  class="form-control"
                  :placeholder="`Дата дня ${day.day}`"
                  :data-rpa-field="`schedule.day${day.day}.date`"
                />
              </div>
              
              <div class="procedures-list">
                <div v-if="day.procedures.length === 0" class="no-procedures">
                  Нет процедур
                </div>
                <div v-for="(proc, procIndex) in day.procedures" :key="procIndex" class="procedure-item">
                  <select
                    v-model="proc.procedureId"
                    class="form-control"
                    :data-rpa-field="`schedule.day${day.day}.procedure${procIndex}.type`"
                  >
                    <option value="">Выберите процедуру</option>
                    <option v-for="p in availableProcedures" :key="p.id" :value="p.id">
                      {{ p.name }} ({{ p.duration }} мин)
                    </option>
                  </select>
                  
                  <select
                    v-model="proc.specialistId"
                    class="form-control"
                    :data-rpa-field="`schedule.day${day.day}.procedure${procIndex}.specialist`"
                  >
                    <option value="">Выберите специалиста</option>
                    <option v-for="s in specialists" :key="s.id" :value="s.id">
                      {{ s.name }} ({{ s.specialty }})
                    </option>
                  </select>
                  
                  <select
                    v-model="proc.time"
                    class="form-control"
                    :data-rpa-field="`schedule.day${day.day}.procedure${procIndex}.time`"
                  >
                    <option value="">Выберите время</option>
                    <option value="09:00">09:00</option>
                    <option value="09:30">09:30</option>
                    <option value="10:00">10:00</option>
                    <option value="10:30">10:30</option>
                    <option value="11:00">11:00</option>
                    <option value="11:30">11:30</option>
                    <option value="12:00">12:00</option>
                    <option value="12:30">12:30</option>
                    <option value="13:00">13:00</option>
                    <option value="13:30">13:30</option>
                    <option value="14:00">14:00</option>
                    <option value="14:30">14:30</option>
                    <option value="15:00">15:00</option>
                  </select>
                  
                  <button
                    type="button"
                    class="btn btn-danger btn-sm"
                    @click="removeProcedure(dayIndex, procIndex)"
                  >
                    Удалить
                  </button>
                </div>
                
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  @click="addProcedure(dayIndex)"
                >
                  + Добавить процедуру
                </button>
              </div>
            </div>
          </div>

          <!-- Кнопки -->
          <div class="form-actions">
            <button type="button" class="btn btn-info" @click="generateSchedule">
              Автоматически сгенерировать расписание
            </button>
            <button type="submit" class="btn btn-primary">Сохранить расписание</button>
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
