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
} from './domHelpers';
import { waitForSelector } from './domObserver';
import { fieldSelector, actionSelector } from '@/shared/selectors';
import type {
  BackgroundToContentMsg,
  ContentReadyMsg,
  GenerateScheduleMsg,
  RpaResult,
  TranscriptMsg,
} from '@/shared/messages';
import { initProactive } from './proactive';

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
      arg: parsed.arg,
      confidence: parsed.confidence,
    };
    chrome.runtime.sendMessage(msg).catch(() => { /* background asleep */ });
  },
  onRequestSchedule: async () => {
    const msg: GenerateScheduleMsg = { type: 'rpa:generateSchedule' };
    try {
      await chrome.runtime.sendMessage(msg);
    } catch (err) {
      console.warn('[rpa] generateSchedule send failed', err);
    }
  },
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

async function handleCommand(msg: BackgroundToContentMsg): Promise<RpaResult> {
  switch (msg.type) {
    case 'rpa:ping':
      return { ok: true, data: { route: getRpaRoute(), url: location.href } };

    case 'rpa:fillField': {
      const selector = fieldSelector(msg.form, msg.field);
      const el = await waitForSelector(selector).catch(() => null);
      if (!el) return { ok: false, error: `field not found: ${msg.form}/${msg.field}`, code: 'NOT_FOUND' };
      await typeIntoElement(el, msg.value, { human: msg.humanTyping ?? true });
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
      // Оркестратор просит озвучить фразу через VoiceManager.
      await proactive.voice.speak(msg.text);
      return { ok: true };
    }

    case 'rpa:setAgentStatus': {
      proactive.voice.setStatus(msg.status);
      return { ok: true };
    }

    default: {
      // Исчерпывающий switch: TypeScript подскажет при расширении union.
      const exhaustive: never = msg;
      return { ok: false, error: `unknown message: ${JSON.stringify(exhaustive)}`, code: 'BAD_ARG' };
    }
  }
}
