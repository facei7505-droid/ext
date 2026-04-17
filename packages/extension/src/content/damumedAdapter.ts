/**
 * Damumed Adapter — адаптер для работы с реальным DOM системы "Дамумед".
 *
 * Основан на реверс-инжиниринге HTML-дампов из:
 * - hospital-akt.dmed.kz/Emergency/Reception
 * - hospital-akt.dmed.kz/patientMedicalRecord/editMedicalRecord
 * - hospital-akt.dmed.kz/medicalHistory/MedicalHistory
 *
 * Ключевые особенности DOM Дамумед:
 * 1. Используется Kendo UI (kendoComboBox, kendoGrid, kendoDatePicker)
 * 2. Rich-text редактор — TinyMCE (TINY.editor) через MedicalRecordsEditor
 * 3. Формы имеют Bootstrap-структуру: .row.form-group > .col-md-2 label + .col-md-10 input
 * 4. ID полей часто динамические, классы — стабильнее
 */

import type { FillFieldMsg } from '@/shared/messages';

/** Глобальный TINY объект (TinyMCE редактор Дамумед) */
declare global {
  interface Window {
    TINY?: {
      editors: Record<string, {
        setContent: (html: string) => void;
        getContent: () => string;
        insertContent: (html: string) => void;
        e: { body: { parentNode: HTMLElement } };
      }>;
    };
  }
}

/** Типы полей в Дамумед */
export type DamumedFieldType =
  | 'tinymce'      // TinyMCE редактор (медицинские записи)
  | 'kendoCombo'   // Kendo ComboBox (выпадающие списки)
  | 'kendoDate'    // Kendo DatePicker
  | 'kendoMasked'  // Kendo MaskedTextBox
  | 'kendoGrid'    // Kendo Grid (таблицы)
  | 'checkbox'     // Обычный чекбокс
  | 'radio'        // Радио-кнопки
  | 'text'         // Обычный текстовый input
  | 'textarea';    // Обычный textarea

/** Селектор поля Дамумед */
export interface DamumedFieldSelector {
  /** Уникальный ключ поля в нашем RPA */
  rpaKey: string;
  /** Тип поля Дамумед */
  type: DamumedFieldType;
  /** CSS/XPath селектор для нахождения элемента */
  selector: string;
  /** ID элемента (если стабильный) */
  id?: string;
  /** Имя поля (name attribute) */
  name?: string;
  /** Метка/label на русском */
  label: string;
  /** Обязательное поле */
  required?: boolean;
}

/** Страницы/формы Дамумед */
export type DamumedPage =
  | 'emergency-reception'    // Приёмное отделение
  | 'medical-record'        // Медицинская запись (редактор)
  | 'medical-history'         // История болезни (список)
  | 'assignments'             // Назначения
  | 'diagnoses'               // Диагнозы
  | 'diary'                   // Дневниковые записи
  | 'epicrisis';              // Выписной эпикриз

