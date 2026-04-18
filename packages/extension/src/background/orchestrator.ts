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
import type { RpaFormKey } from '@/shared/selectors';

export type FsmState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING_LLM'
  | 'FILLING_DOM';

/** Маппинг внутренних ключей полей на человеческие названия для озвучки. */
const FIELD_LABELS: Record<string, string> = {
  'patient.iin': 'ИИН',
  'patient.lastName': 'фамилия',
  'patient.firstName': 'имя',
  'patient.middleName': 'отчество',
  'patient.birthDate': 'дата рождения',
  'patient.gender': 'пол',
  'patient.phone': 'телефон',
  'patient.address': 'адрес',
  'patient.department': 'отделение',
  'patient.admissionDate': 'дата поступления',
  'visit.diagnosis': 'диагноз',
  'visit.complaints': 'жалобы',
  'visit.anamnesis': 'анамнез',
  'visit.bloodPressure': 'артериальное давление',
  'visit.pulse': 'пульс',
  'visit.temperature': 'температура',
  'visit.recommendations': 'рекомендации',
  'epicrisis.finalDiagnosis': 'окончательный диагноз',
  'epicrisis.treatmentResults': 'результаты лечения',
  'epicrisis.disabilityGroup': 'группа инвалидности',
  'epicrisis.dischargeDate': 'дата выписки',
  'epicrisis.followUp': 'рекомендации',
  'epicrisis.nextVisitDate': 'дата следующего визита',
  'diary.date': 'дата',
  'diary.subjective': 'субъективный статус',
  'diary.objective': 'объективный статус',
  'diary.assessment': 'оценка',
  'diary.plan': 'план',
  'diagnoses.new.code': 'код диагноза',
  'diagnoses.new.name': 'название диагноза',
  'diagnoses.new.type': 'тип диагноза',
  'diagnoses.new.date': 'дата диагноза',
  'assignments.new.name': 'название назначения',
  'assignments.new.dosage': 'дозировка',
  'assignments.new.frequency': 'частота приёма',
  'assignments.new.startDate': 'дата начала',
  'assignments.new.endDate': 'дата окончания',
  'assignments.new.type': 'тип назначения',
};

