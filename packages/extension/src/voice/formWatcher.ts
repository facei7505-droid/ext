/**
 * FormCompletionWatcher — отслеживает заполненность формы по data-rpa-field атрибутам.
 *
 * Используется для:
 *   - Визуального фидбека в виджете (прогресс-бар)
 *   - Прокативных голосовых подсказок (когда форма заполнена — предложить сохранить)
 *   - Подсветки незаполненных полей
 */

import type { RpaFormKey } from '@/shared/selectors';

export interface FormWatcherOptions {
  form: RpaFormKey;
  /** Вызывается при изменении прогресса (ratio 0..1). */
  onProgress?: (ratio: number) => void;
  /** Вызывается при достижении 100% заполнения. */
  onComplete?: () => void;
}

export class FormCompletionWatcher {
  private readonly options: FormWatcherOptions;
  private observer: MutationObserver | null = null;
  private readonly selector = '[data-rpa-field]';
  private readonly debounceMs = 200;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastComplete = false;

  constructor(options: FormWatcherOptions) {
    this.options = options;
  }

  mount(): void {
    if (this.observer) return;

    // Добавляем стили для подсветки незаполненных полей
    this.injectHighlightStyles();

    this.observer = new MutationObserver(() => this.scheduleUpdate());
    this.observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['value', 'checked'],
      childList: true,
      characterData: true,
    });

    this.update();
  }

  unmount(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.removeHighlightStyles();
  }

  private injectHighlightStyles(): void {
    const styleId = 'rpa-form-highlight-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      [data-rpa-field].rpa-field-empty {
        outline: 2px solid #f59e0b !important;
        outline-offset: 2px;
        transition: outline 0.3s ease;
      }
      [data-rpa-field].rpa-field-empty:focus {
        outline-color: #0b5394 !important;
      }
    `;
    document.head.appendChild(style);
  }

  private removeHighlightStyles(): void {
    const style = document.getElementById('rpa-form-highlight-styles');
    style?.remove();
  }

  private scheduleUpdate(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.update(), this.debounceMs);
  }

  private update(): void {
    const fields = document.querySelectorAll<HTMLElement>(this.selector);
    if (fields.length === 0) return;

    let filled = 0;
    for (const field of fields) {
      const isFilled = this.isFieldFilled(field);
      if (isFilled) {
        filled++;
        field.classList.remove('rpa-field-empty');
      } else {
        field.classList.add('rpa-field-empty');
      }
    }

    const ratio = filled / fields.length;
    this.options.onProgress?.(ratio);

    const complete = filled === fields.length;
    if (complete && !this.lastComplete) {
      this.lastComplete = true;
      this.options.onComplete?.();
    } else if (!complete && this.lastComplete) {
      this.lastComplete = false;
    }
  }

  private isFieldFilled(el: HTMLElement): boolean {
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        return el.checked;
      }
      return el.value.trim().length > 0;
    }
    if (el instanceof HTMLTextAreaElement) {
      return el.value.trim().length > 0;
    }
    if (el instanceof HTMLSelectElement) {
      return el.value.trim().length > 0;
    }
    return el.textContent?.trim().length > 0;
  }
}
