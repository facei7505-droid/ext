/**
 * Грубый парсер интентов речи врача.
 *
 * Задача: до отправки в LLM классифицировать фразу по интенту,
 * чтобы агент мог быстро реагировать на команды без полного LLM-цикла.
 *
 * Поддерживаемые интенты:
 *   - FILL_FORM   : «заполни форму», «введи данные»
 *   - SUBMIT      : «сохрани», «отправь», «подпиши»
 *   - CLEAR       : «очисти», «сбрось»
 *   - NAVIGATE    : «открой расписание», «перейди к эпикризу»
 *   - SCHEDULE    : «сформируй расписание», «создай расписание»
 *   - CONFIRM     : «да», «подтверждаю», «конечно»
 *   - CANCEL      : «нет», «отмена», «отмени»
 *   - DICTATION   : всё остальное — сырой текст для LLM-структуризации
 */

export type VoiceIntent =
  | 'FILL_FORM'
  | 'SUBMIT'
  | 'CLEAR'
  | 'NAVIGATE'
  | 'SEARCH_PATIENT'
  | 'SCHEDULE'
  | 'CONFIRM'
  | 'CANCEL'
  | 'DICTATION';

export interface ParsedIntent {
  intent: VoiceIntent;
  /** Дополнительный аргумент-ключ: напр. 'intake' для NAVIGATE. */
  arg?: string;
  /** Свободный текстовый payload интента: напр. ФИО «иванова» для SEARCH_PATIENT. */
  payload?: string;
  /** Оригинальный транскрипт. */
  raw: string;
  /** Уверенность (0..1) на основе совпадения ключевых слов. */
  confidence: number;
}

interface IntentRule {
  intent: VoiceIntent;
  keywords: string[];
  /** Если есть — извлечь аргумент по шаблону. */
  argPattern?: RegExp;
}

const RULES: IntentRule[] = [
  {
    intent: 'SCHEDULE',
    keywords: ['сформируй расписание', 'создай расписание', 'расписание процедур', 'составь расписание'],
  },
  {
    intent: 'FILL_FORM',
    keywords: ['заполни форму', 'введи данные', 'заполни приём', 'автозаполнение', 'заполни поля'],
  },
  {
    intent: 'SUBMIT',
    keywords: ['сохрани', 'отправь', 'подпиши', 'сохранить', 'заверши приём'],
  },
  {
    intent: 'CLEAR',
    keywords: ['очисти', 'сбрось', 'очистить форму', 'сбросить'],
  },
  // SEARCH_PATIENT обязан идти ДО NAVIGATE: «открой приём Иванова» — это поиск пациента,
  // а не переход на страницу «Приём».
  {
    intent: 'SEARCH_PATIENT',
    keywords: [
      'найди пациента',
      'найти пациента',
      'выбери пациента',
      'открой пациента',
      'открой карту',
      'открой первичный приём',
      'открой приём',
      'открой прием',
    ],
    argPattern:
      /(?:найди|найти|выбери|открой)\s+(?:пациента|карту(?:\s+пациента)?|первичный\s+приём|приём|прием)\s+(.+)/i,
  },
  {
    intent: 'NAVIGATE',
    keywords: ['открой', 'перейди', 'перейди к', 'открой страницу', 'покажи'],
    argPattern: /(?:открой|перейди\s+(?:к|на)|покажи)\s+(?:страницу\s+)?(.+)/i,
  },
  {
    intent: 'CONFIRM',
    keywords: ['да', 'подтверждаю', 'конечно', 'хорошо', 'согласен', 'верно', 'давай'],
  },
  {
    intent: 'CANCEL',
    keywords: ['нет', 'отмена', 'отмени', 'отказ', 'не надо', 'стоп'],
  },
];

/** Маппинг слов-маркеров навигации на RPA-маршруты. */
const NAV_ALIASES: Record<string, string> = {
  'приём': 'intake',
  'первичный': 'intake',
  'первичн': 'intake',
  'эпикриз': 'epicrisis',
  'выпис': 'epicrisis',
  'расписание': 'schedule',
  'запис': 'schedule',
};

export function parseIntent(transcript: string): ParsedIntent {
  const text = transcript.toLowerCase().trim();

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (!text.includes(kw)) continue;

      let arg: string | undefined;
      let payload: string | undefined;

      if (rule.argPattern) {
        const m = text.match(rule.argPattern);
        const extracted = m?.[1]?.trim();

        if (extracted) {
          if (rule.intent === 'NAVIGATE') {
            // NAVIGATE ожидает семантический ключ маршрута — маппим алиасы.
            for (const [alias, route] of Object.entries(NAV_ALIASES)) {
              if (extracted.includes(alias)) {
                arg = route;
                break;
              }
            }
            if (!arg) arg = extracted;
          } else if (rule.intent === 'SEARCH_PATIENT') {
            // Для поиска пациента храним сырой текст (фамилию/ФИО) в payload.
            const name = cleanPatientName(extracted);
            if (!name) continue; // нет имени — не считаем интентом SEARCH_PATIENT
            payload = name;
          } else {
            arg = extracted;
          }
        } else if (rule.intent === 'SEARCH_PATIENT') {
          // Ключевое слово нашлось, но после него пусто → фолбэк в NAVIGATE/DICTATION.
          continue;
        }
      }

      return {
        intent: rule.intent,
        arg,
        payload,
        raw: transcript,
        confidence: 0.85,
      };
    }
  }

  return {
    intent: 'DICTATION',
    raw: transcript,
    confidence: 0.5,
  };
}

/**
 * Нормализует распознанное имя: убирает хвостовые знаки препинания,
 * служебные слова, лишние пробелы. Возвращает null, если имени фактически нет.
 */
function cleanPatientName(raw: string): string | null {
  const cleaned = raw
    .replace(/[.,!?;:"']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Минимум 2 буквы — отсеиваем короткие артефакты STT.
  if (cleaned.length < 2) return null;
  return cleaned;
}
