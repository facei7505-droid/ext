/**
 * Service Worker (MV3) — точка входа.
 *
 * Архитектура:
 *   Этот файл — ТОЛЬКО transport + lifecycle + диспетчеризация.
 *   Бизнес-логика инкапсулирована в Orchestrator (FSM).
 *
 * Поток данных:
 *   content.ts ──TranscriptMsg──► background ──► Orchestrator
 *      ▲                                           │
 *      │                                           ▼
 *      │                                   structureVisit() (LLM)
 *      │                                           │
 *      │                                           ▼
 *      │                                   mapVisitToCommands()
 *      │                                           │
 *      │◄──── серия rpa:fillField ─────────────────┘
 *      │
 *      │            ┌──── generateSchedule (HTTP) ◄── SCHEDULING
 *      │◄── rpa:speak("Расписание готово...") ──────┘
 *
 * MV3 service worker засыпает между событиями → НИКАКОГО состояния
 * в памяти модуля; всё критичное храним в chrome.storage.session
 * (см. orchestrator.ts).
 */

import type {
  BackgroundToContentMsg,
  ContentToBackgroundMsg,
  RpaResult,
} from '@/shared/messages';
import type { RpaFormKey } from '@/shared/selectors';
import { Orchestrator } from './orchestrator';

const SESSION_KEYS = {
  activeTabId: 'rpa.activeTabId',
  lastRoute: 'rpa.lastRoute',
} as const;

/* -------------------- transport -------------------- */

async function sendToTab<T = unknown>(
  msg: BackgroundToContentMsg,
  tabId?: number,
): Promise<RpaResult<T>> {
  const id = tabId ?? (await resolveActiveTabId());
  if (id === undefined) return { ok: false, error: 'no active tab', code: 'NOT_FOUND' };
  try {
    const res = (await chrome.tabs.sendMessage(id, msg)) as RpaResult<T> | undefined;
    return res ?? { ok: false, error: 'empty response', code: 'UNKNOWN' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: 'UNKNOWN',
    };
  }
}

async function resolveActiveTabId(): Promise<number | undefined> {
  const stored = await chrome.storage.session.get(SESSION_KEYS.activeTabId);
  const cached = stored[SESSION_KEYS.activeTabId] as number | undefined;
  if (cached !== undefined) {
    try {
      const t = await chrome.tabs.get(cached);
      if (t?.id) return t.id;
    } catch {
      /* tab closed */
    }
  }
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return active?.id;
}

/* -------------------- orchestrator (FSM) -------------------- */

const orchestrator = new Orchestrator({ sendToTab });

/* -------------------- lifecycle -------------------- */

chrome.runtime.onInstalled.addListener(() => {
  console.info('[rpa] background installed');
});

chrome.runtime.onMessage.addListener(
  (msg: ContentToBackgroundMsg, sender, sendResponse: (r: RpaResult) => void) => {
    if (!sender.tab?.id) {
      sendResponse({ ok: false, error: 'no sender.tab', code: 'BAD_ARG' });
      return false;
    }

    // Все обработчики — async; возвращаем true, чтобы Chrome ждал.
    handleIncoming(msg, sender.tab.id)
      .then(sendResponse)
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          code: 'UNKNOWN',
        }),
      );
    return true;
  },
);

async function handleIncoming(
  msg: ContentToBackgroundMsg,
  tabId: number,
): Promise<RpaResult> {
  switch (msg.type) {
    case 'rpa:contentReady': {
      await chrome.storage.session.set({
        [SESSION_KEYS.activeTabId]: tabId,
        [SESSION_KEYS.lastRoute]: msg.route ?? null,
      });
      console.info('[rpa] content ready', tabId, msg.url, 'route=', msg.route);
      return { ok: true };
    }

    case 'rpa:transcript': {
      console.info('[rpa] transcript:', msg.intent, '—', msg.transcript);
      return orchestrator.handleTranscript(msg);
    }

    default: {
      const exhaustive: never = msg;
      return {
        ok: false,
        error: `unknown: ${JSON.stringify(exhaustive)}`,
        code: 'BAD_ARG',
      };
    }
  }
}

/* -------------------- публичное API для popup/sidepanel -------------------- */

export async function fillField(
  form: RpaFormKey,
  field: string,
  value: string,
  humanTyping = true,
): Promise<RpaResult> {
  return sendToTab({ type: 'rpa:fillField', form, field, value, humanTyping });
}

export async function clickAction(action: string): Promise<RpaResult> {
  return sendToTab({ type: 'rpa:clickAction', action });
}

export async function waitFor(selector: string, timeoutMs?: number): Promise<RpaResult> {
  return sendToTab({ type: 'rpa:waitFor', selector, timeoutMs });
}

export async function ping(): Promise<RpaResult> {
  return sendToTab({ type: 'rpa:ping' });
}

export { sendToTab };
