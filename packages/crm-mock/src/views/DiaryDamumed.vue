<script setup lang="ts">
import { ref } from 'vue';

const diaryDate = ref('');
const subjective = ref('');
const objective = ref('');
const assessment = ref('');
const plan = ref('');

const handleSubmit = () => {
  console.log('Diary submitted:', {
    diaryDate: diaryDate.value,
    subjective: subjective.value,
    objective: objective.value,
    assessment: assessment.value,
    plan: plan.value,
  });
};
</script>

<template>
  <div class="diary-form">
    <div class="panel panel-default">
      <div class="panel-heading">
        <h2>Дневниковая запись осмотра</h2>
      </div>
      <div class="panel-body">
        <form @submit.prevent="handleSubmit">
          <!-- Дата осмотра -->
          <div class="section-title">Дата осмотра</div>
          <div class="row form-group">
            <div class="col-md-3">
              <label for="dtDiaryDate">Дата осмотра</label>
            </div>
            <div class="col-md-9">
              <input
                id="dtDiaryDate"
                v-model="diaryDate"
                name="dtDiaryDate"
                type="date"
                class="form-control"
                data-rpa-field="diary.date"
              />
            </div>
          </div>

          <!-- SOAP структура -->
          <div class="section-title">SOAP структура осмотра</div>
          
          <!-- Subjective (S) -->
          <div class="row form-group">
            <div class="col-md-3">
              <label for="taSubjective">S - Субъективные данные (жалобы пациента)</label>
            </div>
            <div class="col-md-9">
              <textarea
                id="taSubjective"
                v-model="subjective"
                name="taSubjective"
                class="form-control"
                rows="3"
                placeholder="Жалобы пациента, анамнез"
                data-rpa-field="diary.subjective"
              ></textarea>
            </div>
          </div>

          <!-- Objective (O) -->
          <div class="row form-group">
            <div class="col-md-3">
              <label for="taObjective">O - Объективные данные (осмотр)</label>
            </div>
            <div class="col-md-9">
              <textarea
                id="taObjective"
                v-model="objective"
                name="taObjective"
                class="form-control"
                rows="3"
                placeholder="Данные физикального осмотра, лабораторные данные"
                data-rpa-field="diary.objective"
              ></textarea>
            </div>
          </div>

          <!-- Assessment (A) -->
          <div class="row form-group">
            <div class="col-md-3">
              <label for="taAssessment">A - Оценка (диагноз)</label>
            </div>
            <div class="col-md-9">
              <textarea
                id="taAssessment"
                v-model="assessment"
                name="taAssessment"
                class="form-control"
                rows="3"
                placeholder="Диагноз, оценка состояния"
                data-rpa-field="diary.assessment"
              ></textarea>
            </div>
          </div>

          <!-- Plan (P) -->
          <div class="row form-group">
            <div class="col-md-3">
              <label for="taPlan">P - План лечения</label>
            </div>
            <div class="col-md-9">
              <textarea
                id="taPlan"
                v-model="plan"
                name="taPlan"
                class="form-control"
                rows="3"
                placeholder="План лечения, назначения"
                data-rpa-field="diary.plan"
              ></textarea>
            </div>
          </div>

          <!-- Кнопки -->
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Сохранить</button>
            <button type="button" class="btn btn-default">Отмена</button>
            <button type="button" class="btn btn-info">Печать</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diary-form {
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

.btn-info {
  background: #5bc0de;
  color: #fff;
  border-color: #5bc0de;
}

.btn-info:hover {
  background: #46b8da;
  border-color: #46b8da;
}

.btn + .btn {
  margin-left: 10px;
}
</style>
