import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { useI18n, type Lang } from '@/i18n/I18nContext';
import { DateRangeField } from '@/components/DateRangeField';
import { ExpensesSubNav } from '@/components/ExpensesSubNav';
import {
  ExpenseCategoryDashboard,
  type CategoryStatsPayload,
} from '@/components/ExpenseCategoryDashboard';
import { ExpenseAddModal, type ExpenseAddForm } from '@/components/ExpenseAddModal';
import { SelectField, type SelectOption } from '@/components/SelectField';
import { appendSpentRangeParams, defaultExpenseDateRange, formatYmd, parseYmd, startOfLocalDay, type SpentDateRangeYmd } from '@/lib/spentRangeQuery';

function emptyExpenseForm(categoryId: string): ExpenseAddForm {
  return {
    vehicleId: '',
    categoryId,
    amount: '',
    note: '',
    spentYmd: formatYmd(new Date()),
  };
}

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

type CategoryRow = { id: string; slug: string; name: string };

type Row = {
  id: string;
  amount: string;
  spentAt: string;
  note: string | null;
  vehicleId: string;
  createdByUserId: string | null;
  vehicle: { plateNumber: string };
  category: { id: string; slug: string; name: string };
};

function rowToForm(r: Row): ExpenseAddForm {
  const d = new Date(r.spentAt);
  return {
    vehicleId: r.vehicleId,
    categoryId: r.category.id,
    amount: r.amount,
    note: r.note ?? '',
    spentYmd: Number.isFinite(d.getTime()) ? formatYmd(d) : formatYmd(new Date()),
  };
}

const FUEL_REPORT_NOTE = /^Fuel report(\s|$)/i;

function formatExpenseNote(note: string | null, tr: (key: string) => string): string {
  if (note == null || note === '') return '';
  if (FUEL_REPORT_NOTE.test(note.trim())) return tr('expenseNoteFuelReport');
  return note;
}

