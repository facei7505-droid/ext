<script setup lang="ts">
import { ref } from 'vue';

interface Assignment {
  type: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string;
}

const assignments = ref<Assignment[]>([]);

const newAssignment = ref({
  type: 'medication',
  name: '',
  dosage: '',
  frequency: '',
  startDate: '',
  endDate: '',
});

const addAssignment = () => {
  if (newAssignment.value.name) {
    assignments.value.push({ ...newAssignment.value });
    newAssignment.value = { type: 'medication', name: '', dosage: '', frequency: '', startDate: '', endDate: '' };
  }
};

const removeAssignment = (index: number) => {
  assignments.value.splice(index, 1);
};

const handleSubmit = () => {
  console.log('Assignments submitted:', assignments.value);
};
</script>

<template>
  <div class="assignments-form">
    <div class="panel panel-default">
      <div class="panel-heading">
        <h2>Назначения</h2>
      </div>
      <div class="panel-body">
        <form @submit.prevent="handleSubmit">
          <!-- Добавление назначения -->
          <div class="section-title">Добавить назначение</div>
          <div class="row form-group">
            <div class="col-md-2">
              <label for="cmbAssignmentType">Тип назначения</label>
            </div>
            <div class="col-md-3">
              <select
                id="cmbAssignmentType"
                v-model="newAssignment.type"
                name="cmbAssignmentType"
                class="form-control"
                data-rpa-field="assignments.new.type"
              >
                <option value="medication">Медикамент</option>
                <option value="procedure">Процедура</option>
                <option value="service">Услуга</option>
              </select>
            </div>
            <div class="col-md-2">
              <label for="tbAssignmentName">Название</label>
            </div>
            <div class="col-md-3">
              <input
                id="tbAssignmentName"
                v-model="newAssignment.name"
                name="tbAssignmentName"
                type="text"
                class="form-control"
                placeholder="Название медикамента/процедуры"
                data-rpa-field="assignments.new.name"
              />
            </div>
            <div class="col-md-2">
              <button
                type="button"
                class="btn btn-primary"
                @click="addAssignment"
              >
                Добавить
              </button>
            </div>
          </div>

          <div class="row form-group">
            <div class="col-md-2">
              <label for="tbDosage">Дозировка</label>
            </div>
            <div class="col-md-3">
              <input
                id="tbDosage"
                v-model="newAssignment.dosage"
                name="tbDosage"
                type="text"
                class="form-control"
                placeholder="Например: 500 мг"
                data-rpa-field="assignments.new.dosage"
              />
            </div>
            <div class="col-md-2">
              <label for="tbFrequency">Частота приема</label>
            </div>
            <div class="col-md-3">
              <input
                id="tbFrequency"
                v-model="newAssignment.frequency"
                name="tbFrequency"
                type="text"
                class="form-control"
                placeholder="Например: 3 раза в день"
                data-rpa-field="assignments.new.frequency"
              />
            </div>
          </div>

          <div class="row form-group">
            <div class="col-md-2">
              <label for="dtStartDate">Начало</label>
            </div>
            <div class="col-md-3">
              <input
                id="dtStartDate"
                v-model="newAssignment.startDate"
                name="dtStartDate"
                type="date"
                class="form-control"
                data-rpa-field="assignments.new.startDate"
              />
            </div>
            <div class="col-md-2">
              <label for="dtEndDate">Окончание</label>
            </div>
            <div class="col-md-3">
              <input
                id="dtEndDate"
                v-model="newAssignment.endDate"
                name="dtEndDate"
                type="date"
                class="form-control"
                data-rpa-field="assignments.new.endDate"
              />
            </div>
          </div>

          <!-- Список назначений -->
          <div class="section-title">Список назначений</div>
          <div v-if="assignments.length === 0" class="no-assignments">
            Нет добавленных назначений
          </div>
          <div v-else class="assignments-list">
            <div v-for="(assignment, index) in assignments" :key="index" class="assignment-item">
              <div class="assignment-info">
                <span class="assignment-type">{{ assignment.type }}</span>
                <span class="assignment-name">{{ assignment.name }}</span>
                <span class="assignment-dosage">{{ assignment.dosage }}</span>
                <span class="assignment-frequency">{{ assignment.frequency }}</span>
                <span class="assignment-dates">{{ assignment.startDate }} - {{ assignment.endDate }}</span>
              </div>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                @click="removeAssignment(index)"
              >
                Удалить
              </button>
            </div>
          </div>

          <!-- Кнопки -->
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Сохранить назначения</button>
            <button type="button" class="btn btn-default">Отмена</button>
            <button type="button" class="btn btn-info">Печать</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assignments-form {
  max-width: 1200px;
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

.col-md-2 {
  flex: 0 0 16.666667%;
  padding: 0 15px;
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

.no-assignments {
  color: #999;
  font-style: italic;
  padding: 20px;
  text-align: center;
  background: #fafafa;
  border-radius: 4px;
}

.assignments-list {
  margin-top: 20px;
}

.assignment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  margin-bottom: 10px;
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.assignment-info {
  display: flex;
  gap: 15px;
  flex: 1;
  flex-wrap: wrap;
}

.assignment-type {
  padding: 2px 8px;
  background: #e0e0e0;
  border-radius: 12px;
  font-size: 12px;
  color: #666;
}

.assignment-name {
  font-weight: bold;
  color: #333;
  min-width: 150px;
}

.assignment-dosage {
  color: #666;
}

.assignment-frequency {
  color: #666;
}

.assignment-dates {
  color: #999;
  font-size: 14px;
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
</style>
