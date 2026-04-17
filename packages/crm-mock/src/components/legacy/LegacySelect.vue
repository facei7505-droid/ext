<script setup lang="ts">
/**
 * Нативный select.
 * RPA-контракт: после el.value = '...' вызвать dispatchEvent(new Event('change', { bubbles: true })).
 * Vue 3 v-model на <select> слушает 'change'.
 */
import { computed } from 'vue';

interface Option {
  value: string;
  label: string;
}

interface Props {
  modelValue: string;
  id: string;
  field: string;
  options: ReadonlyArray<Option>;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  placeholder: '— выберите —',
  required: false,
  disabled: false,
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
    <select
      :id="id"
      v-model="value"
      class="kmis-field"
      :required="required"
      :disabled="disabled"
      :name="field"
      :data-rpa-field="field"
      data-rpa-type="select"
    >
      <option value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>
