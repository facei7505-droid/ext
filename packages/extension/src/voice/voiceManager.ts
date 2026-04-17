/**
 * VoiceManager — фасад голосового слоя.
 *
 * Объединяет SpeechRecognizer + SpeechSynthesizer + IntentParser
 * в единый интерфейс для content-script и оркестратора.
 *
 * Жизненный цикл:
 *   idle → listening → thinking → filling → idle
 *            ↑                                 ↓
 *            ←─────── speaking ← (proactive prompt)
 *
 * Проактивность:
 *   VoiceManager НЕ решает, когда задать вопрос — это делает FormCompletionWatcher
 *   (см. formWatcher.ts). VoiceManager предоставляет speak() / startListening()
 *   и асинхронный askConfirmation() для подтверждений «да/нет».
 */

import { SpeechRecognizer, type RecognizerEvent } from './speechRecognizer';
import { SpeechSynthesizer } from './speechSynthesizer';
import { parseIntent, type ParsedIntent } from './intentParser';

export type AgentStatus = 'idle' | 'listening' | 'thinking' | 'filling' | 'speaking';

export interface VoiceManagerEvents {
  statusChange: (status: AgentStatus) => void;
  /** Финальный транскрипт + распознанный интент. */
  transcript: (parsed: ParsedIntent) => void;
  /** Промежуточный (interim) транскрипт — для отображения в виджете. */
  interim: (text: string) => void;
  error: (err: string) => void;
}

type EventKey = keyof VoiceManagerEvents;
type EventHandler<K extends EventKey> = VoiceManagerEvents[K];

export class VoiceManager {
  private recognizer: SpeechRecognizer;
  private synthesizer: SpeechSynthesizer;
  private _status: AgentStatus = 'idle';
  private listeners: { [K in EventKey]?: Array<EventHandler<K>> } = {};
  /** Резолвер для askConfirmation() — ожидает следующий CONFIRM/CANCEL. */
  private pendingConfirmation: ((result: boolean) => void) | null = null;

  constructor() {
    this.recognizer = new SpeechRecognizer();
    this.synthesizer = new SpeechSynthesizer();

    this.recognizer.onResult((ev: RecognizerEvent) => {
      if (ev.isFinal) {
        const parsed = parseIntent(ev.transcript);

        // Перехватываем подтверждение, если есть ожидающий askConfirmation.
        if (this.pendingConfirmation) {
          if (parsed.intent === 'CONFIRM') {
            this.pendingConfirmation(true);
            this.pendingConfirmation = null;
            return;
          }
          if (parsed.intent === 'CANCEL') {
            this.pendingConfirmation(false);
            this.pendingConfirmation = null;
            return;
          }
        }

        this.emit('transcript', parsed);
      } else {
        this.emit('interim', ev.transcript);
      }
    });

    this.recognizer.onError((err) => this.emit('error', err));
  }

  get status(): AgentStatus {
    return this._status;
  }

  /** Ручное переключение статуса (например, из оркестратора после LLM). */
  setStatus(status: AgentStatus): void {
    if (this._status === status) return;
    this._status = status;
    this.emit('statusChange', status);
  }

  /** Подписка. Возвращает функцию отписки. */
  on<K extends EventKey>(event: K, handler: EventHandler<K>): () => void {
    const list = (this.listeners[event] ?? []) as Array<EventHandler<K>>;
    list.push(handler);
    (this.listeners as Record<string, unknown>)[event] = list;
    return () => {
      const arr = (this.listeners[event] ?? []) as Array<EventHandler<K>>;
      const idx = arr.indexOf(handler);
      if (idx >= 0) arr.splice(idx, 1);
    };
  }

  /** Начать прослушивание микрофона (требует user gesture). */
  startListening(): void {
    if (this._status === 'listening') return;
    this.synthesizer.cancel();
    this.setStatus('listening');
    this.recognizer.start();
  }

  /** Остановить прослушивание. */
  stopListening(): void {
    this.recognizer.stop();
    if (this._status === 'listening') this.setStatus('idle');
  }

  /**
   * Озвучить фразу. Во время речи распознавание приостанавливается
   * (иначе микрофон услышит голос синтезатора).
   */
  async speak(text: string): Promise<void> {
    const wasListening = this.recognizer.listening;
    if (wasListening) this.recognizer.stop();

    const prev = this._status;
    this.setStatus('speaking');
    try {
      await this.synthesizer.speak(text);
    } finally {
      this.setStatus(prev === 'speaking' ? 'idle' : prev);
      if (wasListening) {
        // Небольшая пауза, чтобы микрофон не подхватил хвост синтеза.
        setTimeout(() => this.startListening(), 300);
      }
    }
  }

  /**
   * Проактивный вопрос с ожиданием голосового подтверждения.
   * Возвращает true (CONFIRM) / false (CANCEL) / null (таймаут).
   */
  async askConfirmation(question: string, timeoutMs = 10_000): Promise<boolean | null> {
    await this.speak(question);

    return new Promise<boolean | null>((resolve) => {
      this.pendingConfirmation = resolve;
      this.startListening();

      setTimeout(() => {
        if (this.pendingConfirmation === resolve) {
          this.pendingConfirmation = null;
          resolve(null);
        }
      }, timeoutMs);
    });
  }

  destroy(): void {
    this.recognizer.destroy();
    this.synthesizer.cancel();
    this.listeners = {};
    this.pendingConfirmation = null;
  }

  private emit<K extends EventKey>(event: K, ...args: Parameters<EventHandler<K>>): void {
    const list = this.listeners[event];
    if (!list) return;
    for (const handler of list as Array<EventHandler<K>>) {
      (handler as (...a: Parameters<EventHandler<K>>) => void)(...args);
    }
  }
}
