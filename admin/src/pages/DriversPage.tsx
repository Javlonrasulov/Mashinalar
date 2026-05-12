import { useEffect, useMemo, useState } from 'react';
import { Pencil, Search, Smartphone, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import { formatDateTime } from '@/lib/assignmentDisplay';

type Driver = {
  id: string;
  fullName: string;
  phone: string;
  vehicleId: string | null;
  user: { login: string };
  vehicle: { plateNumber: string } | null;
  deviceCount?: number;
};

type Session = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
};

/** Server tomonidagi `ACTIVE_WINDOW_MS` bilan mos: oxirgi 10 daqiqada faol = "hozir online". */
const SESSION_ACTIVE_WINDOW_MS = 10 * 60 * 1000;

export function DriversPage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; plateNumber: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionsFor, setSessionsFor] = useState<Driver | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [sessionsErr, setSessionsErr] = useState<string | null>(null);
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

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((d) => {
      const parts = [d.fullName, d.user.login, d.phone, d.vehicle?.plateNumber];
      return parts.some((p) => (p ?? '').toLowerCase().includes(q));
    });
  }, [rows, searchQuery]);

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

  async function openSessions(d: Driver) {
    setSessionsFor(d);
    setSessions(null);
    setSessionsErr(null);
    try {
      const list = await api<Session[]>(`/drivers/${d.id}/sessions`);
      setSessions(list);
    } catch (e) {
      setSessionsErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function reloadSessions(driverId: string) {
    try {
      const list = await api<Session[]>(`/drivers/${driverId}/sessions`);
      setSessions(list);
    } catch (e) {
      setSessionsErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function revokeSession(driverId: string, sessionId: string) {
    if (!confirm(t('driversDevicesRevokeConfirm'))) return;
    try {
      await api(`/drivers/${driverId}/sessions/${sessionId}`, { method: 'DELETE' });
      await reloadSessions(driverId);
      await load();
    } catch (e) {
      setSessionsErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function revokeAllSessions(driverId: string) {
    if (!confirm(t('driversDevicesRevokeAllConfirm'))) return;
    try {
      await api(`/drivers/${driverId}/sessions`, { method: 'DELETE' });
      await reloadSessions(driverId);
      await load();
    } catch (e) {
      setSessionsErr(e instanceof Error ? e.message : String(e));
    }
  }

  function closeSessions() {
    setSessionsFor(null);
    setSessions(null);
    setSessionsErr(null);
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
            onChange={(e) => setForm({ ...form, login: e.target.value.toLowerCase() })}
            required={!editingId}
            readOnly={Boolean(editingId)}
            aria-readonly={editingId ? true : undefined}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
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
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700/70">
          <div className="w-full min-w-0 sm:max-w-xs">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('oilSearchLabel')}</label>
            <div className="relative min-w-0">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                className="app-input w-full pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('driversSearchPlaceholder')}
                aria-label={t('driversSearchPlaceholder')}
                autoComplete="off"
              />
            </div>
          </div>
        </div>
        <div className="app-table-wrap">
          <table className="app-table-inner text-sm">
          <thead className="app-table-head">
            <tr>
              <th className="p-3">{t('fullName')}</th>
              <th className="p-3">{t('loginLabel')}</th>
              <th className="p-3">{t('phone')}</th>
              <th className="p-3">{t('plate')}</th>
              <th className="p-3">{t('driversDevicesCol')}</th>
              <th className="p-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t('oilSearchNoResults')}
                </td>
              </tr>
            ) : (
              filteredRows.map((d) => {
                const count = d.deviceCount ?? 0;
                const multi = count > 1;
                const badgeClass = multi
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                  : count === 1
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400';
                return (
                  <tr key={d.id} className="app-table-row">
                    <td className="p-3">{d.fullName}</td>
                    <td className="p-3 font-mono">{d.user.login}</td>
                    <td className="p-3">{d.phone}</td>
                    <td className="p-3">{d.vehicle?.plateNumber ?? '—'}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => void openSessions(d)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass}`}
                        title={t('driversDevicesTitle')}
                      >
                        <Smartphone size={14} aria-hidden />
                        {count}
                      </button>
                    </td>
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
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {sessionsFor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-3 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={closeSessions}
        >
          <div
            className="app-card flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700/70">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white">
                  {t('driversDevicesTitle')} — {sessionsFor.fullName}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {sessionsFor.user.login}
                </p>
              </div>
              <button
                type="button"
                onClick={closeSessions}
                className="inline-flex items-center rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label={t('close')}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="overflow-auto">
              {sessionsErr ? (
                <div className="px-4 py-3 text-sm text-red-700 dark:text-red-300">{sessionsErr}</div>
              ) : sessions === null ? (
                <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">…</div>
              ) : sessions.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t('driversDevicesEmpty')}
                </div>
              ) : (
                <table className="app-table-inner text-sm">
                  <thead className="app-table-head">
                    <tr>
                      <th className="p-3">{t('driversDevicesIp')}</th>
                      <th className="p-3">{t('driversDevicesUa')}</th>
                      <th className="p-3">{t('driversDevicesFirstSeen')}</th>
                      <th className="p-3">{t('driversDevicesLastSeen')}</th>
                      <th className="p-3">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => {
                      const active = !s.revokedAt && Date.now() - new Date(s.lastSeenAt).getTime() < SESSION_ACTIVE_WINDOW_MS;
                      return (
                        <tr key={s.id} className="app-table-row">
                          <td className="p-3 font-mono text-xs">{s.ip ?? '—'}</td>
                          <td className="p-3 max-w-[24rem] truncate text-xs text-slate-600 dark:text-slate-300" title={s.userAgent ?? ''}>
                            {s.userAgent ?? '—'}
                          </td>
                          <td className="p-3 whitespace-nowrap text-xs">{formatDateTime(s.firstSeenAt, lang)}</td>
                          <td className="p-3 whitespace-nowrap text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{formatDateTime(s.lastSeenAt, lang)}</span>
                              {s.revokedAt ? (
                                <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {t('driversDevicesRevokedBadge')}
                                </span>
                              ) : active ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  {t('driversDevicesActiveBadge')}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {s.revokedAt ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : (
                              <button
                                type="button"
                                className="app-link-danger text-xs"
                                onClick={() => void revokeSession(sessionsFor.id, s.id)}
                              >
                                {t('driversDevicesRevoke')}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700/70">
              {sessions && sessions.some((s) => !s.revokedAt) ? (
                <button
                  type="button"
                  className="app-btn-ghost border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                  onClick={() => void revokeAllSessions(sessionsFor.id)}
                >
                  {t('driversDevicesRevokeAll')}
                </button>
              ) : null}
              <button type="button" className="app-btn-ghost" onClick={closeSessions}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
