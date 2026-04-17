<script setup lang="ts">
import { RpaActions, RpaRoutes } from '@/rpa/selectors';

/**
 * Левая навигация КМИС. Каждый пункт помечен data-rpa-action
 * для семантической навигации агентом без разбора URL.
 */
const items = [
  { to: '/intake', label: 'Первичный прием', action: RpaActions.navIntake, route: RpaRoutes.intake },
  { to: '/epicrisis', label: 'Эпикриз', action: RpaActions.navEpicrisis, route: RpaRoutes.epicrisis },
  { to: '/schedule', label: 'Расписание', action: RpaActions.navSchedule, route: RpaRoutes.schedule },
] as const;
</script>

<template>
  <aside
    class="w-56 shrink-0 border-r border-kmis-border bg-kmis-panel"
    data-rpa-region="sidebar"
  >
    <nav class="flex flex-col py-2">
      <router-link
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        :data-rpa-action="item.action"
        :data-rpa-route="item.route"
        class="px-4 py-2 text-sm text-kmis-ink hover:bg-gray-100 border-l-2 border-transparent"
        active-class="!border-kmis-accent !bg-blue-50 font-semibold text-kmis-accent"
      >
        {{ item.label }}
      </router-link>
    </nav>
  </aside>
</template>
