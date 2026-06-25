import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Maximize2, Minimize2, ArrowDown, ArrowUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n, type Lang } from '@/i18n/I18nContext';
import { DateRangeField } from '@/components/DateRangeField';
import { ExpensesSubNav } from '@/components/ExpensesSubNav';
import { gasStatRankColors } from '@/lib/gasStatsColors';
import {
  appendSpentRangeParams,
  defaultExpenseDateRange,
  parseYmd,
  type SpentDateRangeYmd,
} from '@/lib/spentRangeQuery';

const DAY_CELL_W = '1.375rem';

type DayKmStatus = { start: boolean; end: boolean };

type GasVehicleStat = {
  vehicleId: string;
  plateNumber: string;
  name: string;
  driverName: string;
  totalKm: number;
  totalAmount: string;
  totalVolumeM3: string | null;
  fuelReportCount: number;
  costPerKm: number | null;
  dailyKm: DayKmStatus[];
};

type GasStatsPayload = {
  rangeFrom: string | null;
  rangeTo: string | null;
  days: string[];
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
  return new Intl.NumberFormat(intlLocaleFor(lang), {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n);
}

type GasSortKey = 'totalKm' | 'volume' | 'totalAmount' | 'costPerKm';

function compareNullableNum(
  a: number | null,
  b: number | null,
  dir: 'asc' | 'desc',
): number {
  const d = dir === 'desc' ? -1 : 1;
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * d;
}

function SortTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={clsx('p-3 text-right', className)}>
      <button
        type="button"
        className={clsx(
          'inline-flex w-full items-center justify-end gap-1 text-left text-inherit transition hover:text-blue-600 dark:hover:text-blue-400',
          active && 'font-semibold text-blue-600 dark:text-blue-400',
        )}
        onClick={onClick}
      >
        <span>{label}</span>
        {active ? (
          dir === 'desc' ? <ArrowDown size={14} aria-hidden /> : <ArrowUp size={14} aria-hidden />
        ) : (
          <span className="inline-block w-3.5" aria-hidden />
        )}
      </button>
    </th>
  );
}

function dayOfMonth(ymd: string): number {
  const d = parseYmd(ymd);
  return Number.isFinite(d.getTime()) ? d.getDate() : Number(ymd.slice(8, 10));
}

function DayKmBars({ status, startLabel, endLabel, missingLabel }: {
  status: DayKmStatus;
  startLabel: string;
  endLabel: string;
  missingLabel: string;
}) {
  return (
    <div className="mt-0.5 flex w-full flex-col gap-px">
      <span
        className={clsx(
          'block h-1 w-full rounded-sm',
          status.start ? 'bg-blue-500 dark:bg-blue-400' : 'bg-slate-200 dark:bg-slate-700',
        )}
        title={status.start ? startLabel : missingLabel}
      />
      <span
        className={clsx(
          'block h-1 w-full rounded-sm',
          status.end ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700',
        )}
        title={status.end ? endLabel : missingLabel}
      />
    </div>
  );
}

function DaysHeader({ days }: { days: string[] }) {
  return (
    <div className="flex gap-0.5">
      {days.map((date) => (
        <div
          key={date}
          className="shrink-0 text-center text-[10px] font-semibold tabular-nums text-slate-500 dark:text-slate-400"
          style={{ width: DAY_CELL_W }}
        >
          {dayOfMonth(date)}
        </div>
      ))}
    </div>
  );
}

function DaysRow({ days, dailyKm, startLabel, endLabel, missingLabel }: {
  days: string[];
  dailyKm: DayKmStatus[];
  startLabel: string;
  endLabel: string;
  missingLabel: string;
}) {
  return (
    <div className="flex gap-0.5">
      {days.map((date, i) => (
        <div key={date} className="shrink-0" style={{ width: DAY_CELL_W }}>
          <DayKmBars
            status={dailyKm[i] ?? { start: false, end: false }}
            startLabel={startLabel}
            endLabel={endLabel}
            missingLabel={missingLabel}
          />
        </div>
      ))}
    </div>
  );
}

