import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="app-card min-w-0 overflow-hidden">
        <form
          onSubmit={onAdd}
          className="flex flex-col gap-2 border-b border-slate-200/90 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50 sm:flex-row sm:items-center"
        >
          <label className="sr-only" htmlFor="vehicle-cat-new-name">
            {t('vehicleCategoriesName')}
          </label>
          <input
            id="vehicle-cat-new-name"
            className="app-input min-h-[40px] min-w-0 flex-1 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('vehicleCategoriesNewPlaceholder')}
            autoComplete="off"
          />
          <button
            type="submit"
            className="app-btn-primary inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 px-4"
            disabled={!name.trim()}
          >
            <Plus size={18} strokeWidth={2.25} aria-hidden />
            <span>{t('add')}</span>
          </button>
        </form>

        <div className="app-table-wrap">
          <table className="app-table-inner text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="px-3 py-2">{t('vehicleCategoriesName')}</th>
                <th className="w-28 px-3 py-2 text-end">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="app-table-row">
                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400" colSpan={2}>
                    {t('vehicleCategoriesEmpty')}
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="app-table-row">
                    <td className="px-3 py-2">
                      {editingId === c.id ? (
                        <input
                          className="app-input max-w-md py-1.5"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium text-slate-900 dark:text-white">{c.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {editingId === c.id ? (
                          <>
                            <button type="button" className="app-btn-primary px-2.5 py-1.5 text-xs" onClick={() => void saveEdit()}>
                              {t('save')}
                            </button>
                            <button type="button" className="app-btn-ghost px-2.5 py-1.5 text-xs" onClick={cancelEdit}>
                              {t('cancel')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="app-btn-ghost inline-flex h-8 w-8 items-center justify-center p-0"
                              onClick={() => startEdit(c)}
                              aria-label={t('edit')}
                              title={t('edit')}
                            >
                              <Pencil size={15} className="text-blue-600 dark:text-blue-400" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="app-btn-ghost inline-flex h-8 w-8 items-center justify-center p-0"
                              onClick={() => void onDelete(c)}
                              aria-label={t('delete')}
                              title={t('delete')}
                            >
                              <Trash2 size={15} className="text-red-600 dark:text-red-400" aria-hidden />
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
