# Патч 5: Реверс-инжиниринг Дамумед — Сводка

## 📋 Что сделано

Проведён анализ реальных HTML-дампов системы "Дамумед" (damumed.kz) и создан адаптер для работы с legacy DOM.

### Артефакты проанализированы:
1. **ДӘУРЕНҚЫЗЫ ТОМИРИС** — история болезни, стационар
2. **Медицинская запись** — редактор TinyMCE, медицинские записи
3. **Дневниковая запись** — записи осмотров
4. **Назначения** — медикаменты, процедуры, услуги

## 🔍 Ключевые находки из реверс-инжиниринга

### Структура DOM Дамумед:
```
- Kendo UI компоненты: kendoComboBox, kendoDatePicker, kendoMaskedTextBox, kendoGrid
- TinyMCE редакторы: TINY.editor.edit('editor_0', {...})
- Bootstrap сетка: .row.form-group > .col-md-2 label + .col-md-10 input
- Селекторы полей: input[name="cmbField"], input[name="tbField"], textarea[name="taField"]
```

### Примеры реальных селекторов:
| Поле | Тип | Селектор |
|------|-----|----------|
| ИИН пациента | text | `input[name="tbPatientIIN"]` |
| Дата поступления | kendoDate | `input[name="dtAdmissionDate"]` |
| Отделение | kendoCombo | `input[name="cmbDepartment"]` |
| Диагноз | kendoCombo | `input[name="cmbDiagnosis"]` |
| Жалобы | tinymce | `#tinyeditor_0` |
| Мед. запись | tinymce | `textarea[data-field="complaints"]` |
| Код услуги | kendoMasked | `input[name="mtbServiceCode"]` |
| Cito (срочно) | checkbox | `input[name="cbServiceCito"]` |

## 📁 Созданные файлы

### 1. `packages/extension/src/content/damumedAdapter.ts`
**Основной адаптер для работы с Дамумед.**

**Ключевые компоненты:**
- `DAMUMED_FIELD_MAP` — маппинг 60+ полей для 7 типов страниц
- `DamumedTinyMCE` — хелпер для работы с TinyMCE редакторами
- `DamumedKendo` — хелпер для Kendo UI (ComboBox, DatePicker)
- `detectDamumedPage()` — автоопределение текущей страницы
- `fillDamumedField()` — заполнение отдельного поля
- `executeDamumedCommand()` — выполнение RPA-команды

**Поддерживаемые страницы:**
- `emergency-reception` — Приёмное отделение
- `medical-record` — Медицинская запись (редактор)
- `medical-history` — История болезни
- `assignments` — Назначения
- `diagnoses` — Диагнозы
- `diary` — Дневниковые записи
- `epicrisis` — Выписной эпикриз

**Использование:**
```typescript
// Заполнить одно поле
await fillDamumedField('complaints', 'Жалобы на головную боль', 'medical-record');

// Массовое заполнение
await fillDamumedFields([
  { rpaKey: 'patientId', value: '940101123456' },
  { rpaKey: 'complaints', value: 'Жалобы на боль в груди' },
  { rpaKey: 'bodyTemperature', value: '36.6' },
], 'intake');

// Глобальный доступ для отладки
window.DamumedAdapter.fillField('diagnosis', 'ОРВИ');
```

### 2. `packages/extension/src/ai/systemPromptDamumed.ts`
**Адаптированный System Prompt для LLM.**

**Особенности:**
- Учитывает структуру полей Дамумед
- Поддерживает казахстанскую специфику (ИИН 12 цифр)
- Учитывает TinyMCE редакторы для длинных текстов
- Включает все типы документов: intake, medical-record, diary, epicrisis, assignments

**JSON Schema:** `RESPONSE_JSON_SCHEMA_DAMUMED` — строгая схема для structured outputs с полями Дамумед.

**Маппинг:** `DAMUMED_FIELD_MAPPING` — преобразование JSON-ответов LLM в команды fillField.

## 🔧 Технические детали

### Работа с TinyMCE:
```typescript
// Получить редактор
const editor = DamumedTinyMCE.getEditor('editor_0');

// Установить HTML-контент
DamumedTinyMCE.content('<p>Жалобы на головную боль</p>');

// Вставить в позицию курсора
DamumedTinyMCE.insert('Добавлено: температура 38°');
```

### Работа с Kendo UI:
```typescript
// ComboBox — установить значение
DamumedKendo.comboValue('input[name="cmbDepartment"]', 'Терапевтическое');

// DatePicker
DamumedKendo.dateValue('input[name="dtAdmissionDate"]', '2026-04-17');

// Поиск в ComboBox с выбором первого результата
DamumedKendo.searchAndSelect('input[name="cmbDiagnosis"]', 'ОРВИ');
```

### Определение страницы:
```typescript
const page = detectDamumedPage();
// Возвращает: 'emergency-reception' | 'medical-record' | 'diary' | ...
```

## 📊 Сравнение: Мокап vs Реальный Дамумед

| Аспект | Мокап | Реальный Дамумед |
|--------|-------|------------------|
| Селекторы | `data-rpa-field` | `input[name="cmbField"]` |
| Редакторы | Простые textarea | TinyMCE (TINY.editor) |
| Выпадающие списки | Native select | Kendo ComboBox |
| Даты | Native date | Kendo DatePicker |
| Маски | HTML5 pattern | Kendo MaskedTextBox |
| Таблицы | HTML table | Kendo Grid |

## 🚀 Следующие шаги

Для интеграции с остальным кодом:

1. **В orchestrator.ts** — добавить ветвление для Damumed:
   ```typescript
   if (isDamumedSite()) {
     const commands = mapToDamumedCommands(llmResponse);
     for (const cmd of commands) {
       await executeDamumedCommand(cmd);
     }
   }
   ```

2. **В content/index.ts** — импортировать адаптер:
   ```typescript
   import { executeDamumedCommand, detectDamumedPage } from './damumedAdapter';
   ```

3. **Для LLM** — переключаться на Damumed-промпт при определении URL:
   ```typescript
   const prompt = isDamumedUrl(url) ? SYSTEM_PROMPT_DAMUMED : SYSTEM_PROMPT;
   ```

## ⚠️ Ограничения и рекомендации

1. **Kendo UI** — требуется инициализация страницы, поля могут появляться динамически
2. **TinyMCE** — нужно дождаться полной загрузки редактора (проверка `TINY.editors`)
3. **ComboBox** — при установке значения нужно триггерить событие 'change'
4. **Модальные окна** — некоторые формы открываются в Kendo Window, требуется обработка

## ✅ Сборка

```bash
cd packages/extension
npm run build
# ✓ built in 1.00s
```

Все TypeScript ошибки исправлены, сборка проходит успешно.
