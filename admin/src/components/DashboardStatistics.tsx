import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { useI18n, type Lang } from '@/i18n/I18nContext';
import { clsx } from 'clsx';

type ChartKind = 'bar' | 'line' | 'pie';

type StatisticsPayload = {
  period: { from: string; to: string };
  kmByVehicle: { vehicleId: string; plateNumber: string; name: string; totalKm: number }[];
  expensesByVehicle: { vehicleId: string; plateNumber: string; name: string; totalAmount: number }[];
  fuelByVehicle: { vehicleId: string; plateNumber: string; name: string; reportCount: number; totalAmount: number }[];
  driversIncomplete: {
    driverId: string;
    fullName: string;
    phone: string;
    openTasks: number;
    overdueOpenTasks: number;
  }[];
};

const CHART_COLORS = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#db2777', '#059669', '#4f46e5', '#b45309'];

function intlLocaleFor(lang: Lang): string {
  if (lang === 'ru') return 'ru-RU';
  if (lang === 'uzCyrl') return 'ru-RU';
  return 'uz-Latn-UZ';
}

function formatIsoDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocaleFor(lang), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatNumber(n: number, lang: Lang): string {
  return new Intl.NumberFormat(intlLocaleFor(lang), { maximumFractionDigits: n >= 100 ? 0 : 1 }).format(n);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 30);
  return { from: toYmd(from), to: toYmd(to) };
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ChartToggle({
  value,
  onChange,
  labels,
  ariaLabel,
}: {
  value: ChartKind;
  onChange: (v: ChartKind) => void;
  labels: Record<ChartKind, string>;
  ariaLabel: string;
}) {
  const kinds: ChartKind[] = ['bar', 'line', 'pie'];
  return (
    <div
      className="flex w-full flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60 sm:w-auto"
      role="group"
      aria-label={ariaLabel}
    >
      {kinds.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={clsx(
            'min-h-[40px] min-w-0 flex-1 rounded-lg px-2.5 py-2 text-xs font-semibold transition sm:flex-none sm:px-3 sm:text-sm',
            value === k
              ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300'
              : 'text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-900/40',
          )}
        >
          {labels[k]}
        </button>
      ))}
    </div>
  );
}

