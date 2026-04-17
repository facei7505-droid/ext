/**
 * Orchestrator — конечный автомат сессии RPA-агента.
 *
 * Состояния:
 *   IDLE             — нет активной задачи; принимаем входящие интенты.
 *   LISTENING        — пользователь диктует (триггерится из voice-слоя content-script).
 *   PROCESSING_LLM   — отправили транскрипт в LLM, ждём StructuredVisit.
 *   FILLING_DOM      — заполняем форму через серию rpa:fillField.
 *   SCHEDULING       — POST к scheduler-service.
 *
 * Переходы:
 *   IDLE         → PROCESSING_LLM   (transcript: DICTATION)
 *   IDLE         → SCHEDULING       (intent: SCHEDULE | message: generateSchedule)
 *   PROCESSING_LLM → FILLING_DOM    (LLM ответил)
 *   PROCESSING_LLM → IDLE (+speak ошибки)
 *   FILLING_DOM  → IDLE             (после серии fillField)
 *   SCHEDULING   → IDLE (+speak результата)
 *
 * Любой переход синхронизируется с виджетом через rpa:setAgentStatus.
 * Любая ошибка озвучивается через rpa:speak.
 *
 * MV3 service worker может уснуть → состояние храним в chrome.storage.session.
 * In-flight операции (LLM/HTTP) пересоздаются при следующем сообщении: мы
 * не пытаемся их «продолжить» после пробуждения — это нормально для
 * интерактивного агента.
 */

import type { TranscriptMsg, BackgroundToContentMsg, RpaResult } from '@/shared/messages';
import { structureForm, LlmError } from '@/ai';
import { generateSchedule, SchedulerError } from './schedulerClient';
import type {
  ProcedureKind,
  ProcedureRequestDto,
  ScheduleGenerateResponseDto,
} from './schedulerClient';
import { mapVisitToCommands, type MappedProcedure } from './visitMapper';
import { mapEpicrisisToCommands } from './epicrisisMapper';

export type FsmState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING_LLM'
  | 'FILLING_DOM'
  | 'SCHEDULING';

const STATE_KEY = 'rpa.fsm.state';
const PRESCRIPTIONS_KEY = 'rpa.fsm.prescriptions';
const LOG_KEY = 'rpa.fsm.log';
const LOG_MAX_ENTRIES = 50;

interface AgentLogEntry {
  ts: number;
  state: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

async function appendLog(entry: AgentLogEntry): Promise<void> {
  const r = await chrome.storage.session.get(LOG_KEY);
  const list = (r[LOG_KEY] as AgentLogEntry[] | undefined) ?? [];
  list.unshift(entry); // последние сверху
  if (list.length > LOG_MAX_ENTRIES) list.length = LOG_MAX_ENTRIES;
  await chrome.storage.session.set({ [LOG_KEY]: list });
}

/** Фоновые отправители — позволяет тестам подменять transport. */
export interface OrchestratorDeps {
  sendToTab: <T = unknown>(msg: BackgroundToContentMsg) => Promise<RpaResult<T>>;
}

export class Orchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  /** Текущее состояние из storage (worker мог уснуть). */
  async getState(): Promise<FsmState> {
    const r = await chrome.storage.session.get(STATE_KEY);
    return ((r[STATE_KEY] as FsmState | undefined) ?? 'IDLE');
  }

  private async setState(s: FsmState, message?: string): Promise<void> {
    await chrome.storage.session.set({ [STATE_KEY]: s });
    await appendLog({
      ts: Date.now(),
      state: s,
      message: message ?? `→ ${s}`,
      level: 'info',
    });
    const status =
      s === 'IDLE' ? 'idle'
      : s === 'LISTENING' ? 'listening'
      : s === 'PROCESSING_LLM' ? 'thinking'
      : s === 'FILLING_DOM' ? 'filling'
      : 'thinking';
    await this.deps
      .sendToTab({ type: 'rpa:setAgentStatus', status })
      .catch(() => { /* tab may be gone */ });
  }

