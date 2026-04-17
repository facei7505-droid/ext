/**
 * Маппинг StructuredEpicrisis (из LLM) → плоский список команд rpa:fillField
 * для content-script.
 *
 * Контракт field-имён зеркалит data-rpa-field из crm-mock/src/views/EpicrisisView.vue.
 * Если LLM вернул null — пропускаем поле (не затираем существующий ввод врача).
 */

import type { FillFieldMsg } from '@/shared/messages';
import { RpaForms } from '@/shared/selectors';
import type { StructuredEpicrisis } from '@shared/visit';

export interface EpicrisisMappingResult {
  commands: FillFieldMsg[];
}

/**
 * Преобразовать структурированный эпикриз в команды заполнения формы epicrisis.
 */
export function mapEpicrisisToCommands(epicrisis: StructuredEpicrisis): EpicrisisMappingResult {
  const commands: FillFieldMsg[] = [];
  const form = RpaForms.epicrisis;

  const push = (field: string, value: string | null | undefined): void => {
    if (value === null || value === undefined || value === '') return;
    commands.push({ type: 'rpa:fillField', form, field, value, humanTyping: true });
  };

  // ─── Общие сведения ───
  push('patientId', epicrisis.patientId);
  push('admissionDate', epicrisis.admissionDate);
  push('dischargeDate', epicrisis.dischargeDate);
  push('department', epicrisis.department);
  push('doctor', epicrisis.doctor);
  push('outcome', epicrisis.outcome);

  // ─── Клинические данные ───
  push('clinicalDiagnosis', epicrisis.clinicalDiagnosis);
  push('comorbidities', epicrisis.comorbidities);
  push('treatmentSummary', epicrisis.treatmentSummary);
  push('labResults', epicrisis.labResults);
  push('recommendations', epicrisis.recommendations);

  return { commands };
}
