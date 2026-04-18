<script setup lang="ts">
import { ref } from 'vue';
import SmartScheduleSection from '@/components/SmartScheduleSection.vue';

const patientIIN = ref('');
const admissionDate = ref('');
const department = ref('');
const diagnosis = ref('');
const complaints = ref('');
const anamnesis = ref('');
const bloodPressure = ref('');
const pulse = ref('');
const temperature = ref('');
const recommendations = ref('');

const handleSubmit = () => {
  console.log('Form submitted:', {
    patientIIN: patientIIN.value,
    admissionDate: admissionDate.value,
    department: department.value,
    diagnosis: diagnosis.value,
    complaints: complaints.value,
    anamnesis: anamnesis.value,
    bloodPressure: bloodPressure.value,
    pulse: pulse.value,
    temperature: temperature.value,
    recommendations: recommendations.value,
  });
};
</script>

<template>
  <div class="intake-form">
    <div class="panel panel-default">
      <div class="panel-heading">
        <h2>Первичный осмотр пациента</h2>
      </div>
      <div class="panel-body">
        <form @submit.prevent="handleSubmit" data-rpa-form="intake">
          <!-- Пациент -->
          <div class="section-title">Данные пациента</div>
          <div class="row form-group">
            <div class="col-md-3">
              <label for="tbPatientIIN">ИИН пациента</label>
            </div>
            <div class="col-md-9">
              <input
                id="tbPatientIIN"
                v-model="patientIIN"
                name="tbPatientIIN"
                type="text"
                class="form-control"
                placeholder="Введите ИИН (12 цифр)"
                maxlength="12"
                data-rpa-field="patient.iin"
              />
            </div>
          </div>

          <div class="row form-group">
            <div class="col-md-3">
              <label for="dtAdmissionDate">Дата поступления</label>
            </div>
            <div class="col-md-9">
              <input
                id="dtAdmissionDate"
                v-model="admissionDate"
                name="dtAdmissionDate"
                type="date"
                class="form-control"
                data-rpa-field="patient.admissionDate"
              />
            </div>
          </div>

          <div class="row form-group">
            <div class="col-md-3">
              <label for="cmbDepartment">Отделение</label>
            </div>
            <div class="col-md-9">
              <select
                id="cmbDepartment"
                v-model="department"
                name="cmbDepartment"
                class="form-control"
                data-rpa-field="patient.department"
              >
                <option value="">Выберите отделение</option>
                <option value="therapeutic">Терапевтическое</option>
                <option value="neurology">Неврологическое</option>
                <option value="pediatric">Детское</option>
              </select>
            </div>
          </div>

          <!-- Диагноз -->
          <div class="section-title">Диагноз</div>
          <div class="row form-group">
            <div class="col-md-3">
              <label for="cmbDiagnosis">Диагноз</label>
            </div>
            <div class="col-md-9">
              <input
                id="cmbDiagnosis"
                v-model="diagnosis"
                name="cmbDiagnosis"
                type="text"
                class="form-control"
                placeholder="Введите диагноз"
                data-rpa-field="visit.diagnosis"
              />
            </div>
          </div>

          <!-- Жалобы и анамнез -->
          <div class="section-title">Жалобы и анамнез</div>
          <div class="row form-group">
            <div class="col-md-3">
              <label for="taComplaints">Жалобы</label>
            </div>
            <div class="col-md-9">
              <textarea
                id="taComplaints"
                v-model="complaints"
                name="taComplaints"
                class="form-control"
                rows="3"
                placeholder="Опишите жалобы пациента"
                data-rpa-field="visit.complaints"
              ></textarea>
            </div>
          </div>

          <div class="row form-group">
            <div class="col-md-3">
              <label for="taAnamnesis">Анамнез</label>
            </div>
            <div class="col-md-9">
              <textarea
                id="taAnamnesis"
                v-model="anamnesis"
                name="taAnamnesis"
                class="form-control"
                rows="3"
                placeholder="Опишите анамнез"
                data-rpa-field="visit.anamnesis"
              ></textarea>
            </div>
          </div>

          <!-- Объективный статус -->
          <div class="section-title">Объективный статус</div>
          <div class="row form-group">
            <div class="col-md-3">
              <label for="tbBloodPressure">Артериальное давление</label>
            </div>
            <div class="col-md-9">
              <input
                id="tbBloodPressure"
                v-model="bloodPressure"
                name="tbBloodPressure"
                type="text"
                class="form-control"
                placeholder="120/80"
                data-rpa-field="visit.bloodPressure"
              />
            </div>
          </div>

          <div class="row form-group">
            <div class="col-md-3">
              <label for="tbPulse">Пульс</label>
            </div>
            <div class="col-md-9">
              <input
                id="tbPulse"
                v-model="pulse"
                name="tbPulse"
                type="text"
                class="form-control"
                placeholder="72"
                data-rpa-field="visit.pulse"
              />
            </div>
          </div>

          <div class="row form-group">
            <div class="col-md-3">
              <label for="tbTemperature">Температура тела</label>
            </div>
            <div class="col-md-9">
              <input
                id="tbTemperature"
                v-model="temperature"
                name="tbTemperature"
                type="text"
                class="form-control"
                placeholder="36.6"
                data-rpa-field="visit.temperature"
              />
            </div>
          </div>

          <!-- Назначения -->
          <div class="section-title">Назначения</div>
          <div class="row form-group">
            <div class="col-md-3">
              <label for="taRecommendations">Назначения</label>
            </div>
            <div class="col-md-9">
              <textarea
                id="taRecommendations"
                v-model="recommendations"
                name="taRecommendations"
                class="form-control"
                rows="3"
                placeholder="Назначения и рекомендации"
                data-rpa-field="visit.recommendations"
              ></textarea>
            </div>
          </div>

          <!-- Умное расписание (встроенный компонент) -->
          <div class="section-title">Умное расписание процедур</div>
          <SmartScheduleSection />

          <!-- Кнопки -->
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" data-rpa-action="submit">Сохранить</button>
            <button type="button" class="btn btn-default">Отмена</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.intake-form {
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

.col-md-3 {
  flex: 0 0 25%;
  padding: 0 15px;
}

.col-md-9 {
  flex: 0 0 75%;
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

textarea {
  resize: vertical;
  min-height: 80px;
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

.btn + .btn {
  margin-left: 10px;
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
