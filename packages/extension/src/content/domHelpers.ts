/**
 * Надёжные DOM-утилиты RPA-агента.
 *
 * Принципы:
 *  - Работа только из ISOLATED world content-script'а: никаких вливаний кода
 *    в MAIN world, никаких eval / new Function — соответствие CSP MV3.
 *  - Используем нативный setter value, чтобы поддерживать и Vue, и React, и
 *    легаси-обработчики onchange/oninput.
 *  - Никаких конфликтов с нативным JS страницы: все обработчики локальны,
 *    события диспатчим как нативные (isTrusted=false, но bubbles=true).
 */

import { fieldSelector, actionSelector, type RpaFormKey } from '@/shared/selectors';

/* =========================================================================
   ПОИСК ЭЛЕМЕНТОВ
   ========================================================================= */

export type Findable =
  | { by: 'id'; id: string }
  | { by: 'field'; form: RpaFormKey; field: string }
  | { by: 'action'; action: string }
  | { by: 'label'; text: string; root?: ParentNode }
  | { by: 'text'; text: string; tag?: string; root?: ParentNode }
  | { by: 'selector'; selector: string };

export function findElement(target: Findable): HTMLElement | null {
  switch (target.by) {
    case 'id':
      return document.getElementById(target.id);
    case 'field':
      return document.querySelector<HTMLElement>(fieldSelector(target.form, target.field));
    case 'action':
      return document.querySelector<HTMLElement>(actionSelector(target.action));
    case 'selector':
      return document.querySelector<HTMLElement>(target.selector);
    case 'label':
      return findByLabel(target.text, target.root ?? document);
    case 'text':
      return findByText(target.text, target.tag, target.root ?? document);
  }
}

/** Поиск input/select/textarea по тексту связанного <label>. */
export function findByLabel(labelText: string, root: ParentNode = document): HTMLElement | null {
  const needle = normalize(labelText);
  const labels = root.querySelectorAll<HTMLLabelElement>('label');
  for (const lbl of labels) {
    if (!normalize(lbl.textContent ?? '').includes(needle)) continue;

    // 1) label[for]
    const forId = lbl.getAttribute('for');
    if (forId) {
      const el = document.getElementById(forId);
      if (el) return el;
    }
    // 2) вложенный контрол
    const nested = lbl.querySelector<HTMLElement>('input, select, textarea, [contenteditable="true"]');
    if (nested) return nested;
    // 3) соседний контрол в том же блоке
    const parent = lbl.parentElement;
    if (parent) {
      const sibling = parent.querySelector<HTMLElement>('input, select, textarea, [contenteditable="true"]');
      if (sibling && sibling !== lbl) return sibling;
    }
  }
  return null;
}

/**
 * Поиск первого видимого элемента по точному/подстрочному совпадению текста.
 * При передаче tag сильно ускоряется (буквально `button`, `a`, `div`).
 */
export function findByText(text: string, tag = '*', root: ParentNode = document): HTMLElement | null {
  const needle = normalize(text);
  const nodes = root.querySelectorAll<HTMLElement>(tag);
  for (const el of nodes) {
    if (!isVisible(el)) continue;
    const t = normalize(el.textContent ?? '');
    if (t === needle || t.includes(needle)) return el;
  }
  return null;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const style = getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/* =========================================================================
   ПРОГРАММНЫЙ ВВОД (human-like typing)
   ========================================================================= */

export interface TypeOptions {
  /** Средняя задержка между символами, мс. По умолчанию 25. */
  delayMs?: number;
  /** Случайный джиттер ±jitter к delayMs. По умолчанию 15. */
  jitterMs?: number;
  /** Имитировать посимвольный ввод. Если false — одна установка значения. */
  human?: boolean;
}

/**
 * Установить значение у input/textarea/contenteditable с корректным
 * триггером событий. Используется нативный сеттер прототипа — это важно,
 * чтобы React (valueTracker) и Vue одинаково увидели изменение.
 */
export async function typeIntoElement(
  el: HTMLElement,
  value: string,
  opts: TypeOptions = {},
): Promise<void> {
  const { delayMs = 25, jitterMs = 15, human = true } = opts;

  if (el instanceof HTMLSelectElement) {
    setSelectValue(el, value);
    return;
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // Для нетекстовых input (date/number/checkbox) — одномоментная установка.
    const isTextLike =
      el instanceof HTMLTextAreaElement ||
      ['text', 'tel', 'email', 'search', 'url', 'password'].includes(el.type);

    focus(el);
    nativeSetValue(el, '');

    if (!human || !isTextLike) {
      nativeSetValue(el, value);
      dispatchInput(el);
      dispatchChange(el);
      return;
    }

    for (const ch of [...value]) {
      nativeSetValue(el, el.value + ch);
      dispatchInput(el);
      await sleep(jitter(delayMs, jitterMs));
    }
    dispatchChange(el);
    return;
  }

  if ((el as HTMLElement).isContentEditable) {
    focus(el);
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
    return;
  }

  throw new Error(`typeIntoElement: unsupported element <${el.tagName.toLowerCase()}>`);
}

/** Установка value на select + корректный 'change'. */
function setSelectValue(el: HTMLSelectElement, value: string): void {
  focus(el);
  el.value = value;
  dispatchInput(el);
  dispatchChange(el);
}

/**
 * Использование нативного setter — единственный надёжный способ обойти
 * value-tracker React и одновременно не сломать Vue.
 */
function nativeSetValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function dispatchInput(el: HTMLElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}
function dispatchChange(el: HTMLElement): void {
  el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
}

function focus(el: HTMLElement): void {
  try {
    el.focus({ preventScroll: false });
  } catch {
    /* некоторые element'ы бросают — игнор */
  }
}

/* =========================================================================
   КЛИК
   ========================================================================= */

export function clickElement(el: HTMLElement): void {
  // Полный набор событий для легаси-обработчиков на mousedown/up.
  const opts = { bubbles: true, cancelable: true, view: window } as const;
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));
  // Фолбэк для <button type="submit"> внутри <form> — native .click() триггерит submit.
  if (typeof (el as HTMLButtonElement).click === 'function') {
    try {
      (el as HTMLButtonElement).click();
    } catch {
      /* ignored */
    }
  }
}

/* =========================================================================
   УТИЛИТЫ
   ========================================================================= */

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(base: number, jitterMs: number): number {
  const delta = (Math.random() * 2 - 1) * jitterMs;
  return Math.max(0, Math.round(base + delta));
}
