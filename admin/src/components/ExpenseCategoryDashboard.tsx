import { useMemo } from 'react';
import { Droplet, MoreHorizontal, Tag, Wrench } from 'lucide-react';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import { useI18n, type Lang } from '@/i18n/I18nContext';
import { colorForCategory } from '@/lib/expenseCategoryColors';
import { enumerateYmdRange, type SpentDateRangeYmd } from '@/lib/spentRangeQuery';

export type CategoryStatDaily = { date: string; value: number };

export type CategoryStatRow = {
  categoryId: string;
  slug: string;
  name: string;
  totalAmount: string;
  expenseCount: number;
  percent: number;
  daily: CategoryStatDaily[];
};

export type CategoryStatsPayload = {
  grandTotal: string;
  rangeFrom?: string | null;
  rangeTo?: string | null;
  categories: CategoryStatRow[];
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

function formatPercent(n: number, lang: Lang): string {
  return new Intl.NumberFormat(intlLocaleFor(lang), {
    minimumFractionDigits: n > 0 && n < 1 ? 1 : 0,
    maximumFractionDigits: 1,
  }).format(n);
}

function formatShortDate(ymd: string, lang: Lang): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return ymd;
  return new Intl.DateTimeFormat(intlLocaleFor(lang), { day: 'numeric', month: 'short' }).format(d);
}

function categoryIcon(slug: string) {
  if (slug === 'FUEL') return Droplet;
  if (slug === 'REPAIR') return Wrench;
  if (slug === 'OIL') return Droplet;
  if (slug === 'OTHER') return Tag;
  return MoreHorizontal;
}

type Props = {
  data: CategoryStatsPayload | null;
  loading?: boolean;
  /** Selected calendar range — used to align trend x-axis when API is stale. */
  spentDateRange?: SpentDateRangeYmd | null;
};

function fillDailyForRange(
  daily: CategoryStatDaily[],
  range: SpentDateRangeYmd | null | undefined,
): CategoryStatDaily[] {
  if (!range?.from || !range?.to) return daily;
  const days = enumerateYmdRange(range.from, range.to);
  if (days.length === 0) return daily;
  const byDate = new Map(daily.map((d) => [d.date, d.value]));
  return days.map((date) => ({ date, value: byDate.get(date) ?? 0 }));
}

function formatRangeLabel(range: SpentDateRangeYmd, lang: Lang): string {
  const fmt = (ymd: string) => formatShortDate(ymd, lang);
  if (range.from === range.to) return fmt(range.from);
  return `${fmt(range.from)} — ${fmt(range.to)}`;
}

