<script setup lang="ts">
/**
 * Страница «Эпикриз» — выписной эпикриз пациента после курса лечения.
 */
import { reactive, ref } from 'vue';
import LegacyInput from '@/components/legacy/LegacyInput.vue';
import LegacySelect from '@/components/legacy/LegacySelect.vue';
import LegacyTextarea from '@/components/legacy/LegacyTextarea.vue';
import { createEmptyEpicrisisForm } from '@/types/forms';
import { RpaActions, RpaForms } from '@/rpa/selectors';

const form = reactive(createEmptyEpicrisisForm());
const submittedAt = ref<string | null>(null);

const outcomeOptions = [
  { value: 'recovery', label: 'Выздоровление' },
  { value: 'improvement', label: 'Улучшение' },
  { value: 'no_change', label: 'Без изменений' },
  { value: 'deterioration', label: 'Ухудшение' },
] as const;

const departmentOptions = [
  { value: 'therapy', label: 'Терапевтическое отделение' },
  { value: 'cardiology', label: 'Кардиология' },
  { value: 'neurology', label: 'Неврология' },
  { value: 'surgery', label: 'Хирургия' },
] as const;

function onSubmit(): void {
  submittedAt.value = new Date().toISOString();
}

function onReset(): void {
  Object.assign(form, createEmptyEpicrisisForm());
  submittedAt.value = null;
}
</script>

<template>
  <form
    class="mx-auto max-w-5xl space-y-4"
    :data-rpa-form="RpaForms.epicrisis"
    autocomplete="off"
    novalidate
    @submit.prevent="onSubmit"
    @reset.prevent="onReset"
  >
    <h1 class="text-lg font-bold text-kmis-ink">Выписной эпикриз</h1>

    <section class="kmis-panel p-4" data-rpa-section="admission">
      <h2 class="kmis-section-title">Общие сведения</h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <LegacyInput
          id="epicrisis-patientId"
          v-model="form.patientId"
          field="patientId"
          label="ID пациента"
          placeholder="P-000123"
          required
        />
        <LegacyInput
          id="epicrisis-admissionDate"
          v-model="form.admissionDate"
          field="admissionDate"
          label="Дата поступления"
          type="date"
          required
        />
        <LegacyInput
          id="epicrisis-dischargeDate"
          v-model="form.dischargeDate"
          field="dischargeDate"
          label="Дата выписки"
          type="date"
          required
        />
        <LegacySelect
          id="epicrisis-department"
          v-model="form.department"
          field="department"
          label="Отделение"
          :options="departmentOptions"
          required
        />
        <LegacyInput
          id="epicrisis-doctor"
          v-model="form.doctor"
          field="doctor"
          label="Лечащий врач"
          placeholder="Петров П.П."
          required
        />
        <LegacySelect
          id="epicrisis-outcome"
          v-model="form.outcome"
          field="outcome"
          label="Исход лечения"
          :options="outcomeOptions"
          required
        />
      </div>
    </section>

    <section class="kmis-panel p-4" data-rpa-section="clinical">
      <h2 class="kmis-section-title">Клинические данные</h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <LegacyTextarea
          id="epicrisis-clinicalDiagnosis"
          v-model="form.clinicalDiagnosis"
          field="clinicalDiagnosis"
          label="Клинический диагноз (МКБ-10)"
          :rows="3"
          placeholder="I11.9 — Гипертоническая болезнь без сердечной недостаточности"
          required
        />
        <LegacyTextarea
          id="epicrisis-comorbidities"
          v-model="form.comorbidities"
          field="comorbidities"
          label="Сопутствующие заболевания"
          :rows="3"
        />
        <LegacyTextarea
          id="epicrisis-treatmentSummary"
          v-model="form.treatmentSummary"
          field="treatmentSummary"
          label="Проведённое лечение"
          :rows="5"
          required
        />
        <LegacyTextarea
          id="epicrisis-labResults"
          v-model="form.labResults"
          field="labResults"
          label="Результаты исследований"
          :rows="5"
        />
      </div>

      <div class="mt-3">
        <LegacyTextarea
          id="epicrisis-recommendations"
          v-model="form.recommendations"
          field="recommendations"
          label="Рекомендации при выписке"
          :rows="4"
        />
      </div>
    </section>

    <div class="flex items-center gap-3">
      <button type="submit" class="kmis-btn-primary" :data-rpa-action="RpaActions.submit">
        Подписать эпикриз
      </button>
      <button type="reset" class="kmis-btn" :data-rpa-action="RpaActions.reset">
        Очистить
      </button>
      <span
        v-if="submittedAt"
        class="text-xs text-kmis-success"
        data-rpa-state="ok"
        data-rpa-field="meta.submittedAt"
      >
        Подписано в {{ new Date(submittedAt).toLocaleTimeString() }}
      </span>
    </div>
  </form>
</template>
