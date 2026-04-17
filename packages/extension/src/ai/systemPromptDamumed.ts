/**
 * System Prompt для LLM — адаптированный под реальный Дамумед (damumed.kz).
 *
 * Различия от generic системного промпта:
 * 1. Адаптирован под реальные поля Дамумед (не data-rpa-* мокапы)
 * 2. Учитывает структуру TinyMCE редакторов для длинных текстов
 * 3. Поддерживает Kendo ComboBox поля со словарями МО
 * 4. Учитывает специфику казахстанской медицинской документации
 */

export const SYSTEM_PROMPT_DAMUMED = `Ты — движок структуризации медицинских записей для системы Дамумед (Казахстан).
Вход: транскрипт речи врача на русском (иногда с казахскими терминами).
Задача: заполнить поля медицинской карты в системе Дамумед.

КОНТЕКСТ ДАМУМЕД (учитывай при извлечении):
- Поля ввода используют Kendo UI (выпадающие списки с поиском, маскированные поля)
- Длинные тексты (жалобы, анамнез, заключения) — в TinyMCE редакторах
- Даты в формате ДД.ММ.ГГГГ ЧЧ:ММ (пример: "17.04.2026 15:02")
- ИИН пациента — 12 цифр (обычно начинается с годов рождения)
- МКБ-10 используется казахстанская адаптация (допустимы локальные коды)

ПОЛЯ ДЛЯ ИЗВЛЕЧЕНИЯ (зависят от типа документа):

1. Первичный приём / Приёмное отделение (formType: "intake"):
   - patientId: ИИН пациента (12 цифр)
   - admissionDate: Дата поступления (YYYY-MM-DD)
   - admissionTime: Время поступления (HH:MM)
   - department: Отделение (текст или код из справочника)
   - doctor: Лечащий врач (ФИО)
   - admissionDiagnosis: Диагноз при поступлении (текст + МКБ-10)
   - condition: Состояние при поступлении (удовлетворительное/средней тяжести/тяжёлое/крайне тяжёлое)
   - consciousness: Сознание (ясное/оглушение/сопор/кома)
   - complaints: Жалобы (полный текст для TinyMCE)
   - anamnesis: Анамнез жизни и болезни
   - objectiveStatus: Объективный статус (осмотр)
   - localStatus: Местный статус (для хирургии)
   - bodyTemperature: Температура тела (36.6)
   - bloodPressure: АД (120/80)
   - pulse: Пульс (72)
   - respiration: Дыхание (18)

2. Медицинская запись / Осмотр (formType: "medical-record"):
   - recordType: Тип записи (осмотр/консультация/процедура)
   - recordDate: Дата записи
   - medicalRecord: Основной текст записи (HTML для TinyMCE)
   - complaints: Жалобы (если отдельное поле)
   - anamnesis: Анамнез
   - objectiveStatus: Объективный статус
   - diagnosisJustification: Обоснование диагноза
   - treatmentPlan: План лечения
   - examinationPlan: План обследования
   - recommendations: Рекомендации

3. Дневниковая запись (formType: "diary"):
   - diaryDate: Дата записи
   - diaryTime: Время
   - diaryRecord: Текст дневниковой записи
   - bodyTemperature: Температура
   - bloodPressure: АД
   - pulse: Пульс
   - respiration: Частота дыхания
   - weight: Вес

4. Выписной эпикриз (formType: "epicrisis"):
   - epicrisisDate: Дата выписки
   - epicrisisType: Тип эпикриза (выписка/перевод/смерть)
   - treatmentSummary: Проведённое лечение (полный текст)
   - dynamics: Динамика состояния
   - labResults: Результаты лабораторных и инструментальных исследований
   - recommendations: Рекомендации при выписке
   - outcome: Исход (выздоровление/улучшение/без изменений/ухудшение/смерть)
   - dischargeReason: Причина выписки
   - dischargedTo: Куда выписан (дом/другая МО)

5. Назначения (formType: "assignments"):
   - assignmentType: Тип назначения (медикамент/процедура/диета/режим)
   - assignmentSick: Диагноз для назначения
   - serviceCode: Код услуги (A02.005.000)
   - serviceName: Наименование услуги
   - serviceCito: Срочное назначение (true/false)
   - assignmentDate: Дата назначения
   - executor: Исполнитель (врач/медсестра)

ПРАВИЛА ДАМУМЕД:
- Отвечай ТОЛЬКО валидным JSON по заданной схеме
- formType: определи по контексту транскрипта (intake/medical-record/diary/epicrisis/assignments)
- Даты нормализуй в YYYY-MM-DD, время в HH:MM (если указано)
- Температура → число с точкой ("36.6")
- Давление → "сист/диаст" ("120/80")
- Пульс/дыхание → целое число как строка
- Для TinyMCE полей — полный текст без сокращений, с медицинской терминологией
- Если врач не произнёс значение поля — верни null, не придумывай
- confidence ∈ [0,1]: оценивай строго, понижай если речь нечёткая или термины расплывчаты
- МКБ-10: только если врач произнёс явно или диагноз однозначен

ОСОБЕННОСТИ ИЗВЛЕЧЕНИЯ:
- Жалобы часто начинаются со слов "Жалобы на...", "Беспокоит..."
- Анамнез включает: перенесённые заболевания, операции, аллергию, наследственность
- Объективный статус — структурирован: общее состояние, кожа, слизистые, ЛОР, ССС, дыхание, ЖКТ, НС
- План лечения обычно содержит: медикаменты (название + дозировка), режим, диета, процедуры
- Рекомендации — что делать пациенту после выписки (режим, питание, лекарства, сроки осмотра)

Не задавай уточняющих вопросов. Не комментируй. Верни только JSON.`;

