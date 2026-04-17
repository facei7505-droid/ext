/**
 * Проактивный вотчер для процедур в расписании.
 * Слушает custom event `procedure:start` и через 10 секунд
 * предлагает пользователю отметить процедуру выполненной и добавить запись в дневник.
 */

import type { VoiceManager } from './voiceManager';

export interface ProcedureWatcherCallbacks {
  /** Запросить подтверждение у пользователя (голос). */
  askConfirmation: (prompt: string) => Promise<boolean>;
  /** Отправить команду в content script для отметки выполненным. */
  markCompleted: (procedureId: string, completed: boolean) => Promise<void>;
  /** Запустить диктовку для дневника процедуры. */
  startDictation: (targetField: string) => Promise<void>;
}

export class ProcedureWatcher {
  private activeTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private voice: VoiceManager,
    private callbacks: ProcedureWatcherCallbacks,
  ) {
    this.init();
  }

  private init(): void {
    window.addEventListener('procedure:start', this.handleProcedureStart);
  }

  private handleProcedureStart = (e: Event): void => {
    const custom = e as CustomEvent<{ procedureId: string; procedureName: string }>;
    const { procedureId, procedureName } = custom.detail;

    console.log('[procedureWatcher] procedure started:', procedureId, procedureName);

    // Если уже есть таймер для этой процедуры — сбрасываем.
    if (this.activeTimeouts.has(procedureId)) {
      clearTimeout(this.activeTimeouts.get(procedureId)!);
    }

    // Через 10 секунд предлагаем отметить выполненным.
    const timeout = setTimeout(() => {
      void this.promptCompletion(procedureId, procedureName);
    }, 10000);

    this.activeTimeouts.set(procedureId, timeout);
  };

  private async promptCompletion(procedureId: string, procedureName: string): Promise<void> {
    const prompt = `Процедура "${procedureName}" завершена?`;
    const confirmed = await this.callbacks.askConfirmation(prompt);

    if (confirmed) {
      console.log('[procedureWatcher] user confirmed completion for', procedureId);
      await this.callbacks.markCompleted(procedureId, true);

      // Сразу предлагаем диктовку для дневника.
      const diaryPrompt = 'Запишите результат процедуры.';
      await this.voice.speak(diaryPrompt);
      await this.callbacks.startDictation(`procedures.${procedureId}.diary`);
    } else {
      console.log('[procedureWatcher] user declined completion for', procedureId);
      // Можно предложить повторить попытку позже или просто ничего не делать.
    }

    this.activeTimeouts.delete(procedureId);
  }

  /** Очистить все таймеры (например, при остановке голосового агента). */
  cancelAll(): void {
    for (const timeout of this.activeTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.activeTimeouts.clear();
  }

  /** Удалить слушатель событий. */
  destroy(): void {
    this.cancelAll();
    window.removeEventListener('procedure:start', this.handleProcedureStart);
  }
}
