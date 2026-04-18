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

export type Intent = 'DICTATION' | 'CONFIRM' | 'CANCEL' | 'EDIT_FIELD' | 'DELETE_FIELD' | 'ADD_FIELD' | 'CLEAR_ALL' | 'SHOW_FIELDS' | 'HELP' | 'REPEAT' | 'SAVE' | 'NAVIGATE' | 'OPEN_TAB' | 'MULTI_EDIT' | 'GENERATE_SCHEDULE' | 'MARK_COMPLETED' | 'SELECT_DATE';

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
  /** Для нескольких команд: массив команд */
  commands?: ParsedIntent[];
  /** Для MARK_COMPLETED: идентификатор процедуры. */
  procedure?: string;
  /** Для MARK_COMPLETED: опциональный короткий дневник. */
  diary?: string;
  /** Для SELECT_DATE: номер дня или 'next'/'prev'. */
  targetDay?: number | 'next' | 'prev';
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

/** Маппинг русских названий полей на английские имена полей формы для Дамумед. */
const FIELD_NAME_MAP: Record<string, string> = {
  // Первичный осмотр (IntakeDamumed)
  'иин': 'patient.iin',
  'иин пациента': 'patient.iin',
  'иин пациентам': 'patient.iin',
  'им пациента': 'patient.iin',
  'им пациентам': 'patient.iin',
  'инн пациента': 'patient.iin',
  'инн пациентам': 'patient.iin',
  'индивидуальный идентификационный номер': 'patient.iin',
  'идентификационный номер': 'patient.iin',
  'номер иин': 'patient.iin',
  'ин': 'patient.iin',
  'и и н': 'patient.iin',
  'идентификационный': 'patient.iin',
  'индивидуальный номер': 'patient.iin',
  'им': 'patient.iin',
  'личный номер': 'patient.iin',
  'номер пациента': 'patient.iin',
  'in': 'patient.iin',
  'дата поступления': 'patient.admissionDate',
  'дата госпитализации': 'patient.admissionDate',
  'дата приема': 'patient.admissionDate',
  'дата начала': 'patient.admissionDate',
  'дата': 'patient.admissionDate',
  'отделение': 'patient.department',
  'отдел': 'patient.department',
  'палата': 'patient.department',
  'терапевтическое': 'therapeutic',
  'неврологическое': 'neurology',
  'детское': 'pediatric',
  'диагноз': 'visit.diagnosis',
  'предварительный диагноз': 'visit.diagnosis',
  'первичный диагноз': 'visit.diagnosis',
  'жалобы': 'visit.complaints',
  'жалобу': 'visit.complaints',
  'жалобы пациента': 'visit.complaints',
  'жалоба': 'visit.complaints',
  'описание жалоб': 'visit.complaints',
  'жалобы при поступлении': 'visit.complaints',
  'анамнез': 'visit.anamnesis',
  'анамнеза': 'visit.anamnesis',
  'история болезни': 'visit.anamnesis',
  'история': 'visit.anamnesis',
  'анамнез заболевания': 'visit.anamnesis',
  'давление': 'visit.bloodPressure',
  'артериальное давление': 'visit.bloodPressure',
  'ад': 'visit.bloodPressure',
  'кровяное давление': 'visit.bloodPressure',
  'пульс': 'visit.pulse',
  'частота пульса': 'visit.pulse',
  'чсс': 'visit.pulse',
  'сердечный ритм': 'visit.pulse',
  'температура': 'visit.temperature',
  'температуру': 'visit.temperature',
  'температура тела': 'visit.temperature',
  'температур': 'visit.temperature',
  'назначения врача': 'visit.recommendations',
  'рекомендации': 'visit.recommendations',
  'лечение': 'visit.recommendations',
  'терапия': 'visit.recommendations',
  // Выписной эпикриз (EpicrisisDamumed) - используется префикс epicrisis
  'окончательный диагноз': 'epicrisis.finalDiagnosis',
  'выписной диагноз': 'epicrisis.finalDiagnosis',
  'финальный диагноз': 'epicrisis.finalDiagnosis',
  'заключительный диагноз': 'epicrisis.finalDiagnosis',
  'результаты лечения': 'epicrisis.treatmentResults',
  'результат лечения': 'epicrisis.treatmentResults',
  'результаты терапии': 'epicrisis.treatmentResults',
  'результат терапии': 'epicrisis.treatmentResults',
  'исход лечения': 'epicrisis.treatmentResults',
  'результаты': 'epicrisis.treatmentResults',
  'результат': 'epicrisis.treatmentResults',
  'диспансерное наблюдение': 'epicrisis.followUp',
  'диспансеризация': 'epicrisis.followUp',
  'наблюдение': 'epicrisis.followUp',
  'диспансерного наблюдения': 'epicrisis.followUp',
  'группа инвалидности': 'epicrisis.disabilityGroup',
  'инвалидность': 'epicrisis.disabilityGroup',
  'группа': 'epicrisis.disabilityGroup',
  'дата следующего визита': 'epicrisis.nextVisitDate',
  'дата следующего приема': 'epicrisis.nextVisitDate',
  'дата повторного визита': 'epicrisis.nextVisitDate',
  'дата контроля': 'epicrisis.nextVisitDate',
  // Дневниковая запись (DiaryDamumed) - используется префикс diary
  'дата осмотра': 'diary.date',
  'дата визита': 'diary.date',
  'дата записи': 'diary.date',
  'субъективные данные': 'diary.subjective',
  'субъективно': 'diary.subjective',
  'субъективный статус': 'diary.subjective',
  'субъективные жалобы': 'diary.subjective',
  'объективные данные': 'diary.objective',
  'объективно': 'diary.objective',
  'объективный статус': 'diary.objective',
  'объективный осмотр': 'diary.objective',
  'осмотр': 'diary.objective',
  'оценка состояния': 'diary.assessment',
  'оценка': 'diary.assessment',
  'заключение': 'diary.assessment',
  'план лечения': 'diary.plan',
  'план': 'diary.plan',
  'дальнейшее лечение': 'diary.plan',
  'тактика лечения': 'diary.plan',
  'дальнейшее ведение': 'diary.plan',
  'план обследования': 'diary.plan',
  // Диагнозы (DiagnosesDamumed) - используется префикс diagnoses.new
  'код диагноза': 'diagnoses.new.code',
  'мкб код': 'diagnoses.new.code',
  'код мкб': 'diagnoses.new.code',
  'мкб': 'diagnoses.new.code',
  'код мкб 10': 'diagnoses.new.code',
  'название диагноза': 'diagnoses.new.name',
  'наименование диагноза': 'diagnoses.new.name',
  'тип диагноза': 'diagnoses.new.type',
  'вид диагноза': 'diagnoses.new.type',
  'категория диагноза': 'diagnoses.new.type',
  'дата установки диагноза': 'diagnoses.new.date',
  'дата диагноза': 'diagnoses.new.date',
  'дата установления': 'diagnoses.new.date',
  'дата постановки': 'diagnoses.new.date',
  // Назначения (AssignmentsDamumed) - используется префикс assignments.new
  'тип назначения': 'assignments.new.type',
  'вид назначения': 'assignments.new.type',
  'категория назначения': 'assignments.new.type',
  'класс назначения': 'assignments.new.type',
  'название препарата': 'assignments.new.name',
  'наименование препарата': 'assignments.new.name',
  'название лекарства': 'assignments.new.name',
  'наименование лекарства': 'assignments.new.name',
  'имя препарата': 'assignments.new.name',
  'препарат': 'assignments.new.name',
  'лекарство': 'assignments.new.name',
  'медикамент': 'assignments.new.name',
  'название назначения': 'assignments.new.name',
  'наименование назначения': 'assignments.new.name',
  'имя назначения': 'assignments.new.name',
  'дозировка': 'assignments.new.dosage',
  'доза': 'assignments.new.dosage',
  'количество': 'assignments.new.dosage',
  'объем': 'assignments.new.dosage',
  'частота приема': 'assignments.new.frequency',
  'частота приёма': 'assignments.new.frequency',
  'частота': 'assignments.new.frequency',
  'как часто': 'assignments.new.frequency',
  'режим приема': 'assignments.new.frequency',
  'режим приёма': 'assignments.new.frequency',
  'периодичность': 'assignments.new.frequency',
  'интервал': 'assignments.new.frequency',
  'дата начала приема': 'assignments.new.startDate',
  'дата начала приёма': 'assignments.new.startDate',
  'дата начала лечения': 'assignments.new.startDate',
  'дата начала курса': 'assignments.new.startDate',
  'дата окончания приема': 'assignments.new.endDate',
  'дата окончания приёма': 'assignments.new.endDate',
  'дата конца': 'assignments.new.endDate',
  'дата завершения': 'assignments.new.endDate',
  'дата окончания курса': 'assignments.new.endDate',
  'дата конца курса': 'assignments.new.endDate',
  // Расписание (ScheduleDamumed)
  'дата начала расписания': 'schedule.startDate',
  'начало расписания': 'schedule.startDate',
  'дата окончания расписания': 'schedule.endDate',
  'конец расписания': 'schedule.endDate',
  'начало курса': 'schedule.startDate',
  'начало лечения': 'schedule.startDate',
  'окончание курса': 'schedule.endDate',
  'конец лечения': 'schedule.endDate',
  'окончание лечения': 'schedule.endDate',
  'расписание': 'schedule',
  'график процедур': 'schedule',
  'процедуры': 'schedule',
};

