import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import { formatDateTime } from '@/lib/assignmentDisplay';

export type DeadlineKind = 'inspection' | 'insurance' | 'gasBalloon';

type Vehicle = {
  id: string;
  plateNumber: string;
  name: string;
  model: string | null;
  category?: { name: string } | null;
  insuranceEndDate?: string | null;
  inspectionNextChangeAt?: string | null;
  gasBalloonNextChangeAt?: string | null;
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysFromToday(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return null;
  const a = startOfLocalDay(new Date());
  const b = startOfLocalDay(dt);
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function nextIso(v: Vehicle, kind: DeadlineKind): string | null {
  if (kind === 'inspection') return v.inspectionNextChangeAt ?? null;
  if (kind === 'insurance') return v.insuranceEndDate ?? null;
  return v.gasBalloonNextChangeAt ?? null;
}

function soonDays(kind: DeadlineKind): number {
  if (kind === 'insurance') return 30;
  return 14;
}

function titleKey(kind: DeadlineKind): string {
  if (kind === 'inspection') return 'vehicleDeadlinesTitleInspection';
  if (kind === 'insurance') return 'vehicleDeadlinesTitleInsurance';
  return 'vehicleDeadlinesTitleGas';
}

export function VehicleDeadlinesPage({ kind }: { kind: DeadlineKind }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Vehicle[]>('/vehicles')
      .then(setRows)
      .catch((e: Error) => setErr(e.message));
  }, []);

  const threshold = soonDays(kind);

  const sorted = useMemo(() => {
    const withDays = rows.map((v) => {
      const iso = nextIso(v, kind);
      const days = daysFromToday(iso);
      return { v, iso, days };
    });
    withDays.sort((a, b) => {
      if (a.days === null && b.days === null) return a.v.plateNumber.localeCompare(b.v.plateNumber);
      if (a.days === null) return 1;
      if (b.days === null) return -1;
      return a.days - b.days;
    });
    return withDays;
  }, [rows, kind]);

  function rowTone(days: number | null): string {
    if (days === null) return '';
    if (days < 0) return 'bg-red-50/80 dark:bg-red-950/25';
    if (days <= threshold) return 'bg-amber-50/70 dark:bg-amber-950/20';
    return '';
  }

  function statusLabel(days: number | null): string {
    if (days === null) return t('deadlineStatus_noDate');
    if (days < 0) return t('deadlineStatus_overdue');
    if (days <= threshold) return t('deadlineStatus_soon');
    return t('deadlineStatus_ok');
  }

  return (
    <div className="app-page">
      <h1 className="app-page-title">{t(titleKey(kind))}</h1>
      <p className="mb-4 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
        {t('vehicleDeadlinesHint', { n: String(threshold) })}
      </p>

      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap">
          <table className="app-table-inner text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="p-3">{t('plate')}</th>
                <th className="p-3">{t('name')}</th>
                <th className="p-3">{t('vehicleCategory')}</th>
                <th className="p-3">{t('deadlinesColNext')}</th>
                <th className="p-3">{t('deadlinesColDaysLeft')}</th>
                <th className="p-3">{t('deadlinesColStatus')}</th>
                <th className="p-3">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr className="app-table-row">
                  <td className="p-3 text-slate-500 dark:text-slate-400" colSpan={7}>
                    {t('vehicleDeadlinesEmpty')}
                  </td>
                </tr>
              ) : (
                sorted.map(({ v, iso, days }) => (
                  <tr key={v.id} className={['app-table-row', rowTone(days)].filter(Boolean).join(' ')}>
                    <td className="p-3 font-mono">{v.plateNumber}</td>
                    <td className="p-3">{v.name}</td>
                    <td className="p-3">{v.category?.name ?? '—'}</td>
                    <td className="p-3 whitespace-nowrap">{iso ? formatDateTime(iso, lang) : '—'}</td>
                    <td className="p-3 tabular-nums">{days === null ? '—' : String(days)}</td>
                    <td className="p-3 text-xs font-medium">{statusLabel(days)}</td>
                    <td className="p-3">
                      <Link
                        to="/vehicles"
                        state={{ editVehicleId: v.id }}
                        className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
                      >
                        {t('deadlinesLinkEdit')}
                      </Link>
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