export function ExpenseCategoryDashboard({ data, loading, spentDateRange }: Props) {
  const { t, lang } = useI18n();

  const categories = data?.categories ?? [];
  const grandTotal = data?.grandTotal ?? '0';

  const colored = useMemo(() => {
    const range: SpentDateRangeYmd | null =
      spentDateRange?.from && spentDateRange?.to
        ? spentDateRange
        : data?.rangeFrom && data?.rangeTo
          ? { from: data.rangeFrom, to: data.rangeTo }
          : null;

    return categories.map((c, i) => ({
      ...c,
      color: colorForCategory(c.slug, i),
      daily: fillDailyForRange(c.daily, range),
    }));
  }, [categories, spentDateRange, data?.rangeFrom, data?.rangeTo]);

  const activeRange: SpentDateRangeYmd | null =
    spentDateRange?.from && spentDateRange?.to
      ? spentDateRange
      : data?.rangeFrom && data?.rangeTo
        ? { from: data.rangeFrom, to: data.rangeTo }
        : null;

  const showTrend =
    colored.length > 0 &&
    (activeRange != null || colored.some((c) => c.daily.length > 1));

  const pieData = useMemo(
    () =>
      colored.map((c) => ({
        name: c.name,
        value: Number(c.totalAmount),
        color: c.color,
        percent: c.percent,
      })),
    [colored],
  );

  if (loading) {
    return (
      <div className="app-card-pad text-center text-sm text-slate-500 dark:text-slate-400">…</div>
    );
  }

  if (colored.length === 0) {
    return (
      <div className="app-card-pad text-sm text-slate-500 dark:text-slate-400">{t('expenseStatsEmpty')}</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {colored.map((cat) => {
          const Icon = categoryIcon(cat.slug);
          const gradId = `exp-cat-${cat.categoryId}`;
          return (
            <div
              key={cat.categoryId}
              className="app-card relative min-w-0 overflow-hidden border border-slate-200/90 bg-white p-4 dark:border-slate-700/90 dark:bg-slate-900/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                  style={{ backgroundColor: cat.color }}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {formatPercent(cat.percent, lang)}%
                </span>
              </div>
              <p className="mt-3 truncate text-sm font-medium text-slate-600 dark:text-slate-300">{cat.name}</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
                {formatMoneyUz(cat.totalAmount, lang)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t('expenseStatsCount')}: {cat.expenseCount}
              </p>
              <div className="mt-3 h-14 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cat.daily} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={cat.color} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={cat.color} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid var(--border, #e2e8f0)',
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [formatMoneyUz(String(value), lang), t('amount')]}
                      labelFormatter={(label) => formatShortDate(String(label), lang)}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={cat.color}
                      strokeWidth={2}
                      fill={`url(#${gradId})`}
                      dot={false}
                      isAnimationActive
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="app-card min-w-0 overflow-hidden border border-slate-200/90 bg-white p-4 dark:border-slate-700/90 dark:bg-slate-900/40 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('expenseCategoryStatsTitle')}</h3>
          <div className="mt-4 flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative h-52 w-full min-w-0 max-w-[220px] shrink-0 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="58%"
                    outerRadius="88%"
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name, item) => {
                      const pct = item?.payload?.percent;
                      const pctStr = typeof pct === 'number' ? ` (${formatPercent(pct, lang)}%)` : '';
                      return [`${formatMoneyUz(String(value), lang)}${pctStr}`, item?.payload?.name ?? ''];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('amount')}
                </span>
                <span className="mt-0.5 max-w-[7rem] text-sm font-bold leading-tight tabular-nums text-slate-900 dark:text-white">
                  {formatMoneyUz(grandTotal, lang)}
                </span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2.5">
              {colored.map((cat) => (
                <li key={cat.categoryId} className="flex min-w-0 items-start gap-2 text-sm">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                      <span className="truncate font-medium text-slate-800 dark:text-slate-100">{cat.name}</span>
                      <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                        {formatPercent(cat.percent, lang)}%
                      </span>
                    </div>
                    <p className="tabular-nums text-xs text-slate-500 dark:text-slate-400">
                      {formatMoneyUz(cat.totalAmount, lang)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="app-card min-w-0 overflow-hidden border border-slate-200/90 bg-white p-4 dark:border-slate-700/90 dark:bg-slate-900/40 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('expenseTopCategories')}</h3>
          <ol className="mt-4 space-y-4">
            {colored.map((cat, idx) => (
              <li key={cat.categoryId} className="min-w-0">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: cat.color }}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                      <span className="truncate font-medium text-slate-800 dark:text-slate-100">{cat.name}</span>
                      <span
                        className="shrink-0 text-sm font-bold tabular-nums"
                        style={{ color: cat.color }}
                      >
                        {formatMoneyUz(cat.totalAmount, lang)}
                      </span>
                    </div>
                    <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(cat.percent, cat.percent > 0 ? 2 : 0))}%`,
                          background: `linear-gradient(90deg, ${cat.color}88, ${cat.color})`,
                        }}
                      />
                      <div
                        className="pointer-events-none absolute inset-0 opacity-30"
                        style={{
                          backgroundImage: `repeating-linear-gradient(
                            -45deg,
                            transparent,
                            transparent 6px,
                            rgba(255,255,255,0.35) 6px,
                            rgba(255,255,255,0.35) 12px
                          )`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {formatPercent(cat.percent, lang)}%
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {showTrend && (
        <div className="app-card min-w-0 overflow-hidden border border-slate-200/90 bg-white p-4 dark:border-slate-700/90 dark:bg-slate-900/40 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('expenseCategoryTrendTitle')}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {activeRange
              ? `${t('expenseCategoryTrendHint')} · ${formatRangeLabel(activeRange, lang)}`
              : t('expenseCategoryTrendHint')}
          </p>
          <div className="mt-4 h-56 w-full min-w-0 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={buildCombinedTrend(colored)}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  {colored.map((cat) => (
                    <linearGradient key={cat.categoryId} id={`trend-${cat.categoryId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={cat.color} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={cat.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <Tooltip
                  contentStyle={{ borderRadius: 10, fontSize: 12 }}
                  labelFormatter={(label) => formatShortDate(String(label), lang)}
                  formatter={(value: number, name: string) => [formatMoneyUz(String(value), lang), name]}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatShortDate(String(d), lang)}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                {colored.map((cat) => (
                  <Area
                    key={cat.categoryId}
                    type="monotone"
                    dataKey={cat.categoryId}
                    name={cat.name}
                    stroke={cat.color}
                    strokeWidth={2}
                    fill={`url(#trend-${cat.categoryId})`}
                    dot={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
            {colored.map((cat) => (
              <li key={cat.categoryId} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function buildCombinedTrend(
  categories: Array<CategoryStatRow & { color: string }>,
): Record<string, string | number>[] {
  const dates = new Set<string>();
  for (const c of categories) {
    for (const d of c.daily) dates.add(d.date);
  }
  return [...dates].sort().map((date) => {
    const row: Record<string, string | number> = { date };
    for (const c of categories) {
      row[c.categoryId] = c.daily.find((d) => d.date === date)?.value ?? 0;
    }
    return row;
  });
}
