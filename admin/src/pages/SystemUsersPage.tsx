import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import {
  ADMIN_PAGE_KEYS,
  ADMIN_PAGE_LABEL_KEYS,
  type AdminPageKey,
} from '@/lib/adminPages';

type OperatorRow = {
  id: string;
  login: string;
  position: string | null;
  allowedPages: string[];
  createdAt: string;
  updatedAt: string;
};

const emptyForm = {
  login: '',
  password: '',
  position: '',
  allowedPages: [] as AdminPageKey[],
};

export function SystemUsersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<OperatorRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await api<OperatorRow[]>('/admin-users');
    setRows(list);
  }, []);

  useEffect(() => {
    load().catch((e: Error) => setErr(e.message));
  }, [load]);

  function togglePage(key: AdminPageKey) {
    setForm((f) => ({
      ...f,
      allowedPages: f.allowedPages.includes(key)
        ? f.allowedPages.filter((x) => x !== key)
        : [...f.allowedPages, key],
    }));
  }

  function startEdit(row: OperatorRow) {
    setEditingId(row.id);
    setForm({
      login: row.login,
      password: '',
      position: row.position ?? '',
      allowedPages: (row.allowedPages as AdminPageKey[]).filter((p) =>
        ADMIN_PAGE_KEYS.includes(p as AdminPageKey),
      ),
    });
    setErr(null);
  }

  function clearEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setErr(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (form.allowedPages.length === 0) {
      setErr(t('operatorNoPages'));
      return;
    }
    try {
      if (editingId) {
        const body: Record<string, unknown> = {
          login: form.login.trim(),
          position: form.position.trim(),
          allowedPages: form.allowedPages,
        };
        if (form.password.trim()) body.password = form.password.trim();
        await api(`/admin-users/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        if (!form.password.trim()) {
          setErr(t('genericError'));
          return;
        }
        await api('/admin-users', {
          method: 'POST',
          body: JSON.stringify({
            login: form.login.trim(),
            password: form.password.trim(),
            position: form.position.trim(),
            allowedPages: form.allowedPages,
          }),
        });
      }
      clearEdit();
      await load();
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : t('genericError'));
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(t('adminUsersConfirmDelete'))) return;
    setErr(null);
    try {
      await api(`/admin-users/${id}`, { method: 'DELETE' });
      if (editingId === id) clearEdit();
      await load();
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : t('genericError'));
    }
  }

  return (
    <div className="app-page min-w-0">
      <div className="min-w-0 space-y-1">
        <h1 className="app-page-title">{t('navSystemUsers')}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t('adminUsersHint')}</p>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 sm:px-4">
          {err}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="app-card-pad min-w-0 space-y-4 sm:space-y-5"
      >
        <div className="grid min-w-0 grid-cols-1 gap-3 min-[400px]:grid-cols-2 min-[720px]:grid-cols-4">
          <div className="min-w-0 min-[400px]:col-span-2 min-[720px]:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('adminUsersPosition')}</label>
            <input
              className="app-input"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder={t('adminUsersPosition')}
              required
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('loginLabel')}</label>
            <input
              className="app-input font-mono text-sm"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
              required
              autoComplete="off"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('password')}</label>
            <input
              type="password"
              className="app-input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editingId}
              autoComplete="new-password"
            />
            {editingId && (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t('adminUsersOptionalPassword')}</p>
            )}
          </div>
        </div>

        <fieldset className="min-w-0 space-y-2 rounded-xl border border-slate-200/90 p-3 dark:border-slate-700 sm:p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('adminUsersAllowedPages')}
          </legend>
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 min-[640px]:grid-cols-3 min-[960px]:grid-cols-4">
            {ADMIN_PAGE_KEYS.map((key) => {
              const on = form.allowedPages.includes(key);
              return (
                <label
                  key={key}
                  className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition sm:min-h-0 ${
                    on
                      ? 'border-blue-300 bg-blue-50/90 text-slate-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={on}
                    onChange={() => togglePage(key)}
                  />
                  <span className="min-w-0 break-words leading-snug">{t(ADMIN_PAGE_LABEL_KEYS[key])}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex min-w-0 flex-col gap-2 min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center">
          <button type="submit" className="app-btn-primary w-full min-[400px]:w-auto">
            {editingId ? t('save') : t('add')}
          </button>
          {editingId && (
            <button type="button" className="app-btn-ghost w-full min-[400px]:w-auto" onClick={clearEdit}>
              {t('cancel')}
            </button>
          )}
        </div>
      </form>

      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap">
          <table className="w-full min-w-[min(100%,520px)] text-sm sm:min-w-[640px]">
            <thead className="app-table-head">
              <tr>
                <th className="p-3">{t('adminUsersPosition')}</th>
                <th className="p-3">{t('loginLabel')}</th>
                <th className="p-3">{t('adminUsersAllowedPages')}</th>
                <th className="p-3">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500 dark:text-slate-400">
                    —
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="app-table-row">
                    <td className="p-3 align-top">{r.position ?? '—'}</td>
                    <td className="p-3 align-top font-mono text-xs sm:text-sm">{r.login}</td>
                    <td className="max-w-[200px] p-3 align-top text-xs leading-relaxed text-slate-600 dark:text-slate-300 sm:max-w-none">
                      {r.allowedPages
                        .map((k) => (ADMIN_PAGE_KEYS.includes(k as AdminPageKey) ? t(ADMIN_PAGE_LABEL_KEYS[k as AdminPageKey]) : k))
                        .join(', ')}
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                        <button type="button" className="app-link-muted text-left text-sm" onClick={() => startEdit(r)}>
                          {t('edit')}
                        </button>
                        <button type="button" className="app-link-danger text-left text-sm" onClick={() => onDelete(r.id)}>
                          {t('delete')}
                        </button>
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
