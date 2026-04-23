import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useI18n, type Lang } from '@/i18n/I18nContext';
import { DateRangeField } from '@/components/DateRangeField';
import { ExpensesSubNav } from '@/components/ExpensesSubNav';
import { SelectField, type SelectOption } from '@/components/SelectField';
import { appendSpentRangeParams, type SpentDateRangeYmd } from '@/lib/spentRangeQuery';

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

function formatSpentAt(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocaleFor(lang), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

type CategoryRow = { id: string; slug: string; name: string };

type ExpenseRow = {
  id: string;
  amount: string;
  spentAt: string;
  note: string | null;
  vehicle: { plateNumber: string };
  category: { id: string; slug: string; name: string };
};

type VehicleExpenseStat = {
  vehicleId: string;
  plateNumber: string;
  totalAmount: string;
  expenseCount: number;
};

const FUEL_REPORT_NOTE = /^Fuel report(\s|$)/i;

function formatExpenseNote(note: string | null, tr: (key: string) => string): string {
  if (note == null || note === '') return '';
  if (FUEL_REPORT_NOTE.test(note.trim())) return tr('expenseNoteFuelReport');
  return note;
}

function expensesQueryForVehicle(
  vehicleId: string,
  categoryIdFilter: string,
  spentRange: SpentDateRangeYmd | null,
): string {
  const p = new URLSearchParams();
  p.set('vehicleId', vehicleId);
  if (categoryIdFilter) p.set('categoryId', categoryIdFilter);
  appendSpentRangeParams(p, spentRange);
  return `?${p.toString()}`;
}

export function ExpensesStatsPage() {
  const { t, lang } = useI18n();
  const [vehicleStats, setVehicleStats] = useState<VehicleExpenseStat[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [spentDateRange, setSpentDateRange] = useState<SpentDateRangeYmd | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<ExpenseRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    const p = new URLSearchParams();
    if (filter) p.set('categoryId', filter);
    appendSpentRangeParams(p, spentDateRange);
    const qs = p.toString() ? `?${p.toString()}` : '';
    const [s, c] = await Promise.all([
      api<VehicleExpenseStat[]>(`/expenses/stats/by-vehicle${qs}`),
      api<CategoryRow[]>('/expense-categories'),
    ]);
    setVehicleStats(s);
    setCategories(c);
  };

  useEffect(() => {
    load().catch(() => {});
  }, [filter, spentDateRange]);

  useEffect(() => {
    if (!selectedVehicleId) {
      setDetailRows([]);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    api<ExpenseRow[]>(`/expenses${expensesQueryForVehicle(selectedVehicleId, filter, spentDateRange)}`)
      .then((rows) => {
        if (!cancelled) setDetailRows(rows);
      })
      .catch(() => {
        if (!cancelled) setDetailRows([]);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVehicleId, filter, spentDateRange]);

  const categoryOptions: SelectOption<string>[] = categories.map((x) => ({
    value: x.id,
    label: x.name,
  }));

  const filterOptions: SelectOption<string>[] = [
    { value: '', label: t('all') },
    ...categoryOptions,
  ];

  const maxStatAmount = vehicleStats[0] ? Number(vehicleStats[0].totalAmount) : 0;

  const selectedPlate =
    vehicleStats.find((x) => x.vehicleId === selectedVehicleId)?.plateNumber ??
    detailRows[0]?.vehicle.plateNumber ??
    '';

  return (
    <div className="app-page">
      <ExpensesSubNav />

      <h1 className="app-page-title">{t('navExpensesStats')}</h1>

      <div className="flex min-w-0 flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('filter')}</span>
          <div className="w-auto min-w-[10rem]">
            <SelectField value={filter} onChange={setFilter} options={filterOptions} />
          </div>
        </div>
        <div className="min-w-0 w-full sm:w-auto sm:min-w-[16rem] sm:max-w-xs">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="expenses-stats-date-range">
            {t('expenseDateRange')}
          </label>
          <DateRangeField id="expenses-stats-date-range" value={spentDateRange} onChange={setSpentDateRange} />
        </div>
      </div>

      <div className="app-card-pad space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('statsExpensesTitle')}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('expenseStatsExplainer')}</p>
          {filter ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('expenseStatsFilteredNote')}</p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('expenseStatsSelectHint')}</p>
        </div>
        {vehicleStats.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('expenseStatsEmpty')}</p>
        ) : (
          <ol className="space-y-4">
            {vehicleStats.slice(0, 12).map((s, idx) => {
              const amt = Number(s.totalAmount);
              const barPct =
                maxStatAmount > 0 && Number.isFinite(amt) ? Math.min(100, (amt / maxStatAmount) * 100) : 0;
              const selected = selectedVehicleId === s.vehicleId;
              return (
                <li key={s.vehicleId} className="min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedVehicleId((prev) => (prev === s.vehicleId ? null : s.vehicleId))
                    }
                    className={clsx(
                      'w-full rounded-xl border px-3 py-3 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                      selected
                        ? 'border-blue-500 bg-blue-50 shadow-sm dark:border-blue-400 dark:bg-blue-950/40'
                        : 'border-slate-200/90 bg-white hover:border-blue-300 hover:bg-slate-50/80 dark:border-slate-700/90 dark:bg-slate-900/40 dark:hover:border-blue-600/60 dark:hover:bg-slate-800/50',
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                          {idx + 1}.
                        </span>
                        <span className="truncate font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {s.plateNumber}
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {formatMoneyUz(s.totalAmount, lang)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {t('expenseStatsCount')}: {s.expenseCount}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-blue-600 dark:bg-blue-400"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {selectedVehicleId && (
        <div className="app-card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('expenseStatsDetailTitle')}
              <span className="ml-2 font-mono text-blue-700 dark:text-blue-300">{selectedPlate}</span>
            </h2>
            <button
              type="button"
              className="app-btn-ghost text-sm"
              onClick={() => setSelectedVehicleId(null)}
            >
              {t('cancel')}
            </button>
          </div>
          <div className="app-table-wrap">
            {detailLoading ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">…</div>
            ) : detailRows.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('expenseStatsEmpty')}</div>
            ) : (
              <table className="app-table-inner text-sm">
                <thead className="app-table-head">
                  <tr>
                    <th className="p-3">{t('expenseCategory')}</th>
                    <th className="p-3">{t('amount')}</th>
                    <th className="p-3">{t('date')}</th>
                    <th className="p-3">{t('note')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r) => (
                    <tr key={r.id} className="app-table-row">
                      <td className="p-3">{r.category?.name ?? '—'}</td>
                      <td className="p-3">{formatMoneyUz(r.amount, lang)}</td>
                      <td className="p-3">{formatSpentAt(r.spentAt, lang)}</td>
                      <td className="p-3">{formatExpenseNote(r.note, t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
