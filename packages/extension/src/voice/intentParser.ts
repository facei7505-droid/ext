/**
 * Простой парсер интентов для заполнения формы первичного приёма.
 *
 * Поддерживаемые интенты:
 *   - DICTATION   : всё, что не да/нет — сырой текст для LLM-структуризации
 *   - CONFIRM     : «да», «подтверждаю» и т.п.
 *   - CANCEL      : «нет», «отмена» и т.п.
 *   - EDIT_FIELD  : редактирование поля
 *   - DELETE_FIELD: удаление поля
 *   - ADD_FIELD   : добавление поля
 *
 * Все команды (заполни, сохрани, очисти) обрабатываются через LLM.
 */

export type Intent = 'DICTATION' | 'CONFIRM' | 'CANCEL' | 'EDIT_FIELD' | 'DELETE_FIELD' | 'ADD_FIELD' | 'CLEAR_ALL' | 'SHOW_FIELDS' | 'HELP' | 'REPEAT' | 'SAVE' | 'NAVIGATE' | 'OPEN_TAB';

export interface ParsedIntent {
  intent: Intent;
  raw: string;
  confidence: number;
  /** Для EDIT_FIELD: поле и новое значение */
  field?: string;
  value?: string;
  /** Для DELETE_FIELD: поле для удаления */
  deleteField?: string;
  /** Для ADD_FIELD: поле и значение для добавления */
  addField?: string;
  addValue?: string;
  /** Для NAVIGATE: целевая страница */
  target?: string;
  /** Для OPEN_TAB: URL для открытия */
  url?: string;
}

const CONFIRM_KEYWORDS = [
  'да', 'подтверждаю', 'конечно', 'хорошо', 'согласен', 'верно', 'давай', 'окей', 'ок',
  'ага', 'угу', 'так точно', 'точно', 'разрешите', 'пожалуйста', 'сделай', 'выполни',
  'принимаю', 'согласен', 'правильно', 'йес', 'yes', 'y', '肯定的', '是', 'okay'
];

const CANCEL_KEYWORDS = [
  'нет', 'отмена', 'отмени', 'отказ', 'не надо', 'стоп', 'не нужно', 'не хочу',
  'отстань', 'отменить', 'отклоняю', 'забудь', 'забей', 'пропусти', 'не',
  'неа', 'не-а', 'ни за что', 'никак', 'неточно', 'неправильно', 'no', 'n', '不', '否'
];

/** Маппинг русских названий полей на английские имена полей формы. */
const FIELD_NAME_MAP: Record<string, string> = {
  // Пациент
  'фамилия': 'patient.lastName',
  'фамилию': 'patient.lastName',
  'фамилии': 'patient.lastName',
  'фамилий': 'patient.lastName',
  'имя': 'patient.firstName',
  'имени': 'patient.firstName',
  'имя пациента': 'patient.firstName',
  'отчество': 'patient.middleName',
  'отчества': 'patient.middleName',
  'дата рождения': 'patient.birthDate',
  'возраст': 'patient.birthDate',
  'пол': 'patient.gender',
  'пол пациента': 'patient.gender',
  'телефон': 'patient.phone',
  'номер телефона': 'patient.phone',
  'телефонный номер': 'patient.phone',
  'контакт': 'patient.phone',
  // Жалобы и анамнез
  'жалобы': 'visit.complaints',
  'жалобу': 'visit.complaints',
  'жалобы пациента': 'visit.complaints',
  'жалоба': 'visit.complaints',
  'анамнез': 'visit.anamnesis',
  'анамнеза': 'visit.anamnesis',
  'история болезни': 'visit.anamnesis',
  // Объективный статус
  'давление': 'visit.bloodPressure',
  'артериальное давление': 'visit.bloodPressure',
  'ад': 'visit.bloodPressure',
  'пульс': 'visit.pulse',
  'частота пульса': 'visit.pulse',
  'чсс': 'visit.pulse',
  'температура': 'visit.temperature',
  'температуру': 'visit.temperature',
  'температура тела': 'visit.temperature',
  // Диагноз
  'диагноз': 'visit.diagnosis',
  'диагноз пациента': 'visit.diagnosis',
  'заключение': 'visit.diagnosis',
  // Назначения
  'назначения': 'visit.recommendations',
  'назначения врача': 'visit.recommendations',
  'рекомендации': 'visit.recommendations',
  'лечение': 'visit.recommendations',
  'лекарства': 'visit.recommendations',
};

/** Нормализует русское название поля на английское имя поля формы. */
function normalizeFieldName(fieldName: string): string {
  const normalized = fieldName.toLowerCase().trim();
  return FIELD_NAME_MAP[normalized] || fieldName;
}

