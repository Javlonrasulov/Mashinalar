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
  'SYSTEM_USERS',
] as const;

export type AdminPageKey = (typeof ADMIN_PAGE_KEYS)[number];

/**
 * GET /vehicles (barcha mashinalar ro‘yxati) — haydovchilar, vazifalar, KM va h.k. sahifalar
 * forma/select uchun ham xuddi shu endpoint ishlatiladi; operator faqat VEHICLES emas.
 */
export const ADMIN_PAGES_ALLOW_VEHICLE_LIST: readonly AdminPageKey[] = [
  'VEHICLES',
  'MAP',
  'DRIVERS',
  'TASKS',
  'FUEL',
  'EXPENSES',
  'EXPENSES_STATS',
  'OIL',
  'DAILY_KM',
  'DAILY_KM_GAPS',
];

/**
 * GET /drivers — mashinalar / vazifalar formalarida haydovchilar ro‘yxati kerak.
 * (Yangi admin endpoint qo‘shsangiz: UI qaysi sahifadan chaqirilishini tekshirib, shu ro‘yxatga qo‘shing yoki alohida @AdminRoutePageAny yozing.)
 */
export const ADMIN_PAGES_ALLOW_DRIVER_LIST: readonly AdminPageKey[] = [
  'DRIVERS',
  'VEHICLES',
  'TASKS',
];

/** GET /expense-categories — xarajatlar va statistika sahifalari */
export const ADMIN_PAGES_ALLOW_EXPENSE_CATEGORY_LIST: readonly AdminPageKey[] = [
  'EXPENSES',
  'EXPENSES_STATS',
];

/** Kun KM / oraliq KM — front ikkala kalitni bir sahifada ishlatishi mumkin */
export const ADMIN_PAGES_DAILY_KM_SHARED: readonly AdminPageKey[] = ['DAILY_KM', 'DAILY_KM_GAPS'];

/** Zapravka xaritasi (OSM) — «Заправкалар» sahifasida ham xarita qatlami */
export const ADMIN_PAGES_MAP_FUEL_OSM: readonly AdminPageKey[] = ['MAP', 'FUEL'];

/** PATCH .../gas-price — faqat gaz narxi (FUEL sahifasi) */
export const ADMIN_PAGES_VEHICLE_GAS_PRICE: readonly AdminPageKey[] = ['FUEL', 'VEHICLES'];

export function isAdminPageKey(v: string): v is AdminPageKey {
  return (ADMIN_PAGE_KEYS as readonly string[]).includes(v);
}
