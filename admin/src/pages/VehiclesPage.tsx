import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Pencil, Trash2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import { DateField } from '@/components/DateField';

type VehicleCategory = {
  id: string;
  name: string;
};

type Driver = {
  id: string;
  fullName: string;
  vehicleId: string | null;
};

type Vehicle = {
  id: string;
  name: string;
  model: string | null;
  plateNumber: string;
  initialKm: string | number;
  oilChangeIntervalKm?: number | null;
  insuranceStartDate?: string | null;
  insuranceEndDate?: string | null;
  inspectionLastChangedAt?: string | null;
  inspectionNextChangeAt?: string | null;
  gasBalloonLastChangedAt?: string | null;
  gasBalloonNextChangeAt?: string | null;
  category?: VehicleCategory | null;
  categoryId?: string | null;
  drivers?: { id: string }[];
};

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseYmdLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const dt = new Date(y, mo, day);
  if (!Number.isFinite(dt.getTime())) return null;
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== day) return null;
  return startOfLocalDay(dt);
}

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function currentDriverId(v: Vehicle): string {
  const d0 = v.drivers?.[0];
  return d0?.id ?? '';
}

export function VehiclesPage() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialDriverId, setInitialDriverId] = useState<string>('');
  const [pendingDelete, setPendingDelete] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** Yangi mashina formasi yashirin; tahrirda doim ochiq. */
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState({
    categoryId: '',
    name: '',
    model: '',
    plateNumber: '',
    initialKm: '0',
    oilChangeIntervalKm: '',
    insuranceStartDate: '',
    insuranceEndDate: '',
    inspectionLastChangedAt: '',
    inspectionNextChangeAt: '',
    gasBalloonLastChangedAt: '',
    gasBalloonNextChangeAt: '',
    driverId: '',
  });

  const load = async () => {
    const [v, c, d] = await Promise.all([
      api<Vehicle[]>('/vehicles'),
      api<VehicleCategory[]>('/vehicle-categories'),
      api<Driver[]>('/drivers'),
    ]);
    setRows(v);
    setCategories(c);
    setDrivers(d);
  };

  useEffect(() => {
    load().catch((e: Error) => setErr(e.message));
  }, []);

  const filteredRows = useMemo(() => {
    if (!categoryFilter) return rows;
    return rows.filter((v) => (v.category?.id ?? v.categoryId ?? '') === categoryFilter);
  }, [rows, categoryFilter]);

  const todayStart = useMemo(() => startOfLocalDay(new Date()), []);

  const insuranceEndMin = useMemo(() => {
    const start = parseYmdLocal(form.insuranceStartDate);
    if (!start) return todayStart;
    return start > todayStart ? start : todayStart;
  }, [form.insuranceStartDate, todayStart]);

  useEffect(() => {
    const end = parseYmdLocal(form.insuranceEndDate);
    if (!end) return;
    if (end < insuranceEndMin) {
      setForm((f) => ({ ...f, insuranceEndDate: formatYmdLocal(insuranceEndMin) }));
    }
  }, [insuranceEndMin, form.insuranceEndDate]);

  const inspectionNextMin = useMemo(() => {
    const last = parseYmdLocal(form.inspectionLastChangedAt);
    if (!last) return todayStart;
    return last > todayStart ? last : todayStart;
  }, [form.inspectionLastChangedAt, todayStart]);

  useEffect(() => {
    const next = parseYmdLocal(form.inspectionNextChangeAt);
    if (!next) return;
    if (next < inspectionNextMin) {
      setForm((f) => ({ ...f, inspectionNextChangeAt: formatYmdLocal(inspectionNextMin) }));
    }
  }, [inspectionNextMin, form.inspectionNextChangeAt]);

  const gasBalloonNextMin = useMemo(() => {
    const last = parseYmdLocal(form.gasBalloonLastChangedAt);
    if (!last) return todayStart;
    return last > todayStart ? last : todayStart;
  }, [form.gasBalloonLastChangedAt, todayStart]);

  useEffect(() => {
    const next = parseYmdLocal(form.gasBalloonNextChangeAt);
    if (!next) return;
    if (next < gasBalloonNextMin) {
      setForm((f) => ({ ...f, gasBalloonNextChangeAt: formatYmdLocal(gasBalloonNextMin) }));
    }
  }, [gasBalloonNextMin, form.gasBalloonNextChangeAt]);

  useEffect(() => {
    if (!pendingDelete) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !deleting) setPendingDelete(null);
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [pendingDelete, deleting]);

  function resetVehicleForm() {
    setEditingId(null);
    setInitialDriverId('');
    setForm({
      categoryId: '',
      name: '',
      model: '',
      plateNumber: '',
      initialKm: '0',
      oilChangeIntervalKm: '',
      insuranceStartDate: '',
      insuranceEndDate: '',
      inspectionLastChangedAt: '',
      inspectionNextChangeAt: '',
      gasBalloonLastChangedAt: '',
      gasBalloonNextChangeAt: '',
      driverId: '',
    });
  }

  function emptyForm() {
    resetVehicleForm();
    setCreateFormOpen(false);
  }

  const showVehicleForm = Boolean(editingId) || createFormOpen;

  async function assignDriverIfNeeded(vehicleId: string, nextDriverId: string, prevDriverId: string) {
    if (nextDriverId === prevDriverId) return;
    await api(`/vehicles/${vehicleId}/assign-driver`, {
      method: 'PATCH',
      body: JSON.stringify({ driverId: nextDriverId || null }),
    });
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const isEdit = Boolean(editingId);
    const base: Record<string, unknown> = {
      name: form.name,
      model: form.model || undefined,
      plateNumber: form.plateNumber,
      initialKm: Number(form.initialKm),
      oilChangeIntervalKm: form.oilChangeIntervalKm ? Number(form.oilChangeIntervalKm) : undefined,
      insuranceStartDate: form.insuranceStartDate || undefined,
      insuranceEndDate: form.insuranceEndDate || undefined,
    };

    const inspectionLast = form.inspectionLastChangedAt.trim();
    const inspectionNext = form.inspectionNextChangeAt.trim();
    const gasLast = form.gasBalloonLastChangedAt.trim();
    const gasNext = form.gasBalloonNextChangeAt.trim();

    if (isEdit) {
      Object.assign(base, {
        categoryId: form.categoryId ? form.categoryId : null,
        inspectionLastChangedAt: inspectionLast || null,
        inspectionNextChangeAt: inspectionNext || null,
        gasBalloonLastChangedAt: gasLast || null,
        gasBalloonNextChangeAt: gasNext || null,
      });
    } else {
      if (form.categoryId) base.categoryId = form.categoryId;
      if (inspectionLast) base.inspectionLastChangedAt = inspectionLast;
      if (inspectionNext) base.inspectionNextChangeAt = inspectionNext;
      if (gasLast) base.gasBalloonLastChangedAt = gasLast;
      if (gasNext) base.gasBalloonNextChangeAt = gasNext;
    }

    try {
      let vehicleId = editingId;
      if (isEdit && vehicleId) {
        await api(`/vehicles/${vehicleId}`, { method: 'PATCH', body: JSON.stringify(base) });
        await assignDriverIfNeeded(vehicleId, form.driverId, initialDriverId);
      } else {
        const created = await api<Vehicle>('/vehicles', { method: 'POST', body: JSON.stringify(base) });
        vehicleId = created.id;
        if (form.driverId) {
          await assignDriverIfNeeded(vehicleId, form.driverId, '');
        }
      }

      emptyForm();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const onEdit = useCallback((v: Vehicle) => {
    setErr(null);
    setEditingId(v.id);
    setInitialDriverId(currentDriverId(v));
    setForm({
      categoryId: v.category?.id ?? v.categoryId ?? '',
      name: v.name ?? '',
      model: v.model ?? '',
      plateNumber: v.plateNumber ?? '',
      initialKm: String(v.initialKm ?? '0'),
      oilChangeIntervalKm: v.oilChangeIntervalKm ? String(v.oilChangeIntervalKm) : '',
      insuranceStartDate: toDateInputValue(v.insuranceStartDate),
      insuranceEndDate: toDateInputValue(v.insuranceEndDate),
      inspectionLastChangedAt: toDateInputValue(v.inspectionLastChangedAt),
      inspectionNextChangeAt: toDateInputValue(v.inspectionNextChangeAt),
      gasBalloonLastChangedAt: toDateInputValue(v.gasBalloonLastChangedAt),
      gasBalloonNextChangeAt: toDateInputValue(v.gasBalloonNextChangeAt),
      driverId: currentDriverId(v),
    });
    document.querySelector('main form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Open edit form when coming from deadlines sub-pages (Link state).
  useEffect(() => {
    const st = location.state as { editVehicleId?: string } | undefined;
    const id = st?.editVehicleId;
    if (!id || rows.length === 0) return;
    const v = rows.find((x) => x.id === id);
    if (!v) return;
    onEdit(v);
    navigate(location.pathname, { replace: true, state: {} });
  }, [rows, location.state, location.pathname, navigate, onEdit]);

  function onCancelEdit() {
    emptyForm();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setErr(null);
    setDeleting(true);
    try {
      await api(`/vehicles/${pendingDelete.id}`, { method: 'DELETE' });
      if (editingId === pendingDelete.id) onCancelEdit();
      setPendingDelete(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="app-page">
      <h1 className="app-page-title">{t('navVehicles')}</h1>
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 sm:max-w-xs">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('vehicleListFilterCategory')}</label>
          <select
            className="app-select w-full"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">{t('vehicleListFilterAll')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {!showVehicleForm ? (
          <button
            type="button"
            className="app-btn-primary w-full shrink-0 sm:w-auto"
            onClick={() => {
              resetVehicleForm();
              setCreateFormOpen(true);
            }}
          >
            {t('vehicleFormOpenCreate')}
          </button>
        ) : null}
      </div>

      {showVehicleForm ? (
      <form onSubmit={onCreate} className="app-card-pad min-w-0 space-y-4">
        <div className="grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
          <div className="min-w-0 sm:col-span-2 xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('vehicleCategory')}</label>
            <select
              className="app-select"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 sm:col-span-2 xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('vehicleDriver')}</label>
            <select className="app-select" value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
              <option value="">{t('vehicleDriverNone')}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('name')}</label>
            <input className="app-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('model')}</label>
            <input className="app-input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('plate')}</label>
            <input className="app-input" value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} required />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('initialKm')}</label>
            <input className="app-input" value={form.initialKm} onChange={(e) => setForm({ ...form, initialKm: e.target.value })} required />
          </div>

          <div className="min-w-0 sm:col-span-2 xl:col-span-2">
            <label className="mb-1 block text-xs font-medium leading-snug text-slate-500 dark:text-slate-400">{t('oilChangeIntervalKm')}</label>
            <input
              type="number"
              min={1}
              className="app-input"
              value={form.oilChangeIntervalKm}
              onChange={(e) => setForm({ ...form, oilChangeIntervalKm: e.target.value })}
              placeholder="—"
            />
          </div>

          <div className="min-w-0 sm:col-span-2 xl:col-span-4">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('insuranceStartDate')} / {t('insuranceEndDate')}</div>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('insuranceStartDate')}</label>
            <DateField
              value={form.insuranceStartDate}
              onChange={(v) => setForm({ ...form, insuranceStartDate: v })}
              onClear={() => setForm({ ...form, insuranceStartDate: '' })}
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('insuranceEndDate')}</label>
            <DateField
              value={form.insuranceEndDate}
              onChange={(v) => setForm({ ...form, insuranceEndDate: v })}
              onClear={() => setForm({ ...form, insuranceEndDate: '' })}
              minDate={insuranceEndMin}
            />
          </div>

          <div className="min-w-0 sm:col-span-2 xl:col-span-4 pt-1">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('vehicleInspectionSection')}</div>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('vehicleInspectionLastChange')}</label>
            <DateField
              value={form.inspectionLastChangedAt}
              onChange={(v) => setForm({ ...form, inspectionLastChangedAt: v })}
              onClear={() => setForm({ ...form, inspectionLastChangedAt: '' })}
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('vehicleInspectionNextChange')}</label>
            <DateField
              value={form.inspectionNextChangeAt}
              onChange={(v) => setForm({ ...form, inspectionNextChangeAt: v })}
              onClear={() => setForm({ ...form, inspectionNextChangeAt: '' })}
              minDate={inspectionNextMin}
            />
          </div>

          <div className="min-w-0 sm:col-span-2 xl:col-span-4 pt-1">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('vehicleGasBalloonSection')}</div>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('vehicleGasBalloonLastChange')}</label>
            <DateField
              value={form.gasBalloonLastChangedAt}
              onChange={(v) => setForm({ ...form, gasBalloonLastChangedAt: v })}
              onClear={() => setForm({ ...form, gasBalloonLastChangedAt: '' })}
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('vehicleGasBalloonNextChange')}</label>
            <DateField
              value={form.gasBalloonNextChangeAt}
              onChange={(v) => setForm({ ...form, gasBalloonNextChangeAt: v })}
              onClear={() => setForm({ ...form, gasBalloonNextChangeAt: '' })}
              minDate={gasBalloonNextMin}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {!editingId && createFormOpen && (
            <button type="button" className="app-btn-ghost w-full sm:w-auto" onClick={() => emptyForm()}>
              {t('vehicleFormCloseCreate')}
            </button>
          )}
          {editingId && (
            <button type="button" className="app-btn-ghost w-full sm:w-auto" onClick={onCancelEdit}>
              {t('cancel')}
            </button>
          )}
          <button type="submit" className="app-btn-primary w-full sm:w-auto">
            {editingId ? t('save') : t('add')}
          </button>
        </div>
      </form>
      ) : null}

      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap">
          <table className="app-table-inner text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="p-3">{t('plate')}</th>
                <th className="p-3">{t('name')}</th>
                <th className="p-3">{t('model')}</th>
                <th className="p-3">{t('vehicleCategory')}</th>
                <th className="p-3">km</th>
                <th className="p-3">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr className="app-table-row">
                  <td className="p-3 text-slate-500 dark:text-slate-400" colSpan={6}>
                    {rows.length === 0 ? t('vehicleDeadlinesEmpty') : t('vehicleListFilterEmpty')}
                  </td>
                </tr>
              ) : (
                filteredRows.map((v) => (
                  <tr key={v.id} className="app-table-row">
                    <td className="p-3 font-mono">{v.plateNumber}</td>
                    <td className="p-3">{v.name}</td>
                    <td className="p-3">{v.model}</td>
                    <td className="p-3">{v.category?.name ?? '—'}</td>
                    <td className="p-3">{String(v.initialKm)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <Link
                          to={`/vehicles/${v.id}/history`}
                          className="app-btn-ghost inline-flex h-9 w-9 items-center justify-center p-0"
                          aria-label={t('vehicleDriverHistoryLink')}
                          title={t('vehicleDriverHistoryLink')}
                        >
                          <History size={16} className="text-slate-700 dark:text-slate-200" aria-hidden />
                        </Link>
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
                          onClick={() => setPendingDelete(v)}
                          aria-label={t('delete')}
                          title={t('delete')}
                        >
                          <Trash2 size={16} className="text-red-600 dark:text-red-400" aria-hidden />
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

      {pendingDelete && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[6200] bg-slate-900/60 backdrop-blur-[1px]"
            aria-label={t('cancel')}
            onClick={() => {
              if (!deleting) setPendingDelete(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-[6300] w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('deleteVehicleTitle')}</div>
              <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono">{pendingDelete.plateNumber}</span>
                <span className="px-1">—</span>
                <span>{pendingDelete.name}</span>
                {pendingDelete.model ? <span className="text-slate-400"> ({pendingDelete.model})</span> : null}
              </div>
            </div>

            <div className="space-y-3 px-4 py-4 sm:px-5">
              <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                {t('deleteVehicleBody')}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:justify-end sm:px-5">
              <button type="button" className="app-btn-ghost w-full sm:w-auto" disabled={deleting} onClick={() => setPendingDelete(null)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-[10px] border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60 sm:w-auto"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? '…' : t('delete')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
