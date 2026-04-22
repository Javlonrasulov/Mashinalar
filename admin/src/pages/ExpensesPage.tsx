import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import { SelectField, type SelectOption } from '@/components/SelectField';

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

export function ExpensesPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
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
    const [e, v] = await Promise.all([
      api<Row[]>(`/expenses${q}`),
      api<{ id: string; plateNumber: string }[]>('/vehicles'),
    ]);
    setRows(e);
    setVehicles(v);
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
    { value: '', label: '—' },
    ...vehicles.map((v) => ({ value: v.id, label: v.plateNumber })),
  ];

  return (
    <div className="app-page">
      <h1 className="app-page-title">{t('navExpenses')}</h1>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('filter')}</span>
        <div className="w-auto min-w-[10rem]">
          <SelectField value={filter} onChange={setFilter} options={filterOptions} />
        </div>
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
                <td className="p-3">
                  {TYPES.includes(r.type as ExpenseType) ? t(TYPE_LABEL_KEY[r.type as ExpenseType]) : r.type}
                </td>
                <td className="p-3">{r.amount}</td>
                <td className="p-3">{new Date(r.spentAt).toLocaleString()}</td>
                <td className="p-3">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