export function ExpensesPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStatsPayload | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [filter, setFilter] = useState<string>('');
  const [spentDateRange, setSpentDateRange] = useState<SpentDateRangeYmd | null>(defaultExpenseDateRange);
  const [search, setSearch] = useState<string>('');
  const [vehicles, setVehicles] = useState<{ id: string; plateNumber: string }[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [form, setForm] = useState<ExpenseAddForm>(() => emptyExpenseForm(''));

  const defaultCategoryId = (cats: CategoryRow[]) =>
    cats.find((c) => c.slug === 'OTHER')?.id ?? cats[0]?.id ?? '';

  const load = async () => {
    const p = new URLSearchParams();
    if (filter) p.set('categoryId', filter);
    appendSpentRangeParams(p, spentDateRange);
    const qs = p.toString() ? `?${p.toString()}` : '';
    setCategoryLoading(true);
    try {
      const [e, v, c, cat] = await Promise.all([
        api<Row[]>(`/expenses${qs}`),
        api<{ id: string; plateNumber: string }[]>('/vehicles'),
        api<CategoryRow[]>('/expense-categories'),
        api<CategoryStatsPayload>(`/expenses/stats/by-category${qs}`),
      ]);
      setRows(e);
      setVehicles(v);
      setCategories(c);
      setCategoryStats(cat);
    } catch {
      setRows([]);
      setCategoryStats(null);
    } finally {
      setCategoryLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, [filter, spentDateRange]);

  useEffect(() => {
    if (categories.length === 0) return;
    setForm((f) => (f.categoryId ? f : { ...f, categoryId: defaultCategoryId(categories) }));
  }, [categories]);

  function openAddModal() {
    setModalMode('add');
    setEditingId(null);
    setForm(emptyExpenseForm(defaultCategoryId(categories)));
    setAddModalOpen(true);
  }

  function openEditModal(row: Row) {
    setModalMode('edit');
    setEditingId(row.id);
    setForm(rowToForm(row));
    setAddModalOpen(true);
  }

  async function onCreate() {
    if (!form.vehicleId || !form.categoryId || !form.spentYmd) return;
    setAddBusy(true);
    try {
      await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: form.vehicleId,
          categoryId: form.categoryId,
          amount: Number(form.amount),
          note: form.note || undefined,
          spentAt: startOfLocalDay(parseYmd(form.spentYmd)).toISOString(),
        }),
      });
      setAddModalOpen(false);
      await load();
    } catch {
      /* ignore */
    } finally {
      setAddBusy(false);
    }
  }

  async function onUpdate() {
    if (!editingId || !form.vehicleId || !form.categoryId || !form.spentYmd) return;
    setAddBusy(true);
    try {
      await api(`/expenses/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          vehicleId: form.vehicleId,
          categoryId: form.categoryId,
          amount: Number(form.amount),
          note: form.note || undefined,
          spentAt: startOfLocalDay(parseYmd(form.spentYmd)).toISOString(),
        }),
      });
      setAddModalOpen(false);
      setEditingId(null);
      await load();
    } catch {
      /* ignore */
    } finally {
      setAddBusy(false);
    }
  }

  async function onDelete(row: Row) {
    if (!window.confirm(`${t('deleteExpenseTitle')}\n\n${row.vehicle.plateNumber} — ${formatMoneyUz(row.amount, lang)}\n\n${t('deleteExpenseBody')}`)) {
      return;
    }
    setAddBusy(true);
    try {
      await api(`/expenses/${row.id}`, { method: 'DELETE' });
      await load();
    } catch {
      /* ignore */
    } finally {
      setAddBusy(false);
    }
  }

  function canManageRow(row: Row): boolean {
    return Boolean(user?.id && row.createdByUserId && row.createdByUserId === user.id);
  }

  async function onAddCategory(nameRaw: string) {
    const name = nameRaw.trim();
    if (!name || addBusy) return;
    setAddBusy(true);
    try {
      const created = await api<CategoryRow>('/expense-categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      const next = await api<CategoryRow[]>('/expense-categories');
      setCategories(next);
      setForm((f) => ({ ...f, categoryId: created.id }));
    } catch {
      /* ignore */
    } finally {
      setAddBusy(false);
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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const noteRaw = r.note ?? '';
      const noteShown = formatExpenseNote(r.note, t);
      const fields = [
        r.vehicle.plateNumber,
        r.category?.name ?? '',
        r.category?.slug ?? '',
        r.amount,
        noteRaw,
        noteShown,
        formatSpentAt(r.spentAt, lang),
      ];
      return fields.some((f) => f.toLowerCase().includes(q));
    });
  }, [rows, search, t, lang]);

  const listTotalAmountStr = useMemo(() => {
    let sum = 0;
    for (const r of filteredRows) {
      const n = Number(r.amount);
      if (Number.isFinite(n)) sum += n;
    }
    return String(sum);
  }, [filteredRows]);

  return (
    <div className="app-page">
      <ExpensesSubNav />

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h1 className="app-page-title mb-0">{t('navExpenses')}</h1>
        <button type="button" className="app-btn-primary shrink-0" onClick={openAddModal}>
          {t('add')}
        </button>
      </div>

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
        <div className="min-w-0 w-full sm:w-auto sm:min-w-[16rem] sm:flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="expenses-search">
            {t('vehicleListSearch')}
          </label>
          <input
            id="expenses-search"
            type="search"
            className="app-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('expenseSearchPlaceholder')}
          />
        </div>
      </div>

      <ExpenseCategoryDashboard
        data={categoryStats}
        loading={categoryLoading}
        spentDateRange={spentDateRange}
      />

      <div className="app-card-pad flex flex-wrap items-baseline justify-between gap-3 border border-slate-200/90 bg-slate-50/80 dark:border-slate-700/90 dark:bg-slate-900/50">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('expenseListTotal')}</span>
        <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
          {formatMoneyUz(listTotalAmountStr, lang)}
        </span>
      </div>

      <ExpenseAddModal
        open={addModalOpen}
        busy={addBusy}
        mode={modalMode}
        form={form}
        vehicleOptions={vehicleOptions}
        categoryOptions={categoryOptions}
        onClose={() => !addBusy && setAddModalOpen(false)}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onSubmit={() => (modalMode === 'edit' ? onUpdate() : onCreate())}
        onAddCategory={onAddCategory}
      />

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
              <th className="p-3 w-28" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="app-table-row">
                <td className="p-3 font-mono">{r.vehicle.plateNumber}</td>
                <td className="p-3">{r.category?.name ?? '—'}</td>
                <td className="p-3">{formatMoneyUz(r.amount, lang)}</td>
                <td className="p-3">{formatSpentAt(r.spentAt, lang)}</td>
                <td className="p-3">{formatExpenseNote(r.note, t)}</td>
                <td className="p-3">
                  {canManageRow(r) && (
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className="app-btn-ghost px-2 py-1 text-xs"
                        disabled={addBusy}
                        onClick={() => openEditModal(r)}
                      >
                        {t('edit')}
                      </button>
                      <button
                        type="button"
                        className="app-link-danger text-xs"
                        disabled={addBusy}
                        onClick={() => void onDelete(r)}
                      >
                        {t('delete')}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={6}>
                  {search.trim() ? t('expenseSearchEmpty') : t('expenseStatsEmpty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
