/**
 * ProcedureWatcher — Модуль 4 (по плану Cursor AI в ScheduleView.vue).
 *
 * Слушает CustomEvent 'rpa:procedureStarted', который страница крм-мок
 * бросает когда врач жмёт "Начать" на процедуре.
 *
 * После того как таймер процедуры истекает (или врач сам завершает):
 *   1. Агент проактивно спрашивает: "ЛФК завершена. Отметить как Выполнено?"
 *   2. На "Да" — программно кликает чекбокс markCompleted для этой процедуры.
 *   3. Затем спрашивает: "Хотите заполнить дневник процедуры голосом?"
 *   4. На "Да" — слушает диктовку и вставляет в textarea дневника.
 */

import type { VoiceManager } from '../voice/voiceManager';

export interface ProcedureStartedDetail {
  id: string;
  name: string;
  startedAt: string;
}

export interface ProcedureWatcherOptions {
  voice: VoiceManager;
  /** Колбэк для отправки SAVE или диктовки через orchestrator */
  onTranscript?: (text: string, procedureId: string) => void;
}

export class ProcedureWatcher {
  private voice: VoiceManager;
  private onTranscript?: (text: string, procedureId: string) => void;
  private activeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private boundHandler: (e: Event) => void;

  constructor(options: ProcedureWatcherOptions) {
    this.voice = options.voice;
    this.onTranscript = options.onTranscript;
    this.boundHandler = this.handleProcedureStarted.bind(this);
  }

  mount(): void {
    window.addEventListener('rpa:procedureStarted', this.boundHandler);
    console.info('[ProcedureWatcher] listening for rpa:procedureStarted');
  }

  unmount(): void {
    window.removeEventListener('rpa:procedureStarted', this.boundHandler);
    for (const timer of this.activeTimers.values()) clearTimeout(timer);
    this.activeTimers.clear();
  }

  private handleProcedureStarted(event: Event): void {
    const detail = (event as CustomEvent<ProcedureStartedDetail>).detail;
    if (!detail?.id || !detail?.name) return;

    console.info('[ProcedureWatcher] procedure started:', detail);

    // Озвучиваем подтверждение старта
    void this.voice.speak(`Процедура ${detail.name} начата. Я напомню когда её нужно отметить.`);

    // Через 30 секунд (демо) / в реальной жизни через duration процедуры
    // предлагаем отметить выполнение
    const DEMO_DURATION_MS = 30_000;
    const timer = setTimeout(() => {
      void this.promptMarkCompleted(detail);
    }, DEMO_DURATION_MS);

    this.activeTimers.set(detail.id, timer);
  }

  private async promptMarkCompleted(detail: ProcedureStartedDetail): Promise<void> {
    this.activeTimers.delete(detail.id);

    const confirm = await this.voice.askConfirmation(
      `${detail.name} завершена. Отметить как Выполнено?`,
      15_000,
    );

    if (confirm === true) {
      this.markProcedureCompleted(detail.id);
      await this.voice.speak('Отмечено. Хотите продиктовать результат процедуры в дневник?');

      const wantDiary = await this.voice.askConfirmation('Заполнить дневник процедуры?', 10_000);
      if (wantDiary === true) {
        await this.voice.speak('Говорите, я записываю результат.');
        // Голосовая диктовка для дневника — просто включаем микрофон,
        // результат придет через onFinalTranscript → orchestrator → fillField
        this.voice.startListening();
        // После завершения диктовки orchestrator запишет в procedures.{id}.diary
        this.onTranscript?.('diary_mode', detail.id);
      }
    } else if (confirm === false) {
      await this.voice.speak('Хорошо, процедура остается в статусе "В процессе".');
    }
  }

  /** Программно кликает чекбокс data-rpa-action="markCompleted" для нужной процедуры */
  private markProcedureCompleted(procedureId: string): void {
    const checkbox = document.querySelector<HTMLInputElement>(
      `[data-rpa-procedure-id="${procedureId}"][data-rpa-action="markCompleted"]`
    );
    if (!checkbox) {
      console.warn('[ProcedureWatcher] markCompleted checkbox not found for', procedureId);
      return;
    }
    if (!checkbox.disabled && !checkbox.checked) {
      checkbox.click();
      console.info('[ProcedureWatcher] marked completed:', procedureId);
    }
  }
}
