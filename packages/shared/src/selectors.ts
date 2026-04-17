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