/** Маппинг русских названий вкладок на имена маршрутов */
const TAB_NAME_MAP: Record<string, string> = {
  // Первичный осмотр
  'первичный прием': 'intake',
  'первичный осмотр': 'intake',
  'осмотр': 'intake',
  'прием': 'intake',
  'прием пациента': 'intake',
  'ввод данных': 'intake',
  // Выписной эпикриз
  'выписной эпикриз': 'epicrisis',
  'эпикриз': 'epicrisis',
  'выписка': 'epicrisis',
  'заключение': 'epicrisis',
  'выписной': 'epicrisis',
  // Дневниковая запись
  'дневниковая запись': 'diary',
  'дневник': 'diary',
  'запись': 'diary',
  'дневниковая': 'diary',
  // Диагнозы
  'диагнозы': 'diagnoses',
  'диагноз': 'diagnoses',
  'диагностика': 'diagnoses',
  // Назначения
  'назначения': 'assignments',
  'назначение': 'assignments',
  'лекарства': 'assignments',
  'лекарство': 'assignments',
  'медикаменты': 'assignments',
  'медикамент': 'assignments',
  'терапия': 'assignments',
  // Расписание
  'расписание': 'schedule',
  'график': 'schedule',
  // Журнал выполнения процедур
  'журнал процедур': 'services',
  'журнал': 'services',
  'выполнение': 'services',
  'выполнение процедур': 'services',
  'выполнение услуг': 'services',
  'услуги': 'services',
  'журнал услуг': 'services',
  // 'процедуры' → services (по умолчанию теперь журнал, расписание триггерится словом "расписание")
  'процедуры': 'services',
  'процедур': 'services',
};

