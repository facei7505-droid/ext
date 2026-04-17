<script setup lang="ts">
import { ref } from 'vue';

interface Diagnosis {
  code: string;
  name: string;
  type: string;
  date: string;
}

const diagnoses = ref<Diagnosis[]>([]);

const newDiagnosis = ref({
  code: '',
  name: '',
  type: 'primary',
  date: '',
});

const addDiagnosis = () => {
  if (newDiagnosis.value.code && newDiagnosis.value.name) {
    diagnoses.value.push({ ...newDiagnosis.value });
    newDiagnosis.value = { code: '', name: '', type: 'primary', date: '' };
  }
};

const removeDiagnosis = (index: number) => {
  diagnoses.value.splice(index, 1);
};

const handleSubmit = () => {
  console.log('Diagnoses submitted:', diagnoses.value);
};
</script>

<template>
  <div class="diagnoses-form">
    <div class="panel panel-default">
      <div class="panel-heading">
        <h2>Диагнозы пациента</h2>
      </div>
      <div class="panel-body">
        <form @submit.prevent="handleSubmit">
          <!-- Добавление диагноза -->
          <div class="section-title">Добавить диагноз</div>
          <div class="row form-group">
            <div class="col-md-2">
              <label for="tbDiagnosisCode">Код МКБ-10</label>
            </div>
            <div class="col-md-3">
              <input
                id="tbDiagnosisCode"
                v-model="newDiagnosis.code"
                name="tbDiagnosisCode"
                type="text"
                class="form-control"
                placeholder="Например: G80.0"
                maxlength="10"
                data-rpa-field="diagnoses.new.code"
              />
            </div>
            <div class="col-md-2">
              <label for="tbDiagnosisName">Название диагноза</label>
            </div>
            <div class="col-md-3">
              <input
                id="tbDiagnosisName"
                v-model="newDiagnosis.name"
                name="tbDiagnosisName"
                type="text"
                class="form-control"
                placeholder="Название диагноза"
                data-rpa-field="diagnoses.new.name"
              />
            </div>
            <div class="col-md-2">
              <button
                type="button"
                class="btn btn-primary"
                @click="addDiagnosis"
              >
                Добавить
              </button>
            </div>
          </div>

          <div class="row form-group">
            <div class="col-md-2">
              <label for="cmbDiagnosisType">Тип диагноза</label>
            </div>
            <div class="col-md-3">
              <select
                id="cmbDiagnosisType"
                v-model="newDiagnosis.type"
                name="cmbDiagnosisType"
                class="form-control"
                data-rpa-field="diagnoses.new.type"
              >
                <option value="primary">Основной</option>
                <option value="secondary">Сопутствующий</option>
                <option value="complication">Осложнение</option>
              </select>
            </div>
            <div class="col-md-2">
              <label for="dtDiagnosisDate">Дата установления</label>
            </div>
            <div class="col-md-3">
              <input
                id="dtDiagnosisDate"
                v-model="newDiagnosis.date"
                name="dtDiagnosisDate"
                type="date"
                class="form-control"
                data-rpa-field="diagnoses.new.date"
              />
            </div>
          </div>

          <!-- Список диагнозов -->
          <div class="section-title">Список диагнозов</div>
          <div v-if="diagnoses.length === 0" class="no-diagnoses">
            Нет добавленных диагнозов
          </div>
          <div v-else class="diagnoses-list">
            <div v-for="(diag, index) in diagnoses" :key="index" class="diagnosis-item">
              <div class="diagnosis-info">
                <span class="diagnosis-code">{{ diag.code }}</span>
                <span class="diagnosis-name">{{ diag.name }}</span>
                <span class="diagnosis-type">{{ diag.type }}</span>
                <span class="diagnosis-date">{{ diag.date }}</span>
              </div>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                @click="removeDiagnosis(index)"
              >
                Удалить
              </button>
            </div>
          </div>

          <!-- Кнопки -->
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Сохранить диагнозы</button>
            <button type="button" class="btn btn-default">Отмена</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diagnoses-form {
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

.no-diagnoses {
  color: #999;
  font-style: italic;
  padding: 20px;
  text-align: center;
  background: #fafafa;
  border-radius: 4px;
}

.diagnoses-list {
  margin-top: 20px;
}

.diagnosis-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  margin-bottom: 10px;
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.diagnosis-info {
  display: flex;
  gap: 15px;
  flex: 1;
}

.diagnosis-code {
  font-weight: bold;
  color: #3098a1;
  min-width: 80px;
}

.diagnosis-name {
  flex: 1;
  color: #333;
}

.diagnosis-type {
  padding: 2px 8px;
  background: #e0e0e0;
  border-radius: 12px;
  font-size: 12px;
  color: #666;
}

.diagnosis-date {
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
