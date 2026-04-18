/**
 * Типы форм КМИС-мокапа.
 *
 * ВНИМАНИЕ: имена полей соответствуют значениям data-rpa-field в DOM,
 * поэтому ЛЮБОЕ переименование = breaking change для RPA-агента.
 */

export type Gender = 'male' | 'female' | 'other';

/** Первичный приём. */
export interface IntakeForm {
  patient: {
    lastName: string;
    firstName: string;
    middleName: string;
    birthDate: string; // ISO YYYY-MM-DD
    gender: Gender | '';
    snils: string;
    policyNumber: string;
    phone: string;
  };
  visit: {
    complaints: string;
    anamnesis: string;
    bloodPressure: string; // "120/80"
    pulse: string;
    temperature: string;   // "36.6"
    diagnosis: string;     // ICD-10 + описание
    recommendations: string;
  };
}

/** Эпикриз: выписка по завершении лечения. */
export interface EpicrisisForm {
  patientId: string;
  admissionDate: string;
  dischargeDate: string;
  department: string;
  clinicalDiagnosis: string;
  comorbidities: string;
  treatmentSummary: string;
  labResults: string;
  outcome: 'recovery' | 'improvement' | 'no_change' | 'deterioration' | '';
  recommendations: string;
  doctor: string;
}

/** Запись на приём. */
export interface ScheduleForm {
  doctor: string;
  specialty: string;
  room: string;
  date: string;
  timeSlot: string; // "09:00-09:30"
  patientFullName: string;
  patientPhone: string;
  visitType: 'primary' | 'follow_up' | 'consultation' | '';
  notes: string;
}

/* ─────── Фабрики пустых форм ─────── */

export const createEmptyIntakeForm = (): IntakeForm => ({
  patient: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    gender: '',
    snils: '',
    policyNumber: '',
    phone: '',
  },
  visit: {
    complaints: '',
    anamnesis: '',
    bloodPressure: '',
    pulse: '',
    temperature: '',
    diagnosis: '',
    recommendations: '',
  },
});

export const createEmptyEpicrisisForm = (): EpicrisisForm => ({
  patientId: '',
  admissionDate: '',
  dischargeDate: '',
  department: '',
  clinicalDiagnosis: '',
  comorbidities: '',
  treatmentSummary: '',
  labResults: '',
  outcome: '',
  recommendations: '',
  doctor: '',
});

export const createEmptyScheduleForm = (): ScheduleForm => ({
  doctor: '',
  specialty: '',
  room: '',
  date: '',
  timeSlot: '',
  patientFullName: '',
  patientPhone: '',
  visitType: '',
  notes: '',
});