export function ExpensesGasStatsPage() {
  const { t, lang } = useI18n();
  const tableStageRef = useRef<HTMLDivElement>(null);
  const [tableFs, setTableFs] = useState(false);
  const [spentDateRange, setSpentDateRange] = useState<SpentDateRangeYmd | null>(defaultExpenseDateRange);
  const [search, setSearch] = useState('');
  const [days, setDays] = useState<string[]>([]);
  const [rows, setRows] = useState<GasVehicleStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<GasSortKey>('costPerKm');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function toggleSort(key: GasSortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  }

  const load = async () => {
    const p = new URLSearchParams();
    appendSpentRangeParams(p, spentDateRange);
    const qs = p.toString() ? `?${p.toString()}` : '';
    setLoading(true);
    try {
      const data = await api<GasStatsPayload>(`/expenses/stats/gas-by-vehicle${qs}`);
      setDays(data.days ?? []);
      setRows(data.vehicles ?? []);
    } catch {
      setDays([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, [spentDateRange]);

  useEffect(() => {
    const el = tableStageRef.current;
    if (!el) return;
    const sync = () => setTableFs(Boolean(el && document.fullscreenElement === el));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  async function toggleTableFullscreen() {
    const el = tableStageRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* ignore */
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [r.plateNumber, r.name, r.driverName, String(r.totalKm), r.totalAmount]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'totalKm':
          cmp = compareNullableNum(a.totalKm, b.totalKm, sortDir);
          break;
        case 'volume':
          cmp = compareNullableNum(
            a.totalVolumeM3 != null ? Number(a.totalVolumeM3) : null,
            b.totalVolumeM3 != null ? Number(b.totalVolumeM3) : null,
            sortDir,
          );
          break;
        case 'totalAmount':
          cmp = compareNullableNum(Number(a.totalAmount), Number(b.totalAmount), sortDir);
          break;
        case 'costPerKm':
        default:
          cmp = compareNullableNum(a.costPerKm, b.costPerKm, sortDir);
          break;
      }
      if (cmp !== 0) return cmp;
      return a.plateNumber.localeCompare(b.plateNumber);
    });
    return list;
  }, [filtered, sortBy, sortDir]);

  const costRankByVehicleId = useMemo(() => {
    const byCost = [...filtered].sort((a, b) =>
      compareNullableNum(a.costPerKm, b.costPerKm, 'desc'),
    );
    const map = new Map<string, number>();
    byCost.forEach((r, i) => map.set(r.vehicleId, i));
    return map;
  }, [filtered]);

  const maxCost = useMemo(() => {
    let m = 0;
    for (const r of filtered) {
      if (r.costPerKm != null && r.costPerKm > m) m = r.costPerKm;
    }
    return m;
  }, [filtered]);

  const startLegend = t('dailyKmOverviewPanelStartOk');
  const endLegend = t('dailyKmOverviewPanelEndOk');
  const missingLegend = t('gasStatsKmLegendMissing');

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

      <div
        ref={tableStageRef}
        className={clsx(
          'app-card relative min-w-0 overflow-hidden',
          '[:fullscreen]:!fixed [:fullscreen]:!inset-0 [:fullscreen]:z-[500] [:fullscreen]:flex [:fullscreen]:!h-screen [:fullscreen]:!max-h-none [:fullscreen]:!w-screen [:fullscreen]:flex-col',
          '[:fullscreen]:rounded-none [:fullscreen]:bg-white dark:[:fullscreen]:bg-slate-950',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 dark:border-slate-800 sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-500 dark:text-slate-400">{t('gasStatsKmLegendTitle')}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-5 rounded-sm bg-blue-500 dark:bg-blue-400" />
              {startLegend}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-5 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
              {endLegend}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-5 rounded-sm bg-slate-200 dark:bg-slate-700" />
              {missingLegend}
            </span>
          </div>
          <button
            type="button"
            className={clsx(
              'app-btn-ghost inline-flex h-9 w-9 shrink-0 items-center justify-center p-0',
              tableFs && 'ring-2 ring-blue-400/80',
            )}
            aria-pressed={tableFs}
            aria-label={tableFs ? t('exitFullScreen') : t('fullScreen')}
            title={tableFs ? t('exitFullScreen') : t('fullScreen')}
            onClick={() => void toggleTableFullscreen()}
          >
            {tableFs ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">…</div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{t('gasStatsEmpty')}</div>
        ) : (
          <div className={clsx('app-table-wrap', tableFs && 'min-h-0 flex-1 overflow-auto')}>
            <table className="app-table-inner text-sm">
              <thead className="app-table-head">
                <tr>
                  <th className="sticky left-0 z-20 w-10 bg-slate-50 p-3 dark:bg-slate-900/95">#</th>
                  <th className="sticky left-10 z-20 min-w-[8.5rem] bg-slate-50 p-3 dark:bg-slate-900/95">{t('plate')}</th>
                  {days.length > 0 ? (
                    <th className="p-3">
                      <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{t('gasStatsColDays')}</div>
                      <DaysHeader days={days} />
                    </th>
                  ) : null}
                  <SortTh
                    label={t('gasStatsColKm')}
                    active={sortBy === 'totalKm'}
                    dir={sortDir}
                    onClick={() => toggleSort('totalKm')}
                  />
                  <SortTh
                    label={t('gasStatsColVolume')}
                    active={sortBy === 'volume'}
                    dir={sortDir}
                    onClick={() => toggleSort('volume')}
                  />
                  <SortTh
                    label={t('gasStatsColTotal')}
                    active={sortBy === 'totalAmount'}
                    dir={sortDir}
                    onClick={() => toggleSort('totalAmount')}
                  />
                  <SortTh
                    label={t('gasStatsColPerKm')}
                    active={sortBy === 'costPerKm'}
                    dir={sortDir}
                    onClick={() => toggleSort('costPerKm')}
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, idx) => {
                  const costIdx = costRankByVehicleId.get(r.vehicleId) ?? idx;
                  const colors = gasStatRankColors(costIdx, filtered.length);
                  const barPct =
                    r.costPerKm != null && maxCost > 0
                      ? Math.min(100, Math.max(4, (r.costPerKm / maxCost) * 100))
                      : 4;
                  return (
                    <tr key={r.vehicleId} className="app-table-row">
                      <td className="sticky left-0 z-10 bg-white p-3 dark:bg-slate-950">
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                          style={{ backgroundColor: colors.badge, color: colors.text }}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="sticky left-10 z-10 bg-white p-3 dark:bg-slate-950">
                        <div className="font-mono font-semibold text-slate-900 dark:text-white">{r.plateNumber}</div>
                        {r.name ? (
                          <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{r.name}</div>
                        ) : null}
                        {r.driverName && r.driverName !== '—' ? (
                          <div className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">{r.driverName}</div>
                        ) : (
                          <div className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">—</div>
                        )}
                        <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{ width: `${barPct}%`, backgroundColor: colors.bar }}
                          />
                        </div>
                      </td>
                      {days.length > 0 ? (
                        <td className="p-3">
                          <DaysRow
                            days={days}
                            dailyKm={r.dailyKm ?? []}
                            startLabel={startLegend}
                            endLabel={endLegend}
                            missingLabel={missingLegend}
                          />
                        </td>
                      ) : null}
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
