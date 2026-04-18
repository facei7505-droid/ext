/**
 * Content Script.
 * Подключён через manifest world:'ISOLATED' — у скрипта собственный realm,
 * общий DOM со страницей, но независимые JS-глобалы → нет конфликтов с КМИС.
 *
 * Обязанности:
 *  1) Сообщить background о готовности страницы (+ текущий RPA-маршрут).
 *  2) Обработать команды rpa:fillField / rpa:clickAction / rpa:waitFor / rpa:queryDom.
 */

import {
  findElement,
  typeIntoElement,
  clickElement,
  findAndClickByText,
  sleep,
} from './domHelpers';
import { fieldSelector, actionSelector, DamumedFieldMap } from '@/shared/selectors';
import type {
  BackgroundToContentMsg,
  ContentReadyMsg,
  RpaResult,
  TranscriptMsg,
} from '@/shared/messages';
import { initProactive } from './proactive';

/* -------------------- утилиты -------------------- */

/** Ожидание появления элемента по селектору с таймаутом */
async function waitForSelector(
  selector: string,
  { timeoutMs = 5000 }: { timeoutMs?: number } = {},
): Promise<HTMLElement> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
    await sleep(50);
  }
  throw new Error(`Element not found: ${selector} (timeout ${timeoutMs}ms)`);
}

