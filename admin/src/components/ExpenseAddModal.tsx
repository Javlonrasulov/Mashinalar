import { useEffect, useState } from 'react';
import { DateField } from '@/components/DateField';
import { SelectField, type SelectOption } from '@/components/SelectField';
import { useI18n } from '@/i18n/I18nContext';
import { formatYmd } from '@/lib/spentRangeQuery';

export type ExpenseAddForm = {
  vehicleId: string;
  categoryId: string;
  amount: string;
  note: string;
  spentYmd: string;
};

type Props = {
  open: boolean;
  busy?: boolean;
  form: ExpenseAddForm;
  vehicleOptions: SelectOption<string>[];
  categoryOptions: SelectOption<string>[];
  onClose: () => void;
  onChange: (patch: Partial<ExpenseAddForm>) => void;
  onSubmit: () => void;
  onAddCategory: (name: string) => void;
};

export function ExpenseAddModal({
  open,
  busy,
  form,
  vehicleOptions,
  categoryOptions,
  onClose,
  onChange,
  onSubmit,
  onAddCategory,
}: Props) {
  const { t } = useI18n();
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const today = new Date();

  useEffect(() => {
    if (!open) return;
    setAddCatOpen(false);
    setNewCategoryName('');
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const canSubmit = Boolean(form.vehicleId && form.categoryId && form.amount.trim() && form.spentYmd);

  return (
    <div className="fixed inset-0 z-[6200] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        aria-label={t('cancel')}
        disabled={busy}
        onClick={() => !busy && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-add-modal-title"
        className="relative z-[6210] flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
          <h2 id="expense-add-modal-title" className="text-base font-semibold text-slate-900 dark:text-white">
            {t('expenseAddModalTitle')}
          </h2>
        </div>

        <form
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit && !busy) onSubmit();
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="expense-add-plate">
              {t('plate')}
            </label>
            <SelectField
              id="expense-add-plate"
              value={form.vehicleId}
              onChange={(v) => onChange({ vehicleId: v })}
              options={vehicleOptions}
              placeholder={t('mapVehicleSelectPlaceholder')}
            />
          </div>

          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="expense-add-category">
                {t('expenseCategory')}
              </label>
              <button
                type="button"
                className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                onClick={() => setAddCatOpen((o) => !o)}
              >
                {t('expenseAddCategory')}
              </button>
            </div>
            <SelectField
              id="expense-add-category"
              value={form.categoryId}
              onChange={(v) => onChange({ categoryId: v })}
              options={categoryOptions}
              placeholder={t('mapVehicleSelectPlaceholder')}
            />
          </div>

          {addCatOpen && (
            <div className="flex min-w-0 flex-wrap items-end gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 dark:border-slate-700/90 dark:bg-slate-950/40">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('expenseNewCategoryName')}
                </label>
                <input
                  className="app-input"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t('expenseNewCategoryName')}
                />
              </div>
              <button
                type="button"
                className="app-btn-primary text-sm"
                disabled={!newCategoryName.trim() || busy}
                onClick={() => {
                  const name = newCategoryName.trim();
                  if (!name || busy) return;
                  onAddCategory(name);
                  setNewCategoryName('');
                  setAddCatOpen(false);
                }}
              >
                {t('save')}
              </button>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="expense-add-date">
              {t('date')}
            </label>
            <DateField
              id="expense-add-date"
              value={form.spentYmd}
              onChange={(v) => onChange({ spentYmd: v || formatYmd(today) })}
              maxDate={today}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="expense-add-amount">
              {t('amount')}
            </label>
            <input
              id="expense-add-amount"
              className="app-input"
              type="number"
              min={0}
              step="any"
              value={form.amount}
              onChange={(e) => onChange({ amount: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="expense-add-note">
              {t('note')}
            </label>
            <input
              id="expense-add-note"
              className="app-input"
              value={form.note}
              onChange={(e) => onChange({ note: e.target.value })}
            />
          </div>
        </form>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
          <button type="button" className="app-btn-ghost text-sm" disabled={busy} onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="app-btn-primary text-sm"
            disabled={!canSubmit || busy}
            onClick={() => onSubmit()}
          >
            {busy ? '…' : t('add')}
          </button>
        </div>
      </div>
    </div>
  );
}