export function parseIntent(transcript: string): ParsedIntent {
  const text = transcript.toLowerCase().trim();

  for (const kw of CONFIRM_KEYWORDS) {
    if (text === kw || text.startsWith(kw + ' ') || text.endsWith(' ' + kw)) {
      return { intent: 'CONFIRM', raw: transcript, confidence: 0.9 };
    }
  }

  for (const kw of CANCEL_KEYWORDS) {
    if (text === kw || text.startsWith(kw + ' ') || text.endsWith(' ' + kw)) {
      return { intent: 'CANCEL', raw: transcript, confidence: 0.9 };
    }
  }

  // Парсинг команд редактирования
  // EDIT_FIELD: исправь, измени, поменяй, замени, обнови, поставь, впиши, напиши
  const editMatch = text.match(/(?:исправь|измени|поменяй|замени|обнови|поставь|впиши|напиши|запиши|установи)\s+(?:поле\s+)?(.+?)\s+(?:на|в)\s+(.+)/i);
  if (editMatch) {
    return {
      intent: 'EDIT_FIELD',
      raw: transcript,
      confidence: 0.85,
      field: normalizeFieldName(editMatch[1]),
      value: editMatch[2],
    };
  }

  // DELETE_FIELD: удали, очисти, сотри, убери, вычеркни, аннулируй, сбрось, обнули
  const deleteMatch = text.match(/(?:удали|очисти|сотри|убери|вычеркни|аннулируй|сбрось|обнули|удалить|стереть|забудь)\s+(?:поле\s+)?(.+)/i);
  if (deleteMatch) {
    return {
      intent: 'DELETE_FIELD',
      raw: transcript,
      confidence: 0.85,
      deleteField: normalizeFieldName(deleteMatch[1]),
    };
  }

  // ADD_FIELD: добавь, допиши, впиши, напиши, запиши, включи, внеси, припишите
  const addMatch = text.match(/(?:добавь|допиши|впиши|напиши|запиши|включи|внеси|припишите|добавить|вписать)\s+(?:в\s+)?(.+?)\s+(.+)/i);
  if (addMatch) {
    return {
      intent: 'ADD_FIELD',
      raw: transcript,
      confidence: 0.85,
      addField: normalizeFieldName(addMatch[1]),
      addValue: addMatch[2],
    };
  }

  // CLEAR_ALL: очисти всё, сотри всё, удали всё, сбрось форму, начни заново
  const clearAllMatch = text.match(/(?:очисти|сотри|удали|сбрось|обнули)\s+(?:всё|все|форму|всё на странице|все поля)/i);
  if (clearAllMatch) {
    return {
      intent: 'CLEAR_ALL',
      raw: transcript,
      confidence: 0.85,
    };
  }

  // SHOW_FIELDS: покажи поля, какие поля есть, список полей
  const showFieldsMatch = text.match(/(?:покажи|какие|список|какие поля|поля)\s+(?:поля|поля есть|доступны)/i);
  if (showFieldsMatch) {
    return {
      intent: 'SHOW_FIELDS',
      raw: transcript,
      confidence: 0.85,
    };
  }

  // HELP: помощь, помоги, что умеешь, команды, как пользоваться
  const helpMatch = text.match(/(?:помощь|помоги|что умеешь|команды|как пользоваться|инструкция)/i);
  if (helpMatch) {
    return {
      intent: 'HELP',
      raw: transcript,
      confidence: 0.85,
    };
  }

  // REPEAT: повтори, ещё раз, скажи ещё, повтори команду
  const repeatMatch = text.match(/(?:повтори|ещё раз|скажи ещё|повтори команду|повтори это)/i);
  if (repeatMatch) {
    return {
      intent: 'REPEAT',
      raw: transcript,
      confidence: 0.85,
    };
  }

  // SAVE: сохрани, сохранить приём, сохранить пациента, завершить приём, отправить
  const saveMatch = text.match(/(?:сохрани|сохранить|заверши|отправь|подтверди)\s+(?:приём|прием|пациента|форму|карточку)/i);
  if (saveMatch) {
    return {
      intent: 'SAVE',
      raw: transcript,
      confidence: 0.85,
    };
  }

  // NAVIGATE: перейди на, открой страницу, перейди к, перейди в
  const navigateMatch = text.match(/(?:перейди|открой)\s+(?:на|в|к)\s+(.+)/i);
  if (navigateMatch) {
    return {
      intent: 'NAVIGATE',
      raw: transcript,
      confidence: 0.85,
      target: normalizeFieldName(navigateMatch[1]),
    };
  }

  // OPEN_TAB: открой вкладку, открой в новой вкладке, новая вкладка
  const openTabMatch = text.match(/(?:открой)\s+(?:вкладку|в новой вкладке)\s+(?:на|с)\s+(.+)/i);
  if (openTabMatch) {
    return {
      intent: 'OPEN_TAB',
      raw: transcript,
      confidence: 0.85,
      url: openTabMatch[1],
    };
  }

  return { intent: 'DICTATION', raw: transcript, confidence: 0.5 };
}
