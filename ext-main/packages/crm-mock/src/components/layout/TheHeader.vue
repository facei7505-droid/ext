<script setup lang="ts">
/**
 * Шапка КМИС: системное имя и данные «текущего пользователя».
 * Используется во всех layout-страницах.
 */
const appVersion = '0.1.0-demo';
</script>

<template>
  <header
    class="flex items-center justify-between border-b border-kmis-border bg-kmis-panel px-4 py-2"
    data-rpa-region="header"
  >
    <div class="flex items-baseline gap-3">
      <span class="text-base font-bold text-kmis-accent">КМИС</span>
      <span class="text-xs text-kmis-muted">Клиническая медицинская информационная система</span>
    </div>
    <div class="flex items-center gap-4 text-xs text-kmis-muted">
      <span>Версия {{ appVersion }}</span>
      <span data-rpa-field="currentUser.fullName">Иванов И.И. (врач-терапевт)</span>
    </div>
  </header>
</template>
