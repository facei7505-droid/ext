/**
 * Маппинг StructuredVisit (из LLM) → плоский список команд rpa:fillField
 * для content-script.
 *
 * Контракт field-имён зеркалит data-rpa-field из crm-mock/src/views/IntakeView.vue.
 * Если LLM вернул null — пропускаем поле (не затираем существующий ввод врача).
 */

import type { FillFieldMsg } from '@/shared/messages';
import { RpaForms } from '@/shared/selectors';
import type { StructuredVisit } from '@/ai/types';

export interface MappedProcedure {
  name: string;
  kind: 'procedure' | 'medication' | 'regimen' | 'referral' | 'other';
}

export interface MappingResult {
  commands: FillFieldMsg[];
  /** Список назначений для последующей передачи в scheduler-service. */
  prescriptions: MappedProcedure[];
}

/**
 * Преобразовать структурированный визит в команды заполнения формы intake.
 */
export function mapVisitToCommands(visit: StructuredVisit): MappingResult {
  const commands: FillFieldMsg[] = [];
  const form = RpaForms.intake;

  const push = (field: string, value: string | null | undefined): void => {
    if (value === null || value === undefined || value === '') return;
    commands.push({ type: 'rpa:fillField', form, field, value, humanTyping: true });
  };

  // ─── Пациент ───
  push('patient.lastName', visit.patient.lastName);
  push('patient.firstName', visit.patient.firstName);
  push('patient.middleName', visit.patient.middleName);
  push('patient.birthDate', visit.patient.birthDate);
  push('patient.gender', visit.patient.gender);
  push('patient.phone', visit.patient.phone);

  // ─── Жалобы / анамнез ───
  push('visit.complaints', visit.complaints);
  push('visit.anamnesis', visit.anamnesis);

  // ─── Объективный статус ───
  push('visit.bloodPressure', visit.objectiveStatus.bloodPressure);
  push('visit.pulse', visit.objectiveStatus.pulse);
  push('visit.temperature', visit.objectiveStatus.temperature);

  // ─── Диагноз ───
  // Соединяем "ICD10 — текст" если оба есть; иначе берём что есть.
  const dx = visit.diagnosis;
  const diagnosisStr =
    dx.icd10 && dx.text ? `${dx.icd10} — ${dx.text}` : dx.icd10 ?? dx.text ?? null;
  push('visit.diagnosis', diagnosisStr);

  // ─── Назначения ───
  // Сворачиваем массив в одну строку "• текст\n• текст".
  if (visit.recommendations.length > 0) {
    const recText = visit.recommendations
      .map((r) => `• ${r.text}`)
      .join('\n');
    push('visit.recommendations', recText);
  }

  const prescriptions: MappedProcedure[] = visit.recommendations.map((r) => ({
    name: r.text,
    kind: r.kind,
  }));

  return { commands, prescriptions };
}