function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const parts = field.split('.');
  return parts[parts.length - 1] || field;
}

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
    console.log('[orchestrator] handleTranscript:', { intent: msg.intent, field: msg.field, value: msg.value, transcript: msg.transcript });
    const state = await this.getState();

    // Если состояние застряло в FILLING_DOM или PROCESSING_LLM, принудительно сбрасываем в IDLE
    if (state === 'FILLING_DOM' || state === 'PROCESSING_LLM') {
      console.warn('[orchestrator] Force resetting state from', state, 'to IDLE');
      await this.setState('IDLE');
    }

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
      console.log('[orchestrator] Processing EDIT_FIELD:', { field: msg.field, value: msg.value });
      return this.handleEditField(msg.field, msg.value);
    }

    if (msg.intent === 'DELETE_FIELD' && msg.deleteField) {
      return this.handleDeleteField(msg.deleteField);
    }

    if (msg.intent === 'ADD_FIELD' && msg.addField && msg.addValue) {
      return this.handleAddField(msg.addField, msg.addValue);
    }

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

    // MULTI_EDIT → обрабатываем несколько команд последовательно
    if (msg.intent === 'MULTI_EDIT' && msg.commands) {
      console.log('[orchestrator] Handling MULTI_EDIT with commands:', msg.commands.length);
      return this.handleMultiEdit(msg.commands);
    }

    // DICTATION → отправляем в LLM для структуризацию
    console.log('[orchestrator] Sending to LLM flow, intent:', msg.intent);
    return this.runLlmFlow(msg.transcript);
  }

  /* ──────────────────────── Обработка команд редактирования ──────────────────────── */

  private async handleEditField(field: string, value: string): Promise<RpaResult> {
    try {
      await this.setState('FILLING_DOM', `Редактирование поля: ${field}`);

      // Определяем форму на основе имени поля
      let form: RpaFormKey = 'intake';
      if (field.startsWith('epicrisis.')) {
        form = 'epicrisis';
      } else if (field.startsWith('diary.')) {
        form = 'diary';
      } else if (field.startsWith('diagnoses.')) {
        form = 'diagnoses';
      } else if (field.startsWith('assignments.') || field.startsWith('schedule.')) {
        form = 'assignments';
      }

      const r = await this.deps.sendToTab({
        type: 'rpa:fillField',
        form,
        field,
        value,
        humanTyping: false,
      });
      const label = fieldLabel(field);
      await this.deps.sendToTab({
        type: 'rpa:speak',
        text: r.ok ? `${label}: ${value}` : `Ошибка изменения поля ${label}`,
      }).catch(() => {});

      // Проверяем, нужно ли предложить следующий шаг
      if (r.ok) {
        await this.checkAndSuggestNextStep(form);
      }

      return r;
    } finally {
      // Гарантируем сброс состояния в IDLE даже при ошибке
      await this.setState('IDLE');
    }
  }

  /** Проверяет состояние формы и предлагает следующий шаг если нужно */
  private async checkAndSuggestNextStep(form: RpaFormKey): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Проверяем обязательные поля — content script вернёт список незаполненных
    // и нарисует красные звёздочки возле соответствующих input'ов.
    const check = await this.deps.sendToTab({
      type: 'rpa:checkRequired',
      form,
    }).catch(() => null);

    const missing = (check && check.ok && check.data && Array.isArray((check.data as { missing?: string[] }).missing))
      ? (check.data as { missing: string[] }).missing
      : [];

    if (missing.length > 0) {
      await this.deps.sendToTab({
        type: 'rpa:speak',
        text: 'Заполните все обязательные поля.',
        silentAfter: true,
      }).catch(() => {});
      return;
    }

    // Все обязательные поля заполнены — предлагаем следующий шаг
    const suggestions: Record<RpaFormKey, string> = {
      'intake': 'Первичный осмотр заполнен. Сформировать расписание процедур для пациента?',
      'epicrisis': 'Выписной эпикриз заполнен. Сохранить данные пациента?',
      'diary': 'Дневниковая запись сохранена. Перейти к назначениям?',
      'diagnoses': 'Диагноз добавлен. Добавить сопутствующие диагнозы?',
      'assignments': 'Назначение добавлено. Добавить еще назначения?',
    };

    const suggestion = suggestions[form];
    if (suggestion) {
      await this.deps.sendToTab({
        type: 'rpa:speak',
        text: suggestion,
        silentAfter: true,
      }).catch(() => {});
    }
  }

  private async handleDeleteField(field: string): Promise<RpaResult> {
    try {
      await this.setState('FILLING_DOM', `Удаление поля: ${field}`);
      const r = await this.deps.sendToTab({
        type: 'rpa:fillField',
        form: 'intake',
        field,
        value: '',
        humanTyping: false,
      });
      const label = fieldLabel(field);
      await this.deps.sendToTab({
        type: 'rpa:speak',
        text: r.ok ? `Поле ${label} очищено` : `Ошибка очистки поля ${label}`,
      }).catch(() => {});
      return r;
    } finally {
      await this.setState('IDLE');
    }
  }

  private async handleAddField(field: string, value: string): Promise<RpaResult> {
    try {
      await this.setState('FILLING_DOM', `Добавление в поле: ${field}`);
      const r = await this.deps.sendToTab({
        type: 'rpa:fillField',
        form: 'intake',
        field,
        value,
        humanTyping: false,
      });
      const label = fieldLabel(field);
      await this.deps.sendToTab({
        type: 'rpa:speak',
        text: r.ok ? `Добавлено в поле ${label}: ${value}` : `Ошибка добавления в поле ${label}`,
      }).catch(() => {});
      return r;
    } finally {
      await this.setState('IDLE');
    }
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
      text: 'Доступные поля: иин, дата поступления, отделение, диагноз, жалобы, анамнез, давление, пульс, температура, назначения',
    }).catch(() => {});
    return { ok: true, data: { fields: ['иин', 'дата поступления', 'отделение', 'диагноз', 'жалобы', 'анамнез', 'давление', 'пульс', 'температура', 'назначения'] } };
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
    await this.setState('PROCESSING_LLM', `Переход на ${target}`);
    const r = await this.deps.sendToTab({
      type: 'rpa:navigate',
      target,
    });
    const label = (r.ok && r.data && typeof (r.data as { label?: string }).label === 'string')
      ? (r.data as { label: string }).label
      : target;
    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: r.ok ? `Переход на ${label} выполнен` : `Ошибка перехода на ${target}`,
      silentAfter: true,
    }).catch(() => {});
    await this.setState('IDLE');
    return r;
  }

  private async handleOpenTab(url: string): Promise<RpaResult> {
    await this.setState('IDLE');
    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: `Открытие вкладки на ${url} в разработке`,
    }).catch(() => {});
    return { ok: true, data: { opened: url } };
  }

  private async handleMultiEdit(commands: TranscriptMsg[]): Promise<RpaResult> {
    await this.setState('FILLING_DOM', `Заполнение ${commands.length} полей`);
    let filled = 0;
    let failed = 0;

    for (const cmd of commands) {
      if (cmd.intent === 'EDIT_FIELD' && cmd.field && cmd.value) {
        const r = await this.handleEditField(cmd.field, cmd.value);
        if (r.ok) filled++;
        else failed++;
      }
    }

    await this.setState('IDLE', `Заполнено ${filled}/${commands.length} полей`);
    await this.deps.sendToTab({
      type: 'rpa:speak',
      text: `Заполнено ${filled} из ${commands.length} полей`,
    }).catch(() => {});
    return { ok: true, data: { filled, failed } };
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
