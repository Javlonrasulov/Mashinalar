import type { Lang } from '@/i18n/I18nContext';

export function intlLocaleFor(lang: Lang): string {
  if (lang === 'ru') return 'ru-RU';
  if (lang === 'uzCyrl') return 'ru-RU';
  return 'uz-Latn-UZ';
}

export function formatDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat(intlLocaleFor(lang), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatDateTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat(intlLocaleFor(lang), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatTimeOnly(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat(intlLocaleFor(lang), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDurationMinutes(
  totalMinutes: number,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '—';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return t('durationHoursMinutes', { h: String(h), m: String(m) });
  if (h > 0) return t('durationHours', { h: String(h) });
  return t('durationMinutes', { m: String(m) });
}

export function formatDuration(ms: number, lang: Lang): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;
  const days = Math.floor(ms / dayMs);
  const hours = Math.floor((ms % dayMs) / hourMs);
  const minutes = Math.floor((ms % hourMs) / minuteMs);
  if (lang === 'ru') {
    const parts: string[] = [];
    if (days) parts.push(`${days} д`);
    if (hours) parts.push(`${hours} ч`);
    if (!days && !hours) parts.push(`${minutes} мин`);
    else if (minutes) parts.push(`${minutes} мин`);
    return parts.join(' ') || '0 мин';
  }
  const parts: string[] = [];
  if (days) parts.push(`${days} kun`);
  if (hours) parts.push(`${hours} soat`);
  if (!days && !hours) parts.push(`${minutes} daqiqa`);
  else if (minutes) parts.push(`${minutes} daqiqa`);
  return parts.join(' ') || '0 daqiqa';
}