/** Маппинг русских названий процедур → id для журнала услуг. */
const PROCEDURE_NAME_MAP: Record<string, string> = {
  'лфк': 'lfk',
  'лечебная физкультура': 'lfk',
  'физкультура': 'lfk',
  'зарядка': 'lfk',
  'массаж': 'massage',
  'массажа': 'massage',
  'массажиста': 'massage',
  'психолог': 'psychology',
  'психолога': 'psychology',
  'психология': 'psychology',
  'психологическая процедура': 'psychology',
  'физиотерапия': 'physiotherapy',
  'физиотерапию': 'physiotherapy',
  'физио': 'physiotherapy',
  'логопед': 'speech',
  'логопеда': 'speech',
  'речевая терапия': 'speech',
};

/** Нормализует русское название поля на английское имя поля формы. */
function normalizeFieldName(fieldName: string): string {
  const normalized = fieldName.toLowerCase().trim();
  return FIELD_NAME_MAP[normalized] || fieldName;
}

/** Парсит несколько команд из одной транскрипции */
function parseMultipleCommands(text: string, originalTranscript: string): ParsedIntent[] {
  const commands: ParsedIntent[] = [];

  // Нормализуем текст: заменяем ё на е для согласования
  const normalizedText = text.replace(/ё/g, 'е');
  const normalizedOriginal = originalTranscript.replace(/ё/g, 'е');

  // Сортируем ключи FIELD_NAME_MAP по длине (сначала длинные, чтобы "дата поступления" было до "дата")
  const sortedFieldNames = Object.keys(FIELD_NAME_MAP).sort((a, b) => b.length - a.length);

  // Находим все позиции полей в тексте
  const fieldMatches: { fieldName: string; index: number; field: string }[] = [];
  for (const fieldName of sortedFieldNames) {
    const normalizedFieldName = fieldName.replace(/ё/g, 'е');
    let searchIndex = 0;
    while (true) {
      const fieldIndex = normalizedText.indexOf(normalizedFieldName + ' ', searchIndex);
      if (fieldIndex === -1) break;
      fieldMatches.push({
        fieldName,
        index: fieldIndex,
        field: FIELD_NAME_MAP[fieldName],
      });
      searchIndex = fieldIndex + 1;
    }
  }

  // Сортируем найденные поля по позиции, затем по длине названия (сначала длинные)
  fieldMatches.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return b.fieldName.length - a.fieldName.length;
  });

  // Фильтруем короткие названия полей которые являются подстроками длинных на той же позиции
  const filteredMatches: typeof fieldMatches = [];
  for (let i = 0; i < fieldMatches.length; i++) {
    const current = fieldMatches[i];
    let isSubsequence = false;

    // Проверяем, есть ли более длинное поле на той же позиции, которое содержит текущее
    for (let j = 0; j < fieldMatches.length; j++) {
      if (i !== j && fieldMatches[j].index === current.index && fieldMatches[j].fieldName.length > current.fieldName.length) {
        if (fieldMatches[j].fieldName.includes(current.fieldName)) {
          isSubsequence = true;
          console.log('[intentParser] Filtering out subsequence:', current.fieldName, 'covered by', fieldMatches[j].fieldName);
          break;
        }
      }
    }

    // Дополнительная проверка: если текущее поле начинается в середине другого поля, фильтруем его
    for (let j = 0; j < fieldMatches.length; j++) {
      if (i !== j && current.index > fieldMatches[j].index && current.index < fieldMatches[j].index + fieldMatches[j].fieldName.length) {
        isSubsequence = true;
        console.log('[intentParser] Filtering out overlapping:', current.fieldName, 'overlaps with', fieldMatches[j].fieldName);
        break;
      }
    }

    // Проверяем, если текущее слово является частью более длинной фразы (например, "диагноз" в "окончательный диагноз")
    for (let j = 0; j < fieldMatches.length; j++) {
      if (i !== j && current.index > fieldMatches[j].index && current.index < fieldMatches[j].index + fieldMatches[j].fieldName.length + 1) {
        // Проверяем, что текущее слово начинается после пробела в длинной фразе
        const longerPhrase = text.slice(fieldMatches[j].index, fieldMatches[j].index + fieldMatches[j].fieldName.length);
        if (longerPhrase.includes(' ' + current.fieldName) || longerPhrase.endsWith(current.fieldName)) {
          isSubsequence = true;
          console.log('[intentParser] Filtering out word in phrase:', current.fieldName, 'part of', fieldMatches[j].fieldName);
          break;
        }
      }
    }

    if (!isSubsequence) {
      filteredMatches.push(current);
    }
  }

  console.log('[intentParser] Filtered field matches:', filteredMatches.map(m => ({ fieldName: m.fieldName, field: m.field })));

  // Извлекаем значения для каждого поля
  for (let i = 0; i < filteredMatches.length; i++) {
    const match = filteredMatches[i];
    const nextMatch = filteredMatches[i + 1];

    const normalizedFieldName = match.fieldName.replace(/ё/g, 'е');
    const afterFieldStart = match.index + normalizedFieldName.length + 1;
    const nextFieldIndex = nextMatch ? nextMatch.index : normalizedText.length;

    const valueText = normalizedText.slice(afterFieldStart, nextFieldIndex).trim();
    const originalValueText = normalizedOriginal.slice(afterFieldStart, nextFieldIndex).trim();

    console.log('[intentParser] Extracting value for:', match.fieldName, 'from index', afterFieldStart, 'to', nextFieldIndex, 'value:', valueText);

    if (valueText) {
      // Удаляем пробелы если значение состоит только из цифр
      const isNumericOnly = /^\d+(\s+\d+)*$/.test(valueText);
      const value = isNumericOnly ? valueText.replace(/\s+/g, '') : valueText;

      // Для ИИН полей извлекаем только числа
      let finalValue = value;
      if (match.field === 'patient.iin') {
        const numbers = value.match(/\d+(\s+\d+)*/g);
        if (numbers) {
          finalValue = numbers.join(' ').replace(/\s+/g, '');
        }
      }

      console.log('[intentParser] Extracted field:', { fieldName: match.fieldName, field: match.field, value: finalValue });

      commands.push({
        intent: 'EDIT_FIELD',
        raw: originalValueText,
        confidence: 0.7,
        field: match.field,
        value: finalValue,
      });
    }
  }

  // Удаляем дубликаты полей (оставляем последнее совпадение)
  const uniqueCommands: ParsedIntent[] = [];
  const seenFields = new Set<string>();
  for (let i = commands.length - 1; i >= 0; i--) {
    const field = commands[i].field;
    if (field && !seenFields.has(field)) {
      seenFields.add(field);
      uniqueCommands.unshift(commands[i]);
    } else if (field) {
      console.log('[intentParser] Skipping duplicate field:', field);
    }
  }

  console.log('[intentParser] Final commands after deduplication:', uniqueCommands.map(c => ({ field: c.field, value: c.value })));
  return uniqueCommands;
}

