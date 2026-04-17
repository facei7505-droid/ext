<script setup lang="ts">
/**
 * Страница «Расписание» — создание записи пациента на приём.
 * Справа — таблица уже существующих слотов дня (для визуальной полноты).
 */
import { reactive, ref } from 'vue';
import LegacyInput from '@/components/legacy/LegacyInput.vue';
import LegacySelect from '@/components/legacy/LegacySelect.vue';
import LegacyTextarea from '@/components/legacy/LegacyTextarea.vue';
import { createEmptyScheduleForm } from '@/types/forms';
import { RpaActions, RpaForms } from '@/rpa/selectors';

const form = reactive(createEmptyScheduleForm());
const submittedAt = ref<string | null>(null);

const specialtyOptions = [
  { value: 'therapy', label: 'Терапия' },
  { value: 'cardiology', label: 'Кардиология' },
  { value: 'neurology', label: 'Неврология' },
  { value: 'endocrinology', label: 'Эндокринология' },
  { value: 'surgery', label: 'Хирургия' },
] as const;

const visitTypeOptions = [
  { value: 'primary', label: 'Первичный' },
  { value: 'follow_up', label: 'Повторный' },
  { value: 'consultation', label: 'Консультация' },
] as const;

const timeSlots = [
  '09:00-09:30',
  '09:30-10:00',
  '10:00-10:30',
  '10:30-11:00',
  '11:00-11:30',
  '11:30-12:00',
  '14:00-14:30',
  '14:30-15:00',
  '15:00-15:30',
] as const;
const timeSlotOptions = timeSlots.map((t) => ({ value: t, label: t }));

/** Демонстрационный список уже занятых слотов. Будет приходить из API в Модуле 2. */
const existingAppointments = [
  { time: '09:00-09:30', patient: 'Смирнова А.В.', doctor: 'Петров П.П.', specialty: 'Терапия' },
  { time: '10:00-10:30', patient: 'Кузнецов Д.И.', doctor: 'Петров П.П.', specialty: 'Терапия' },
  { time: '11:30-12:00', patient: 'Орлова Е.С.', doctor: 'Сидорова Н.М.', specialty: 'Кардиология' },
];

function onSubmit(): void {
  submittedAt.value = new Date().toISOString();
}

function onReset(): void {
  Object.assign(form, createEmptyScheduleForm());
  submittedAt.value = null;
}
</script>

<template>
  <div class="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_20rem]">
    <form
      class="space-y-4"
      :data-rpa-form="RpaForms.schedule"
      autocomplete="off"
      novalidate
      @submit.prevent="onSubmit"
      @reset.prevent="onReset"
    >
      <h1 class="text-lg font-bold text-kmis-ink">Запись на приём</h1>

      <section class="kmis-panel p-4" data-rpa-section="doctor">
        <h2 class="kmis-section-title">Врач и кабинет</h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <LegacyInput
            id="schedule-doctor"
            v-model="form.doctor"
            field="doctor"
            label="Врач"
            placeholder="Петров П.П."
            required
          />
          <LegacySelect
            id="schedule-specialty"
            v-model="form.specialty"
            field="specialty"
            label="Специальность"
            :options="specialtyOptions"
            required
          />
          <LegacyInput
            id="schedule-room"
            v-model="form.room"
            field="room"
            label="Кабинет"
            placeholder="№ 214"
          />
        </div>
      </section>

      <section class="kmis-panel p-4" data-rpa-section="slot">
        <h2 class="kmis-section-title">Дата и время</h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <LegacyInput
            id="schedule-date"
            v-model="form.date"
            field="date"
            label="Дата"
            type="date"
            required
          />
          <LegacySelect
            id="schedule-timeSlot"
            v-model="form.timeSlot"
            field="timeSlot"
            label="Временной слот"
            :options="timeSlotOptions"
            required
          />
          <LegacySelect
            id="schedule-visitType"
            v-model="form.visitType"
            field="visitType"
            label="Тип приёма"
            :options="visitTypeOptions"
            required
          />
        </div>
      </section>

      <section class="kmis-panel p-4" data-rpa-section="patient">
        <h2 class="kmis-section-title">Пациент</h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <LegacyInput
            id="schedule-patientFullName"
            v-model="form.patientFullName"
            field="patientFullName"
            label="ФИО пациента"
            placeholder="Иванов Иван Иванович"
            required
          />
          <LegacyInput
            id="schedule-patientPhone"
            v-model="form.patientPhone"
            field="patientPhone"
            label="Телефон"
            type="tel"
            placeholder="+7 (___) ___-__-__"
          />
        </div>
        <div class="mt-3">
          <LegacyTextarea
            id="schedule-notes"
            v-model="form.notes"
            field="notes"
            label="Примечания"
            :rows="3"
            placeholder="Направлен участковым терапевтом..."
          />
        </div>
      </section>

      <div class="flex items-center gap-3">
        <button type="submit" class="kmis-btn-primary" :data-rpa-action="RpaActions.submit">
          Записать
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
          Записано в {{ new Date(submittedAt).toLocaleTimeString() }}
        </span>
      </div>
    </form>

    <!-- Правая панель: текущая загрузка. Структура помечена для RPA-агента. -->
    <aside class="kmis-panel p-3" data-rpa-region="daySchedule">
      <h2 class="kmis-section-title">Сегодня</h2>
      <table class="w-full text-xs" data-rpa-table="appointments">
        <thead class="text-left text-kmis-muted">
          <tr>
            <th class="py-1 pr-2">Время</th>
            <th class="py-1 pr-2">Пациент</th>
            <th class="py-1">Врач</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(a, idx) in existingAppointments"
            :key="a.time"
            class="border-t border-kmis-border"
            :data-rpa-row="idx"
          >
            <td class="py-1 pr-2 font-mono" :data-rpa-field="`appointments.${idx}.time`">{{ a.time }}</td>
            <td class="py-1 pr-2" :data-rpa-field="`appointments.${idx}.patient`">{{ a.patient }}</td>
            <td class="py-1" :data-rpa-field="`appointments.${idx}.doctor`">{{ a.doctor }}</td>
          </tr>
        </tbody>
      </table>
    </aside>
  </div>
</template>
