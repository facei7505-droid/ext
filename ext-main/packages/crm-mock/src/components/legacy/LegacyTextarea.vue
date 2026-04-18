<script setup lang="ts">
/**
 * Textarea для клинических текстов (жалобы, анамнез, рекомендации).
 * RPA: event 'input' (v-model в Vue 3 слушает input).
 */
import { computed } from 'vue';

interface Props {
  modelValue: string;
  id: string;
  field: string;
  label?: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  maxlength?: number;
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  placeholder: '',
  rows: 3,
  required: false,
  disabled: false,
  maxlength: 4000,
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
    <textarea
      :id="id"
      v-model="value"
      class="kmis-field resize-y leading-5"
      :rows="rows"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :maxlength="maxlength"
      :name="field"
      :data-rpa-field="field"
      data-rpa-type="textarea"
    />
  </div>
</template>
