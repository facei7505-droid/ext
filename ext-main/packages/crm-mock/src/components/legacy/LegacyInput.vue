<script setup lang="ts">
/**
 * Унифицированный input с v-model и RPA-атрибутами.
 *
 * КОНТРАКТ ДЛЯ ВНЕШНЕГО RPA-АГЕНТА:
 *   1. Найти элемент по селектору [data-rpa-form="<form>"] [data-rpa-field="<field>"].
 *   2. Установить input.value = '...';
 *   3. Обязательно вызвать input.dispatchEvent(new Event('input', { bubbles: true })).
 * Vue 3 v-model слушает нативный 'input' — реактивность сработает корректно.
 */
import { computed } from 'vue';

interface Props {
  modelValue: string;
  id: string;
  /** Семантический путь поля, напр. "patient.lastName". */
  field: string;
  label?: string;
  type?: 'text' | 'tel' | 'date' | 'number' | 'email';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autocomplete?: string;
  pattern?: string;
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  type: 'text',
  placeholder: '',
  required: false,
  disabled: false,
  autocomplete: 'off',
  pattern: undefined,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});
</script>

<template>
  <div>
    <label v-if="label" :for="id">{{ label }}<span v-if="required" class="text-kmis-danger">&nbsp;*</span></label>
    <input
      :id="id"
      v-model="value"
      class="kmis-field"
      :type="type"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :autocomplete="autocomplete"
      :pattern="pattern"
      :name="field"
      :data-rpa-field="field"
      :data-rpa-type="type"
    />
  </div>
</template>
