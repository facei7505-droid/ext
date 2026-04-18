/**
 * Единая точка истины для DOM-контракта `data-rpa-*`.
 *
 * Используется одновременно:
 *   - в crm-mock (рендерит атрибуты на формах);
 *   - в extension (ищет элементы по тем же атрибутам).
 *
 * При добавлении новой формы/действия — менять ТОЛЬКО здесь.
 */

export const RPA_ROOT = 'kmis' as const;

export const RpaRoutes = {
  intake: 'intake',
  epicrisis: 'epicrisis',
  schedule: 'schedule',
  services: 'services',
} as const;
export type RpaRouteKey = (typeof RpaRoutes)[keyof typeof RpaRoutes];

export const RpaForms = {
  intake: 'intake',
  epicrisis: 'epicrisis',
  diary: 'diary',
  diagnoses: 'diagnoses',
  assignments: 'assignments',
  services: 'services',
} as const;
export type RpaFormKey = (typeof RpaForms)[keyof typeof RpaForms];

export const RpaActions = {
  submit: 'submit',
  reset: 'reset',
  navIntake: 'nav:intake',
  navEpicrisis: 'nav:epicrisis',
  navSchedule: 'nav:schedule',
  markCompleted: 'markCompleted',
} as const;
export type RpaActionKey = (typeof RpaActions)[keyof typeof RpaActions];

/** CSS-селектор поля внутри формы. */
export function fieldSelector(form: RpaFormKey, field: string): string {
  const safe = field.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `[data-rpa-form="${form}"] [data-rpa-field="${safe}"]`;
}

/** CSS-селектор действия (кнопки). */
export function actionSelector(action: string): string {
  // NB: CSS.escape для ':' выдаёт '\3A ' — это валидно, но в некоторых движках
  // строка селектора интерпретируется иначе. Для attribute-value достаточно
  // экранировать обратный слэш и двойную кавычку.
  const safe = action.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `[data-rpa-action="${safe}"]`;
}

/** CSS-селектор формы. */
export function formSelector(form: RpaFormKey): string {
  return `[data-rpa-form="${form}"]`;
}

/** Селекторы для работы с реальным DOM Дамумед. */
export const DamumedSelectors = {
  // Пациент
  patientIIN: 'input[name="tbPatientIIN"]',
  admissionDate: 'input[name="dtAdmissionDate"]',
  department: 'input[name="cmbDepartment"]',
  // Диагноз
  diagnosis: 'input[name="cmbDiagnosis"]',
  // Жалобы и анамнез
  complaints: 'textarea[name="taComplaints"]',
  anamnesis: 'textarea[name="taAnamnesis"]',
  // Объективный статус
  bloodPressure: 'input[name="tbBloodPressure"]',
  pulse: 'input[name="tbPulse"]',
  temperature: 'input[name="tbTemperature"]',
  // Назначения
  recommendations: 'textarea[name="taRecommendations"]',
} as const;

/** Маппинг полей RPA на селекторы Дамумед. */
export const DamumedFieldMap: Record<string, string> = {
  // Первичный осмотр
  'patient.iin': DamumedSelectors.patientIIN,
  'patient.admissionDate': DamumedSelectors.admissionDate,
  'patient.department': DamumedSelectors.department,
  'visit.diagnosis': DamumedSelectors.diagnosis,
  'visit.complaints': DamumedSelectors.complaints,
  'visit.anamnesis': DamumedSelectors.anamnesis,
  'visit.bloodPressure': DamumedSelectors.bloodPressure,
  'visit.pulse': DamumedSelectors.pulse,
  'visit.temperature': DamumedSelectors.temperature,
  'visit.recommendations': DamumedSelectors.recommendations,
  // Выписной эпикриз (используем data-rpa-field в crm-mock с префиксом epicrisis)
  'epicrisis.finalDiagnosis': '[data-rpa-field="epicrisis.finalDiagnosis"]',
  'epicrisis.treatmentResults': '[data-rpa-field="epicrisis.treatmentResults"]',
  'epicrisis.followUp': '[data-rpa-field="epicrisis.followUp"]',
  'epicrisis.disabilityGroup': '[data-rpa-field="epicrisis.disabilityGroup"]',
  'epicrisis.nextVisitDate': '[data-rpa-field="epicrisis.nextVisitDate"]',
  // Дневниковая запись (используем data-rpa-field в crm-mock с префиксом diary)
  'diary.date': '[data-rpa-field="diary.date"]',
  'diary.subjective': '[data-rpa-field="diary.subjective"]',
  'diary.objective': '[data-rpa-field="diary.objective"]',
  'diary.assessment': '[data-rpa-field="diary.assessment"]',
  'diary.plan': '[data-rpa-field="diary.plan"]',
  // Диагнозы (используем data-rpa-field в crm-mock с префиксом diagnoses.new)
  'diagnoses.new.code': '[data-rpa-field="diagnoses.new.code"]',
  'diagnoses.new.name': '[data-rpa-field="diagnoses.new.name"]',
  'diagnoses.new.type': '[data-rpa-field="diagnoses.new.type"]',
  'diagnoses.new.date': '[data-rpa-field="diagnoses.new.date"]',
  // Назначения (используем data-rpa-field в crm-mock с префиксом assignments.new)
  'assignments.new.type': '[data-rpa-field="assignments.new.type"]',
  'assignments.new.name': '[data-rpa-field="assignments.new.name"]',
  'assignments.new.dosage': '[data-rpa-field="assignments.new.dosage"]',
  'assignments.new.frequency': '[data-rpa-field="assignments.new.frequency"]',
  'assignments.new.startDate': '[data-rpa-field="assignments.new.startDate"]',
  'assignments.new.endDate': '[data-rpa-field="assignments.new.endDate"]',
  // Расписание
  'schedule.startDate': '[data-rpa-field="schedule.startDate"]',
  'schedule.endDate': '[data-rpa-field="schedule.endDate"]',
} as const;

