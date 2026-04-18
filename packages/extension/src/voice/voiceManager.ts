/**
 * VoiceManager — упрощённый фасад голосового слоя для заполнения формы.
 *
 * Объединяет SpeechRecognizer + SpeechSynthesizer + IntentParser
 * в единый интерфейс.
 *
 * Жизненный цикл:
 *   idle → listening → thinking → filling → idle
 *            ↑                                 ↓
 *            ←─────── speaking ← (proactive prompt)
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
  private _manuallyStopped: boolean = false;

  constructor() {
    this.recognizer = new SpeechRecognizer();
    this.synthesizer = new SpeechSynthesizer();

    this.recognizer.onResult((ev: RecognizerEvent) => {
      if (ev.isFinal) {
        const parsed = parseIntent(ev.transcript);

        // Перехватываем подтверждение, если есть ожидающий askConfirmation.
        if (this.pendingConfirmation) {
          if (!Array.isArray(parsed) && parsed.intent === 'CONFIRM') {
            this.pendingConfirmation(true);
            this.pendingConfirmation = null;
            return;
          }
          if (!Array.isArray(parsed) && parsed.intent === 'CANCEL') {
            this.pendingConfirmation(false);
            this.pendingConfirmation = null;
            return;
          }
        }

        // Если это массив интентов (MULTI_EDIT), отправляем как отдельные команды
        if (Array.isArray(parsed)) {
          // Отправляем MULTI_EDIT интент с массивом команд
          const multiIntent: ParsedIntent = {
            intent: 'MULTI_EDIT',
            raw: parsed.map(p => p.raw).join(' '),
            confidence: 0.7,
            commands: parsed,
          };
          this.emit('transcript', multiIntent);
        } else {
          this.emit('transcript', parsed);
        }
      } else {
        this.emit('interim', ev.transcript);
      }
    });

    this.recognizer.onError((err) => this.emit('error', err));
  }

  get status(): AgentStatus {
    return this._status;
  }

  /** Ручное переключение статуса. */
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
    if (this._manuallyStopped) return;
    this.synthesizer.cancel();
    this.setStatus('listening');
    this.recognizer.start();
  }

  /** Ручная остановка микрофона (предотвращает авто-рестарт). */
  stopManually(): void {
    this._manuallyStopped = true;
    this.cancelAll();
  }

  /** Ручное включение микрофона (сбрасывает флаг ручной остановки). */
  resumeManually(): void {
    this._manuallyStopped = false;
    this.startListening();
  }

  /** Проверка, был ли микрофон остановлен вручную. */
  get isManuallyStopped(): boolean {
    return this._manuallyStopped;
  }

  /** Остановить прослушивание. */
  stopListening(): void {
    this.recognizer.stop();
    if (this._status === 'listening') this.setStatus('idle');
  }

  /** Жёсткий «стоп» всего голосового пайплайна. */
  cancelAll(): void {
    this.recognizer.stop();
    this.synthesizer.cancel();
    if (this.pendingConfirmation) {
      const resolve = this.pendingConfirmation;
      this.pendingConfirmation = null;
      resolve(false);
    }
    this.setStatus('idle');
  }

  /** Озвучить фразу. Во время речи распознавание приостанавливается. */
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
        setTimeout(() => this.startListening(), 300);
      }
    }
  }

  /** Вопрос с ожиданием голосового подтверждения (да/нет). */
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

  /** Захватить один финальный транскрипт (для диктовки). */
  async listenOnce(timeoutMs = 15_000): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const handler = (parsed: ParsedIntent) => {
        this.stopListening();
        resolve(parsed.raw);
      };

      const unsub = this.on('transcript', handler);
      this.startListening();

      setTimeout(() => {
        unsub();
        if (this._status === 'listening') this.stopListening();
        resolve(null);
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
