/**
 * Стор пациента — персистит базовые данные между вкладками в рамках сессии.
 *
 * Хранит: ИИН, дату поступления, отделение, диагноз, жалобы, анамнез,
 * объективный статус (давление, пульс, температура), рекомендации.
 *
 * Примечание: это in-memory стор (Pinia). При перезагрузке страницы
 * данные теряются — для хакатона достаточно. Для продо нужно добавить
 * localStorage/IndexedDB персистент.
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const usePatientStore = defineStore('patient', () => {
  const iin = ref('');
  const admissionDate = ref('');
  const department = ref('');
  const diagnosis = ref('');
  const complaints = ref('');
  const anamnesis = ref('');
  const bloodPressure = ref('');
  const pulse = ref('');
  const temperature = ref('');
  const recommendations = ref('');

  const setPatient = (data: {
    iin?: string;
    admissionDate?: string;
    department?: string;
    diagnosis?: string;
    complaints?: string;
    anamnesis?: string;
    bloodPressure?: string;
    pulse?: string;
    temperature?: string;
    recommendations?: string;
  }): void => {
    if (data.iin !== undefined) iin.value = data.iin;
    if (data.admissionDate !== undefined) admissionDate.value = data.admissionDate;
    if (data.department !== undefined) department.value = data.department;
    if (data.diagnosis !== undefined) diagnosis.value = data.diagnosis;
    if (data.complaints !== undefined) complaints.value = data.complaints;
    if (data.anamnesis !== undefined) anamnesis.value = data.anamnesis;
    if (data.bloodPressure !== undefined) bloodPressure.value = data.bloodPressure;
    if (data.pulse !== undefined) pulse.value = data.pulse;
    if (data.temperature !== undefined) temperature.value = data.temperature;
    if (data.recommendations !== undefined) recommendations.value = data.recommendations;
  };

  const clear = (): void => {
    iin.value = '';
    admissionDate.value = '';
    department.value = '';
    diagnosis.value = '';
    complaints.value = '';
    anamnesis.value = '';
    bloodPressure.value = '';
    pulse.value = '';
    temperature.value = '';
    recommendations.value = '';
  };

  return {
    iin,
    admissionDate,
    department,
    diagnosis,
    complaints,
    anamnesis,
    bloodPressure,
    pulse,
    temperature,
    recommendations,
    setPatient,
    clear,
  };
});