/** Маппинг RPA-полей → реальные селекторы Дамумед */
export const DAMUMED_FIELD_MAP: Record<DamumedPage, DamumedFieldSelector[]> = {
  'emergency-reception': [
    // Общие сведения (Admission)
    { rpaKey: 'patientId', type: 'text', selector: 'input[name="tbPatientIIN"]', label: 'ИИН пациента', required: true },
    { rpaKey: 'admissionDate', type: 'kendoDate', selector: 'input[name="dtAdmissionDate"]', label: 'Дата поступления' },
    { rpaKey: 'admissionTime', type: 'text', selector: 'input[name="dtAdmissionTime"]', label: 'Время поступления' },
    { rpaKey: 'department', type: 'kendoCombo', selector: 'input[name="cmbDepartment"]', label: 'Отделение' },
    { rpaKey: 'bed', type: 'kendoCombo', selector: 'input[name="cmbBed"]', label: 'Койка' },
    { rpaKey: 'doctor', type: 'kendoCombo', selector: 'input[name="cmbDoctor"]', label: 'Лечащий врач' },
    
    // Диагноз при поступлении
    { rpaKey: 'admissionDiagnosis', type: 'kendoCombo', selector: 'input[name="cmbDiagnosis"]', label: 'Диагноз при поступлении' },
    { rpaKey: 'diagnosisDescription', type: 'textarea', selector: 'textarea[name="taDiagnosisDescription"]', label: 'Описание диагноза' },
    
    // Состояние при поступлении
    { rpaKey: 'condition', type: 'kendoCombo', selector: 'input[name="cmbCondition"]', label: 'Состояние при поступлении' },
    { rpaKey: 'consciousness', type: 'kendoCombo', selector: 'input[name="cmbConsciousness"]', label: 'Сознание' },
    { rpaKey: 'bodyPosition', type: 'kendoCombo', selector: 'input[name="cmbBodyPosition"]', label: 'Положение тела' },
    
    // Источник финансирования
    { rpaKey: 'paymentType', type: 'radio', selector: 'input[name="options_PaymentType"]', label: 'Тип оплаты' },
    { rpaKey: 'financeSource', type: 'kendoCombo', selector: 'input[name="cmbFinanceSource"]', label: 'Источник финансирования' },
    
    // Страховка
    { rpaKey: 'insuranceCompany', type: 'kendoCombo', selector: 'input[name="cmbInsuranceCompany"]', label: 'Страховая компания' },
    { rpaKey: 'insurancePolisNumber', type: 'text', selector: 'input[name="tbInsurancePolisNumber"]', label: 'Номер страхового полиса' },
    { rpaKey: 'insuranceExpireDate', type: 'kendoDate', selector: 'input[name="dpInsuranceExpireDate"]', label: 'Срок действия полиса' },
  ],
  
  'medical-record': [
    // TinyMCE редактор для основного текста записи
    { rpaKey: 'medicalRecord', type: 'tinymce', selector: '#tinyeditor_0', id: 'tinyeditor_0', label: 'Медицинская запись (основной текст)' },
    
    // Служебные поля записи
    { rpaKey: 'recordType', type: 'kendoCombo', selector: 'input[name="cmbMedicalRecordType"]', label: 'Тип медицинской записи' },
    { rpaKey: 'recordTypeMo', type: 'kendoCombo', selector: 'input[name="cmbMedicalRecordTypeMo"]', label: 'Тип МО' },
    { rpaKey: 'medicalForm', type: 'kendoCombo', selector: 'input[name="cmbMedicalForm"]', label: 'Медицинская форма' },
    { rpaKey: 'recordDate', type: 'kendoDate', selector: 'input[name="dtRegDateTime"]', label: 'Дата записи' },
    
    // Поля для разных типов записей (динамические)
    { rpaKey: 'complaints', type: 'tinymce', selector: 'textarea[data-field="complaints"], #tinyeditor_complaints', label: 'Жалобы' },
    { rpaKey: 'anamnesis', type: 'tinymce', selector: 'textarea[data-field="anamnesis"], #tinyeditor_anamnesis', label: 'Анамнез' },
    { rpaKey: 'objectiveStatus', type: 'tinymce', selector: 'textarea[data-field="objective"], #tinyeditor_objective', label: 'Объективный статус' },
    { rpaKey: 'localStatus', type: 'tinymce', selector: 'textarea[data-field="local"], #tinyeditor_local', label: 'Местный статус' },
    { rpaKey: 'diagnosisJustification', type: 'tinymce', selector: 'textarea[data-field="diagnosis"], #tinyeditor_diagnosis', label: 'Обоснование диагноза' },
    { rpaKey: 'treatmentPlan', type: 'tinymce', selector: 'textarea[data-field="treatment"], #tinyeditor_treatment', label: 'План лечения' },
    { rpaKey: 'examinationPlan', type: 'tinymce', selector: 'textarea[data-field="examination"], #tinyeditor_examination', label: 'План обследования' },
    { rpaKey: 'recommendations', type: 'tinymce', selector: 'textarea[data-field="recommendations"], #tinyeditor_recommendations', label: 'Рекомендации' },
    { rpaKey: 'note', type: 'tinymce', selector: 'textarea[data-field="note"], #tinyeditor_note', label: 'Примечание' },
  ],
  
  'medical-history': [
    // Поля основной страницы истории болезни
    { rpaKey: 'historyNumber', type: 'text', selector: 'input[name="tbHistoryNumber"]', label: 'Номер истории болезни' },
    { rpaKey: 'patientFullName', type: 'text', selector: 'input[name="tbPatientFullName"]', label: 'ФИО пациента' },
    { rpaKey: 'patientBirthDate', type: 'kendoDate', selector: 'input[name="dpBirthDate"]', label: 'Дата рождения' },
    { rpaKey: 'patientGender', type: 'kendoCombo', selector: 'input[name="cmbGender"]', label: 'Пол' },
    { rpaKey: 'patientAge', type: 'text', selector: 'input[name="tbAge"]', label: 'Возраст' },
    
    // Адрес и контакты
    { rpaKey: 'address', type: 'textarea', selector: 'textarea[name="taAddress"]', label: 'Адрес' },
    { rpaKey: 'phone', type: 'text', selector: 'input[name="tbPhone"]', label: 'Телефон' },
    { rpaKey: 'workPlace', type: 'text', selector: 'input[name="tbWorkPlace"]', label: 'Место работы' },
    
    // Движение пациента
    { rpaKey: 'admissionDate', type: 'kendoDate', selector: 'input[name="dtInDate"]', label: 'Дата поступления' },
    { rpaKey: 'dischargeDate', type: 'kendoDate', selector: 'input[name="dtOutDate"]', label: 'Дата выписки' },
    { rpaKey: 'bedDays', type: 'text', selector: 'input[name="tbBedDays"]', label: 'Койко-дни' },
    { rpaKey: 'transferDepartment', type: 'kendoCombo', selector: 'input[name="cmbTransferDepartment"]', label: 'Переведен в отделение' },
  ],
  
  'assignments': [
    // Назначения (медикаменты, процедуры)
    { rpaKey: 'assignmentType', type: 'kendoCombo', selector: 'input[name="cmbAssignmentType"]', label: 'Тип назначения' },
    { rpaKey: 'assignmentSick', type: 'kendoCombo', selector: 'input[name="cmbAssignmentSick"]', label: 'Диагноз назначения' },
    { rpaKey: 'assignmentDate', type: 'kendoDate', selector: 'input[name="dtAssignDate"]', label: 'Дата назначения' },
    { rpaKey: 'assignmentStatus', type: 'kendoCombo', selector: 'input[name="cmbAssignmentStatus"]', label: 'Статус назначения' },
    
    // Детали назначения
    { rpaKey: 'serviceCode', type: 'kendoMasked', selector: 'input[name="mtbServiceCode"]', label: 'Код услуги (Классификатор)' },
    { rpaKey: 'serviceName', type: 'kendoCombo', selector: 'input[name="cmbService"]', label: 'Услуга классификатора' },
    { rpaKey: 'serviceMoCode', type: 'kendoMasked', selector: 'input[name="mtbServiceMoCode"]', label: 'Код услуги МО' },
    { rpaKey: 'serviceMoName', type: 'kendoCombo', selector: 'input[name="cmbServiceMo"]', label: 'Услуга из прейскуранта' },
    { rpaKey: 'serviceCito', type: 'checkbox', selector: 'input[name="cbServiceCito"]', label: 'Cito (срочно)' },
    
    // Исполнитель
    { rpaKey: 'serviceExecutorPost', type: 'kendoCombo', selector: 'input[name="cmbServiceExecutorPost"]', label: 'Исполнитель' },
    
    // Периодичность
    { rpaKey: 'periodType', type: 'radio', selector: 'input[name="options_PeriodExecuteCount"]', label: 'Тип периода (разовое/периодическое)' },
    { rpaKey: 'periodBeginDate', type: 'kendoDate', selector: 'input[name="dtPeriodBeginDate"]', label: 'Дата начала' },
    { rpaKey: 'periodEndDate', type: 'kendoDate', selector: 'input[name="dtPeriodEndDate"]', label: 'Дата окончания' },
    { rpaKey: 'periodExecuteCount', type: 'text', selector: 'input[name="tbPeriodExecuteCount"]', label: 'Количество выполнений' },
    
    // Шаблоны
    { rpaKey: 'templateFinanceSource', type: 'kendoCombo', selector: 'input[name="cmbTemplateFinanceSource"]', label: 'Источник финансирования (шаблон)' },
    { rpaKey: 'templateAssignDate', type: 'kendoDate', selector: 'input[name="dtTemplateAssignDate"]', label: 'Дата назначения (шаблон)' },
  ],
  
  'diagnoses': [
    // Диагнозы (грид + форма редактирования)
    { rpaKey: 'diagnosisType', type: 'kendoCombo', selector: 'input[name="cmbDiagnosisType"]', label: 'Тип диагноза' },
    { rpaKey: 'diagnosisCode', type: 'kendoMasked', selector: 'input[name="mtbDiagnosisCode"]', label: 'Код МКБ-10' },
    { rpaKey: 'diagnosisName', type: 'kendoCombo', selector: 'input[name="cmbDiagnosis"]', label: 'Наименование диагноза' },
    { rpaKey: 'diagnosisFullName', type: 'textarea', selector: 'textarea[name="taDiagnosisFullName"]', label: 'Полное наименование' },
    { rpaKey: 'diagnosisStage', type: 'kendoCombo', selector: 'input[name="cmbDiagnosisStage"]', label: 'Стадия' },
    { rpaKey: 'diagnosisPhase', type: 'kendoCombo', selector: 'input[name="cmbDiagnosisPhase"]', label: 'Фаза' },
    { rpaKey: 'diagnosisMain', type: 'checkbox', selector: 'input[name="cbMainDiagnosis"]', label: 'Основной диагноз' },
    { rpaKey: 'diagnosisComplication', type: 'checkbox', selector: 'input[name="cbComplication"]', label: 'Осложнение' },
    { rpaKey: 'diagnosisAccompanying', type: 'checkbox', selector: 'input[name="cbAccompanying"]', label: 'Сопутствующий' },
  ],
  
  'diary': [
    // Дневниковые записи
    { rpaKey: 'diaryDate', type: 'kendoDate', selector: 'input[name="dtDiaryDate"]', label: 'Дата дневниковой записи' },
    { rpaKey: 'diaryTime', type: 'text', selector: 'input[name="dtDiaryTime"]', label: 'Время' },
    { rpaKey: 'diaryRecord', type: 'tinymce', selector: '#tinyeditor_diary', label: 'Текст дневниковой записи' },
    { rpaKey: 'diaryDoctor', type: 'kendoCombo', selector: 'input[name="cmbDiaryDoctor"]', label: 'Врач' },
    { rpaKey: 'diaryTemperature', type: 'text', selector: 'input[name="tbTemperature"]', label: 'Температура' },
    { rpaKey: 'diaryPulse', type: 'text', selector: 'input[name="tbPulse"]', label: 'Пульс' },
    { rpaKey: 'diaryPressure', type: 'text', selector: 'input[name="tbPressure"]', label: 'АД' },
    { rpaKey: 'diaryRespiration', type: 'text', selector: 'input[name="tbRespiration"]', label: 'Дыхание' },
    { rpaKey: 'diaryWeight', type: 'text', selector: 'input[name="tbWeight"]', label: 'Вес' },
  ],
  
  'epicrisis': [
    // Выписной эпикриз
    { rpaKey: 'epicrisisType', type: 'kendoCombo', selector: 'input[name="cmbEpicrisisType"]', label: 'Тип эпикриза' },
    { rpaKey: 'epicrisisDate', type: 'kendoDate', selector: 'input[name="dtEpicrisisDate"]', label: 'Дата эпикриза' },
    { rpaKey: 'epicrisisText', type: 'tinymce', selector: '#tinyeditor_epicrisis', label: 'Текст выписного эпикриза' },
    { rpaKey: 'treatmentSummary', type: 'tinymce', selector: 'textarea[data-field="treatmentSummary"]', label: 'Проведенное лечение' },
    { rpaKey: 'dynamics', type: 'tinymce', selector: 'textarea[data-field="dynamics"]', label: 'Динамика состояния' },
    { rpaKey: 'recommendations', type: 'tinymce', selector: 'textarea[data-field="recommendations"]', label: 'Рекомендации' },
    { rpaKey: 'outcome', type: 'kendoCombo', selector: 'input[name="cmbOutcome"]', label: 'Исход заболевания' },
    { rpaKey: 'dischargeReason', type: 'kendoCombo', selector: 'input[name="cmbDischargeReason"]', label: 'Причина выписки' },
    { rpaKey: 'dischargedTo', type: 'kendoCombo', selector: 'input[name="cmbDischargedTo"]', label: 'Куда выписан' },
  ],
};