  /* ──────────────────────── Публичные обработчики ──────────────────────── */

  /** Обработать транскрипт от content-script. */
  async handleTranscript(msg: TranscriptMsg): Promise<RpaResult> {
    const state = await this.getState();
    if (state !== 'IDLE' && state !== 'LISTENING') {
      // Уже что-то делаем — игнорируем доп. транскрипты, но не падаем.
      console.warn('[orchestrator] transcript ignored, state=', state);
      return { ok: true };
    }

    // Голосовая команда «сформируй расписание» эквивалентна generateSchedule.
    if (msg.intent === 'SCHEDULE') {
      return this.handleGenerateSchedule();
    }

    // Голосовая навигация: «открой эпикриз» / «перейди к расписанию».
    if (msg.intent === 'NAVIGATE') {
      return this.runNavigateFlow(msg.arg);
    }

    // «Найди пациента Иванова» / «Открой первичный приём Иванова».
    if (msg.intent === 'SEARCH_PATIENT') {
      return this.runSearchPatientFlow(msg.payload);
    }

    // Все прочие финальные транскрипты считаем диктовкой → LLM.
    return this.runLlmFlow(msg.transcript);
  }

  /** Обработать запрос «сгенерировать расписание». */
  async handleGenerateSchedule(): Promise<RpaResult> {
    return this.runScheduleFlow();
  }

  /**
   * Семантическая навигация по SPA КМИС без URL-хардкода.
   * arg — ключ маршрута ('intake' | 'epicrisis' | 'schedule') из intentParser.
   * Агент находит в сайдбаре ссылку с data-rpa-action="nav:{route}" и кликает.
   */
  private async runNavigateFlow(arg: string | undefined): Promise<RpaResult> {
    const ROUTES = ['intake', 'epicrisis', 'schedule'] as const;
    const LABELS: Record<(typeof ROUTES)[number], string> = {
      intake: 'Первичный приём',
      epicrisis: 'Эпикриз',
      schedule: 'Расписание',
    };
    const route = (ROUTES as readonly string[]).includes(arg ?? '')
      ? (arg as (typeof ROUTES)[number])
      : null;

    if (!route) {
      await this.deps
        .sendToTab({ type: 'rpa:speak', text: 'Не поняла, куда перейти.' })
        .catch(() => {});
      return { ok: false, error: `unknown route: ${arg}`, code: 'BAD_ARG' };
    }

    const action = `nav:${route}`;
    const r = await this.deps.sendToTab({ type: 'rpa:clickAction', action });
    if (!r.ok) {
      await this.failAndSpeak('Не удалось перейти.', r.error ?? 'clickAction failed');
      return r;
    }

    await appendLog({
      ts: Date.now(),
      state: 'IDLE',
      message: `Навигация → ${LABELS[route]}`,
      level: 'info',
    });
    await this.deps
      .sendToTab({ type: 'rpa:speak', text: `Открываю ${LABELS[route]}.` })
      .catch(() => {});
    return { ok: true };
  }

  /**
   * «Найди пациента / открой первичный приём <ФИО>».
   *
   * Важно: мы не знаем заранее, на какой странице находится список пациентов
   * в боевом Дамумеде — поэтому вместо хардкода страницы просим content-script
   * найти DOM-элемент по тексту фамилии где угодно в документе. Если совпадение
   * отсутствует — голосом сообщаем об этом врачу.
   */
  private async runSearchPatientFlow(payload: string | undefined): Promise<RpaResult> {
    const name = (payload ?? '').trim();
    if (!name) {
      await this.deps
        .sendToTab({ type: 'rpa:speak', text: 'Не расслышала фамилию пациента.' })
        .catch(() => {});
      return { ok: false, error: 'empty patient name', code: 'BAD_ARG' };
    }

    await appendLog({
      ts: Date.now(),
      state: 'IDLE',
      message: `Поиск пациента: «${name}»`,
      level: 'info',
    });

    const r = await this.deps.sendToTab({ type: 'rpa:searchAndClick', text: name });
    if (!r.ok) {
      await this.deps
        .sendToTab({ type: 'rpa:speak', text: `Пациент ${name} не найден на странице.` })
        .catch(() => {});
      await appendLog({
        ts: Date.now(),
        state: 'IDLE',
        message: `Пациент «${name}» не найден`,
        level: 'warn',
      });
      return r;
    }

    await this.deps
      .sendToTab({ type: 'rpa:speak', text: `Открываю карту пациента ${name}.` })
      .catch(() => {});
    return { ok: true };
  }