function VehicleValueChart({
  title,
  rows,
  valueKey,
  nameKey,
  chartKind,
  onChartKind,
  chartLabels,
  chartToggleAria,
  tickColor,
  gridColor,
  lang,
  valueLabel,
  emptyLabel,
}: {
  title: string;
  rows: Record<string, string | number>[];
  valueKey: string;
  nameKey: string;
  chartKind: ChartKind;
  onChartKind: (k: ChartKind) => void;
  chartLabels: Record<ChartKind, string>;
  chartToggleAria: string;
  tickColor: string;
  gridColor: string;
  lang: Lang;
  valueLabel: string;
  emptyLabel: string;
}) {
  const data = useMemo(() => {
    const top = rows.slice(0, 12).map((r) => ({
      ...r,
      label: String(r[nameKey]),
    }));
    return top;
  }, [rows, nameKey]);

  const tooltipFmt = useCallback(
    (v: number) => formatNumber(v, lang),
    [lang],
  );

  if (!data.length) {
    return (
      <div className="app-card rounded-xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white sm:text-base">{title}</h2>
          <ChartToggle value={chartKind} onChange={onChartKind} labels={chartLabels} ariaLabel={chartToggleAria} />
        </div>
        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="app-card rounded-xl p-3 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 dark:border-slate-800 lg:flex-row lg:items-start lg:justify-between">
        <h2 className="text-sm font-bold leading-snug text-slate-900 dark:text-white sm:text-base">{title}</h2>
        <ChartToggle value={chartKind} onChange={onChartKind} labels={chartLabels} ariaLabel={chartToggleAria} />
      </div>
      <div className="mt-3 h-[min(52vh,320px)] w-full min-h-[220px] sm:min-h-[260px] md:min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartKind === 'pie' ? (
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Pie
                data={data}
                dataKey={valueKey}
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={32}
                outerRadius="72%"
                paddingAngle={2}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [tooltipFmt(v), valueLabel]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          ) : chartKind === 'line' ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={68} />
              <YAxis tick={{ fill: tickColor, fontSize: 11 }} width={44} tickFormatter={(v) => formatNumber(Number(v), lang)} />
              <Tooltip formatter={(v: number) => [tooltipFmt(v), valueLabel]} labelFormatter={(l) => String(l)} />
              <Line type="monotone" dataKey={valueKey} stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name={valueLabel} />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={68} />
              <YAxis tick={{ fill: tickColor, fontSize: 11 }} width={44} tickFormatter={(v) => formatNumber(Number(v), lang)} />
              <Tooltip formatter={(v: number) => [tooltipFmt(v), valueLabel]} />
              <Bar dataKey={valueKey} fill="#2563eb" radius={[6, 6, 0, 0]} name={valueLabel} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DriversChart({
  title,
  rows,
  chartKind,
  onChartKind,
  chartLabels,
  chartToggleAria,
  tickColor,
  gridColor,
  lang,
  openLabel,
  overdueLabel,
  emptyLabel,
}: {
  title: string;
  rows: { label: string; openTasks: number; overdueOpenTasks: number }[];
  chartKind: ChartKind;
  onChartKind: (k: ChartKind) => void;
  chartLabels: Record<ChartKind, string>;
  chartToggleAria: string;
  tickColor: string;
  gridColor: string;
  lang: Lang;
  openLabel: string;
  overdueLabel: string;
  emptyLabel: string;
}) {
  const data = useMemo(() => rows.slice(0, 12), [rows]);

  const tooltipFmt = useCallback((v: number) => formatNumber(v, lang), [lang]);

  if (!data.length) {
    return (
      <div className="app-card rounded-xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white sm:text-base">{title}</h2>
          <ChartToggle value={chartKind} onChange={onChartKind} labels={chartLabels} ariaLabel={chartToggleAria} />
        </div>
        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="app-card rounded-xl p-3 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 dark:border-slate-800 lg:flex-row lg:items-start lg:justify-between">
        <h2 className="text-sm font-bold leading-snug text-slate-900 dark:text-white sm:text-base">{title}</h2>
        <ChartToggle value={chartKind} onChange={onChartKind} labels={chartLabels} ariaLabel={chartToggleAria} />
      </div>
      <div className="mt-3 h-[min(52vh,340px)] w-full min-h-[240px] sm:min-h-[280px] md:min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartKind === 'pie' ? (
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Pie
                data={data.map((d) => ({ ...d, value: d.openTasks }))}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={32}
                outerRadius="72%"
                paddingAngle={2}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [tooltipFmt(v), openLabel]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          ) : chartKind === 'line' ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 9 }} interval={0} angle={-32} textAnchor="end" height={78} />
              <YAxis tick={{ fill: tickColor, fontSize: 11 }} width={36} allowDecimals={false} />
              <Tooltip
                formatter={(v: number, name) => [tooltipFmt(v), name === 'openTasks' ? openLabel : overdueLabel]}
                labelFormatter={(l) => String(l)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="openTasks" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name={openLabel} />
              <Line type="monotone" dataKey="overdueOpenTasks" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} name={overdueLabel} />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 9 }} interval={0} angle={-32} textAnchor="end" height={78} />
              <YAxis tick={{ fill: tickColor, fontSize: 11 }} width={36} allowDecimals={false} />
              <Tooltip
                formatter={(v: number, name) => [tooltipFmt(v), name === 'openTasks' ? openLabel : overdueLabel]}
                labelFormatter={(l) => String(l)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="openTasks" fill="#2563eb" name={openLabel} radius={[6, 6, 0, 0]} />
              <Bar dataKey="overdueOpenTasks" fill="#d97706" name={overdueLabel} radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FuelComboChart({
  title,
  rows,
  chartKind,
  onChartKind,
  chartLabels,
  chartToggleAria,
  tickColor,
  gridColor,
  lang,
  countLabel,
  sumLabel,
  emptyLabel,
}: {
  title: string;
  rows: { label: string; reportCount: number; totalAmount: number }[];
  chartKind: ChartKind;
  onChartKind: (k: ChartKind) => void;
  chartLabels: Record<ChartKind, string>;
  chartToggleAria: string;
  tickColor: string;
  gridColor: string;
  lang: Lang;
  countLabel: string;
  sumLabel: string;
  emptyLabel: string;
}) {
  const data = useMemo(() => rows.slice(0, 12), [rows]);

  if (!data.length) {
    return (
      <div className="app-card rounded-xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white sm:text-base">{title}</h2>
          <ChartToggle value={chartKind} onChange={onChartKind} labels={chartLabels} ariaLabel={chartToggleAria} />
        </div>
        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="app-card rounded-xl p-3 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 dark:border-slate-800 lg:flex-row lg:items-start lg:justify-between">
        <h2 className="text-sm font-bold leading-snug text-slate-900 dark:text-white sm:text-base">{title}</h2>
        <ChartToggle value={chartKind} onChange={onChartKind} labels={chartLabels} ariaLabel={chartToggleAria} />
      </div>
      <div className="mt-3 h-[min(52vh,340px)] w-full min-h-[240px] sm:min-h-[280px] md:min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartKind === 'pie' ? (
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Pie
                data={data.map((d) => ({ ...d, value: d.reportCount }))}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={32}
                outerRadius="72%"
                paddingAngle={2}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [String(v), countLabel]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          ) : chartKind === 'line' ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={68} />
              <YAxis yAxisId="left" tick={{ fill: tickColor, fontSize: 11 }} width={40} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: tickColor, fontSize: 11 }} width={52} />
              <Tooltip
                formatter={(v: number, name) =>
                  name === 'reportCount' ? [String(v), countLabel] : [formatNumber(v, lang), sumLabel]
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left" type="monotone" dataKey="reportCount" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name={countLabel} />
              <Line yAxisId="right" type="monotone" dataKey="totalAmount" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} name={sumLabel} />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={68} />
              <YAxis yAxisId="left" tick={{ fill: tickColor, fontSize: 11 }} width={40} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: tickColor, fontSize: 11 }} width={56} tickFormatter={(v) => formatNumber(Number(v), lang)} />
              <Tooltip
                formatter={(v: number, name) =>
                  name === 'reportCount' ? [String(v), countLabel] : [formatNumber(v, lang), sumLabel]
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="reportCount" fill="#2563eb" name={countLabel} radius={[6, 6, 0, 0]} />
              <Bar yAxisId="right" dataKey="totalAmount" fill="#0d9488" name={sumLabel} radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DashboardStatistics() {
  const { t, lang } = useI18n();
  const { resolvedTheme } = useTheme();
  const [range, setRange] = useState(defaultRange);
  const [data, setData] = useState<StatisticsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [kmKind, setKmKind] = useState<ChartKind>('bar');
  const [expKind, setExpKind] = useState<ChartKind>('bar');
  const [fuelKind, setFuelKind] = useState<ChartKind>('bar');
  const [drvKind, setDrvKind] = useState<ChartKind>('bar');

  const tickColor = resolvedTheme === 'dark' ? '#94a3b8' : '#64748b';
  const gridColor = resolvedTheme === 'dark' ? '#334155' : '#e2e8f0';

  const chartLabels = useMemo(
    () =>
      ({
        bar: t('statsChartBar'),
        line: t('statsChartLine'),
        pie: t('statsChartPie'),
      }) as Record<ChartKind, string>,
    [t],
  );

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const q = `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
      const d = await api<StatisticsPayload>(`/dashboard/statistics${q}`);
      setData(d);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('genericError'));
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, t]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const kmRows = useMemo(
    () =>
      (data?.kmByVehicle ?? []).map((r) => ({
        plateNumber: r.plateNumber,
        totalKm: r.totalKm,
      })),
    [data],
  );

  const expRows = useMemo(
    () =>
      (data?.expensesByVehicle ?? []).map((r) => ({
        plateNumber: r.plateNumber,
        totalAmount: r.totalAmount,
      })),
    [data],
  );

  const fuelRows = useMemo(
    () =>
      (data?.fuelByVehicle ?? []).map((r) => ({
        label: r.plateNumber,
        reportCount: r.reportCount,
        totalAmount: r.totalAmount,
      })),
    [data],
  );

  const driverRows = useMemo(
    () =>
      (data?.driversIncomplete ?? []).map((d) => ({
        label: d.fullName.length > 18 ? `${d.fullName.slice(0, 16)}…` : d.fullName,
        openTasks: d.openTasks,
        overdueOpenTasks: d.overdueOpenTasks,
      })),
    [data],
  );

  if (err) {
    return (
      <section className="mt-8 border-t border-slate-200/90 pt-6 dark:border-slate-800 sm:mt-10 sm:pt-8" aria-label={t('navStatistics')}>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{err}</div>
      </section>
    );
  }

  return (
    <section className="mt-8 w-full space-y-4 border-t border-slate-200/90 pt-6 dark:border-slate-800 sm:mt-10 sm:space-y-5 sm:pt-8" aria-label={t('navStatistics')}>
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:p-4 md:p-5">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">{t('navStatistics')}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{t('statsIntro')}</p>
          {data && (
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
              {t('statsPeriod')}: {formatIsoDate(data.period.from, lang)} — {formatIsoDate(data.period.to, lang)}
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 min-[360px]:flex-row min-[360px]:items-end sm:w-auto sm:gap-3">
          <div className="grid w-full grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:w-auto">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('mapFrom')}
              <input
                type="date"
                className="app-input mt-1 w-full min-w-0"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('mapTo')}
              <input
                type="date"
                className="app-input mt-1 w-full min-w-0"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              />
            </label>
          </div>
          <button type="button" className="app-btn-primary h-10 w-full shrink-0 px-4 min-[360px]:w-auto" onClick={() => load()} disabled={loading}>
            {loading ? '…' : t('refresh')}
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-24 text-slate-500">
          <span className="inline-flex items-center gap-2 text-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            …
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:gap-6">
          <div className="min-w-0 md:col-span-2">
            <VehicleValueChart
              title={t('statsKmTitle')}
              rows={kmRows}
              valueKey="totalKm"
              nameKey="plateNumber"
              chartKind={kmKind}
              onChartKind={setKmKind}
              chartLabels={chartLabels}
              chartToggleAria={t('statsChartGroupAria')}
              tickColor={tickColor}
              gridColor={gridColor}
              lang={lang}
              valueLabel={t('statsKmAxis')}
              emptyLabel={t('statsEmpty')}
            />
          </div>
          <div className="min-w-0">
            <VehicleValueChart
              title={t('statsExpensesTitle')}
              rows={expRows}
              valueKey="totalAmount"
              nameKey="plateNumber"
              chartKind={expKind}
              onChartKind={setExpKind}
              chartLabels={chartLabels}
              chartToggleAria={t('statsChartGroupAria')}
              tickColor={tickColor}
              gridColor={gridColor}
              lang={lang}
              valueLabel={t('statsMoneyAxis')}
              emptyLabel={t('statsEmpty')}
            />
          </div>
          <div className="min-w-0">
            <FuelComboChart
              title={t('statsFuelTitle')}
              rows={fuelRows}
              chartKind={fuelKind}
              onChartKind={setFuelKind}
              chartLabels={chartLabels}
              chartToggleAria={t('statsChartGroupAria')}
              tickColor={tickColor}
              gridColor={gridColor}
              lang={lang}
              countLabel={t('statsFuelCount')}
              sumLabel={t('statsMoneyAxis')}
              emptyLabel={t('statsEmpty')}
            />
          </div>
          <div className="min-w-0 md:col-span-2">
            <DriversChart
              title={t('statsDriversTitle')}
              rows={driverRows}
              chartKind={drvKind}
              onChartKind={setDrvKind}
              chartLabels={chartLabels}
              chartToggleAria={t('statsChartGroupAria')}
              tickColor={tickColor}
              gridColor={gridColor}
              lang={lang}
              openLabel={t('statsOpenTasks')}
              overdueLabel={t('statsOverdueOpen')}
              emptyLabel={t('statsDriversEmpty')}
            />
          </div>
        </div>
      )}
    </section>
  );
}