/** Конвертирует значения select из русского в английский для Дамумед */
function convertSelectValue(field: string, value: string): string {
  const valueLower = value.toLowerCase().trim();

  // Конвертация для отделения
  if (field === 'patient.department') {
    const departmentMap: Record<string, string> = {
      'терапевтическое': 'therapeutic',
      'неврологическое': 'neurology',
      'детское': 'pediatric',
    };
    return departmentMap[valueLower] || value;
  }

  // Конвертация для давления: "120 на 80" → "120/80"
  if (field === 'visit.bloodPressure') {
    return value.replace(/\s+на\s+/i, '/').replace(/\s+/g, '/');
  }

  // Конвертация для группы инвалидности
  if (field === 'epicrisis.disabilityGroup') {
    const disabilityMap: Record<string, string> = {
      'первая': '1',
      'вторая': '2',
      'третья': '3',
      'нет': '0',
      'без группы': '0',
    };
    return disabilityMap[valueLower] || value;
  }

  // Конвертация для типа диагноза
  if (field === 'diagnoses.new.type') {
    const diagnosisTypeMap: Record<string, string> = {
      // Основной диагноз
      'основной': 'primary',
      'основной диагноз': 'primary',
      'первичный': 'primary',
      'первичный диагноз': 'primary',
      'главный': 'primary',
      'главный диагноз': 'primary',
      'основное': 'primary',
      'основное заболевание': 'primary',
      'ведущий': 'primary',
      'ведущий диагноз': 'primary',
      // Сопутствующий диагноз
      'сопутствующий': 'secondary',
      'сопутствующий диагноз': 'secondary',
      'вторичный': 'secondary',
      'вторичный диагноз': 'secondary',
      'дополнительный': 'secondary',
      'дополнительный диагноз': 'secondary',
      'фоновый': 'secondary',
      'фоновый диагноз': 'secondary',
      // Осложнение
      'осложнение': 'complication',
      'осложнения': 'complication',
      'осложнении': 'complication',
      'осложнений': 'complication',
      'осложнение основного': 'complication',
      'осложнение заболевания': 'complication',
      'осложнение основного диагноза': 'complication',
    };

    const converted = diagnosisTypeMap[valueLower] || value;

    // Проверяем реальные значения в select элементе
    const selector = DamumedFieldMap[field] || field;
    if (selector) {
      const element = document.querySelector<HTMLSelectElement>(selector);
      if (element && element.tagName === 'SELECT') {
        const options = Array.from(element.options).map(opt => ({
          value: opt.value.toLowerCase(),
          text: opt.text.toLowerCase(),
        }));

        // Ищем точное совпадение по value
        const exactMatch = options.find(opt => opt.value === converted.toLowerCase());
        if (exactMatch) {
          console.log('[rpa] Found exact match for diagnosis type:', exactMatch.value);
          return exactMatch.value;
        }

        // Ищем частичное совпадение по value
        const partialMatch = options.find(opt => opt.value.includes(converted.toLowerCase()) || converted.toLowerCase().includes(opt.value));
        if (partialMatch) {
          console.log('[rpa] Found partial match for diagnosis type:', partialMatch.value);
          return partialMatch.value;
        }

        // Ищем совпадение по тексту опции
        const textMatch = options.find(opt => opt.text.includes(converted.toLowerCase()) || converted.toLowerCase().includes(opt.text));
        if (textMatch) {
          console.log('[rpa] Found text match for diagnosis type:', textMatch.value);
          return textMatch.value;
        }

        console.log('[rpa] No match found for diagnosis type:', converted, 'Available options:', options);
      }
    }

    return converted;
  }

  // Конвертация для типа назначения
  if (field === 'assignments.new.type') {
    const assignmentTypeMap: Record<string, string> = {
      'лекарственный': 'medication',
      'лекарственный препарат': 'medication',
      'препарат': 'medication',
      'лекарство': 'medication',
      'медикамент': 'medication',
      'медикаментозный': 'medication',
      'процедура': 'procedure',
      'процедуры': 'procedure',
      'исследование': 'investigation',
      'обследование': 'investigation',
      'анализ': 'analysis',
      'анализы': 'analysis',
      'диагностика': 'diagnostics',
      'операция': 'surgery',
      'хирургический': 'surgery',
    };

    const converted = assignmentTypeMap[valueLower] || value;

    // Проверяем реальные значения в select элементе
    const selector = DamumedFieldMap[field] || field;
    if (selector) {
      const element = document.querySelector<HTMLSelectElement>(selector);
      if (element && element.tagName === 'SELECT') {
        const options = Array.from(element.options).map(opt => ({
          value: opt.value.toLowerCase(),
          text: opt.text.toLowerCase(),
        }));

        // Ищем точное совпадение по value
        const exactMatch = options.find(opt => opt.value === converted.toLowerCase());
        if (exactMatch) {
          console.log('[rpa] Found exact match for assignment type:', exactMatch.value);
          return exactMatch.value;
        }

        // Ищем частичное совпадение по value
        const partialMatch = options.find(opt => opt.value.includes(converted.toLowerCase()) || converted.toLowerCase().includes(opt.value));
        if (partialMatch) {
          console.log('[rpa] Found partial match for assignment type:', partialMatch.value);
          return partialMatch.value;
        }

        // Ищем совпадение по тексту опции
        const textMatch = options.find(opt => opt.text.includes(converted.toLowerCase()) || converted.toLowerCase().includes(opt.text));
        if (textMatch) {
          console.log('[rpa] Found text match for assignment type:', textMatch.value);
          return textMatch.value;
        }

        console.log('[rpa] No match found for assignment type:', converted, 'Available options:', options);
      }
    }

    return converted;
  }

  return value;
}

