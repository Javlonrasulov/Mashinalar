/** API / operator bilan bir xil sahifa kalitlari */
export const ADMIN_PAGE_KEYS = [
  'DASHBOARD',
  'MAP',
  'VEHICLES',
  'DRIVERS',
  'TASKS',
  'FUEL',
  'DAILY_KM',
  'DAILY_KM_GAPS',
  'OIL',
  'EXPENSES',
  'EXPENSES_STATS',
] as const;

export type AdminPageKey = (typeof ADMIN_PAGE_KEYS)[number];

export function pathnameToAdminPageKey(pathname: string): AdminPageKey | null {
  const p = pathname.replace(/\/$/, '') || '/';
  if (p === '/' || p === '') return 'DASHBOARD';
  if (p.startsWith('/system-users')) return null;
  if (p.startsWith('/vehicles')) return 'VEHICLES';
  if (p.startsWith('/drivers')) return 'DRIVERS';
  if (p.startsWith('/tasks')) return 'TASKS';
  if (p.startsWith('/fuel')) return 'FUEL';
  if (p.startsWith('/daily-km/gaps')) return 'DAILY_KM_GAPS';
  if (p.startsWith('/daily-km')) return 'DAILY_KM';
  if (p.startsWith('/oil')) return 'OIL';
  if (p.startsWith('/expenses/stats')) return 'EXPENSES_STATS';
  if (p.startsWith('/expenses')) return 'EXPENSES';
  if (p.startsWith('/map')) return 'MAP';
  return null;
}

/** Operator uchun birinchi ochiq sahifa (yo‘nalish) */
export function firstAllowedHref(allowed: string[] | undefined): string {
  const pages = allowed ?? [];
  const order: { path: string; key: AdminPageKey }[] = [
    { path: '/', key: 'DASHBOARD' },
    { path: '/map', key: 'MAP' },
    { path: '/vehicles', key: 'VEHICLES' },
    { path: '/drivers', key: 'DRIVERS' },
    { path: '/tasks', key: 'TASKS' },
    { path: '/fuel', key: 'FUEL' },
    { path: '/daily-km', key: 'DAILY_KM' },
    { path: '/daily-km/gaps', key: 'DAILY_KM_GAPS' },
    { path: '/oil', key: 'OIL' },
    { path: '/expenses', key: 'EXPENSES' },
    { path: '/expenses/stats', key: 'EXPENSES_STATS' },
  ];
  for (const { path, key } of order) {
    if (pages.includes(key)) return path;
  }
  return '/';
}

/** Checkbox yorliqlari uchun i18n kalitlari (mavjud nav kalitlari) */
export const ADMIN_PAGE_LABEL_KEYS: Record<AdminPageKey, string> = {
  DASHBOARD: 'navDashboard',
  MAP: 'navMap',
  VEHICLES: 'navVehicles',
  DRIVERS: 'navDrivers',
  TASKS: 'navTasks',
  FUEL: 'navFuel',
  DAILY_KM: 'navDailyKm',
  DAILY_KM_GAPS: 'navDailyKmGaps',
  OIL: 'navOil',
  EXPENSES: 'navExpenses',
  EXPENSES_STATS: 'navExpensesStats',
};
