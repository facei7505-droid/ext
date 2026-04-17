/**
 * Контракт сообщений chrome.runtime между background и content скриптами.
 *
 * Дискриминированный union по полю `type`. NEVER заменяет дефолт-кейс
 * для exhaustive-проверок в обеих сторонах.
 */

import type { RpaFormKey } from './selectors';

/* ================== background → content ================== */

export interface FillFieldMsg {
  type: 'rpa:fillField';
  form: RpaFormKey;
  field: string;
  value: string;
  /** Имитировать посимвольный ввод (для text/tel/textarea). */
  humanTyping?: boolean;
}

export interface ClickActionMsg {
  type: 'rpa:clickAction';
  action: string;
}

export interface WaitForMsg {
  type: 'rpa:waitFor';
  selector: string;
  timeoutMs?: number;
}

export interface QueryDomMsg {
  type: 'rpa:queryDom';
  form?: RpaFormKey;
  field?: string;
  selector?: string;
}

export interface PingMsg {
  type: 'rpa:ping';
}

export interface SpeakMsg {
  type: 'rpa:speak';
  text: string;
  silentAfter?: boolean;
}

export type AgentVisualStatus = 'idle' | 'listening' | 'thinking' | 'filling' | 'speaking';

export interface SetAgentStatusMsg {
  type: 'rpa:setAgentStatus';
  status: AgentVisualStatus;
}

/**
 * Поиск и клик по текстовому содержимому (например, фамилия пациента в таблице).
 * containerSelector — опциональный CSS-скоуп, чтобы не кликнуть по случайному совпадению
 * (например, только внутри таблицы расписания).
 */
export interface SearchAndClickMsg {
  type: 'rpa:searchAndClick';
  text: string;
  containerSelector?: string;
}

export type BackgroundToContentMsg =
  | FillFieldMsg
  | ClickActionMsg
  | WaitForMsg
  | QueryDomMsg
  | PingMsg
  | SpeakMsg
  | SetAgentStatusMsg
  | SearchAndClickMsg;

/* ================== content → background ================== */

export interface ContentReadyMsg {
  type: 'rpa:contentReady';
  url: string;
  route?: string;
}

export interface TranscriptMsg {
  type: 'rpa:transcript';
  transcript: string;
  intent: string;
  arg?: string;
  /** Свободный payload интента (напр. ФИО для SEARCH_PATIENT). */
  payload?: string;
  confidence: number;
}

export interface GenerateScheduleMsg {
  type: 'rpa:generateSchedule';
}

export type ContentToBackgroundMsg =
  | ContentReadyMsg
  | TranscriptMsg
  | GenerateScheduleMsg;

/* ================== Универсальный ответ ================== */

export interface RpaResultOk<T = unknown> {
  ok: true;
  data?: T;
}
export interface RpaResultErr {
  ok: false;
  error: string;
  code?: 'NOT_FOUND' | 'TIMEOUT' | 'BAD_ARG' | 'UNKNOWN';
}
export type RpaResult<T = unknown> = RpaResultOk<T> | RpaResultErr;
