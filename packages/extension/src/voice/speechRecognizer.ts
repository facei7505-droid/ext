/**
 * Обёртка над Web Speech API (SpeechRecognition).
 *
 * Особенности:
 *  - Работает ТОЛЬКО в content script (нужен доступ к вкладке для микрофона).
 *  - continuous=true + interimResults=true для потокового транскрибирования.
 *  - Автоматический restart при обрыве (Chrome закрывает сессию при тишине).
 *  - Локаль ru-RU — врач говорит по-русски.
 */

export interface RecognizerConfig {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface RecognizerEvent {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

type RecognizerCallback = (event: RecognizerEvent) => void;

export class SpeechRecognizer {
  private recognition: SpeechRecognition | null = null;
  private callbacks: RecognizerCallback[] = [];
  private errorCallbacks: ((err: string) => void)[] = [];
  private _listening = false;
  private _restartTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly cfg: Required<RecognizerConfig>;

  constructor(cfg: RecognizerConfig = {}) {
    this.cfg = {
      lang: cfg.lang ?? 'ru-RU',
      continuous: cfg.continuous ?? true,
      interimResults: cfg.interimResults ?? true,
      maxAlternatives: cfg.maxAlternatives ?? 1,
    };
  }

  get listening(): boolean {
    return this._listening;
  }

  /** Подписка на результаты распознавания. */
  onResult(cb: RecognizerCallback): () => void {
    this.callbacks.push(cb);
    return () => {
      this.callbacks = this.callbacks.filter((c) => c !== cb);
    };
  }

  /** Подписка на ошибки. */
  onError(cb: (err: string) => void): () => void {
    this.errorCallbacks.push(cb);
    return () => {
      this.errorCallbacks = this.errorCallbacks.filter((c) => c !== cb);
    };
  }

  /** Запуск распознавания. Требует user gesture (click/keydown) в контексте вкладки. */
  start(): void {
    if (this._listening) return;

    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      this.emitError('SpeechRecognition API not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognitionCtor();
    this.recognition.lang = this.cfg.lang;
    this.recognition.continuous = this.cfg.continuous;
    this.recognition.interimResults = this.cfg.interimResults;
    this.recognition.maxAlternatives = this.cfg.maxAlternatives;

    this.recognition.onresult = (ev: SpeechRecognitionEvent) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const alt = result[0];
        this.emit({
          transcript: alt.transcript,
          isFinal: result.isFinal,
          confidence: alt.confidence,
        });
      }
    };

    this.recognition.onerror = (ev: SpeechRecognitionErrorEvent) => {
      // 'no-speech' и 'aborted' — не критичные, не логируем как ошибки.
      if (ev.error === 'no-speech' || ev.error === 'aborted') return;
      this.emitError(ev.error);
    };

    this.recognition.onend = () => {
      // Chrome автоматически останавливает continuous-сессию при тишине.
      // Перезапускаем, если мы не вызывали stop() явно.
      if (this._listening) {
        this._restartTimer = setTimeout(() => {
          try {
            this.recognition?.start();
          } catch {
            // Может бросить если уже стартовал — игнор.
          }
        }, 100);
      }
    };

    try {
      this.recognition.start();
      this._listening = true;
    } catch (err) {
      this.emitError(`Failed to start: ${(err as Error).message}`);
    }
  }

  /** Остановка распознавания. */
  stop(): void {
    this._listening = false;
    if (this._restartTimer !== null) {
      clearTimeout(this._restartTimer);
      this._restartTimer = null;
    }
    try {
      this.recognition?.stop();
    } catch {
      /* already stopped */
    }
  }

  /** Полная очистка. */
  destroy(): void {
    this.stop();
    this.callbacks = [];
    this.errorCallbacks = [];
    this.recognition = null;
  }

  private emit(event: RecognizerEvent): void {
    for (const cb of this.callbacks) cb(event);
  }

  private emitError(err: string): void {
    for (const cb of this.errorCallbacks) cb(err);
  }
}

/* TypeScript declarations для webkit-префикса. */
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
