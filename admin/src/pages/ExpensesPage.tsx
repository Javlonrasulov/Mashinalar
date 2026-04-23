import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n, type Lang } from '@/i18n/I18nContext';
import { SelectField, type SelectOption } from '@/components/SelectField';

function intlLocaleFor(lang: Lang): string {
  if (lang === 'ru') return 'ru-RU';
  if (lang === 'uzCyrl') return 'ru-RU';
  return 'uz-Latn-UZ';
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

function formatMoneyUz(amountStr: string, lang: Lang): string {
  const n = Number(amountStr);
  if (!Number.isFinite(n)) return amountStr;
  return new Intl.NumberFormat(intlLocaleFor(lang), {
    style: 'currency',
    currency: 'UZS',
    maximumFractionDigits: 0,
  }).format(n);
}

type VehicleExpenseStat = {
  vehicleId: string;
  plateNumber: string;
  totalAmount: string;
  expenseCount: number;
};

type Row = {
  id: string;
  type: string;
  amount: string;
  spentAt: string;
  note: string | null;
  vehicle: { plateNumber: string };
};

const TYPES = ['FUEL', 'REPAIR', 'OIL', 'OTHER'] as const;
type ExpenseType = (typeof TYPES)[number];
type TKey = Parameters<ReturnType<typeof useI18n>['t']>[0];

const TYPE_LABEL_KEY: Record<ExpenseType, TKey> = {
  FUEL: 'expenseType_FUEL',
  REPAIR: 'expenseType_REPAIR',
  OIL: 'expenseType_OIL',
  OTHER: 'expenseType_OTHER',
};

const FUEL_REPORT_NOTE = /^Fuel report(\s|$)/i;

function formatExpenseNote(note: string | null, t: (key: string) => string): string {
  if (note == null || note === '') return '';
  if (FUEL_REPORT_NOTE.test(note.trim())) return t('expenseNoteFuelReport');
  return note;
}

export function ExpensesPage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [vehicleStats, setVehicleStats] = useState<VehicleExpenseStat[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [vehicles, setVehicles] = useState<{ id: string; plateNumber: string }[]>([]);
  const [form, setForm] = useState({
    vehicleId: '',
    type: 'OTHER' as ExpenseType,
    amount: '',
    note: '',
  });

  const load = async () => {
    const q = filter ? `?type=${encodeURIComponent(filter)}` : '';
    const [e, v, s] = await Promise.all([
      api<Row[]>(`/expenses${q}`),
      api<{ id: string; plateNumber: string }[]>('/vehicles'),
      api<VehicleExpenseStat[]>(`/expenses/stats/by-vehicle${q}`),
    ]);
    setRows(e);
    setVehicles(v);
    setVehicleStats(s);
  };

  useEffect(() => {
    load().catch(() => {});
  }, [filter]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vehicleId) return;
    await api('/expenses', {
      method: 'POST',
      body: JSON.stringify({
        vehicleId: form.vehicleId,
        type: form.type,
        amount: Number(form.amount),
        note: form.note || undefined,
      }),
    });
    setForm({ vehicleId: '', type: 'OTHER', amount: '', note: '' });
    await load();
  }

  const typeOptions: SelectOption<ExpenseType>[] = TYPES.map((x) => ({
    value: x,
    label: t(TYPE_LABEL_KEY[x]),
  }));

  const filterOptions: SelectOption<string>[] = [
    { value: '', label: t('all') },
    ...typeOptions,
  ];

  const vehicleOptions: SelectOption<string>[] = [
    { value: '', label: '' },
    ...vehicles.map((v) => ({ value: v.id, label: v.plateNumber })),
  ];

  function typeLabel(raw: string) {
    const normalized = raw.toUpperCase() as ExpenseType;
    return TYPES.includes(normalized) ? t(TYPE_LABEL_KEY[normalized]) : raw;
  }

  const maxStatAmount = vehicleStats[0] ? Number(vehicleStats[0].totalAmount) : 0;

  return (
    <div className="app-page">
      <h1 className="app-page-title">{t('navExpenses')}</h1>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('filter')}</span>
        <div className="w-auto min-w-[10rem]">
          <SelectField value={filter} onChange={setFilter} options={filterOptions} />
        </div>
      </div>

      <div className="app-card-pad space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('statsExpensesTitle')}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('expenseStatsExplainer')}</p>
          {filter ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('expenseStatsFilteredNote')}</p>
          ) : null}
        </div>
        {vehicleStats.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('expenseStatsEmpty')}</p>
        ) : (
          <ol className="space-y-4">
            {vehicleStats.slice(0, 12).map((s, idx) => {
              const amt = Number(s.totalAmount);
              const barPct =
                maxStatAmount > 0 && Number.isFinite(amt) ? Math.min(100, (amt / maxStatAmount) * 100) : 0;
              return (
                <li key={s.vehicleId} className="min-w-0">
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
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <form
        onSubmit={onCreate}
        className="app-card-pad grid min-w-0 grid-cols-1 items-end gap-3 md:grid-cols-5"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('plate')}</label>
          <SelectField
            value={form.vehicleId}
            onChange={(v) => setForm({ ...form, vehicleId: v })}
            options={vehicleOptions}
            placeholder={t('mapVehicleSelectPlaceholder')}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('type')}</label>
          <SelectField
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v })}
            options={typeOptions}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('amount')}</label>
          <input
            className="app-input"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('note')}</label>
          <input
            className="app-input"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
        <button type="submit" className="app-btn-primary w-full md:w-auto">
          {t('add')}
        </button>
      </form>

      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap">
          <table className="app-table-inner text-sm">
          <thead className="app-table-head">
            <tr>
              <th className="p-3">{t('plate')}</th>
              <th className="p-3">{t('type')}</th>
              <th className="p-3">{t('amount')}</th>
              <th className="p-3">{t('date')}</th>
              <th className="p-3">{t('note')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="app-table-row">
                <td className="p-3 font-mono">{r.vehicle.plateNumber}</td>
                <td className="p-3">{typeLabel(r.type)}</td>
                <td className="p-3">{r.amount}</td>
                <td className="p-3">{formatSpentAt(r.spentAt, lang)}</td>
                <td className="p-3">{formatExpenseNote(r.note, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
