/**
 * Orchestrator — упрощённый конечный автомат для заполнения формы первичного приёма.
 *
 * Состояния:
 *   IDLE             — нет активной задачи; принимаем входящие транскрипты.
 *   LISTENING        — пользователь диктует (триггерится из voice-слоя content-script).
 *   PROCESSING_LLM   — отправили транскрипт в LLM, ждём структурированные данные.
 *   FILLING_DOM      — заполняем форму через серию rpa:fillField.
 *
 * Переходы:
 *   IDLE         → PROCESSING_LLM   (transcript: DICTATION)
 *   PROCESSING_LLM → FILLING_DOM    (LLM ответил)
 *   PROCESSING_LLM → IDLE (+speak ошибки)
 *   FILLING_DOM  → IDLE             (после серии fillField)
 *
 * Любой переход синхронизируется с виджетом через rpa:setAgentStatus.
 * Любая ошибка озвучивается через rpa:speak.
 */

import type { TranscriptMsg, BackgroundToContentMsg, RpaResult } from '@/shared/messages';
import { structureForm, LlmError } from '@/ai';
import { mapVisitToCommands } from './visitMapper';

export type FsmState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING_LLM'
  | 'FILLING_DOM';

const STATE_KEY = 'rpa.fsm.state';
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
  list.unshift(entry);
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
      : 'filling';
    await this.deps
      .sendToTab({ type: 'rpa:setAgentStatus', status })
      .catch(() => { /* tab may be gone */ });
  }

  /* ──────────────────────── Публичные обработчики ──────────────────────── */

  /** Обработать транскрипт от content-script. */
  async handleTranscript(msg: TranscriptMsg): Promise<RpaResult> {
    const state = await this.getState();
    if (state !== 'IDLE' && state !== 'LISTENING') {
      console.warn('[orchestrator] transcript ignored, state=', state);
      return { ok: true };
    }

    // CONFIRM и CANCEL обрабатываются локально в content script (askConfirmation)
    if (msg.intent === 'CONFIRM' || msg.intent === 'CANCEL') {
      return { ok: true };
    }

    // Команды редактирования
    if (msg.intent === 'EDIT_FIELD' && msg.field && msg.value) {
      return this.handleEditField(msg.field, msg.value);
    }

    if (msg.intent === 'DELETE_FIELD' && msg.deleteField) {
      return this.handleDeleteField(msg.deleteField);
    }

    if (msg.intent === 'ADD_FIELD' && msg.addField && msg.addValue) {
      return this.handleAddField(msg.addField, msg.addValue);
    }

    // Новые команды
    if (msg.intent === 'CLEAR_ALL') {
      return this.handleClearAll();
    }

    if (msg.intent === 'SHOW_FIELDS') {
      return this.handleShowFields();
    }

    if (msg.intent === 'HELP') {
      return this.handleHelp();
    }

    if (msg.intent === 'REPEAT') {
      return this.handleRepeat();
    }

    // Новые команды для сохранения и навигации
    if (msg.intent === 'SAVE') {
      return this.handleSave();
    }

    if (msg.intent === 'NAVIGATE' && msg.target) {
      return this.handleNavigate(msg.target);
    }

    if (msg.intent === 'OPEN_TAB' && msg.url) {
      return this.handleOpenTab(msg.url);
    }

    // DICTATION → отправляем в LLM для структуризацию
    return this.runLlmFlow(msg.transcript);
  }

  /* ──────────────────────── Обработка команд редактирования ──────────────────────── */

  private async handleEditField(field: string, value: string): Promise<RpaResult> {
    await this.setState('FILLING_DOM', `Редактирование поля: ${field}`);
    const r = await this.deps.sendToTab({
      type: 'rpa:fillField',
      form: 'intake',
      field,
      value,
      humanTyping: true,
    });
    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: r.ok ? `Поле ${field} изменено на ${value}` : `Ошибка изменения поля ${field}`,
    }).catch(() => {});
    await this.setState('IDLE');
    return r;
  }

  private async handleDeleteField(field: string): Promise<RpaResult> {
    await this.setState('FILLING_DOM', `Удаление поля: ${field}`);
    const r = await this.deps.sendToTab({
      type: 'rpa:fillField',
      form: 'intake',
      field,
      value: '',
      humanTyping: true,
    });
    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: r.ok ? `Поле ${field} очищено` : `Ошибка очистки поля ${field}`,
    }).catch(() => {});
    await this.setState('IDLE');
    return r;
  }

  private async handleAddField(field: string, value: string): Promise<RpaResult> {
    await this.setState('FILLING_DOM', `Добавление в поле: ${field}`);
    const r = await this.deps.sendToTab({
      type: 'rpa:fillField',
      form: 'intake',
      field,
      value,
      humanTyping: true,
    });
    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: r.ok ? `Добавлено в поле ${field}: ${value}` : `Ошибка добавления в поле ${field}`,
    }).catch(() => {});
    await this.setState('IDLE');
    return r;
  }

  private async handleClearAll(): Promise<RpaResult> {
    await this.setState('FILLING_DOM', 'Очистка формы');
    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: 'Функция очистки формы в разработке',
    }).catch(() => {});
    await this.setState('IDLE');
    return { ok: true, data: { cleared: true } };
  }

  private async handleShowFields(): Promise<RpaResult> {
    await this.setState('IDLE');
    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: 'Доступные поля: фамилия, имя, отчество, дата рождения, пол, телефон, жалобы, анамнез, давление, пульс, температура, диагноз, назначения',
    }).catch(() => {});
    return { ok: true, data: { fields: ['фамилия', 'имя', 'отчество', 'дата рождения', 'пол', 'телефон', 'жалобы', 'анамнез', 'давление', 'пульс', 'температура', 'диагноз', 'назначения'] } };
  }

  private async handleHelp(): Promise<RpaResult> {
    await this.setState('IDLE');
    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: 'Доступные команды: исправь поле на значение, удали поле, добавь в поле значение, очисти всё, покажи поля, помощь, повтори',
    }).catch(() => {});
    return { ok: true, data: { help: true } };
  }

  private async handleRepeat(): Promise<RpaResult> {
    await this.setState('IDLE');
    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: 'Функция повтора команды в разработке',
    }).catch(() => {});
    return { ok: true, data: { repeated: true } };
  }

  private async handleSave(): Promise<RpaResult> {
    await this.setState('FILLING_DOM', 'Сохранение приема');
    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: 'Функция сохранения приема в разработке',
    }).catch(() => {});
    await this.setState('IDLE');
    return { ok: true, data: { saved: true } };
  }

  private async handleNavigate(target: string): Promise<RpaResult> {
    await this.setState('IDLE');
    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: `Переход на ${target} в разработке`,
    }).catch(() => {});
    return { ok: true, data: { navigated: target } };
  }

  private async handleOpenTab(url: string): Promise<RpaResult> {
    await this.setState('IDLE');
    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: `Открытие вкладки на ${url} в разработке`,
    }).catch(() => {});
    return { ok: true, data: { opened: url } };
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
      console.log('[orchestrator] LLM response:', JSON.stringify(formResponse, null, 2));
    } catch (err) {
      await this.failAndSpeak(
        err instanceof LlmError && err.code === 'CONFIG'
          ? 'LLM не настроен. Откройте параметры расширения.'
          : 'Не удалось обработать речь. Проверьте подключение к LLM.',
        err,
      );
      return { ok: false, error: (err as Error).message, code: 'UNKNOWN' };
    }

    // Проверяем наличие данных в intake (игнорируем null-поля)
    const hasData = formResponse.intake && Object.values(formResponse.intake).some(v => v !== null && v !== undefined && v !== '');
    if (!hasData || !formResponse.intake) {
      console.warn('[orchestrator] No data in intake response');
      await this.deps.sendToTab({
        type: 'rpa:speak',
        text: 'Не удалось извлечь данные из речи.',
      }).catch(() => {});
      await this.setState('IDLE');
      return { ok: true, data: { filled: 0 } };
    }

    const mapped = mapVisitToCommands(formResponse.intake);
    const commands = mapped.commands;

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

    await this.setState('IDLE', `Заполнено ${filled}/${commands.length} полей`);
    return { ok: true, data: { filled, failed } };
  }

  /** Озвучить ошибку и вернуться в IDLE. */
  private async failAndSpeak(text: string, err: unknown): Promise<void> {
    console.error('[orchestrator]', text, err);
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
