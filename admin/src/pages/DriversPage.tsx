import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';

type Driver = {
  id: string;
  fullName: string;
  phone: string;
  vehicleId: string | null;
  user: { login: string };
  vehicle: { plateNumber: string } | null;
};

export function DriversPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; plateNumber: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    login: '',
    password: '',
    fullName: '',
    phone: '',
    vehicleId: '',
  });

  const load = async () => {
    const [d, v] = await Promise.all([
      api<Driver[]>('/drivers'),
      api<{ id: string; plateNumber: string }[]>('/vehicles'),
    ]);
    setRows(d);
    setVehicles(v);
  };

  useEffect(() => {
    load().catch((e: Error) => setErr(e.message));
  }, []);

  function startEdit(d: Driver) {
    setEditingId(d.id);
    setForm({
      login: d.user.login,
      password: '',
      fullName: d.fullName,
      phone: d.phone,
      vehicleId: d.vehicleId ?? '',
    });
    setErr(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ login: '', password: '', fullName: '', phone: '', vehicleId: '' });
    setErr(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      if (editingId) {
        const pw = form.password.trim();
        if (pw.length > 0 && pw.length < 6) {
          setErr(t('adminUsersPasswordMin'));
          return;
        }
        const body: Record<string, unknown> = {
          fullName: form.fullName,
          phone: form.phone,
          vehicleId: form.vehicleId ? form.vehicleId : null,
        };
        if (pw.length > 0) {
          body.password = pw;
        }
        await api(`/drivers/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) });
        cancelEdit();
      } else {
        const pw = form.password.trim();
        if (pw.length < 6) {
          setErr(t('adminUsersPasswordMin'));
          return;
        }
        await api('/drivers', {
          method: 'POST',
          body: JSON.stringify({
            login: form.login.trim(),
            password: pw,
            fullName: form.fullName,
            phone: form.phone,
            vehicleId: form.vehicleId || undefined,
          }),
        });
        setForm({ login: '', password: '', fullName: '', phone: '', vehicleId: '' });
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete?')) return;
    try {
      await api(`/drivers/${id}`, { method: 'DELETE' });
      if (editingId === id) cancelEdit();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="app-page">
      <h1 className="app-page-title">{t('navDrivers')}</h1>
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="app-card-pad grid min-w-0 grid-cols-1 items-end gap-3 md:grid-cols-6"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('loginLabel')}</label>
          <input
            className={editingId ? 'app-input bg-slate-100 dark:bg-slate-800/80' : 'app-input'}
            value={form.login}
            onChange={(e) => setForm({ ...form, login: e.target.value })}
            required={!editingId}
            readOnly={Boolean(editingId)}
            aria-readonly={editingId ? true : undefined}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('password')}</label>
          <input
            type="text"
            autoComplete="off"
            className="app-input"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editingId}
            minLength={!editingId ? 6 : undefined}
          />
          {editingId ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('adminUsersOptionalPassword')}</p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('fullName')}</label>
          <input
            className="app-input"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('phone')}</label>
          <input
            className="app-input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('plate')}</label>
          <select
            className="app-select"
            value={form.vehicleId}
            onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
          >
            <option value="">—</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button type="submit" className="app-btn-primary w-full sm:w-auto">
            {editingId ? t('save') : t('add')}
          </button>
          {editingId ? (
            <button type="button" className="app-btn-ghost w-full sm:w-auto" onClick={cancelEdit}>
              {t('cancel')}
            </button>
          ) : null}
        </div>
      </form>

      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap">
          <table className="app-table-inner text-sm">
          <thead className="app-table-head">
            <tr>
              <th className="p-3">{t('fullName')}</th>
              <th className="p-3">{t('loginLabel')}</th>
              <th className="p-3">{t('phone')}</th>
              <th className="p-3">{t('plate')}</th>
              <th className="p-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="app-table-row">
                <td className="p-3">{d.fullName}</td>
                <td className="p-3 font-mono">{d.user.login}</td>
                <td className="p-3">{d.phone}</td>
                <td className="p-3">{d.vehicle?.plateNumber ?? '—'}</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md p-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
                      onClick={() => startEdit(d)}
                      title={t('edit')}
                      aria-label={t('edit')}
                    >
                      <Pencil size={16} aria-hidden />
                    </button>
                    <button type="button" className="app-link-danger" onClick={() => void onDelete(d.id)}>
                      {t('delete')}
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
