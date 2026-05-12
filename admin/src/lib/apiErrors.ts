type TFn = (key: string, vars?: Record<string, string>) => string;

/**
 * Backenddan keladigan tanish xato kodlari va ularning i18n kalitlari.
 * Agar xato kodi parametrlar bilan kelsa (masalan, `code:param1:param2`),
 * `params` ro‘yxati har bir tirnoq orasidagi qiymatni nomli o‘zgaruvchiga bog‘laydi.
 */
const KNOWN_CODES: Record<string, { i18n: string; params?: string[] }> = {
  login_taken: { i18n: 'apiError_login_taken' },
  operator_no_pages: { i18n: 'apiError_operator_no_pages' },
  vehicle_already_assigned: {
    i18n: 'apiError_vehicle_already_assigned',
    params: ['name'],
  },
};

/**
 * Backend xato matnini i18n bo‘yicha tarjima qiladi. Agar matn tanimas bo‘lsa,
 * asl xabarni qaytaradi.
 */
export function translateApiError(t: TFn, message: unknown): string {
  const raw = message instanceof Error ? message.message : String(message ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const sep = trimmed.indexOf(':');
  const code = sep === -1 ? trimmed : trimmed.slice(0, sep);
  const rest = sep === -1 ? '' : trimmed.slice(sep + 1);
  const def = KNOWN_CODES[code];
  if (!def) return raw;
  const vars: Record<string, string> = {};
  if (def.params && rest) {
    const parts = rest.split(':');
    def.params.forEach((p, i) => {
      vars[p] = (parts[i] ?? '').trim();
    });
  }
  const translated = t(def.i18n, vars);
  if (translated && translated !== def.i18n) return translated;
  return raw;
}
