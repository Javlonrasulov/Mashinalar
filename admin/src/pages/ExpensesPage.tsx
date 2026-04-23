import { useEffect, useState } from 'react';
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

type Row = {
  id: string;
  amount: string;
  spentAt: string;
  note: string | null;
  vehicle: { plateNumber: string };
  category: { id: string; slug: string; name: string };
};

const FUEL_REPORT_NOTE = /^Fuel report(\s|$)/i;

function formatExpenseNote(note: string | null, tr: (key: string) => string): string {
  if (note == null || note === '') return '';
  if (FUEL_REPORT_NOTE.test(note.trim())) return tr('expenseNoteFuelReport');
  return note;
}

export function ExpensesPage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [spentDateRange, setSpentDateRange] = useState<SpentDateRangeYmd | null>(null);
  const [vehicles, setVehicles] = useState<{ id: string; plateNumber: string }[]>([]);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addCatBusy, setAddCatBusy] = useState(false);
  const [form, setForm] = useState({
    vehicleId: '',
    categoryId: '',
    amount: '',
    note: '',
  });

  const defaultCategoryId = (cats: CategoryRow[]) =>
    cats.find((c) => c.slug === 'OTHER')?.id ?? cats[0]?.id ?? '';

  const load = async () => {
    const p = new URLSearchParams();
    if (filter) p.set('categoryId', filter);
    appendSpentRangeParams(p, spentDateRange);
    const qs = p.toString() ? `?${p.toString()}` : '';
    const [e, v, c] = await Promise.all([
      api<Row[]>(`/expenses${qs}`),
      api<{ id: string; plateNumber: string }[]>('/vehicles'),
      api<CategoryRow[]>('/expense-categories'),
    ]);
    setRows(e);
    setVehicles(v);
    setCategories(c);
  };

  useEffect(() => {
    load().catch(() => {});
  }, [filter, spentDateRange]);

  useEffect(() => {
    if (categories.length === 0) return;
    setForm((f) => (f.categoryId ? f : { ...f, categoryId: defaultCategoryId(categories) }));
  }, [categories]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vehicleId || !form.categoryId) return;
    await api('/expenses', {
      method: 'POST',
      body: JSON.stringify({
        vehicleId: form.vehicleId,
        categoryId: form.categoryId,
        amount: Number(form.amount),
        note: form.note || undefined,
      }),
    });
    setForm({
      vehicleId: '',
      categoryId: defaultCategoryId(categories),
      amount: '',
      note: '',
    });
    await load();
  }

  async function onAddCategory() {
    const name = newCategoryName.trim();
    if (!name || addCatBusy) return;
    setAddCatBusy(true);
    try {
      const created = await api<CategoryRow>('/expense-categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      const next = await api<CategoryRow[]>('/expense-categories');
      setCategories(next);
      setForm((f) => ({ ...f, categoryId: created.id }));
      setNewCategoryName('');
      setAddCatOpen(false);
    } catch {
      /* ignore */
    } finally {
      setAddCatBusy(false);
    }
  }

  const categoryOptions: SelectOption<string>[] = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const filterOptions: SelectOption<string>[] = [
    { value: '', label: t('all') },
    ...categoryOptions,
  ];

  const vehicleOptions: SelectOption<string>[] = [
    { value: '', label: '' },
    ...vehicles.map((v) => ({ value: v.id, label: v.plateNumber })),
  ];

  return (
    <div className="app-page">
      <ExpensesSubNav />

      <h1 className="app-page-title">{t('navExpenses')}</h1>

      <div className="flex min-w-0 flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('filter')}</span>
          <div className="w-auto min-w-[10rem]">
            <SelectField value={filter} onChange={setFilter} options={filterOptions} />
          </div>
        </div>
        <div className="min-w-0 w-full sm:w-auto sm:min-w-[16rem] sm:max-w-xs">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="expenses-date-range">
            {t('expenseDateRange')}
          </label>
          <DateRangeField id="expenses-date-range" value={spentDateRange} onChange={setSpentDateRange} />
        </div>
      </div>

      {addCatOpen && (
        <div className="app-card-pad flex min-w-0 flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:max-w-md">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('expenseNewCategoryName')}</label>
            <input
              className="app-input"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t('expenseNewCategoryName')}
            />
          </div>
          <button type="button" className="app-btn-primary" disabled={addCatBusy} onClick={() => onAddCategory()}>
            {t('save')}
          </button>
          <button type="button" className="app-btn-ghost" disabled={addCatBusy} onClick={() => setAddCatOpen(false)}>
            {t('cancel')}
          </button>
        </div>
      )}

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
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">{t('expenseCategory')}</label>
            <button type="button" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400" onClick={() => setAddCatOpen((o) => !o)}>
              {t('expenseAddCategory')}
            </button>
          </div>
          <SelectField
            value={form.categoryId}
            onChange={(v) => setForm({ ...form, categoryId: v })}
            options={categoryOptions}
            placeholder={t('mapVehicleSelectPlaceholder')}
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
        <button type="submit" className="app-btn-primary w-full md:w-auto" disabled={!form.categoryId}>
          {t('add')}
        </button>
      </form>

      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap">
          <table className="app-table-inner text-sm">
          <thead className="app-table-head">
            <tr>
              <th className="p-3">{t('plate')}</th>
              <th className="p-3">{t('expenseCategory')}</th>
              <th className="p-3">{t('amount')}</th>
              <th className="p-3">{t('date')}</th>
              <th className="p-3">{t('note')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="app-table-row">
                <td className="p-3 font-mono">{r.vehicle.plateNumber}</td>
                <td className="p-3">{r.category?.name ?? '—'}</td>
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
