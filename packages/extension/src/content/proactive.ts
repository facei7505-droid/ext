/**
 * Proactive Bootstrap — собирает VoiceManager + виджет + FormWatcher
 * для заполнения формы первичного приёма.
 *
 * Логика:
 *   1. Монтируем AgentStatusWidget (Shadow DOM).
 *   2. Создаём VoiceManager; при клике на микрофон — старт/стоп прослушивания.
 *   3. Синхронизируем статус агента с виджетом (statusChange → setStatus).
 *   4. Показываем interim-транскрипт в виджете.
 *   5. FormCompletionWatcher на форме intake:
 *        - onProgress → прогресс-бар виджета
 *        - onComplete → voice.askConfirmation("Форма заполнена. Сохранить?")
 *   6. Финальные транскрипты пересылаем в background (для LLM).
 */

import { AgentStatusWidget } from '@/widget/agentWidget';
import { VoiceManager } from '@/voice/voiceManager';
import { FormCompletionWatcher } from '@/voice/formWatcher';
import { RpaForms } from '@/shared/selectors';
import type { ParsedIntent } from '@/voice/intentParser';

export interface ProactiveHandle {
  destroy: () => void;
  voice: VoiceManager;
  widget: AgentStatusWidget;
}

/**
 * Колбэки наверх. Реальная отправка в background происходит в content/index.ts.
 */
export interface ProactiveCallbacks {
  onFinalTranscript?: (parsed: ParsedIntent) => void;
}

export function initProactive(cb: ProactiveCallbacks = {}): ProactiveHandle {
  const widget = new AgentStatusWidget();
  widget.mount();

  const voice = new VoiceManager();

  // Синхронизация статуса.
  voice.on('statusChange', (status) => widget.setStatus(status));

  // Промежуточный транскрипт для live-отображения + показываем кнопку "Отправить".
  voice.on('interim', (text) => {
    widget.setTranscript(text);
    widget.setHasPendingInterim(text.trim().length > 0);
  });

  // Финальные транскрипты — вверх для LLM. Скрываем кнопку "Отправить".
  voice.on('transcript', (parsed) => {
    widget.setTranscript(parsed.raw);
    widget.setHasPendingInterim(false);
    cb.onFinalTranscript?.(parsed);
  });

  voice.on('error', (err) => {
    widget.setTranscript(`⚠ ${err}`);
    widget.setHasPendingInterim(false);
  });

  // Кнопка "Отправить" — вручную коммитим накопленный текст как финальный.
  widget.onSendClick(() => {
    voice.flushInterim();
    widget.setHasPendingInterim(false);
  });

  // Переключение микрофона: любой активный режим → полный стоп; иначе — старт.
  // Если микрофон был остановлен вручную, кнопка включает его снова.
  widget.onMicClick(() => {
    const s = voice.status;
    if (voice.isManuallyStopped) {
      voice.resumeManually();
      widget.setTranscript('');
    } else if (s === 'listening' || s === 'speaking' || s === 'thinking' || s === 'filling') {
      voice.stopManually();
      widget.setTranscript('');
    } else {
      voice.startListening();
    }
  });

  // Проактивный watcher на форме первичного приёма.
  const watcher = new FormCompletionWatcher({
    form: RpaForms.intake,
    onProgress: (ratio) => {
      // Прогресс отключен по запросу пользователя
      console.log('[rpa] form progress:', ratio);
    },
    onComplete: async () => {
      const answer = await voice.askConfirmation(
        'Форма заполнена. Сохранить?',
        12_000,
      );
      if (answer === true) {
        await voice.speak('Форма сохранена.');
      } else if (answer === false) {
        await voice.speak('Хорошо, продолжайте заполнение.');
      }
    },
  });
  watcher.mount();

  return {
    voice,
    widget,
    destroy: () => {
      watcher.unmount();
      voice.destroy();
      widget.unmount();
    },
  };
}
