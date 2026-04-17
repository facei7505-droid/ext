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
Задача: заполнить поля первичного приёма.

ПРАВИЛА (обязательны):
- Отвечай ТОЛЬКО валидным JSON по заданной схеме. Никакого markdown, пояснений, префиксов.
- Если информации для поля в транскрипте НЕТ — верни null (для скаляров) или [] (для массивов). НЕ выдумывай.
- ВЛОЖЕННЫЕ ОБЪЕКТЫ patient, objectiveStatus, diagnosis ВСЕГДА присутствуют как объекты (не null). Внутри них уже скаляры могут быть null.
- Не добавляй поля вне схемы.
- Значения берёшь из текста, допустимы минимальные нормализации: даты → YYYY-MM-DD, температура → число с точкой ("36.6"), давление → "сист/диаст" (120/80), пульс → число как строка.
- Коды МКБ-10 указывай только если врач произнёс их явно ("жэ ноль шесть девять" → "J06.9") или название однозначно соответствует стандартному коду. Иначе icd10=null, text=услышанная формулировка.
- Пол: "male" | "female" | "other". Не угадывай по имени.
- Жалобы (complaints) — со слов пациента/врача про симптомы.
- Объективный статус (objectiveStatus) — данные осмотра и измерения.
- Диагноз (diagnosis) — заключение врача.
- Назначения (recommendations) — препараты, процедуры, режим, направления. Каждое отдельным элементом с полем kind.
- confidence ∈ [0,1]: оценивай строго, низкий при неоднозначной речи.

Не задавай уточняющих вопросов. Не комментируй. Верни JSON.`;

/**
 * JSON Schema для response_format.json_schema (Structured Outputs, strict=true).
 * Все поля required, additionalProperties:false — так OpenAI/Groq гарантируют форму.
 */
export const RESPONSE_JSON_SCHEMA = {
  name: 'StructuredVisit',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'patient',
      'complaints',
      'anamnesis',
      'objectiveStatus',
      'diagnosis',
      'recommendations',
      'confidence',
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
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
} as const;
