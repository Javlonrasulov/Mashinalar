import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import { DateTimeField } from '@/components/DateTimeField';
import { toDatetimeLocalValue } from '@/lib/datetimeLocal';

type GapAuditRow = {
  reportId: string;
  reportDate: string;
  vehicleId: string;
  plateNumber: string;
  driverName: string;
  startKm: string;
  endKm: string | null;
  prevReportId: string | null;
  prevReportDate: string | null;
  prevEndKm: string | null;
  gapKm: string | null;
};

function toDateInputValueLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateOnly(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

type GapTier = 'unknown' | 'ok' | 'low' | 'mid' | 'high';

function gapTier(gap: number | null): GapTier {
  if (gap == null || !Number.isFinite(gap)) return 'unknown';
  if (gap <= 0) return 'ok';
  if (gap <= 20) return 'low';
  if (gap <= 100) return 'mid';
  return 'high';
}

function rowTone(tier: GapTier): string {
  switch (tier) {
    case 'unknown':
      return 'bg-slate-50/70 dark:bg-slate-900/40';
    case 'ok':
      return 'bg-emerald-50/80 dark:bg-emerald-950/25';
    case 'low':
      return 'bg-emerald-100/85 dark:bg-emerald-950/35';
    case 'mid':
      return 'bg-amber-50/95 dark:bg-amber-950/30';
    case 'high':
      return 'bg-red-50/95 dark:bg-red-950/35';
    default:
      return '';
  }
}

function badgeClass(tier: GapTier): string {
  switch (tier) {
    case 'ok':
      return 'bg-emerald-600/15 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100';
    case 'low':
      return 'bg-emerald-700/12 text-emerald-950 dark:bg-emerald-400/12 dark:text-emerald-50';
    case 'mid':
      return 'bg-amber-500/20 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100';
    case 'high':
      return 'bg-red-600/15 text-red-950 dark:bg-red-500/20 dark:text-red-100';
    default:
      return 'bg-slate-200/60 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200';
  }
}

export function DailyKmGapsPage() {
  const { t } = useI18n();
  const [fromValue, setFromValue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return toDatetimeLocalValue(d);
  });
  const [toValue, setToValue] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toDatetimeLocalValue(d);
  });
  const [rows, setRows] = useState<GapAuditRow[]>([]);

  const { fromStr, toStr } = useMemo(() => {
    const a = toDateInputValueLocal(new Date(fromValue));
    const b = toDateInputValueLocal(new Date(toValue));
    return a <= b ? { fromStr: a, toStr: b } : { fromStr: b, toStr: a };
  }, [fromValue, toValue]);

  useEffect(() => {
    const q = `from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`;
    api<GapAuditRow[]>(`/daily-km-reports/gap-audit?${q}`).then(setRows).catch(() => setRows([]));
  }, [fromStr, toStr]);

  return (
    <div className="app-page">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="app-page-title">{t('dailyKmGapsPageTitle')}</h1>
            <Link to="/daily-km" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
              ← {t('dailyKmGapsOpenDailyKm')}
            </Link>
          </div>
          <p className="max-w-3xl text-xs leading-relaxed text-slate-600 dark:text-slate-400 sm:text-sm">{t('dailyKmGapsHint')}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('dailyKmGapsFrom')}
              <div className="w-[170px]">
                <DateTimeField value={fromValue} onChange={setFromValue} mode="date" disabled={{ after: new Date() }} />
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('dailyKmGapsTo')}
              <div className="w-[170px]">
                <DateTimeField value={toValue} onChange={setToValue} mode="date" disabled={{ after: new Date() }} />
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap overflow-x-auto">
          <table className="app-table-inner min-w-[920px] text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="p-3">{t('plate')}</th>
                <th className="p-3">{t('fullName')}</th>
                <th className="p-3">{t('dailyKmGapsColReportDay')}</th>
                <th className="p-3">{t('dailyKmGapsColPrevDay')}</th>
                <th className="p-3">{t('dailyKmGapsColPrevEnd')}</th>
                <th className="p-3">{t('dailyKmGapsColStart')}</th>
                <th className="p-3">{t('dailyKmGapsColEnd')}</th>
                <th className="p-3">{t('dailyKmGapsColGap')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="app-table-row">
                  <td colSpan={8} className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    {t('dailyKmGapsNoData')}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const g = r.gapKm == null ? NaN : Number(r.gapKm);
                  const tier = r.gapKm == null ? gapTier(null) : gapTier(g);
                  const tone = rowTone(tier);
                  return (
                    <tr key={r.reportId} className={`app-table-row ${tone}`}>
                      <td className="p-3 font-mono">{r.plateNumber}</td>
                      <td className="p-3">{r.driverName}</td>
                      <td className="p-3 whitespace-nowrap">{formatDateOnly(r.reportDate)}</td>
                      <td className="p-3 whitespace-nowrap">{formatDateOnly(r.prevReportDate)}</td>
                      <td className="p-3 tabular-nums">{r.prevEndKm ?? '—'}</td>
                      <td className="p-3 tabular-nums">{r.startKm}</td>
                      <td className="p-3 tabular-nums">{r.endKm ?? '—'}</td>
                      <td className="p-3">
                        {r.gapKm == null ? (
                          <span className="text-slate-500 dark:text-slate-400">—</span>
                        ) : (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">+{r.gapKm}</span>
                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${badgeClass(tier)}`}>
                              {tier === 'ok' && t('dailyKmGapsOk')}
                              {tier === 'low' && t('dailyKmGapsSeverityLow')}
                              {tier === 'mid' && t('dailyKmGapsSeverityMid')}
                              {tier === 'high' && t('dailyKmGapsSeverityHigh')}
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
