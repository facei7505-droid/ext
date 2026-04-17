/**
 * FormCompletionWatcher — проактивный наблюдатель заполненности формы.
 *
 * Задача: отследить момент, когда форма первичного приёма (или другая RPA-форма)
 * заполнена на 100%, и единоразово сообщить об этом наверх. После этого
 * content-script озвучит: «Осмотр заполнен. Сформировать расписание?».
 *
 * Подход:
 *   - Читаем все [data-rpa-field] внутри [data-rpa-form="..."].
 *   - Считаем поле заполненным, если у контрола непустое value.
 *   - Подписываемся на 'input'/'change' на форме (одно делегирование).
 *   - Debounce 400 мс, чтобы не дёргать при посимвольном вводе агентом.
 *   - Триггерим onComplete один раз за цикл заполнения; после сброса (≥1 пустое
 *     поле) снова готовы триггернуть.
 */

import type { RpaFormKey } from '@/shared/selectors';

export interface FormWatcherEvents {
  /** Форма полностью заполнена. */
  onComplete: (form: RpaFormKey) => void;
  /** Прогресс 0..1 — для анимации виджета. */
  onProgress: (form: RpaFormKey, ratio: number, filled: number, total: number) => void;
}

export class FormCompletionWatcher {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastComplete = false;
  private delegatedHandler: ((ev: Event) => void) | null = null;
  private observer: MutationObserver | null = null;

  constructor(
    private readonly form: RpaFormKey,
    private readonly events: Partial<FormWatcherEvents>,
    private readonly debounceMs = 400,
  ) {}

  start(): void {
    this.attachListener();

    // Форма может появиться позже (SPA-роутинг) → MutationObserver.
    this.observer = new MutationObserver(() => this.attachListener());
    this.observer.observe(document.body, { childList: true, subtree: true });

    // Первичная проверка.
    this.scheduleCheck();
  }

  stop(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.observer?.disconnect();
    this.observer = null;
    this.detachListener();
  }

  private getFormEl(): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[data-rpa-form="${this.form}"]`);
  }

  private attachListener(): void {
    const formEl = this.getFormEl();
    if (!formEl || this.delegatedHandler) return;

    const handler = () => this.scheduleCheck();
    formEl.addEventListener('input', handler, true);
    formEl.addEventListener('change', handler, true);
    this.delegatedHandler = handler;
  }

  private detachListener(): void {
    const formEl = this.getFormEl();
    if (formEl && this.delegatedHandler) {
      formEl.removeEventListener('input', this.delegatedHandler, true);
      formEl.removeEventListener('change', this.delegatedHandler, true);
    }
    this.delegatedHandler = null;
  }

  private scheduleCheck(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.check(), this.debounceMs);
  }

  private check(): void {
    const formEl = this.getFormEl();
    if (!formEl) return;

    const fields = formEl.querySelectorAll<HTMLElement>('[data-rpa-field]');
    let total = 0;
    let filled = 0;

    for (const el of fields) {
      // Игнорируем только read-only meta-поля вроде meta.submittedAt.
      const fieldName = el.dataset.rpaField ?? '';
      if (fieldName.startsWith('meta.')) continue;

      total++;
      if (this.isFilled(el)) filled++;
    }

    if (total === 0) return;

    const ratio = filled / total;
    this.events.onProgress?.(this.form, ratio, filled, total);

    const complete = filled === total;
    if (complete && !this.lastComplete) {
      this.lastComplete = true;
      this.events.onComplete?.(this.form);
    } else if (!complete && this.lastComplete) {
      // Сброс: форма снова неполная — готовы триггернуть ещё раз.
      this.lastComplete = false;
    }
  }

  private isFilled(el: HTMLElement): boolean {
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      return el.value.trim().length > 0;
    }
    return (el.textContent ?? '').trim().length > 0;
  }
}
