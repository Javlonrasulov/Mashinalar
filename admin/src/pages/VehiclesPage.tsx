import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import { DateField } from '@/components/DateField';

type Vehicle = {
  id: string;
  name: string;
  model: string | null;
  plateNumber: string;
  initialKm: string;
  oilChangeIntervalKm?: number | null;
  insuranceStartDate?: string | null;
  insuranceEndDate?: string | null;
};

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function VehiclesPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    model: '',
    plateNumber: '',
    initialKm: '0',
    oilChangeIntervalKm: '',
    insuranceStartDate: '',
    insuranceEndDate: '',
  });

  const load = () =>
    api<Vehicle[]>('/vehicles')
      .then(setRows)
      .catch((e: Error) => setErr(e.message));

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const payload = {
      name: form.name,
      model: form.model || undefined,
      plateNumber: form.plateNumber,
      initialKm: Number(form.initialKm),
      oilChangeIntervalKm: form.oilChangeIntervalKm ? Number(form.oilChangeIntervalKm) : undefined,
      insuranceStartDate: form.insuranceStartDate || undefined,
      insuranceEndDate: form.insuranceEndDate || undefined,
    };
    if (editingId) {
      await api(`/vehicles/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      await api('/vehicles', { method: 'POST', body: JSON.stringify(payload) });
    }
    setEditingId(null);
    setForm({
      name: '',
      model: '',
      plateNumber: '',
      initialKm: '0',
      oilChangeIntervalKm: '',
      insuranceStartDate: '',
      insuranceEndDate: '',
    });
    await load();
  }

  function onEdit(v: Vehicle) {
    setErr(null);
    setEditingId(v.id);
    setForm({
      name: v.name ?? '',
      model: v.model ?? '',
      plateNumber: v.plateNumber ?? '',
      initialKm: String(v.initialKm ?? '0'),
      oilChangeIntervalKm: v.oilChangeIntervalKm ? String(v.oilChangeIntervalKm) : '',
      insuranceStartDate: toDateInputValue(v.insuranceStartDate),
      insuranceEndDate: toDateInputValue(v.insuranceEndDate),
    });
    document.querySelector('main form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function onCancelEdit() {
    setEditingId(null);
    setForm({
      name: '',
      model: '',
      plateNumber: '',
      initialKm: '0',
      oilChangeIntervalKm: '',
      insuranceStartDate: '',
      insuranceEndDate: '',
    });
  }

  async function onDelete(id: string) {
    if (!confirm('Delete?')) return;
    await api(`/vehicles/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="app-page">
      <h1 className="app-page-title">{t('navVehicles')}</h1>
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      <form
        onSubmit={onCreate}
        className="app-card-pad grid min-w-0 grid-cols-1 items-end gap-3 md:grid-cols-8"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('name')}</label>
          <input
            className="app-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('model')}</label>
          <input
            className="app-input"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('plate')}</label>
          <input
            className="app-input"
            value={form.plateNumber}
            onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('initialKm')}</label>
          <input
            className="app-input"
            value={form.initialKm}
            onChange={(e) => setForm({ ...form, initialKm: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('oilChangeIntervalKm')}</label>
          <input
            type="number"
            min={1}
            className="app-input"
            value={form.oilChangeIntervalKm}
            onChange={(e) => setForm({ ...form, oilChangeIntervalKm: e.target.value })}
            placeholder="—"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('insuranceStartDate')}</label>
          <DateField
            value={form.insuranceStartDate}
            onChange={(v) => setForm({ ...form, insuranceStartDate: v })}
            onClear={() => setForm({ ...form, insuranceStartDate: '' })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('insuranceEndDate')}</label>
          <DateField
            value={form.insuranceEndDate}
            onChange={(v) => setForm({ ...form, insuranceEndDate: v })}
            onClear={() => setForm({ ...form, insuranceEndDate: '' })}
          />
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end">
          {editingId && (
            <button type="button" className="app-btn-ghost w-full md:w-auto" onClick={onCancelEdit}>
              {t('cancel')}
            </button>
          )}
          <button type="submit" className="app-btn-primary w-full md:w-auto">
            {editingId ? t('save') : t('add')}
          </button>
        </div>
      </form>

      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap">
          <table className="app-table-inner text-sm">
          <thead className="app-table-head">
            <tr>
              <th className="p-3">{t('plate')}</th>
              <th className="p-3">{t('name')}</th>
              <th className="p-3">{t('model')}</th>
              <th className="p-3">km</th>
              <th className="p-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="app-table-row">
                <td className="p-3 font-mono">{v.plateNumber}</td>
                <td className="p-3">{v.name}</td>
                <td className="p-3">{v.model}</td>
                <td className="p-3">{v.initialKm}</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      className="app-btn-ghost inline-flex h-9 w-9 items-center justify-center p-0"
                      onClick={() => onEdit(v)}
                      aria-label={t('edit')}
                      title={t('edit')}
                    >
                      <Pencil size={16} className="text-blue-600 dark:text-blue-400" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="app-btn-ghost inline-flex h-9 w-9 items-center justify-center p-0"
                      onClick={() => onDelete(v.id)}
                      aria-label={t('delete')}
                      title={t('delete')}
                    >
                      <Trash2 size={16} className="text-red-600 dark:text-red-400" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
