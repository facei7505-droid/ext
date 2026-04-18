<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed } from 'vue';
import TheHeader from '@/components/layout/TheHeader.vue';
import TheSidebar from '@/components/layout/TheSidebar.vue';

/**
 * Корневая оболочка. Атрибут data-rpa-route на main позволяет агенту
 * быстро определить текущий «экран» КМИС без разбора URL.
 */
const route = useRoute();
const currentRpaRoute = computed(() => (route.meta.rpaRoute as string | undefined) ?? 'unknown');
</script>

<template>
  <div class="flex h-full flex-col">
    <TheHeader />
    <div class="flex flex-1 min-h-0">
      <TheSidebar />
      <main
        class="flex-1 overflow-auto p-4"
        data-rpa-region="content"
        :data-rpa-route="currentRpaRoute"
      >
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>
    </div>
  </div>
</template>
