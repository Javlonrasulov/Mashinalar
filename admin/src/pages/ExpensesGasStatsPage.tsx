import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useI18n, type Lang } from '@/i18n/I18nContext';
import { DateRangeField } from '@/components/DateRangeField';
import { ExpensesSubNav } from '@/components/ExpensesSubNav';
import { gasStatRankColors } from '@/lib/gasStatsColors';
import { appendSpentRangeParams, defaultExpenseDateRange, type SpentDateRangeYmd } from '@/lib/spentRangeQuery';

type GasVehicleStat = {
  vehicleId: string;
  plateNumber: string;
  name: string;
  totalKm: number;
  totalAmount: string;
  totalVolumeM3: string | null;
  fuelReportCount: number;
  costPerKm: number | null;
};

type GasStatsPayload = {
  rangeFrom: string | null;
  rangeTo: string | null;
  vehicles: GasVehicleStat[];
};

function intlLocaleFor(lang: Lang): string {
  if (lang === 'ru') return 'ru-RU';
  if (lang === 'uzCyrl') return 'ru-RU';
  return 'uz-Latn-UZ';
}

function formatMoneyUz(amountStr: string, lang: Lang): string {
  const n = Number(amountStr);
  if (!Number.isFinite(n)) return amountStr;
  return new Intl.NumberFormat(intlLocaleFor(lang), {
    style: 'currency',
    currency: 'UZS',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatKm(n: number, lang: Lang): string {
  return new Intl.NumberFormat(intlLocaleFor(lang), { maximumFractionDigits: 0 }).format(n);
}

function formatVolumeM3(v: string | null, lang: Lang): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return `${new Intl.NumberFormat(intlLocaleFor(lang), { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n)} m³`;
}

function formatCostPerKm(n: number | null, lang: Lang): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const formatted = new Intl.NumberFormat(intlLocaleFor(lang), {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n);
  return formatted;
}

export function ExpensesGasStatsPage() {
  const { t, lang } = useI18n();
  const [spentDateRange, setSpentDateRange] = useState<SpentDateRangeYmd | null>(defaultExpenseDateRange);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<GasVehicleStat[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const p = new URLSearchParams();
    appendSpentRangeParams(p, spentDateRange);
    const qs = p.toString() ? `?${p.toString()}` : '';
    setLoading(true);
    try {
      const data = await api<GasStatsPayload>(`/expenses/stats/gas-by-vehicle${qs}`);
      setRows(data.vehicles ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, [spentDateRange]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [r.plateNumber, r.name, String(r.totalKm), r.totalAmount].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const maxCost = filtered[0]?.costPerKm ?? 0;

  return (
    <div className="app-page">
      <ExpensesSubNav />

      <h1 className="app-page-title">{t('navExpensesGasStats')}</h1>
      <p className="mb-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{t('gasStatsExplainer')}</p>

      <div className="mb-4 flex min-w-0 flex-wrap items-end gap-4">
        <div className="min-w-0 w-full sm:w-auto sm:min-w-[16rem] sm:max-w-xs">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="gas-stats-date-range">
            {t('expenseDateRange')}
          </label>
          <DateRangeField id="gas-stats-date-range" value={spentDateRange} onChange={setSpentDateRange} />
        </div>
        <div className="min-w-0 w-full sm:w-auto sm:min-w-[16rem] sm:flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="gas-stats-search">
            {t('vehicleListSearch')}
          </label>
          <input
            id="gas-stats-search"
            type="search"
            className="app-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('gasStatsSearchPlaceholder')}
          />
        </div>
      </div>

      <div className="app-card min-w-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{t('gasStatsEmpty')}</div>
        ) : (
          <div className="app-table-wrap">
            <table className="app-table-inner text-sm">
              <thead className="app-table-head">
                <tr>
                  <th className="w-10 p-3">#</th>
                  <th className="p-3">{t('plate')}</th>
                  <th className="p-3 text-right">{t('gasStatsColKm')}</th>
                  <th className="p-3 text-right">{t('gasStatsColVolume')}</th>
                  <th className="p-3 text-right">{t('gasStatsColTotal')}</th>
                  <th className="p-3 text-right">{t('gasStatsColPerKm')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const colors = gasStatRankColors(idx, filtered.length);
                  const barPct =
                    r.costPerKm != null && maxCost > 0
                      ? Math.min(100, Math.max(4, (r.costPerKm / maxCost) * 100))
                      : 4;
                  return (
                    <tr key={r.vehicleId} className="app-table-row">
                      <td className="p-3">
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                          style={{ backgroundColor: colors.badge, color: colors.text }}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-mono font-semibold text-slate-900 dark:text-white">{r.plateNumber}</div>
                        {r.name ? (
                          <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{r.name}</div>
                        ) : null}
                        <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{ width: `${barPct}%`, backgroundColor: colors.bar }}
                          />
                        </div>
                      </td>
                      <td className="p-3 text-right tabular-nums">{formatKm(r.totalKm, lang)}</td>
                      <td className="p-3 text-right tabular-nums">{formatVolumeM3(r.totalVolumeM3, lang)}</td>
                      <td className="p-3 text-right tabular-nums font-medium">{formatMoneyUz(r.totalAmount, lang)}</td>
                      <td className={clsx('p-3 text-right tabular-nums text-base font-bold')} style={{ color: colors.text }}>
                        {formatCostPerKm(r.costPerKm, lang)}
                        {r.costPerKm != null ? (
                          <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">UZS/km</span>
                        ) : (
                          <span className="ml-1 block text-xs font-normal text-slate-400">{t('gasStatsNoKm')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