/** Парсит дату из различных форматов в формат YYYY-MM-DD */
function parseDate(value: string): string {
  const text = value.toLowerCase().trim();

  // Если уже в формате YYYY-MM-DD, возвращаем как есть
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  // Если в формате DD.MM.YYYY или DD/MM/YYYY
  const dotMatch = text.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (dotMatch) {
    const [, day, month, year] = dotMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Месяцы на русском
  const months: Record<string, number> = {
    'января': 0, 'январь': 0,
    'февраля': 1, 'февраль': 1,
    'марта': 2, 'март': 2,
    'апреля': 3, 'апрель': 3,
    'мая': 4,
    'июня': 5, 'июнь': 5,
    'июля': 6, 'июль': 6,
    'августа': 7, 'август': 7,
    'сентября': 8, 'сентябрь': 8,
    'октября': 9, 'октябрь': 9,
    'ноября': 10, 'ноябрь': 10,
    'декабря': 11, 'декабрь': 11,
  };

  // Парсим форматы типа "15 июля 2026", "пятнадцатое июля 2026 года"
  // Сначала пробуем с пробелами
  const words = text.split(/\s+/);
  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  for (const word of words) {
    // Парсим день (число или текстовое число)
    const numberWords: Record<string, number> = {
      'первое': 1, 'второе': 2, 'третье': 3, 'четвертое': 4, 'пятое': 5,
      'шестое': 6, 'седьмое': 7, 'восьмое': 8, 'девятое': 9, 'десятое': 10,
      'одиннадцатое': 11, 'двенадцатое': 12, 'тринадцатое': 13, 'четырнадцатое': 14,
      'пятнадцатое': 15, 'шестнадцатое': 16, 'семнадцатое': 17, 'восемнадцатое': 18,
      'девятнадцатое': 19, 'двадцатое': 20, 'двадцать первое': 21, 'двадцать второе': 22,
      'двадцать третье': 23, 'двадцать четвертое': 24, 'двадцать пятое': 25,
      'двадцать шестое': 26, 'двадцать седьмое': 27, 'двадцать восьмое': 28,
      'двадцать девятое': 29, 'тридцатое': 30, 'тридцать первое': 31,
    };

    if (numberWords[word]) {
      day = numberWords[word];
    } else if (/^\d{1,2}$/.test(word)) {
      day = parseInt(word, 10);
    }

    // Парсим месяц
    if (months[word] !== undefined) {
      month = months[word];
    }

    // Парсим год
    if (/^\d{4}$/.test(word)) {
      year = parseInt(word, 10);
    }
  }

  // Если не удалось с пробелами, пробуем без пробелов (например, "15апреля2026")
  if (day === null || month === null || year === null) {
    // Пробуем найти месяц в тексте
    for (const [monthName, monthNum] of Object.entries(months)) {
      if (text.includes(monthName)) {
        month = monthNum;
        // Извлекаем день и год из оставшегося текста
        const remainingText = text.replace(monthName, '').replace(/\s/g, '');
        const dayMatch = remainingText.match(/^(\d{1,2})/);
        const yearMatch = remainingText.match(/(\d{4})$/);
        if (dayMatch) day = parseInt(dayMatch[1], 10);
        if (yearMatch) year = parseInt(yearMatch[1], 10);
        break;
      }
    }
  }

  // Если год не указан, используем текущий год
  if (year === null) {
    year = new Date().getFullYear();
  }

  if (day !== null && month !== null && year !== null) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Если не удалось распарсить, возвращаем исходное значение
  return value;
}

/* -------------------- bootstrap -------------------- */

function getRpaRoute(): string | undefined {
  const el = document.querySelector<HTMLElement>('[data-rpa-route]');
  return el?.dataset.rpaRoute;
}

function notifyReady(): void {
  const msg: ContentReadyMsg = {
    type: 'rpa:contentReady',
    url: location.href,
    route: getRpaRoute(),
  };
  chrome.runtime.sendMessage(msg).catch(() => {
    /* background мог быть ещё не готов — неважно, следующий месседж пойдёт нормально */
  });
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  notifyReady();
} else {
  window.addEventListener('DOMContentLoaded', notifyReady, { once: true });
}

// Видеть rejection'ы, которые иначе показывались бы как "Uncaught (in promise) Object".
window.addEventListener('unhandledrejection', (ev) => {
  console.warn('[rpa] unhandledrejection:', ev.reason);
});

console.info('[rpa] content script loaded at', location.href);

/* -------------------- proactive voice layer -------------------- */

// Монтируем виджет + VoiceManager + FormWatcher один раз на страницу.
const proactive = initProactive({
  onFinalTranscript: (parsed) => {
    const msg: TranscriptMsg = {
      type: 'rpa:transcript',
      transcript: parsed.raw,
      intent: parsed.intent,
      confidence: parsed.confidence,
      field: parsed.field,
      value: parsed.value,
      deleteField: parsed.deleteField,
      addField: parsed.addField,
      addValue: parsed.addValue,
      target: parsed.target,
      url: parsed.url,
      targetDay: parsed.targetDay,
      procedure: parsed.procedure,
      diary: parsed.diary,
      commands: parsed.commands?.map(cmd => ({
        type: 'rpa:transcript',
        transcript: cmd.raw,
        intent: cmd.intent,
        confidence: cmd.confidence,
        field: cmd.field,
        value: cmd.value,
      })),
    };
    chrome.runtime.sendMessage(msg).catch(() => { /* background asleep */ });
  },
});

// Мост страница→TTS: страница может отправить запрос на озвучку двумя способами:
//   1. CustomEvent('rpa:tts-request', { detail: { text } })
//   2. window.postMessage({ __rpa_tts: true, text }, '*')   (гарантированно работает через isolated world)
let _lastTtsText = '';
let _lastTtsAt = 0;
function ttsSpeak(text: string | undefined): void {
  const trimmed = text?.trim();
  if (!trimmed) return;
  // Дедуп: CustomEvent и postMessage могут прийти одновременно от страницы.
  const now = Date.now();
  if (trimmed === _lastTtsText && now - _lastTtsAt < 500) {
    console.log('[rpa] TTS bridge dedup skip');
    return;
  }
  _lastTtsText = trimmed;
  _lastTtsAt = now;
  console.log('[rpa] TTS bridge received:', { text: trimmed, status: proactive.voice.status });
  proactive.voice.speak(trimmed)
    .then(() => console.log('[rpa] TTS bridge done'))
    .catch((err) => console.warn('[rpa] TTS bridge error:', err));
}

window.addEventListener('rpa:tts-request', (ev) => {
  ttsSpeak((ev as CustomEvent<{ text?: string }>).detail?.text);
});

window.addEventListener('message', (ev) => {
  if (ev.source !== window) return;
  const data = ev.data as { __rpa_tts?: boolean; text?: string } | null;
  if (!data || !data.__rpa_tts) return;
  ttsSpeak(data.text);
});

/* -------------------- команды -------------------- */

chrome.runtime.onMessage.addListener(
  (msg: BackgroundToContentMsg, _sender, sendResponse: (r: RpaResult) => void) => {
    // Возвращаем true, чтобы Chrome ждал async-ответ.
    handleCommand(msg)
      .then(sendResponse)
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          code: 'UNKNOWN',
        }),
      );
    return true;
  },
);

