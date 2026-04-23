import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import { DateTimeField } from '@/components/DateTimeField';
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
  driver: { fullName: string };
  vehicle: { plateNumber: string };
};

const TASK_STATUSES = ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;

function taskStatusLabelKey(status: string): string {
  return TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])
    ? `taskStatus_${status}`
    : status;
}

export function TasksPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<TaskRow[]>([]);
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

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const deadline = new Date(form.deadlineAt);
    if (!Number.isFinite(deadline.getTime()) || deadline.getTime() < Date.now()) {
      window.alert(t('taskDeadlineMustBeFuture'));
      return;
    }
    await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        vehicleId: form.vehicleId,
        driverId: form.driverId,
        title: form.title,
        deadlineAt: new Date(form.deadlineAt).toISOString(),
      }),
    });
    setForm({ vehicleId: '', driverId: '', title: '', deadlineAt: defaultTaskDeadline() });
    await load();
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
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('plate')}</label>
          <select
            className="app-select"
            value={form.vehicleId}
            onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
            required
          >
            <option value="">—</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('fullName')}</label>
          <select
            className="app-select"
            value={form.driverId}
            onChange={(e) => setForm({ ...form, driverId: e.target.value })}
            required
          >
            <option value="">—</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('title')}</label>
          <input
            className="app-input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
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
          <table className="app-table-inner text-sm">
          <thead className="app-table-head">
            <tr>
              <th className="p-3">{t('title')}</th>
              <th className="p-3">{t('plate')}</th>
              <th className="p-3">{t('fullName')}</th>
              <th className="p-3">{t('deadline')}</th>
              <th className="p-3">{t('status')}</th>
              <th className="p-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="app-table-row">
                <td className="p-3">{r.title}</td>
                <td className="p-3 font-mono">{r.vehicle.plateNumber}</td>
                <td className="p-3">{r.driver.fullName}</td>
                <td className="p-3">{new Date(r.deadlineAt).toLocaleString()}</td>
                <td className="p-3">{t(taskStatusLabelKey(r.status))}</td>
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
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
