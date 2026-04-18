/**
 * AgentStatusWidget — плавающий виджет статуса RPA-агента.
 *
 * Требования ТЗ:
 *   - Внедряется через Shadow DOM → нет конфликтов CSS с КМИС.
 *   - Не перекрывает важные элементы: правый нижний угол, малый размер,
 *     position: fixed, высокий но конечный z-index, pointer-events по необходимости.
 *   - Плавные анимации: пульсация при прослушивании, спиннер при thinking/filling.
 *
 * Внешний API:
 *   const widget = new AgentStatusWidget();
 *   widget.mount();
 *   widget.setStatus('listening');
 *   widget.setTranscript('покажи расписание...');
 *   widget.setProgress(0.6);
 *   widget.onMicClick(() => ...);
 *
 * Почему Custom Element + Shadow DOM, а не просто <div>:
 *   - Стили полностью изолированы (all:initial в host).
 *   - Возможность переиспользовать виджет в popup/sidepanel без изменений.
 */

import type { AgentStatus } from '@/voice/voiceManager';

const WIDGET_TAG = 'rpa-agent-widget';

const WIDGET_STYLES = /* css */ `
  :host {
    all: initial;
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483000; /* высокий, но не max — чтобы не ломать нативные модалы */
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    pointer-events: auto;
  }

  .shell {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #ffffff;
    border: 1px solid #c5cdd8;
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(11, 83, 148, 0.18);
    min-width: 220px;
    max-width: 360px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .shell[data-status="listening"] { border-color: #0b5394; }
  .shell[data-status="thinking"]  { border-color: #b38700; }
  .shell[data-status="filling"]   { border-color: #166534; }
  .shell[data-status="speaking"]  { border-color: #6b21a8; }

  .mic {
    position: relative;
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    background: #f3f5f8;
    color: #1f2937;
    display: grid;
    place-items: center;
    transition: background 0.2s ease, transform 0.15s ease;
  }
  .mic:hover { background: #e4e9f0; }
  .mic:active { transform: scale(0.96); }

  .mic[data-status="listening"] {
    background: #dc2626;
    color: #fff;
  }
  .mic[data-status="speaking"] {
    background: #6b21a8;
    color: #fff;
  }
  .mic[data-status="listening"]:hover { background: #b91c1c; }

  /* Кнопка отправки — показывается только когда есть накопленный текст */
  .send-btn {
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    background: #16a34a;
    color: #fff;
    display: none;
    place-items: center;
    transition: background 0.2s ease, transform 0.15s ease;
  }
  .send-btn:hover { background: #15803d; }
  .send-btn:active { transform: scale(0.96); }
  .shell[data-has-pending="true"] .send-btn { display: grid; }
  .icon-send { width: 18px; height: 18px; fill: currentColor; }

  /* Пульсация во время прослушивания */
  .mic[data-status="listening"]::before,
  .mic[data-status="listening"]::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid #dc2626;
    animation: pulse 1.8s ease-out infinite;
    opacity: 0;
  }
  .mic[data-status="listening"]::after { animation-delay: 0.9s; }

  @keyframes pulse {
    0%   { transform: scale(0.95); opacity: 0.7; }
    100% { transform: scale(1.7);  opacity: 0;   }
  }

  /* Спиннер для thinking / filling */
  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-right-color: currentColor;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .status {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
  }
  .shell[data-status="listening"] .status { color: #0b5394; }
  .shell[data-status="thinking"]  .status { color: #b38700; }
  .shell[data-status="filling"]   .status { color: #166534; }
  .shell[data-status="speaking"]  .status { color: #6b21a8; }

  .transcript {
    font-size: 13px;
    color: #1f2937;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .transcript:empty::before {
    content: 'Нажмите микрофон для начала';
    color: #9ca3af;
    font-style: italic;
  }

  .icon-mic { width: 20px; height: 20px; fill: currentColor; }
`;

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Готов',
  listening: 'Слушаю',
  thinking: 'Думаю',
  filling: 'Заполняю',
  speaking: 'Говорю',
};

export class AgentStatusWidget {
  private hostEl: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private micEl: HTMLButtonElement | null = null;
  private sendEl: HTMLButtonElement | null = null;
  private statusEl: HTMLElement | null = null;
  private transcriptEl: HTMLElement | null = null;
  private shellEl: HTMLElement | null = null;
  private iconSlot: HTMLElement | null = null;
  private currentStatus: AgentStatus = 'idle';
  private micHandlers: Array<() => void> = [];
  private sendHandlers: Array<() => void> = [];