export function parseIntent(transcript: string): ParsedIntent | ParsedIntent[] {
  const text = transcript.toLowerCase().trim();
  console.log('[intentParser] Parsing transcript:', text);

  for (const kw of CONFIRM_KEYWORDS) {
    if (text === kw || text.startsWith(kw + ' ') || text.endsWith(' ' + kw)) {
      console.log('[intentParser] Matched CONFIRM keyword:', kw);
      return { intent: 'CONFIRM', raw: transcript, confidence: 0.9 };
    }
  }

  for (const kw of CANCEL_KEYWORDS) {
    if (text === kw || text.startsWith(kw + ' ') || text.endsWith(' ' + kw)) {
      console.log('[intentParser] Matched CANCEL keyword:', kw);
      return { intent: 'CANCEL', raw: transcript, confidence: 0.9 };
    }
  }

  // Проверяем на несколько команд (несколько полей в одной транскрипции)
  const multiCommands = parseMultipleCommands(text, transcript);
  if (multiCommands.length > 1) {
    console.log('[intentParser] Detected multiple commands:', multiCommands.length);
    return {
      intent: 'MULTI_EDIT',
      raw: transcript,
      confidence: 0.7,
      commands: multiCommands,
    };
  }

  // Парсинг отметки выполнения процедур (Модуль 4: Тайм-менеджмент)
  // 1. "<процедура> выполнен(а/о) [, <короткий дневник>]"
  // 2. "отметь <процедура> как выполненн(ую/ый/ое) [, <дневник>]"
  // 3. "<процедура> завершен(а/о)"
  const sortedProcNames = Object.keys(PROCEDURE_NAME_MAP).sort((a, b) => b.length - a.length);
  // NB: JS \w не захватывает кириллицу, поэтому используем [а-яё]* для суффиксов.
  const DONE = '(?:выполнен|завершен|сделан|закончен|готов)[а-яё]*';
  console.log('[intentParser] Checking MARK_COMPLETED patterns against text:', JSON.stringify(text));
  for (const procName of sortedProcNames) {
    const escaped = procName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns: RegExp[] = [
      new RegExp(`(?:отметь|отметить|поставь)\\s+${escaped}\\s+(?:как\\s+)?${DONE}(?:[\\s,\\-:—.]+(.+))?$`, 'i'),
      new RegExp(`^${escaped}\\s+${DONE}(?:[\\s,\\-:—.]+(.+))?$`, 'i'),
      new RegExp(`${DONE}\\s+${escaped}(?:[\\s,\\-:—.]+(.+))?$`, 'i'),
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        const procId = PROCEDURE_NAME_MAP[procName];
        const diary = (m[1] || '').trim();
        console.log('[intentParser] Matched MARK_COMPLETED:', { procedure: procId, diary });
        return {
          intent: 'MARK_COMPLETED',
          raw: transcript,
          confidence: 0.9,
          procedure: procId,
          diary: diary || undefined,
        };
      }
    }
  }

  // Выбор даты в журнале процедур: "день 3", "день два", "покажи день 3", "следующий день", "предыдущий день"
  const NUMBER_WORDS: Record<string, number> = {
    'один': 1, 'два': 2, 'три': 3, 'четыре': 4, 'пять': 5,
    'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10,
  };
  const dateMatch = text.match(/(?:покажи\s+)?день\s+(\d+|[а-яё]+)|(?:перейди\s+)?(?:на\s+)?(?:следующий|следующую)\s+день|(?:перейди\s+)?(?:на\s+)?(?:предыдущий|предыдущую)\s+день/i);
  if (dateMatch) {
    let targetDay: number | 'next' | 'prev' | undefined;
    if (dateMatch[1]) {
      const dayStr = dateMatch[1].toLowerCase();
      if (dayStr in NUMBER_WORDS) {
        targetDay = NUMBER_WORDS[dayStr];
      } else {
        targetDay = parseInt(dayStr, 10);
      }
    } else if (dateMatch[0].includes('следующ')) {
      targetDay = 'next';
    } else if (dateMatch[0].includes('предыдущ')) {
      targetDay = 'prev';
    }
    console.log('[intentParser] Matched SELECT_DATE:', targetDay);
    return {
      intent: 'SELECT_DATE',
      raw: transcript,
      confidence: 0.9,
      targetDay,
    };
  }

  // "запиши в дневник <процедура>: <текст>" / "дневник <процедура> <текст>"
  const diaryMatch = text.match(/(?:запиши\s+в\s+дневник|дневник(?:а|е)?)\s+([а-яё]+)(?:[\s,:\-—]+)(.+)/i);
  if (diaryMatch) {
    const procKey = diaryMatch[1].toLowerCase();
    const diaryText = diaryMatch[2].trim();
    if (PROCEDURE_NAME_MAP[procKey]) {
      const procId = PROCEDURE_NAME_MAP[procKey];
      console.log('[intentParser] Matched diary-only MARK_COMPLETED:', { procedure: procId, diary: diaryText });
      return {
        intent: 'MARK_COMPLETED',
        raw: transcript,
        confidence: 0.85,
        procedure: procId,
        diary: diaryText,
      };
    }
  }

  // Парсинг команды автогенерации расписания
  const scheduleMatch = text.match(/(?:сгенерируй|создай|построй|сформируй|сделай)\s+(?:умное\s+)?расписание/i);
  if (scheduleMatch) {
    console.log('[intentParser] Matched GENERATE_SCHEDULE command');
    return {
      intent: 'GENERATE_SCHEDULE',
      raw: transcript,
      confidence: 0.9,
    };
  }

  // Парсинг навигационных команд (перед коротким форматом)
  const navMatch = text.match(/(?:открой|перейди к|перейди в|перейти к|перейти в|покажи|переключись на|зайди в)\s+(.+)/i);
  if (navMatch && navMatch[1]) {
    const targetText = navMatch[1].toLowerCase().trim();
    const normalizedTarget = targetText.replace(/ё/g, 'е');

    // Ищем соответствие в маппинге вкладок
    for (const [tabName, route] of Object.entries(TAB_NAME_MAP)) {
      const normalizedTabName = tabName.replace(/ё/g, 'е');
      if (normalizedTarget.includes(normalizedTabName) || normalizedTabName.includes(normalizedTarget)) {
        console.log('[intentParser] Matched navigation command:', { target: targetText, tabName, route });
        return {
          intent: 'NAVIGATE',
          raw: transcript,
          confidence: 0.85,
          target: route,
        };
      }
    }

    console.log('[intentParser] Navigation command matched but no tab found:', targetText);
  }

  // Парсинг команд редактирования
  // EDIT_FIELD: исправь, измени, поменяй, замени, обнови, поставь, впиши, напиши
  // Улучшенный regex для коротких названий полей (например, "ин" вместо "иин")
  const editMatch = text.match(/(?:исправь|измени|поменяй|замени|обнови|поставь|впиши|напиши|запиши|установи)\s+(?:поле\s+)?(\S+)\s+(?:на|в)\s+(.+)/i);
  if (editMatch) {
    const rawValue = editMatch[2];
    // Объединяем числа, разделенные пробелами
    const value = rawValue.replace(/\s+/g, '');
    console.log('[intentParser] Matched EDIT_FIELD with verb:', { field: editMatch[1], value, normalizedField: normalizeFieldName(editMatch[1]) });
    return {
      intent: 'EDIT_FIELD',
      raw: transcript,
      confidence: 0.85,
      field: normalizeFieldName(editMatch[1]),
      value,
    };
  }

  // Также поддерживаем формат без глагола: "[поле] [значение]"
  // Например: "иин 123456789012", "диагноз бронхит", "дата поступления 15 апреля 2026"
  // Сначала пробуем найти известные многословные названия полей
  for (const [russianField, englishField] of Object.entries(FIELD_NAME_MAP)) {
    if (text.startsWith(russianField + ' ')) {
      let value = text.slice(russianField.length).trim();
      // Удаляем пробелы если значение состоит только из цифр (для ИИН)
      const isNumericOnly = /^\d+(\s+\d+)*$/.test(value);
      if (isNumericOnly) {
        value = value.replace(/\s+/g, '');
      }
      console.log('[intentParser] Matched multi-word field:', { field: englishField, value, isNumericOnly });
      return {
        intent: 'EDIT_FIELD',
        raw: transcript,
        confidence: 0.75,
        field: englishField,
        value,
      };
    }
    // Также пробуем если поле находится в начале текста (например, "ин пациента 123")
    // Но не в середине, чтобы избежать ложных срабатываний
    const match = text.match(new RegExp('^' + russianField + '\\s+(.+)'));
    if (match) {
      let value = match[1].trim();
      // Для ИИН полей извлекаем только числа
      if (englishField === 'patient.iin') {
        const numbers = value.match(/\d+(\s+\d+)*/g);
        if (numbers) {
          value = numbers.join(' ').replace(/\s+/g, '');
        }
      }
      // Удаляем пробелы если значение состоит только из цифр (для ИИН)
      const isNumericOnly = /^\d+(\s+\d+)*$/.test(value);
      if (isNumericOnly) {
        value = value.replace(/\s+/g, '');
      }
      console.log('[intentParser] Matched multi-word field (start):', { field: englishField, value, isNumericOnly });
      return {
        intent: 'EDIT_FIELD',
        raw: transcript,
        confidence: 0.75,
        field: englishField,
        value,
      };
    }
  }

  // Если многословные поля не найдены, пробуем однословный формат
  const shortEditMatch = text.match(/^(\S+)\s+(.+)$/i);
  if (shortEditMatch) {
    const potentialField = normalizeFieldName(shortEditMatch[1]);
    console.log('[intentParser] Trying short format:', { firstWord: shortEditMatch[1], potentialField, isMapped: potentialField !== shortEditMatch[1] });
    // Проверяем, что первое слово является известным полем
    if (potentialField !== shortEditMatch[1]) {
      const rawValue = shortEditMatch[2];
      // Удаляем пробелы только если значение состоит из цифр (для ИИН и других числовых полей)
      const isNumericOnly = /^\d+(\s+\d+)*$/.test(rawValue);
      const value = isNumericOnly ? rawValue.replace(/\s+/g, '') : rawValue;
      console.log('[intentParser] Matched EDIT_FIELD without verb:', { field: potentialField, value, isNumericOnly });
      return {
        intent: 'EDIT_FIELD',
        raw: transcript,
        confidence: 0.75,
        field: potentialField,
        value,
      };
    }
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
