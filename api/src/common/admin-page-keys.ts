/** Admin panel sahifalari — JWT/DB va front bilan bir xil kalitlar */
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

export function isAdminPageKey(v: string): v is AdminPageKey {
  return (ADMIN_PAGE_KEYS as readonly string[]).includes(v);
}