/** Помощник для работы с TinyMCE в Дамумед */
export const DamumedTinyMCE = {
  /** Получить инстанс редактора по ID (обычно 'editor_0') */
  getEditor(editorId: string = 'editor_0'): NonNullable<Window['TINY']>['editors'][string] | null {
    const tiny = window.TINY;
    if (!tiny || !tiny.editors?.[editorId]) {
      return null;
    }
    return tiny.editors[editorId];
  },

  /** Получить/установить содержимое редактора */
  content(value?: string, editorId: string = 'editor_0'): string | void {
    const editor = this.getEditor(editorId);
    if (!editor) return value ?? '';
    
    if (value !== undefined) {
      // Установить контент
      editor.setContent(value);
    } else {
      // Получить контент
      return editor.getContent();
    }
  },

  /** Вставить текст в позицию курсора */
  insert(text: string, editorId: string = 'editor_0'): boolean {
    const editor = this.getEditor(editorId);
    if (!editor) return false;
    
    editor.insertContent(text);
    return true;
  },

  /** Проверить, готов ли редактор */
  isReady(editorId: string = 'editor_0'): boolean {
    return !!this.getEditor(editorId);
  },
};

/** Помощник для работы с Kendo UI в Дамумед */
export const DamumedKendo = {
  /** Получить инстанс Kendo ComboBox */
  getCombo(selector: string): any | null {
    const el = document.querySelector(selector);
    if (!el) return null;
    const kendoObj = (el as any).kendoComboBox || (el as any).data?.('kendoComboBox');
    return kendoObj || null;
  },

  /** Получить/установить значение ComboBox */
  comboValue(selector: string, value?: string | number): string | number | void | null {
    const combo = this.getCombo(selector);
    if (!combo) return value ?? null;
    
    if (value !== undefined) {
      combo.value(value);
      combo.trigger('change');
    } else {
      return combo.value();
    }
  },

  /** Получить инстанс Kendo DatePicker */
  getDatePicker(selector: string): any | null {
    const el = document.querySelector(selector);
    if (!el) return null;
    const kendoObj = (el as any).kendoDatePicker || (el as any).data?.('kendoDatePicker');
    return kendoObj || null;
  },

  /** Получить/установить значение DatePicker */
  dateValue(selector: string, value?: Date | string): Date | string | void | null {
    const picker = this.getDatePicker(selector);
    if (!picker) return value ?? null;
    
    if (value !== undefined) {
      picker.value(value);
      picker.trigger('change');
    } else {
      return picker.value();
    }
  },

  /** Открыть dropdown Kendo ComboBox */
  openCombo(selector: string): boolean {
    const combo = this.getCombo(selector);
    if (!combo) return false;
    combo.open();
    return true;
  },

  /** Выполнить поиск в ComboBox и выбрать первый результат */
  searchAndSelect(selector: string, searchText: string): boolean {
    const combo = this.getCombo(selector);
    if (!combo) return false;
    
    combo.search(searchText);
    // После поиска нужно дождаться результатов и выбрать первый
    setTimeout(() => {
      const items = combo.dataSource?.view?.() || [];
      if (items.length > 0) {
        combo.select(0);
        combo.trigger('change');
      }
    }, 300);
    return true;
  },
};

