import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';

type VehicleCategory = {
  id: string;
  name: string;
};

export function VehicleCategoriesPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<VehicleCategory[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = async () => {
    const list = await api<VehicleCategory[]>('/vehicle-categories');
    setRows(list);
  };

  useEffect(() => {
    load().catch((e: Error) => setErr(e.message));
  }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    await api('/vehicle-categories', { method: 'POST', body: JSON.stringify({ name: trimmed }) });
    setName('');
    await load();
  }

  function startEdit(c: VehicleCategory) {
    setErr(null);
    setEditingId(c.id);
    setEditName(c.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
  }

  async function saveEdit() {
    if (!editingId) return;
    setErr(null);
    const trimmed = editName.trim();
    if (!trimmed) return;
    await api(`/vehicle-categories/${editingId}`, { method: 'PATCH', body: JSON.stringify({ name: trimmed }) });
    cancelEdit();
    await load();
  }

  async function onDelete(c: VehicleCategory) {
    if (!window.confirm(`${t('confirmDeleteCategoryTitle')}\n\n${c.name}\n\n${t('confirmDeleteCategoryBody')}`)) return;
    setErr(null);
    await api(`/vehicle-categories/${c.id}`, { method: 'DELETE' });
    if (editingId === c.id) cancelEdit();
    await load();
  }

  return (
    <div className="app-page">
      <h1 className="app-page-title">{t('vehicleCategoriesTitle')}</h1>
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      <form onSubmit={onAdd} className="app-card-pad flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('vehicleCategoriesName')}</label>
          <input className="app-input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <button type="submit" className="app-btn-primary w-full shrink-0 sm:w-auto">
          {t('add')}
        </button>
      </form>

      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap">
          <table className="app-table-inner text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="p-3">{t('vehicleCategoriesName')}</th>
                <th className="p-3">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="app-table-row">
                  <td className="p-3 text-slate-500 dark:text-slate-400" colSpan={2}>
                    {t('vehicleCategoriesEmpty')}
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="app-table-row">
                    <td className="p-3">
                      {editingId === c.id ? (
                        <input className="app-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      ) : (
                        <span className="font-medium text-slate-900 dark:text-white">{c.name}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {editingId === c.id ? (
                          <>
                            <button type="button" className="app-btn-primary px-3 py-1.5 text-xs" onClick={() => void saveEdit()}>
                              {t('save')}
                            </button>
                            <button type="button" className="app-btn-ghost px-3 py-1.5 text-xs" onClick={cancelEdit}>
                              {t('cancel')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="app-btn-ghost inline-flex h-9 w-9 items-center justify-center p-0"
                              onClick={() => startEdit(c)}
                              aria-label={t('edit')}
                              title={t('edit')}
                            >
                              <Pencil size={16} className="text-blue-600 dark:text-blue-400" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="app-btn-ghost inline-flex h-9 w-9 items-center justify-center p-0"
                              onClick={() => void onDelete(c)}
                              aria-label={t('delete')}
                              title={t('delete')}
                            >
                              <Trash2 size={16} className="text-red-600 dark:text-red-400" aria-hidden />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
