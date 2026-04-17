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
} as const;
export type RpaRouteKey = (typeof RpaRoutes)[keyof typeof RpaRoutes];

export const RpaForms = {
  intake: 'intake',
  epicrisis: 'epicrisis',
  schedule: 'schedule',
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
  return `[data-rpa-form="${form}"] [data-rpa-field="${CSS.escape(field)}"]`;
}

/** CSS-селектор действия (кнопки). */
export function actionSelector(action: string): string {
  return `[data-rpa-action="${CSS.escape(action)}"]`;
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
} as const;