  /* ──────────────────────── Внутренние flow ──────────────────────── */

  private async runLlmFlow(transcript: string): Promise<RpaResult> {
    await this.setState(
      'PROCESSING_LLM',
      `Транскрипт: «${transcript.slice(0, 60)}${transcript.length > 60 ? '…' : ''}»`,
    );
    let formResponse;
    try {
      formResponse = await structureForm({ transcript });
    } catch (err) {
      await this.failAndSpeak(
        err instanceof LlmError && err.code === 'CONFIG'
          ? 'LLM не настроен. Откройте параметры расширения.'
          : 'Не удалось обработать речь. Проверьте подключение к LLM.',
        err,
      );
      return { ok: false, error: (err as Error).message, code: 'UNKNOWN' };
    }

    // Выбираем маппер в зависимости от типа формы.
    let commands;
    let prescriptions: MappedProcedure[] = [];
    if (formResponse.formType === 'intake' && formResponse.intake) {
      const mapped = mapVisitToCommands(formResponse.intake);
      commands = mapped.commands;
      prescriptions = mapped.prescriptions;
    } else if (formResponse.formType === 'epicrisis' && formResponse.epicrisis) {
      const mapped = mapEpicrisisToCommands(formResponse.epicrisis);
      commands = mapped.commands;
      // Для эпикриза назначения не сохраняем — scheduling не нужен.
    } else {
      await this.deps.sendToTab({
        type: 'rpa:speak',
        text: 'Не удалось определить тип формы или извлечь данные.',
      }).catch(() => {});
      await this.setState('IDLE');
      return { ok: true, data: { filled: 0 } };
    }

    await this.setState('FILLING_DOM', `Получено ${commands.length} полей от LLM`);

    if (commands.length === 0) {
      await this.deps.sendToTab({
        type: 'rpa:speak',
        text: 'Не удалось извлечь данные из речи.',
      }).catch(() => {});
      await this.setState('IDLE');
      return { ok: true, data: { filled: 0 } };
    }

    let filled = 0;
    let failed = 0;
    for (const cmd of commands) {
      const r = await this.deps.sendToTab(cmd);
      if (r.ok) filled++;
      else {
        failed++;
        console.warn('[orchestrator] fillField failed', cmd.field, r.error);
      }
    }

    // Сохраняем назначения — нужны для последующего scheduling (только для intake).
    if (formResponse.formType === 'intake') {
      await chrome.storage.session.set({ [PRESCRIPTIONS_KEY]: prescriptions });
    }

    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: failed === 0
        ? `Заполнено ${filled} полей.`
        : `Заполнено ${filled} полей, ${failed} с ошибкой.`,
    }).catch(() => {});

    await this.setState('IDLE', `Заполнено ${filled}/${commands.length} полей`);
    return { ok: true, data: { filled, failed } };
  }

  private async runScheduleFlow(): Promise<RpaResult<ScheduleGenerateResponseDto>> {
    await this.setState('SCHEDULING', 'Запрос к scheduler-service');

    const stored = await chrome.storage.session.get(PRESCRIPTIONS_KEY);
    const prescriptions = (stored[PRESCRIPTIONS_KEY] as MappedProcedure[] | undefined) ?? [];

    const procedures = mapPrescriptionsToProcedures(prescriptions);
    if (procedures.length === 0) {
      await this.failAndSpeak(
        'Нет назначенных процедур. Сначала заполните прием.',
        new Error('no procedures'),
      );
      return { ok: false, error: 'no procedures', code: 'BAD_ARG' };
    }

    const payload = {
      patient_id: 'P-000001', // TODO(orchestrator): извлекать из CRM через rpa:queryDom
      start_date: nextWorkingDayIso(),
      procedures,
    };

    let response: ScheduleGenerateResponseDto;
    try {
      response = await generateSchedule(payload);
    } catch (err) {
      const text =
        err instanceof SchedulerError && err.kind === 'NETWORK'
          ? 'Ошибка соединения с сервером расписаний.'
          : err instanceof SchedulerError && err.kind === 'TIMEOUT'
          ? 'Сервер расписаний не отвечает.'
          : 'Не удалось сформировать расписание.';
      await this.failAndSpeak(text, err);
      return { ok: false, error: (err as Error).message, code: 'UNKNOWN' };
    }

    // Озвучиваем сводку.
    const summary = `Расписание готово. ${response.slots.length} сеансов на ${response.total_days} дней.`;
    await this.deps.sendToTab({ type: 'rpa:speak', text: summary }).catch(() => {});

    // Сохраняем для UI (расширение покажет в popup/sidepanel).
    await chrome.storage.session.set({ 'rpa.lastSchedule': response });

    await this.setState('IDLE', `Расписание: ${response.slots.length} сеансов / ${response.total_days} дней`);
    return { ok: true, data: response };
  }

  /** Озвучить ошибку и вернуться в IDLE. */
  private async failAndSpeak(text: string, err: unknown): Promise<void> {
    console.error('[orchestrator]', text, err);
    // В попап-лог пишем детали (включая HTTP-код), врачу — краткое голосом.
    const detail = err instanceof Error ? err.message : String(err);
    await appendLog({
      ts: Date.now(),
      state: 'ERROR',
      message: `${text} — ${detail}`,
      level: 'error',
    });
    await this.deps.sendToTab({ type: 'rpa:speak', text }).catch(() => {});
    await this.setState('IDLE');
  }
}