/** Помощник для определения текущей страницы Дамумед */
export function detectDamumedPage(): DamumedPage | null {
  const path = window.location.pathname;
  
  if (path.includes('/Emergency/Reception')) return 'emergency-reception';
  if (path.includes('/patientMedicalRecord/editMedicalRecord')) return 'medical-record';
  if (path.includes('/medicalHistory/MedicalHistory')) return 'medical-history';
  if (path.includes('/patientDiary/')) return 'diary';
  if (path.includes('/HospitalResult/')) return 'epicrisis';
  
  // Дополнительные проверки по DOM-элементам
  if (document.querySelector('input[name="cmbAssignmentType"]')) return 'assignments';
  if (document.querySelector('#tinyeditor_diary')) return 'diary';
  if (document.querySelector('input[name="cmbDiagnosisType"]')) return 'diagnoses';
  if (document.querySelector('#tinyeditor_epicrisis')) return 'epicrisis';
  
  return null;
}

/** Найти поле по RPA-ключу для текущей страницы */
export function findDamumedField(rpaKey: string, page?: DamumedPage): DamumedFieldSelector | null {
  const currentPage = page || detectDamumedPage();
  if (!currentPage) return null;
  
  const fields = DAMUMED_FIELD_MAP[currentPage];
  return fields.find(f => f.rpaKey === rpaKey) || null;
}