/**
 * JSON Schema для Дамумед (расширенная версия с учётом реальных полей).
 */
export const RESPONSE_JSON_SCHEMA_DAMUMED = {
  name: 'DamumedStructuredResponse',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['formType', 'confidence'],
    properties: {
      formType: {
        type: 'string',
        enum: ['intake', 'medical-record', 'diary', 'epicrisis', 'assignments', 'diagnosis'],
      },
      // Первичный приём
      intake: {
        type: 'object',
        additionalProperties: false,
        properties: {
          patientId: { type: ['string', 'null'] },
          admissionDate: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
          admissionTime: { type: ['string', 'null'], description: 'HH:MM' },
          department: { type: ['string', 'null'] },
          doctor: { type: ['string', 'null'] },
          admissionDiagnosis: { type: ['string', 'null'] },
          diagnosisCode: { type: ['string', 'null'], description: 'МКБ-10 код' },
          condition: { type: ['string', 'null'] },
          consciousness: { type: ['string', 'null'] },
          bodyPosition: { type: ['string', 'null'] },
          complaints: { type: ['string', 'null'] },
          anamnesis: { type: ['string', 'null'] },
          objectiveStatus: { type: ['string', 'null'] },
          localStatus: { type: ['string', 'null'] },
          bodyTemperature: { type: ['string', 'null'] },
          bloodPressure: { type: ['string', 'null'] },
          pulse: { type: ['string', 'null'] },
          respiration: { type: ['string', 'null'] },
          weight: { type: ['string', 'null'] },
          height: { type: ['string', 'null'] },
          paymentType: { type: ['string', 'null'], enum: ['1', '2', null] }, // 1=гос, 2=платно
          financeSource: { type: ['string', 'null'] },
          insuranceCompany: { type: ['string', 'null'] },
          insurancePolisNumber: { type: ['string', 'null'] },
          insuranceExpireDate: { type: ['string', 'null'] },
        },
      },
      // Медицинская запись
      medicalRecord: {
        type: 'object',
        additionalProperties: false,
        properties: {
          recordType: { type: ['string', 'null'] },
          recordTypeMo: { type: ['string', 'null'] },
          medicalForm: { type: ['string', 'null'] },
          recordDate: { type: ['string', 'null'] },
          medicalRecord: { type: ['string', 'null'], description: 'HTML текст для TinyMCE' },
          complaints: { type: ['string', 'null'] },
          anamnesis: { type: ['string', 'null'] },
          objectiveStatus: { type: ['string', 'null'] },
          localStatus: { type: ['string', 'null'] },
          diagnosisJustification: { type: ['string', 'null'] },
          treatmentPlan: { type: ['string', 'null'] },
          examinationPlan: { type: ['string', 'null'] },
          recommendations: { type: ['string', 'null'] },
          note: { type: ['string', 'null'] },
        },
      },
      // Дневниковая запись
      diary: {
        type: 'object',
        additionalProperties: false,
        properties: {
          diaryDate: { type: ['string', 'null'] },
          diaryTime: { type: ['string', 'null'] },
          diaryRecord: { type: ['string', 'null'] },
          bodyTemperature: { type: ['string', 'null'] },
          bloodPressure: { type: ['string', 'null'] },
          pulse: { type: ['string', 'null'] },
          respiration: { type: ['string', 'null'] },
          weight: { type: ['string', 'null'] },
          doctor: { type: ['string', 'null'] },
        },
      },
      // Выписной эпикриз
      epicrisis: {
        type: 'object',
        additionalProperties: false,
        properties: {
          epicrisisType: { type: ['string', 'null'] },
          epicrisisDate: { type: ['string', 'null'] },
          treatmentSummary: { type: ['string', 'null'] },
          dynamics: { type: ['string', 'null'] },
          labResults: { type: ['string', 'null'] },
          recommendations: { type: ['string', 'null'] },
          outcome: { type: ['string', 'null'] },
          dischargeReason: { type: ['string', 'null'] },
          dischargedTo: { type: ['string', 'null'] },
        },
      },
      // Назначения
      assignments: {
        type: 'object',
        additionalProperties: false,
        properties: {
          assignmentType: { type: ['string', 'null'] },
          assignmentSick: { type: ['string', 'null'] },
          assignmentDate: { type: ['string', 'null'] },
          serviceCode: { type: ['string', 'null'] },
          serviceName: { type: ['string', 'null'] },
          serviceMoCode: { type: ['string', 'null'] },
          serviceMoName: { type: ['string', 'null'] },
          serviceCito: { type: ['boolean', 'null'] },
          executor: { type: ['string', 'null'] },
          periodType: { type: ['string', 'null'], enum: ['one', 'period', 'demand', null] },
          periodBeginDate: { type: ['string', 'null'] },
          periodEndDate: { type: ['string', 'null'] },
          periodExecuteCount: { type: ['string', 'null'] },
        },
      },
      // Диагнозы (структура для грида)
      diagnosis: {
        type: 'object',
        additionalProperties: false,
        properties: {
          diagnosisType: { type: ['string', 'null'] },
          diagnosisCode: { type: ['string', 'null'] },
          diagnosisName: { type: ['string', 'null'] },
          diagnosisFullName: { type: ['string', 'null'] },
          stage: { type: ['string', 'null'] },
          phase: { type: ['string', 'null'] },
          isMain: { type: ['boolean', 'null'] },
          isComplication: { type: ['boolean', 'null'] },
          isAccompanying: { type: ['boolean', 'null'] },
        },
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
} as const;

/**
 * Маппинг полей Дамумед в структурированные LLM-ответы.
 * Используется в маппере для преобразования JSON в команды fillField.
 */
export const DAMUMED_FIELD_MAPPING: Record<string, { page: string; field: string; transform?: (v: unknown) => string }> = {
  // Intake fields
  'intake.patientId': { page: 'emergency-reception', field: 'patientId' },
  'intake.admissionDate': { page: 'emergency-reception', field: 'admissionDate' },
  'intake.admissionTime': { page: 'emergency-reception', field: 'admissionTime' },
  'intake.department': { page: 'emergency-reception', field: 'department' },
  'intake.doctor': { page: 'emergency-reception', field: 'doctor' },
  'intake.admissionDiagnosis': { page: 'emergency-reception', field: 'admissionDiagnosis' },
  'intake.diagnosisCode': { page: 'emergency-reception', field: 'diagnosisCode' },
  'intake.condition': { page: 'emergency-reception', field: 'condition' },
  'intake.consciousness': { page: 'emergency-reception', field: 'consciousness' },
  'intake.complaints': { page: 'emergency-reception', field: 'complaints' },
  'intake.anamnesis': { page: 'emergency-reception', field: 'anamnesis' },
  'intake.objectiveStatus': { page: 'emergency-reception', field: 'objectiveStatus' },
  'intake.localStatus': { page: 'emergency-reception', field: 'localStatus' },
  'intake.bodyTemperature': { page: 'emergency-reception', field: 'bodyTemperature' },
  'intake.bloodPressure': { page: 'emergency-reception', field: 'bloodPressure' },
  'intake.pulse': { page: 'emergency-reception', field: 'pulse' },
  'intake.respiration': { page: 'emergency-reception', field: 'respiration' },
  'intake.paymentType': { page: 'emergency-reception', field: 'paymentType' },
  'intake.financeSource': { page: 'emergency-reception', field: 'financeSource' },
  'intake.insuranceCompany': { page: 'emergency-reception', field: 'insuranceCompany' },
  'intake.insurancePolisNumber': { page: 'emergency-reception', field: 'insurancePolisNumber' },
  'intake.insuranceExpireDate': { page: 'emergency-reception', field: 'insuranceExpireDate' },

  // Medical record fields
  'medical-record.recordType': { page: 'medical-record', field: 'recordType' },
  'medical-record.recordTypeMo': { page: 'medical-record', field: 'recordTypeMo' },
  'medical-record.medicalForm': { page: 'medical-record', field: 'medicalForm' },
  'medical-record.recordDate': { page: 'medical-record', field: 'recordDate' },
  'medical-record.medicalRecord': { page: 'medical-record', field: 'medicalRecord' },
  'medical-record.complaints': { page: 'medical-record', field: 'complaints' },
  'medical-record.anamnesis': { page: 'medical-record', field: 'anamnesis' },
  'medical-record.objectiveStatus': { page: 'medical-record', field: 'objectiveStatus' },
  'medical-record.localStatus': { page: 'medical-record', field: 'localStatus' },
  'medical-record.diagnosisJustification': { page: 'medical-record', field: 'diagnosisJustification' },
  'medical-record.treatmentPlan': { page: 'medical-record', field: 'treatmentPlan' },
  'medical-record.examinationPlan': { page: 'medical-record', field: 'examinationPlan' },
  'medical-record.recommendations': { page: 'medical-record', field: 'recommendations' },

  // Diary fields
  'diary.diaryDate': { page: 'diary', field: 'diaryDate' },
  'diary.diaryTime': { page: 'diary', field: 'diaryTime' },
  'diary.diaryRecord': { page: 'diary', field: 'diaryRecord' },
  'diary.bodyTemperature': { page: 'diary', field: 'bodyTemperature' },
  'diary.bloodPressure': { page: 'diary', field: 'bloodPressure' },
  'diary.pulse': { page: 'diary', field: 'pulse' },
  'diary.respiration': { page: 'diary', field: 'respiration' },
  'diary.weight': { page: 'diary', field: 'weight' },

  // Epicrisis fields
  'epicrisis.epicrisisType': { page: 'epicrisis', field: 'epicrisisType' },
  'epicrisis.epicrisisDate': { page: 'epicrisis', field: 'epicrisisDate' },
  'epicrisis.treatmentSummary': { page: 'epicrisis', field: 'treatmentSummary' },
  'epicrisis.dynamics': { page: 'epicrisis', field: 'dynamics' },
  'epicrisis.labResults': { page: 'epicrisis', field: 'labResults' },
  'epicrisis.recommendations': { page: 'epicrisis', field: 'recommendations' },
  'epicrisis.outcome': { page: 'epicrisis', field: 'outcome' },
  'epicrisis.dischargeReason': { page: 'epicrisis', field: 'dischargeReason' },
  'epicrisis.dischargedTo': { page: 'epicrisis', field: 'dischargedTo' },

  // Assignments fields
  'assignments.assignmentType': { page: 'assignments', field: 'assignmentType' },
  'assignments.assignmentSick': { page: 'assignments', field: 'assignmentSick' },
  'assignments.assignmentDate': { page: 'assignments', field: 'assignmentDate' },
  'assignments.serviceCode': { page: 'assignments', field: 'serviceCode' },
  'assignments.serviceName': { page: 'assignments', field: 'serviceName' },
  'assignments.serviceCito': { page: 'assignments', field: 'serviceCito', transform: (v) => String(v) },
  'assignments.executor': { page: 'assignments', field: 'executor' },
};