/* ──────────────────────── Helpers ──────────────────────── */

const KIND_KEYWORDS: Array<[ProcedureKind, RegExp]> = [
  ['lfk', /\bлфк|лечебн[а-я]+\s+физ|гимнастик/i],
  ['massage', /\bмассаж/i],
  ['physio', /\bфизио|узи|увч|магнит|электрофорез|ингаляц/i],
  ['injection', /\bинъекц|укол|капельниц|внутримышечн|внутривенн/i],
  ['lab', /\bанализ|лабораторн|кровь\s+на/i],
  ['consultation', /\bконсульт|осмотр\s+врача|приём\s+специалист/i],
];

function classifyProcedure(text: string): ProcedureKind | null {
  for (const [kind, re] of KIND_KEYWORDS) {
    if (re.test(text)) return kind;
  }
  return null;
}

/**
 * Превратить назначения LLM в payload для scheduler-service.
 * Берём только kind='procedure'. Остальные (medication/regimen/...) пропускаем.
 */
export function mapPrescriptionsToProcedures(
  prescriptions: MappedProcedure[],
): ProcedureRequestDto[] {
  const result: ProcedureRequestDto[] = [];
  for (const p of prescriptions) {
    if (p.kind !== 'procedure' && p.kind !== 'referral') continue;
    const kind = classifyProcedure(p.name);
    if (!kind) continue; // не смогли классифицировать — пропускаем
    result.push({
      kind,
      name: p.name,
      sessions: kind === 'consultation' || kind === 'lab' ? 1 : 9,
      duration_min: kind === 'injection' ? 15 : kind === 'massage' ? 40 : 30,
    });
  }
  return result;
}

/** Ближайший рабочий день (Пн–Пт). */
export function nextWorkingDayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Если сегодня после 16:00 — берём завтра.
  if (new Date().getHours() >= 16) d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
