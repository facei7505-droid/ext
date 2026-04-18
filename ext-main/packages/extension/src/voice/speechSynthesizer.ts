/**
 * Обёртка над Web Speech API (SpeechSynthesis).
 *
 * Используется для голосовых подсказок врача:
 *   - «Осмотр заполнен. Сформировать расписание?»
 *   - «Поле диагноз заполнено» и т.п.
 *
 * Локаль ru-RU, женский голос (предпочтение).
 * SpeechSynthesis работает в content script (доступ к вкладке).
 */

export interface SynthesizerConfig {
  lang?: string;
  rate?: number;   // 0.1 – 10, default 1
  pitch?: number;  // 0 – 2, default 1
  volume?: number; // 0 – 1, default 1
}

export class SpeechSynthesizer {
  private readonly cfg: Required<SynthesizerConfig>;
  private _speaking = false;

  constructor(cfg: SynthesizerConfig = {}) {
    this.cfg = {
      lang: cfg.lang ?? 'ru-RU',
      rate: cfg.rate ?? 1.0,
      pitch: cfg.pitch ?? 1.0,
      volume: cfg.volume ?? 0.9,
    };
  }

  get speaking(): boolean {
    return this._speaking;
  }

  /**
   * Произнести фразу. Возвращает Promise, резолвящийся по завершении.
   * Если синтез уже идёт — сначала прерывается текущая фраза.
   */
  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('SpeechSynthesis not supported'));
        return;
      }

      // Прерываем текущую фразу, если есть.
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.cfg.lang;
      utterance.rate = this.cfg.rate;
      utterance.pitch = this.cfg.pitch;
      utterance.volume = this.cfg.volume;

      // Пытаемся выбрать русский женский голос.
      const voices = window.speechSynthesis.getVoices();
      const ruVoice =
        voices.find((v) => v.lang.startsWith('ru') && /female|женск/i.test(v.name)) ??
        voices.find((v) => v.lang.startsWith('ru'));
      if (ruVoice) utterance.voice = ruVoice;

      utterance.onstart = () => {
        this._speaking = true;
      };
      utterance.onend = () => {
        this._speaking = false;
        resolve();
      };
      utterance.onerror = (ev) => {
        this._speaking = false;
        // 'canceled' — не ошибка, мы сами вызываем cancel().
        if (ev.error === 'canceled') {
          resolve();
          return;
        }
        reject(new Error(`SpeechSynthesis error: ${ev.error}`));
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  /** Прервать текущую фразу. */
  cancel(): void {
    window.speechSynthesis?.cancel();
    this._speaking = false;
  }
}