  /** Монтируем виджет в <body>. Идемпотентно + устойчиво к ранней инициализации. */
  mount(): void {
    if (this.hostEl && this.hostEl.isConnected) return;

    if (!document.body) {
      // body ещё нет (очень ранний run_at) — ждём.
      window.addEventListener('DOMContentLoaded', () => this.mount(), { once: true });
      return;
    }

    // Не используем customElements — на некоторых страницах глобал может быть
    // недоступен в isolated world или замоканым другим content-script'ом.
    // Shadow DOM полностью работает на обычном <div>.
    this.hostEl = document.createElement('div');
    this.hostEl.id = WIDGET_TAG;
    this.hostEl.setAttribute('data-rpa-widget', '');
    this.shadow = this.hostEl.attachShadow({ mode: 'closed' });
    console.info('[rpa] widget mounting');

    const style = document.createElement('style');
    style.textContent = WIDGET_STYLES;

    const shell = document.createElement('div');
    shell.className = 'shell';
    shell.setAttribute('data-status', 'idle');
    shell.innerHTML = `
      <button class="mic" type="button" aria-label="Включить микрофон" data-status="idle">
        <span class="icon-slot">${MIC_SVG}</span>
      </button>
      <div class="info">
        <div class="status">Готов</div>
        <div class="transcript" role="status" aria-live="polite"></div>
      </div>
      <button class="send-btn" type="button" aria-label="Отправить текст" title="Отправить распознанный текст">
        ${SEND_SVG}
      </button>
    `;

    this.shadow.append(style, shell);
    this.shellEl = shell;
    this.micEl = shell.querySelector<HTMLButtonElement>('.mic');
    this.sendEl = shell.querySelector<HTMLButtonElement>('.send-btn');
    this.statusEl = shell.querySelector<HTMLElement>('.status');
    this.transcriptEl = shell.querySelector<HTMLElement>('.transcript');
    this.iconSlot = shell.querySelector<HTMLElement>('.icon-slot');

    this.micEl?.addEventListener('click', () => {
      for (const h of this.micHandlers) h();
    });

    this.sendEl?.addEventListener('click', () => {
      for (const h of this.sendHandlers) h();
    });

    document.body.appendChild(this.hostEl);
  }

  unmount(): void {
    this.hostEl?.remove();
    this.hostEl = null;
    this.shadow = null;
    this.micHandlers = [];
    this.sendHandlers = [];
  }

  /** Показать/скрыть кнопку "Отправить" в зависимости от наличия текста. */
  setHasPendingInterim(has: boolean): void {
    this.shellEl?.setAttribute('data-has-pending', has ? 'true' : 'false');
  }

  /** Подписка на клик по кнопке "Отправить". */
  onSendClick(handler: () => void): () => void {
    this.sendHandlers.push(handler);
    return () => {
      const idx = this.sendHandlers.indexOf(handler);
      if (idx >= 0) this.sendHandlers.splice(idx, 1);
    };
  }

  setStatus(status: AgentStatus): void {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    this.shellEl?.setAttribute('data-status', status);
    this.micEl?.setAttribute('data-status', status);
    if (this.statusEl) this.statusEl.textContent = STATUS_LABELS[status];

    // Иконка по статусу: спиннер (thinking/filling) / стоп (listening/speaking) / микрофон.
    if (this.iconSlot) {
      this.iconSlot.innerHTML =
        status === 'thinking' || status === 'filling' ? SPINNER_SVG
        : status === 'listening' || status === 'speaking' ? STOP_SVG
        : MIC_SVG;
    }

    // aria-label отражает действие, которое совершит клик.
    if (this.micEl) {
      const title =
        status === 'listening' || status === 'speaking'
          ? 'Остановить микрофон'
          : 'Включить микрофон';
      this.micEl.setAttribute('aria-label', title);
      this.micEl.title = title;
    }
  }

  setTranscript(text: string): void {
    if (this.transcriptEl) this.transcriptEl.textContent = text;
  }

  /** Подписка на клик по микрофону. */
  onMicClick(handler: () => void): () => void {
    this.micHandlers.push(handler);
    return () => {
      const idx = this.micHandlers.indexOf(handler);
      if (idx >= 0) this.micHandlers.splice(idx, 1);
    };
  }
}

const MIC_SVG = `
<svg class="icon-mic" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/>
</svg>`;

const STOP_SVG = `
<svg class="icon-mic" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
</svg>`;

const SPINNER_SVG = `<span class="spinner" aria-hidden="true"></span>`;

const SEND_SVG = `
<svg class="icon-send" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
</svg>`;
