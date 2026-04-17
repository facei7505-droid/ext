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
  | 'SCHEDULE'
  | 'CONFIRM'
  | 'CANCEL'
  | 'DICTATION';

export interface ParsedIntent {
  intent: VoiceIntent;
  /** Дополнительный аргумент: напр. 'intake' для NAVIGATE. */
  arg?: string;
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
      if (text.includes(kw)) {
        let arg: string | undefined;

        if (rule.argPattern) {
          const m = text.match(rule.argPattern);
          if (m) {
            // Пытаемся замаппить аргумент навигации.
            const argText = m[1].trim();
            for (const [alias, route] of Object.entries(NAV_ALIASES)) {
              if (argText.includes(alias)) {
                arg = route;
                break;
              }
            }
            if (!arg) arg = argText;
          }
        }

        return {
          intent: rule.intent,
          arg,
          raw: transcript,
          confidence: 0.85,
        };
      }
    }
  }

  return {
    intent: 'DICTATION',
    raw: transcript,
    confidence: 0.5,
  };
}