/** Заполнить поле Дамумед */
export async function fillDamumedField(
  rpaKey: string, 
  value: string, 
  page?: DamumedPage
): Promise<boolean> {
  const field = findDamumedField(rpaKey, page);
  if (!field) {
    console.warn(`[DamumedAdapter] Поле ${rpaKey} не найдено для страницы ${page || detectDamumedPage()}`);
    return false;
  }

  try {
    switch (field.type) {
      case 'tinymce':
        return DamumedTinyMCE.content(value) !== undefined;
        
      case 'kendoCombo':
        DamumedKendo.comboValue(field.selector, value);
        return true;
        
      case 'kendoDate':
        DamumedKendo.dateValue(field.selector, value);
        return true;
        
      case 'checkbox':
        const cb = document.querySelector(field.selector) as HTMLInputElement;
        if (cb) {
          cb.checked = value === 'true' || value === '1' || value === 'on';
          cb.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
        
      case 'radio':
        const radios = document.querySelectorAll(field.selector);
        for (const radio of Array.from(radios)) {
          const r = radio as HTMLInputElement;
          if (r.value === value) {
            r.checked = true;
            r.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
        
      case 'text':
      case 'kendoMasked':
      case 'textarea':
        const input = document.querySelector(field.selector) as HTMLInputElement | HTMLTextAreaElement;
        if (input) {
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          
          // Для Kendo MaskedTextBox нужно триггерить специфичное событие
          if (field.type === 'kendoMasked') {
            const kendoObj = (input as any).data?.('kendoMaskedTextBox');
            if (kendoObj) {
              kendoObj.value(value);
              kendoObj.trigger('change');
            }
          }
          return true;
        }
        return false;
        
      default:
        return false;
    }
  } catch (err) {
    console.error(`[DamumedAdapter] Ошибка заполнения поля ${rpaKey}:`, err);
    return false;
  }
}

/** Конвертировать RPA команду fillField в Damumed-совместимую */
export async function executeDamumedCommand(cmd: FillFieldMsg): Promise<boolean> {
  // Определяем страницу по form из команды
  const pageMapping: Record<string, DamumedPage> = {
    'intake': 'emergency-reception',
    'epicrisis': 'epicrisis',
    'procedure': 'assignments',
    'schedule': 'assignments',
  };
  
  const page = pageMapping[cmd.form];
  if (!page) {
    console.warn(`[DamumedAdapter] Неизвестная форма: ${cmd.form}`);
    return false;
  }
  
  return fillDamumedField(cmd.field, cmd.value, page);
}

/** Массовое заполнение полей */
export async function fillDamumedFields(
  fields: Array<{ rpaKey: string; value: string }>, 
  page?: DamumedPage
): Promise<{ success: number; failed: number; errors: string[] }> {
  const result = { success: 0, failed: 0, errors: [] as string[] };
  
  for (const { rpaKey, value } of fields) {
    const success = await fillDamumedField(rpaKey, value, page);
    if (success) {
      result.success++;
    } else {
      result.failed++;
      result.errors.push(`Не удалось заполнить поле: ${rpaKey}`);
    }
    
    // Небольшая задержка между полями для стабильности
    await new Promise(r => setTimeout(r, 100));
  }
  
  return result;
}

/** Экспорт для глобального доступа (для отладки из консоли) */
if (typeof window !== 'undefined') {
  (window as any).DamumedAdapter = {
    detectPage: detectDamumedPage,
    fillField: fillDamumedField,
    fillFields: fillDamumedFields,
    TinyMCE: DamumedTinyMCE,
    Kendo: DamumedKendo,
    fieldMap: DAMUMED_FIELD_MAP,
  };
}
