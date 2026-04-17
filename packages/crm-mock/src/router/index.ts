import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

/**
 * Hash-роутинг специально выбран для статического SPA-билда:
 * позволяет хостить КМИС-мокап из любого origin (в т.ч. file://, GitHub Pages)
 * без серверных переписываний — это важно при прогоне Chrome Extension.
 *
 * data-rpa-route в meta используется RPA-агентом для семантической навигации:
 * вместо хрупких URL агент получает стабильный ключ маршрута.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/intake',
  },
  {
    path: '/intake',
    name: 'intake',
    component: () => import('@/views/IntakeView.vue'),
    meta: { title: 'Первичный прием', rpaRoute: 'intake' },
  },
  {
    path: '/epicrisis',
    name: 'epicrisis',
    component: () => import('@/views/EpicrisisView.vue'),
    meta: { title: 'Эпикриз', rpaRoute: 'epicrisis' },
  },
  {
    path: '/schedule',
    name: 'schedule',
    component: () => import('@/views/ScheduleView.vue'),
    meta: { title: 'Расписание', rpaRoute: 'schedule' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/intake',
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? 'КМИС';
  document.title = `КМИС — ${title}`;
});
