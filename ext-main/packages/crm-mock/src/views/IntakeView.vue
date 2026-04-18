<script setup lang="ts">
/**
 * Страница «Первичный прием».
 * Главная цель автозаполнения для Chrome Extension:
 * вся форма покрыта data-rpa-form="intake" и data-rpa-field="...".
 */
import { reactive, ref } from 'vue';
import LegacyInput from '@/components/legacy/LegacyInput.vue';
import LegacySelect from '@/components/legacy/LegacySelect.vue';
import LegacyTextarea from '@/components/legacy/LegacyTextarea.vue';
import { createEmptyIntakeForm } from '@/types/forms';
import { RpaActions, RpaForms } from '@/rpa/selectors';

const form = reactive(createEmptyIntakeForm());
const submittedAt = ref<string | null>(null);

const genderOptions = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
  { value: 'other', label: 'Не указан' },
] as const;

function onSubmit(): void {
  // В Модуле 2 уйдёт в Pinia-store + mock-server; сейчас только фиксация факта.
  submittedAt.value = new Date().toISOString();
}

function onReset(): void {
  Object.assign(form, createEmptyIntakeForm());
  submittedAt.value = null;
}
</script>

<template>
  <form
    class="mx-auto max-w-5xl space-y-4"
    :data-rpa-form="RpaForms.intake"
    autocomplete="off"
    novalidate
    @submit.prevent="onSubmit"
    @reset.prevent="onReset"
  >
    <h1 class="text-lg font-bold text-kmis-ink">Первичный прием пациента</h1>

    <!-- Блок: паспортные данные -->
    <section class="kmis-panel p-4" data-rpa-section="patient">
      <h2 class="kmis-section-title">Паспортные данные</h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <LegacyInput
          id="intake-patient-lastName"
          v-model="form.patient.lastName"
          field="patient.lastName"
          label="Фамилия"
          placeholder="Иванов"
          required
        />
        <LegacyInput
          id="intake-patient-firstName"
          v-model="form.patient.firstName"
          field="patient.firstName"
          label="Имя"
          placeholder="Иван"
          required
        />
        <LegacyInput
          id="intake-patient-middleName"
          v-model="form.patient.middleName"
          field="patient.middleName"
          label="Отчество"
          placeholder="Иванович"
        />
        <LegacyInput
          id="intake-patient-birthDate"
          v-model="form.patient.birthDate"
          field="patient.birthDate"
          label="Дата рождения"
          type="date"
          required
        />
        <LegacySelect
          id="intake-patient-gender"
          v-model="form.patient.gender"
          field="patient.gender"
          label="Пол"
          :options="genderOptions"
          required
        />
        <LegacyInput
          id="intake-patient-phone"
          v-model="form.patient.phone"
          field="patient.phone"
          label="Телефон"
          type="tel"
          placeholder="+7 (___) ___-__-__"
          autocomplete="tel"
        />
        <LegacyInput
          id="intake-patient-snils"
          v-model="form.patient.snils"
          field="patient.snils"
          label="СНИЛС"
          placeholder="000-000-000 00"
          pattern="^\d{3}-\d{3}-\d{3} \d{2}$"
        />
        <LegacyInput
          id="intake-patient-policyNumber"
          v-model="form.patient.policyNumber"
          field="patient.policyNumber"
          label="№ полиса ОМС"
          placeholder="0000 0000 0000 0000"
        />
      </div>
    </section>

    <!-- Блок: осмотр -->
    <section class="kmis-panel p-4" data-rpa-section="visit">
      <h2 class="kmis-section-title">Осмотр и анамнез</h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <LegacyTextarea
          id="intake-visit-complaints"
          v-model="form.visit.complaints"
          field="visit.complaints"
          label="Жалобы пациента"
          placeholder="Головная боль, слабость, температура..."
          :rows="4"
          required
        />
        <LegacyTextarea
          id="intake-visit-anamnesis"
          v-model="form.visit.anamnesis"
          field="visit.anamnesis"
          label="Анамнез заболевания"
          placeholder="Болен в течение 3 дней..."
          :rows="4"
        />
      </div>

      <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <LegacyInput
          id="intake-visit-bloodPressure"
          v-model="form.visit.bloodPressure"
          field="visit.bloodPressure"
          label="Артериальное давление"
          placeholder="120/80"
          pattern="^\d{2,3}/\d{2,3}$"
        />
        <LegacyInput
          id="intake-visit-pulse"
          v-model="form.visit.pulse"
          field="visit.pulse"
          label="Пульс, уд/мин"
          type="number"
          placeholder="72"
        />
        <LegacyInput
          id="intake-visit-temperature"
          v-model="form.visit.temperature"
          field="visit.temperature"
          label="Температура, °C"
          placeholder="36.6"
        />
        <LegacyInput
          id="intake-visit-diagnosis"
          v-model="form.visit.diagnosis"
          field="visit.diagnosis"
          label="Предварительный диагноз (МКБ-10)"
          placeholder="J06.9 — ОРВИ"
          required
        />
      </div>

      <div class="mt-3">
        <LegacyTextarea
          id="intake-visit-recommendations"
          v-model="form.visit.recommendations"
          field="visit.recommendations"
          label="Рекомендации"
          placeholder="Постельный режим, обильное питьё..."
          :rows="3"
        />
      </div>
    </section>

    <!-- Панель действий -->
    <div class="flex items-center gap-3">
      <button type="submit" class="kmis-btn-primary" :data-rpa-action="RpaActions.submit">
        Сохранить приём
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
        Сохранено в {{ new Date(submittedAt).toLocaleTimeString() }}
      </span>
    </div>
  </form>
</template>