/** Рисует красную звёздочку в верхнем углу элемента (для обязательных полей). */
function markFieldAsRequired(el: HTMLElement): void {
  const parent = el.parentElement;
  if (!parent) return;

  // Идемпотентно — не дублируем
  if (parent.querySelector(':scope > [data-rpa-required-mark]')) return;

  const parentStyle = window.getComputedStyle(parent);
  if (parentStyle.position === 'static') {
    parent.style.position = 'relative';
  }

  const mark = document.createElement('span');
  mark.setAttribute('data-rpa-required-mark', '');
  mark.textContent = '*';
  mark.style.cssText = [
    'position:absolute',
    'top:-4px',
    'right:-4px',
    'color:#dc2626',
    'font-size:18px',
    'font-weight:700',
    'line-height:1',
    'z-index:9999',
    'pointer-events:none',
    'text-shadow:0 0 2px #fff',
  ].join(';');
  parent.appendChild(mark);
}

/** Список обязательных полей по формам. */
const REQUIRED_BY_FORM: Record<string, string[]> = {
  intake: [
    'patient.iin',
    'patient.admissionDate',
    'patient.department',
    'visit.diagnosis',
    'visit.complaints',
    'visit.anamnesis',
  ],
  epicrisis: [
    'epicrisis.finalDiagnosis',
    'epicrisis.treatmentResults',
  ],
  diary: [
    'diary.subjective',
    'diary.objective',
    'diary.assessment',
    'diary.plan',
  ],
  diagnoses: [
    'diagnoses.new.code',
    'diagnoses.new.name',
    'diagnoses.new.type',
  ],
  assignments: [
    'assignments.new.type',
    'assignments.new.name',
    'assignments.new.dosage',
    'assignments.new.frequency',
  ],
};

