<script setup lang="ts">
/**
 * Журнал выполнения процедур (Модуль 4 — тайм-менеджмент статусов).
 *
 * Врач/массажист отмечает процедуру как выполненную в момент/сразу после услуги
 * — агент автоматически фиксирует таймстамп и запрашивает короткий дневник.
 *
 * data-rpa-action="markCompleted:<procId>" — клик ставит галочку + timestamp.
 * data-rpa-field="service.<procId>.diary"  — поле короткого дневника.
 */
import { reactive, computed } from 'vue';

interface ServiceRow {
  id: string;
  name: string;
  specialist: string;
  plannedTime: string;
  completed: boolean;
  completedAt: string;
  diary: string;
}

const services = reactive<ServiceRow[]>([
  { id: 'lfk',           name: 'ЛФК',          specialist: 'Иванов И.И.',    plannedTime: '09:00', completed: false, completedAt: '', diary: '' },
  { id: 'massage',       name: 'Массаж',       specialist: 'Петров П.П.',    plannedTime: '09:30', completed: false, completedAt: '', diary: '' },
  { id: 'psychology',    name: 'Психолог',     specialist: 'Сидорова А.А.',  plannedTime: '10:00', completed: false, completedAt: '', diary: '' },
  { id: 'physiotherapy', name: 'Физиотерапия', specialist: 'Козлов В.В.',    plannedTime: '11:00', completed: false, completedAt: '', diary: '' },
  { id: 'speech',        name: 'Логопед',      specialist: 'Никитина О.Л.',  plannedTime: '11:30', completed: false, completedAt: '', diary: '' },
]);

const progress = computed(() => {
  const done = services.filter((s) => s.completed).length;
  return { done, total: services.length, ratio: services.length ? done / services.length : 0 };
});

const currentTime = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Попросить расширение озвучить фразу. */
const speak = (text: string) => {
  window.dispatchEvent(new CustomEvent('rpa:tts-request', { detail: { text } }));
  window.postMessage({ __rpa_tts: true, text }, '*');
};

const markCompleted = (row: ServiceRow) => {
  if (row.completed) {
    speak(`${row.name} уже отмечена как выполненная в ${row.completedAt}`);
    return;
  }
  row.completed = true;
  row.completedAt = currentTime();
  speak(
    `${row.name} отмечена как выполненная в ${row.completedAt}. ` +
      'Продиктуйте короткий дневник процедуры или скажите "пропусти".',
  );
};

const toggle = (row: ServiceRow) => {
  if (row.completed) {
    row.completed = false;
    row.completedAt = '';
    speak(`${row.name} возвращена в статус "запланировано"`);
  } else {
    markCompleted(row);
  }
};
</script>

<template>
  <div class="service-execution" data-rpa-form="services">
    <div class="panel panel-default">
      <div class="panel-heading">
        <h2>Журнал выполнения процедур</h2>
        <div class="progress-summary">
          Выполнено: <strong>{{ progress.done }} / {{ progress.total }}</strong>
        </div>
      </div>

      <div class="panel-body">
        <table class="services-table">
          <thead>
            <tr>
              <th style="width:50px">#</th>
              <th>Процедура</th>
              <th>Специалист</th>
              <th style="width:110px">План</th>
              <th style="width:130px">Статус</th>
              <th style="width:110px">Выполнено</th>
              <th>Дневник процедуры</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in services"
              :key="row.id"
              :class="{ 'row-done': row.completed }"
            >
              <td>{{ idx + 1 }}</td>
              <td class="proc-name">{{ row.name }}</td>
              <td>{{ row.specialist }}</td>
              <td>{{ row.plannedTime }}</td>
              <td>
                <button
                  type="button"
                  class="btn-status"
                  :class="row.completed ? 'btn-done' : 'btn-pending'"
                  :data-rpa-action="`markCompleted:${row.id}`"
                  :data-rpa-field="`service.${row.id}.completed`"
                  @click="toggle(row)"
                >
                  <span v-if="row.completed">✓ Выполнено</span>
                  <span v-else>☐ Запланировано</span>
                </button>
              </td>
              <td>
                <input
                  type="text"
                  class="form-control time-cell"
                  v-model="row.completedAt"
                  placeholder="--:--"
                  :data-rpa-field="`service.${row.id}.timestamp`"
                  readonly
                />
              </td>
              <td>
                <textarea
                  v-model="row.diary"
                  class="form-control diary-cell"
                  rows="2"
                  placeholder="Запишите результат процедуры голосом"
                  :data-rpa-field="`service.${row.id}.diary`"
                ></textarea>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="hint">
          <strong>Голосовые команды:</strong>
          <em>"ЛФК выполнена"</em> ·
          <em>"Массаж выполнен, пациент перенёс хорошо"</em> ·
          <em>"Запиши в дневник психолога: ребёнок активен"</em>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.service-execution {
  padding: 16px;
}

.panel {
  background: #fff;
  border: 1px solid #e0e4ea;
  border-radius: 6px;
}

.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #e0e4ea;
  background: #f8f9fa;
}

.panel-heading h2 {
  margin: 0;
  font-size: 18px;
  color: #2c3e50;
}

.progress-summary {
  font-size: 14px;
  color: #555;
}

.progress-summary strong {
  color: #0b5394;
}

.panel-body {
  padding: 16px 18px;
}

.services-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.services-table th,
.services-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
  text-align: left;
  vertical-align: middle;
}

.services-table th {
  background: #f3f5f8;
  font-weight: 600;
  color: #555;
  font-size: 13px;
}

.services-table tr.row-done {
  background: #f0fdf4;
}

.proc-name {
  font-weight: 600;
  color: #1f2937;
}

.btn-status {
  width: 100%;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.btn-pending {
  background: #f3f4f6;
  color: #6b7280;
  border-color: #d1d5db;
}

.btn-pending:hover {
  background: #e5e7eb;
}

.btn-done {
  background: #16a34a;
  color: #fff;
  border-color: #15803d;
}

.btn-done:hover {
  background: #15803d;
}

.time-cell {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
  font-family: 'Courier New', monospace;
  font-weight: 600;
}

.diary-cell {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
}

.diary-cell:focus,
.time-cell:focus {
  border-color: #3098a1;
  outline: none;
  box-shadow: 0 0 0 2px rgba(48, 152, 161, 0.15);
}

.hint {
  margin-top: 18px;
  padding: 12px 14px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 4px;
  font-size: 13px;
  color: #713f12;
}

.hint strong {
  color: #92400e;
}

.hint em {
  font-style: italic;
  color: #6b4423;
  background: #fef3c7;
  padding: 1px 6px;
  border-radius: 3px;
  margin: 0 2px;
  white-space: nowrap;
}
</style>
