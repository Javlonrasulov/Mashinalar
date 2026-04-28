import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { api, apiUrl } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import { DateTimeField } from '@/components/DateTimeField';
import { SelectField } from '@/components/SelectField';
import { toDatetimeLocalValue } from '@/lib/datetimeLocal';

function startOfLocalToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function defaultTaskDeadline(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

type TaskRow = {
  id: string;
  title: string;
  status: string;
  deadlineAt: string;
  proofPhotoUrl?: string | null;
  proofText?: string | null;
  driver: { fullName: string };
  vehicle: { plateNumber: string };
};

function taskProofPhotoSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  if (u.startsWith('http')) return u;
  return apiUrl(u.startsWith('/') ? u : `/${u}`);
}

const TASK_STATUSES = ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;

function taskStatusLabelKey(status: string): string {
  return TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])
    ? `taskStatus_${status}`
    : status;
}

export function TasksPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [proofPhoto, setProofPhoto] = useState<{ src: string; title: string } | null>(null);
  const [proofPhotoFs, setProofPhotoFs] = useState(false);
  const proofPhotoStageRef = useRef<HTMLDivElement>(null);
  const [vehicles, setVehicles] = useState<{ id: string; plateNumber: string }[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; fullName: string }[]>([]);
  const [form, setForm] = useState({
    vehicleId: '',
    driverId: '',
    title: '',
    deadlineAt: defaultTaskDeadline(),
  });

  const load = async () => {
    const [tasks, v, d] = await Promise.all([
      api<TaskRow[]>('/tasks'),
      api<{ id: string; plateNumber: string }[]>('/vehicles'),
      api<{ id: string; fullName: string }[]>('/drivers'),
    ]);
    setRows(tasks);
    setVehicles(v);
    setDrivers(d);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  useEffect(() => {
    if (!proofPhoto) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setProofPhoto(null);
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [proofPhoto]);

  useEffect(() => {
    if (!proofPhoto) {
      setProofPhotoFs(false);
      return;
    }
    const sync = () => {
      const el = proofPhotoStageRef.current;
      setProofPhotoFs(Boolean(el && document.fullscreenElement === el));
    };
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [proofPhoto]);

  const vehicleOptions = useMemo(
    () => [
      { value: '', label: '—' },
      ...vehicles.map((v) => ({ value: v.id, label: v.plateNumber })),
    ],
    [vehicles],
  );

  const driverOptions = useMemo(
    () => [
      { value: '', label: '—' },
      ...drivers.map((d) => ({ value: d.id, label: d.fullName })),
    ],
    [drivers],
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vehicleId || !form.driverId) return;
    const title = form.title.trim();
    if (title.length < 2) {
      window.alert(t('taskTitleMinLength'));
      return;
    }
    const deadline = new Date(form.deadlineAt);
    if (!Number.isFinite(deadline.getTime()) || deadline.getTime() < Date.now()) {
      window.alert(t('taskDeadlineMustBeFuture'));
      return;
    }
    try {
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: form.vehicleId,
          driverId: form.driverId,
          title,
          deadlineAt: new Date(form.deadlineAt).toISOString(),
        }),
      });
      setForm({ vehicleId: '', driverId: '', title: '', deadlineAt: defaultTaskDeadline() });
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t('genericError'));
    }
  }

  async function review(id: string, status: 'APPROVED' | 'REJECTED') {
    await api(`/tasks/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Delete?')) return;
    await api(`/tasks/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="app-page">
      <h1 className="app-page-title">{t('navTasks')}</h1>

      <form
        onSubmit={onCreate}
        className="app-card-pad grid min-w-0 grid-cols-1 items-end gap-3 md:grid-cols-5"
      >
        <div>
          <label
            className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
            htmlFor="task-form-vehicle"
          >
            {t('plate')}
          </label>
          <SelectField
            id="task-form-vehicle"
            value={form.vehicleId}
            onChange={(vehicleId) => setForm({ ...form, vehicleId })}
            options={vehicleOptions}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
            htmlFor="task-form-driver"
          >
            {t('fullName')}
          </label>
          <SelectField
            id="task-form-driver"
            value={form.driverId}
            onChange={(driverId) => setForm({ ...form, driverId })}
            options={driverOptions}
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('title')}</label>
          <input
            className="app-input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            minLength={2}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('deadline')}</label>
          <DateTimeField
            value={form.deadlineAt}
            onChange={(deadlineAt) => setForm({ ...form, deadlineAt })}
            disabled={{ before: startOfLocalToday() }}
          />
        </div>
        <button type="submit" className="app-btn-primary md:col-span-5 md:justify-self-start">
          {t('add')}
        </button>
      </form>

      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap">
          <table className="app-table-inner min-w-[920px] text-sm">
          <thead className="app-table-head">
            <tr>
              <th className="p-3">{t('title')}</th>
              <th className="p-3">{t('plate')}</th>
              <th className="p-3">{t('fullName')}</th>
              <th className="p-3">{t('deadline')}</th>
              <th className="p-3">{t('status')}</th>
              <th className="p-3">{t('taskDriverProof')}</th>
              <th className="p-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const proofSrc = taskProofPhotoSrc(r.proofPhotoUrl);
              const proofNote = r.proofText?.trim() ?? '';
              return (
                <tr key={r.id} className="app-table-row">
                  <td className="p-3">{r.title}</td>
                  <td className="p-3 font-mono">{r.vehicle.plateNumber}</td>
                  <td className="p-3">{r.driver.fullName}</td>
                  <td className="p-3">{new Date(r.deadlineAt).toLocaleString()}</td>
                  <td className="p-3">{t(taskStatusLabelKey(r.status))}</td>
                  <td className="max-w-[220px] p-3 align-top">
                    <div className="flex flex-col gap-2">
                      {proofSrc ? (
                        <button
                          type="button"
                          className="group relative h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-0 shadow-sm transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                          aria-label={t('dailyKmViewPhoto')}
                          onClick={() =>
                            setProofPhoto({
                              src: proofSrc,
                              title: `${r.title} · ${r.vehicle.plateNumber}`,
                            })
                          }
                        >
                          <img src={proofSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
                        </button>
                      ) : null}
                      {proofNote ? (
                        <p className="line-clamp-3 text-xs leading-snug text-slate-600 dark:text-slate-300">
                          {proofNote}
                        </p>
                      ) : !proofSrc ? (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {r.status === 'SUBMITTED' && (
                        <>
                          <button
                            type="button"
                            className="font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                            onClick={() => review(r.id, 'APPROVED')}
                          >
                            {t('approve')}
                          </button>
                          <button
                            type="button"
                            className="app-link-danger"
                            onClick={() => review(r.id, 'REJECTED')}
                          >
                            {t('reject')}
                          </button>
                        </>
                      )}
                      <button type="button" className="app-link-muted" onClick={() => remove(r.id)}>
                        {t('delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {proofPhoto && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[6000] bg-slate-900/60 backdrop-blur-[1px]"
            aria-label={t('cancel')}
            onClick={() => setProofPhoto(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-[6100] w-[min(96vw,980px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{proofPhoto.title}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="app-btn-ghost inline-flex items-center gap-2 px-3 py-2"
                  onClick={async () => {
                    const el = proofPhotoStageRef.current;
                    if (!el) return;
                    try {
                      if (document.fullscreenElement === el) await document.exitFullscreen();
                      else await el.requestFullscreen();
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  <Maximize2 size={16} aria-hidden />
                  <span className="hidden sm:inline">{proofPhotoFs ? t('exitFullScreen') : t('fullScreen')}</span>
                </button>
                <button
                  type="button"
                  className="app-btn-ghost inline-flex h-9 w-9 items-center justify-center p-0"
                  aria-label={t('cancel')}
                  onClick={async () => {
                    try {
                      if (document.fullscreenElement) await document.exitFullscreen();
                    } catch {
                      /* ignore */
                    }
                    setProofPhoto(null);
                  }}
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
            </div>
            <div
              ref={proofPhotoStageRef}
              className="flex min-h-[min(78vh,820px)] items-center justify-center bg-slate-950 [:fullscreen]:min-h-screen [:fullscreen]:w-screen"
            >
              <img
                src={proofPhoto.src}
                alt=""
                className="max-h-[min(78vh,820px)] max-w-full object-contain [:fullscreen]:max-h-full [:fullscreen]:max-w-full"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
