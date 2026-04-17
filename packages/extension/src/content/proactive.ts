/**
 * Proactive Bootstrap — собирает VoiceManager + виджет + FormWatcher
 * в единый рабочий цикл. Вызывается из content/index.ts при старте.
 *
 * Логика:
 *   1. Монтируем AgentStatusWidget (Shadow DOM).
 *   2. Создаём VoiceManager; при клике на микрофон — старт/стоп прослушивания.
 *   3. Синхронизируем статус агента с виджетом (statusChange → setStatus).
 *   4. Показываем interim-транскрипт в виджете.
 *   5. FormCompletionWatcher на форме intake:
 *        - onProgress → прогресс-бар виджета
 *        - onComplete → voice.askConfirmation("Осмотр заполнен. Сформировать расписание?")
 *          → при 'да': шлём background команду на генерацию расписания (Модуль 4)
 *          → при 'нет': просто молчим до следующего заполнения
 *   6. ProcedureWatcher для проактивного напоминания о завершении процедур:
 *        - procedure:start → через 10с askConfirmation("Процедура завершена?")
 *          → при 'да': markCompleted + startDictation для дневника
 *   7. Финальные транскрипты пересылаем в background (для LLM/интентов).
 */

import { AgentStatusWidget } from '@/widget/agentWidget';
import { VoiceManager } from '@/voice/voiceManager';
import { FormCompletionWatcher } from '@/voice/formWatcher';
import { ProcedureWatcher } from '@/voice/procedureWatcher';
import { RpaForms } from '@/shared/selectors';
import type { ParsedIntent } from '@/voice/intentParser';

export interface ProactiveHandle {
  destroy: () => void;
  voice: VoiceManager;
  widget: AgentStatusWidget;
}

/**
 * Колбэки наверх. Реальная отправка в background происходит в content/index.ts,
 * чтобы proactive.ts не зависел от chrome.runtime.
 */
export interface ProactiveCallbacks {
  onFinalTranscript?: (parsed: ParsedIntent) => void;
  onRequestSchedule?: () => Promise<void> | void;
  /** Отметить процедуру выполненной (content → background → content). */
  onMarkCompleted?: (procedureId: string, completed: boolean) => Promise<void>;
  /** Запустить диктовку в поле (content → background → content). */
  onStartDictation?: (targetField: string) => Promise<void>;
}

export function initProactive(cb: ProactiveCallbacks = {}): ProactiveHandle {
  const widget = new AgentStatusWidget();
  widget.mount();

  const voice = new VoiceManager();

  // Синхронизация статуса.
  voice.on('statusChange', (status) => widget.setStatus(status));

  // Промежуточный транскрипт для live-отображения.
  voice.on('interim', (text) => widget.setTranscript(text));

  // Финальные транскрипты — вверх для LLM / интентов.
  voice.on('transcript', (parsed) => {
    widget.setTranscript(parsed.raw);
    cb.onFinalTranscript?.(parsed);
  });

  voice.on('error', (err) => {
    widget.setTranscript(`⚠ ${err}`);
  });

  // Переключение микрофона: любой активный режим → полный стоп; иначе — старт.
  widget.onMicClick(() => {
    const s = voice.status;
    if (s === 'listening' || s === 'speaking' || s === 'thinking' || s === 'filling') {
      voice.cancelAll();
      widget.setTranscript('');
    } else {
      voice.startListening();
    }
  });

  // Проактивный watcher на форме первичного приёма.
  const watcher = new FormCompletionWatcher(RpaForms.intake, {
    onProgress: (_form, ratio) => widget.setProgress(ratio),
    onComplete: async () => {
      const answer = await voice.askConfirmation(
        'Осмотр заполнен. Сформировать расписание?',
        12_000,
      );
      if (answer === true) {
        voice.setStatus('thinking');
        await widget.setTranscript('Формирую расписание...');
        try {
          await cb.onRequestSchedule?.();
          await voice.speak('Расписание готово.');
        } catch (err) {
          await voice.speak('Не удалось сформировать расписание.');
          console.error('[rpa] schedule generation failed', err);
        } finally {
          voice.setStatus('idle');
        }
      } else if (answer === false) {
        await voice.speak('Хорошо, отменяю.');
      }
      // null — таймаут, ничего не делаем.
    },
  });
  watcher.start();

  // Проактивный watcher для процедур (Модуль 4).
  const procedureWatcher = new ProcedureWatcher(voice, {
    askConfirmation: async (prompt) => {
      const answer = await voice.askConfirmation(prompt, 10_000);
      return answer === true;
    },
    markCompleted: async (procedureId, completed) => {
      await cb.onMarkCompleted?.(procedureId, completed);
    },
    startDictation: async (targetField) => {
      await cb.onStartDictation?.(targetField);
    },
  });

  return {
    voice,
    widget,
    destroy: () => {
      watcher.stop();
      procedureWatcher.destroy();
      voice.destroy();
      widget.unmount();
    },
  };
}
