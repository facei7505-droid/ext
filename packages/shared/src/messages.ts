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
  /** Для MULTI_EDIT: массив команд */
  commands?: TranscriptMsg[];
}

export type ContentToBackgroundMsg =
  | ContentReadyMsg
  | TranscriptMsg;

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