/** Проставляет звёздочки всем обязательным полям на странице. */
function applyRequiredMarks(): void {
  for (const fields of Object.values(REQUIRED_BY_FORM)) {
    for (const field of fields) {
      const sel = DamumedFieldMap[field];
      if (!sel) continue;
      const el = document.querySelector<HTMLElement>(sel);
      if (el) markFieldAsRequired(el);
    }
  }
}

// Применяем звёздочки при загрузке и наблюдаем за изменениями DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyRequiredMarks);
} else {
  applyRequiredMarks();
}

// Наблюдаем за динамическими изменениями (SPA навигация)
const requiredMarksObserver = new MutationObserver(() => {
  applyRequiredMarks();
});
requiredMarksObserver.observe(document.body, { childList: true, subtree: true });

/** Обработка навигации по вкладкам */
async function handleNavigation(target: string): Promise<RpaResult> {
  console.log('[rpa] handleNavigation:', target);

  // Маппинг маршрутов на текст вкладок для поиска в DOM
  const tabTextMap: Record<string, string[]> = {
    'intake': ['первичный осмотр', 'первичный прием', 'осмотр', 'прием'],
    'epicrisis': ['выписной эпикриз', 'эпикриз', 'выписка', 'заключение'],
    'diary': ['дневниковая запись', 'дневник', 'запись'],
    'diagnoses': ['диагнозы', 'диагностика'],
    'assignments': ['назначения', 'лекарства', 'медикаменты'],
    'schedule': ['умное расписание', 'расписание', 'график'],
    'services': ['журнал процедур', 'журнал', 'выполнение', 'журнал услуг'],
  };

  const searchTerms = tabTextMap[target] || [target];

  // Ищем вкладки по тексту
  for (const term of searchTerms) {
    const elements = Array.from(document.querySelectorAll('a, button, [role="tab"], li')).filter(
      (el) => el.textContent?.toLowerCase().includes(term.toLowerCase())
    );

    if (elements.length > 0) {
      const element = elements[0];
      console.log('[rpa] Found tab element:', element, 'for term:', term);
      const tabLabel = (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      (element as HTMLElement).click();
      return { ok: true, data: { label: tabLabel } };
    }
  }

  // Если не нашли по тексту, пробуем найти по data-rpa-route
  const routeElement = document.querySelector(`[data-rpa-route="${target}"]`);
  if (routeElement) {
    console.log('[rpa] Found element by data-rpa-route:', routeElement);
    const tabLabel = (routeElement.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    (routeElement as HTMLElement).click();
    return { ok: true, data: { label: tabLabel } };
  }

  return {
    ok: false,
    error: `Tab not found for target: ${target}`,
  };
}

async function handleCommand(msg: BackgroundToContentMsg): Promise<RpaResult> {
  switch (msg.type) {
    case 'rpa:ping':
      return { ok: true, data: { route: getRpaRoute(), url: location.href } };

    case 'rpa:navigate': {
      return handleNavigation(msg.target);
    }

    case 'rpa:fillField': {
      console.log('[rpa] fillField:', { form: msg.form, field: msg.field, value: msg.value });
      const startTime = Date.now();

      // Сначала пробуем найти через data-rpa-field
      let selector = fieldSelector(msg.form, msg.field);
      console.log('[rpa] trying selector:', selector);
      let el = await waitForSelector(selector, { timeoutMs: 1000 }).catch(() => null);

      // Если не нашли, пробуем использовать DamumedFieldMap
      if (!el && DamumedFieldMap[msg.field]) {
        selector = DamumedFieldMap[msg.field];
        console.log('[rpa] trying DamumedFieldMap selector:', selector);
        el = document.querySelector(selector);
      }

      if (!el) {
        console.error('[rpa] element not found for:', msg.field);
        return { ok: false, error: `field not found: ${msg.form}/${msg.field}`, code: 'NOT_FOUND' };
      }

      console.log('[rpa] element found in', Date.now() - startTime, 'ms');

      // Парсим дату если это поле типа date
      let value = msg.value;
      if (el instanceof HTMLInputElement && el.type === 'date') {
        value = parseDate(value);
        console.log('[rpa] parsed date:', value);
      }

      // Конвертируем значение для select элементов
      if (el instanceof HTMLSelectElement) {
        value = convertSelectValue(msg.field, value);
        console.log('[rpa] converted select value:', value);
      }

      // Убираем humanTyping для ускорения
      await typeIntoElement(el, value, { human: false });
      console.log('[rpa] field filled in', Date.now() - startTime, 'ms total');
      return { ok: true };
    }

    case 'rpa:clickAction': {
      const el = document.querySelector<HTMLElement>(actionSelector(msg.action));
      if (!el) return { ok: false, error: `action not found: ${msg.action}`, code: 'NOT_FOUND' };
      clickElement(el);
      return { ok: true };
    }

    case 'rpa:waitFor': {
      try {
        await waitForSelector(msg.selector, { timeoutMs: msg.timeoutMs });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message, code: 'TIMEOUT' };
      }
    }

    case 'rpa:queryDom': {
      let el: HTMLElement | null = null;
      if (msg.selector) el = findElement({ by: 'selector', selector: msg.selector });
      else if (msg.form && msg.field) el = findElement({ by: 'field', form: msg.form, field: msg.field });
      if (!el) return { ok: false, error: 'no element', code: 'NOT_FOUND' };
      const value =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
          ? el.value
          : el.textContent?.trim() ?? '';
      return { ok: true, data: { value, tag: el.tagName.toLowerCase() } };
    }

    case 'rpa:speak': {
      try {
        await proactive.voice.speak(msg.text);
      } catch (err) {
        console.warn('[rpa] Speech synthesis error:', err);
      }
      return { ok: true };
    }

    case 'rpa:setAgentStatus': {
      proactive.voice.setStatus(msg.status);
      return { ok: true };
    }

    case 'rpa:searchAndClick': {
      const el = findAndClickByText(msg.text, msg.containerSelector);
      if (!el) {
        return {
          ok: false,
          error: `no DOM node matches text "${msg.text}"`,
          code: 'NOT_FOUND',
        };
      }
      return {
        ok: true,
        data: {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? '').trim().slice(0, 120),
        },
      };
    }

    case 'rpa:checkRequired': {
      const required = REQUIRED_BY_FORM[msg.form] || [];
      const missing: string[] = [];
      for (const field of required) {
        const sel = DamumedFieldMap[field];
        if (!sel) continue;
        const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(sel);
        const val = el?.value?.trim() || '';
        if (!val) missing.push(field);
      }
      return { ok: true, data: { missing } };
    }

    case 'rpa:executeJs': {
      try {
        const result = eval(msg.js);
        return { ok: true, data: result };
      } catch (err) {
        return { ok: false, error: (err as Error).message, code: 'UNKNOWN' };
      }
    }

    default: {
      const exhaustive: never = msg;
      return { ok: false, error: `unknown message: ${JSON.stringify(exhaustive)}`, code: 'BAD_ARG' };
    }
  }
}
