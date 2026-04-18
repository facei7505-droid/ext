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
    redirect: '/intake-damumed',
  },
  {
    path: '/intake',
    name: 'intake',
    component: () => import('@/views/IntakeView.vue'),
    meta: { title: 'Первичный прием', rpaRoute: 'intake' },
  },
  {
    path: '/intake-damumed',
    name: 'intake-damumed',
    component: () => import('@/views/IntakeDamumed.vue'),
    meta: { title: 'Первичный осмотр (Дамумед)', rpaRoute: 'intake' },
  },
  {
    path: '/epicrisis',
    name: 'epicrisis',
    component: () => import('@/views/EpicrisisView.vue'),
    meta: { title: 'Эпикриз', rpaRoute: 'epicrisis' },
  },
  {
    path: '/epicrisis-damumed',
    name: 'epicrisis-damumed',
    component: () => import('@/views/EpicrisisDamumed.vue'),
    meta: { title: 'Выписной эпикриз (Дамумед)', rpaRoute: 'epicrisis' },
  },
  {
    path: '/diary-damumed',
    name: 'diary-damumed',
    component: () => import('@/views/DiaryDamumed.vue'),
    meta: { title: 'Дневниковая запись (Дамумед)', rpaRoute: 'diary' },
  },
  {
    path: '/diagnoses-damumed',
    name: 'diagnoses-damumed',
    component: () => import('@/views/DiagnosesDamumed.vue'),
    meta: { title: 'Диагнозы (Дамумед)', rpaRoute: 'diagnoses' },
  },
  {
    path: '/assignments-damumed',
    name: 'assignments-damumed',
    component: () => import('@/views/AssignmentsDamumed.vue'),
    meta: { title: 'Назначения (Дамумед)', rpaRoute: 'assignments' },
  },
  {
    path: '/schedule-damumed',
    name: 'schedule-damumed',
    component: () => import('@/views/ScheduleDamumed.vue'),
    meta: { title: 'Умное расписание (Дамумед)', rpaRoute: 'schedule' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/intake-damumed',
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
