/**
 * System Prompt для LLM.
 *
 * Принципы, заложенные в формулировку (оптимизация TTFT/TGT):
 *  1. Короткий, без художественных оборотов: меньше input-токенов → быстрее первый токен.
 *  2. Жёсткие запреты с "MUST"/"MUST NOT" — LLM реже срывается в свободный текст.
 *  3. Никакой просьбы "think step by step" — цепочки размышлений замедляют вывод
 *     и при json_schema всё равно недопустимы в ответе.
 *  4. Явное правило "unknown → null, never invent" режет галлюцинации.
 *  5. Схема ответа описывается не в промпте, а через response_format.json_schema —
 *     это снимает необходимость дублировать её текстом и сокращает промпт.
 *  6. Формат промпта стабилен между вызовами → KV-cache провайдера попадает чаще.
 */

export const SYSTEM_PROMPT = `Ты — движок структуризации медицинских приёмов в российской клинике.
Вход: транскрипт речи врача (иногда с репликами пациента) на русском.
Задача: заполнить поля первичного приёма ИЛИ выписного эпикриза в зависимости от контекста.

ПРАВИЛА (обязательны):
- Отвечай ТОЛЬКО валидным JSON. Никакого markdown, пояснений, префиксов.
- Структура JSON: { "formType": "intake"|"epicrisis", "intake": {...}|"epicrisis": {...}, "confidence": 0..1 }
- Для intake форма: patient {lastName, firstName, middleName, birthDate (YYYY-MM-DD), gender (male|female|other), phone}, complaints, anamnesis, allergies [], chronicDiseases [], objectiveStatus {summary, bloodPressure, pulse, temperature}, diagnosis {icd10, text}, recommendations [{kind, text}]
- Для epicrisis форма: patientId, admissionDate, dischargeDate, department, doctor, outcome, clinicalDiagnosis, comorbidities, treatmentSummary, labResults, recommendations
- Если информации для поля НЕТ — верни null (для скаляров) или [] (для массивов). НЕ выдумывай.
- Определи тип формы по контексту: "intake" — первичный приём, "epicrisis" — выписной эпикриз.
- Разделяй ФИО: patient.lastName, patient.firstName, patient.middleName (НЕ "name")
- Даты в формате YYYY-MM-DD. Если указан возраст, вычисли примерную дату рождения (текущий год - возраст)
- Давление как "120/80", температура как "36.6", пульс как "72"
- Пол: "male" | "female" | "other"
- Аллергии: извлекай упоминания аллергических реакций (пенициллин, аспирин, пыльца, орехи и т.д.)
- Хронические заболевания: извлекай упоминания хронических болезней (гипертония, диабет, астма и т.д.)
- Медицинские термины: сохраняй оригинальные термины врача, не упрощай
- Коды МКБ-10 только если произнесены явно ("жэ ноль шесть девять" → "J06.9")
- confidence ∈ [0,1]

Не задавай вопросов. Не комментируй. Верни JSON.`;

/**
 * JSON Schema для response_format.json_schema (Structured Outputs, strict=true).
 * Все поля required, additionalProperties:false — так OpenAI/Groq гарантируют форму.
 */
export const RESPONSE_JSON_SCHEMA = {
  name: 'StructuredFormResponse',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['formType', 'confidence'],
    properties: {
      formType: {
        type: 'string',
        enum: ['intake', 'epicrisis'],
      },
      intake: {
        type: 'object',
        additionalProperties: false,
        required: [
          'patient',
          'complaints',
          'anamnesis',
          'allergies',
          'chronicDiseases',
          'objectiveStatus',
          'diagnosis',
          'recommendations',
        ],
        properties: {
          patient: {
            type: 'object',
            additionalProperties: false,
            required: ['lastName', 'firstName', 'middleName', 'birthDate', 'gender', 'phone'],
            properties: {
              lastName: { type: ['string', 'null'] },
              firstName: { type: ['string', 'null'] },
              middleName: { type: ['string', 'null'] },
              birthDate: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
              gender: { type: ['string', 'null'], enum: ['male', 'female', 'other', null] },
              phone: { type: ['string', 'null'] },
            },
          },
          complaints: { type: ['string', 'null'] },
          anamnesis: { type: ['string', 'null'] },
          allergies: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of allergies (medications, foods, pollen, etc.)',
          },
          chronicDiseases: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of chronic diseases',
          },
          objectiveStatus: {
            type: 'object',
            additionalProperties: false,
            required: ['summary', 'bloodPressure', 'pulse', 'temperature'],
            properties: {
              summary: { type: ['string', 'null'] },
              bloodPressure: { type: ['string', 'null'], description: 'sys/dia, e.g. 120/80' },
              pulse: { type: ['string', 'null'] },
              temperature: { type: ['string', 'null'] },
            },
          },
          diagnosis: {
            type: 'object',
            additionalProperties: false,
            required: ['icd10', 'text'],
            properties: {
              icd10: { type: ['string', 'null'] },
              text: { type: ['string', 'null'] },
            },
          },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'text'],
              properties: {
                kind: {
                  type: 'string',
                  enum: ['medication', 'procedure', 'regimen', 'referral', 'other'],
                },
                text: { type: 'string' },
              },
            },
          },
        },
      },
      epicrisis: {
        type: 'object',
        additionalProperties: false,
        required: [
          'patientId',
          'admissionDate',
          'dischargeDate',
          'department',
          'doctor',
          'outcome',
          'clinicalDiagnosis',
          'comorbidities',
          'treatmentSummary',
          'labResults',
          'recommendations',
        ],
        properties: {
          patientId: { type: ['string', 'null'] },
          admissionDate: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
          dischargeDate: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
          department: {
            type: ['string', 'null'],
            enum: ['therapy', 'cardiology', 'neurology', 'surgery', null],
          },
          doctor: { type: ['string', 'null'] },
          outcome: {
            type: ['string', 'null'],
            enum: ['recovery', 'improvement', 'no_change', 'deterioration', null],
          },
          clinicalDiagnosis: { type: ['string', 'null'] },
          comorbidities: { type: ['string', 'null'] },
          treatmentSummary: { type: ['string', 'null'] },
          labResults: { type: ['string', 'null'] },
          recommendations: { type: ['string', 'null'] },
        },
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
} as const;
