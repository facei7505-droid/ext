<script setup lang="ts">
import { ref } from 'vue';

const finalDiagnosis = ref('');
const treatmentResults = ref('');
const recommendations = ref('');
const followUp = ref('');
const disabilityGroup = ref('');
const nextVisitDate = ref('');

const handleSubmit = () => {
  console.log('Epicrisis submitted:', {
    finalDiagnosis: finalDiagnosis.value,
    treatmentResults: treatmentResults.value,
    recommendations: recommendations.value,
    followUp: followUp.value,
    disabilityGroup: disabilityGroup.value,
    nextVisitDate: nextVisitDate.value,
  });
};
</script>

<template>
  <div class="epicrisis-form">
    <div class="panel panel-default">
      <div class="panel-heading">
        <h2>Выписной эпикриз</h2>
      </div>
      <div class="panel-body">
        <form @submit.prevent="handleSubmit">
          <!-- Окончательный диагноз -->
          <div class="section-title">Окончательный диагноз</div>
          <div class="row form-group">
            <div class="col-md-3">
              <label for="tbFinalDiagnosis">Окончательный диагноз</label>
            </div>
            <div class="col-md-9">
              <input
                id="tbFinalDiagnosis"
                v-model="finalDiagnosis"
                name="tbFinalDiagnosis"
                type="text"
                class="form-control"
                placeholder="Введите окончательный диагноз"
                data-rpa-field="epicrisis.finalDiagnosis"
              />
            </div>
          </div>

          <div class="row form-group">
            <div class="col-md-3">
              <label for="cmbDisabilityGroup">Группа инвалидности</label>
            </div>
            <div class="col-md-9">
              <select
                id="cmbDisabilityGroup"
                v-model="disabilityGroup"
                name="cmbDisabilityGroup"
                class="form-control"
                data-rpa-field="epicrisis.disabilityGroup"
              >
                <option value="">Нет</option>
                <option value="1">I группа</option>
                <option value="2">II группа</option>
                <option value="3">III группа</option>
              </select>
            </div>
          </div>

          <!-- Результаты лечения -->
          <div class="section-title">Результаты лечения</div>
          <div class="row form-group">
            <div class="col-md-3">
              <label for="taTreatmentResults">Результаты лечения</label>
            </div>
            <div class="col-md-9">
              <textarea
                id="taTreatmentResults"
                v-model="treatmentResults"
                name="taTreatmentResults"
                class="form-control"
                rows="4"
                placeholder="Опишите результаты лечения"
                data-rpa-field="epicrisis.treatmentResults"
              ></textarea>
            </div>
          </div>

          <!-- Рекомендации -->
          <div class="section-title">Рекомендации</div>
          <div class="row form-group">
            <div class="col-md-3">
              <label for="taRecommendations">Рекомендации</label>
            </div>
            <div class="col-md-9">
              <textarea
                id="taRecommendations"
                v-model="recommendations"
                name="taRecommendations"
                class="form-control"
                rows="4"
                placeholder="Рекомендации по лечению и образу жизни"
                data-rpa-field="epicrisis.recommendations"
              ></textarea>
            </div>
          </div>

          <!-- Диспансерное наблюдение -->
          <div class="section-title">Диспансерное наблюдение</div>
          <div class="row form-group">
            <div class="col-md-3">
              <label for="taFollowUp">Диспансерное наблюдение</label>
            </div>
            <div class="col-md-9">
              <textarea
                id="taFollowUp"
                v-model="followUp"
                name="taFollowUp"
                class="form-control"
                rows="3"
                placeholder="Сроки и характер диспансерного наблюдения"
                data-rpa-field="epicrisis.followUp"
              ></textarea>
            </div>
          </div>

          <div class="row form-group">
            <div class="col-md-3">
              <label for="dtNextVisitDate">Дата следующего визита</label>
            </div>
            <div class="col-md-9">
              <input
                id="dtNextVisitDate"
                v-model="nextVisitDate"
                name="dtNextVisitDate"
                type="date"
                class="form-control"
                data-rpa-field="epicrisis.nextVisitDate"
              />
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
.epicrisis-form {
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
