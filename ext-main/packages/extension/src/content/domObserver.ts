/**
 * MutationObserver-утилита: дожидается появления DOM-узлов в SPA (Vue-роутинг,
 * ленивые формы, async-подгрузки). Без поллинга — реагируем на реальные мутации.
 */

import { isVisible } from './domHelpers';

export interface WaitForOptions {
  /** Корень наблюдения. По умолчанию document.body. */
  root?: ParentNode;
  /** Таймаут в мс. По умолчанию 8000. */
  timeoutMs?: number;
  /** Требовать, чтобы элемент был видимым. По умолчанию true. */
  visible?: boolean;
  /** Дополнительный предикат. */
  predicate?: (el: HTMLElement) => boolean;
}

/**
 * Ожидает первый элемент, удовлетворяющий selector (+ предикат/visible).
 * Проверяет сразу, затем подписывается на мутации до таймаута.
 */
export function waitForSelector(
  selector: string,
  options: WaitForOptions = {},
): Promise<HTMLElement> {
  const {
    root = document.body,
    timeoutMs = 8000,
    visible = true,
    predicate,
  } = options;

  const check = (): HTMLElement | null => {
    const el = (root as ParentNode).querySelector<HTMLElement>(selector);
    if (!el) return null;
    if (visible && !isVisible(el)) return null;
    if (predicate && !predicate(el)) return null;
    return el;
  };

  const existing = check();
  if (existing) return Promise.resolve(existing);

  return new Promise<HTMLElement>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const observer = new MutationObserver(() => {
      const found = check();
      if (found) {
        cleanup();
        resolve(found);
      }
    });

    const cleanup = (): void => {
      observer.disconnect();
      if (timer !== undefined) clearTimeout(timer);
    };

    observer.observe(root === document ? document.documentElement : (root as Node), {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-rpa-route', 'data-rpa-form', 'data-rpa-field', 'class', 'hidden'],
    });

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`waitForSelector: timeout ${timeoutMs}ms for "${selector}"`));
    }, timeoutMs);
  });
}

/**
 * Ожидает исчезновения элемента (например, спиннера загрузки).
 */
export function waitForSelectorGone(
  selector: string,
  options: Omit<WaitForOptions, 'visible' | 'predicate'> = {},
): Promise<void> {
  const { root = document.body, timeoutMs = 8000 } = options;

  const present = (): boolean => !!(root as ParentNode).querySelector(selector);
  if (!present()) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!present()) {
        cleanup();
        resolve();
      }
    });
    const cleanup = (): void => {
      observer.disconnect();
      clearTimeout(timer);
    };
    observer.observe(root === document ? document.documentElement : (root as Node), {
      childList: true,
      subtree: true,
    });
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`waitForSelectorGone: timeout ${timeoutMs}ms for "${selector}"`));
    }, timeoutMs);
  });
}
