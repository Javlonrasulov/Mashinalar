import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n, type Lang } from '@/i18n/I18nContext';

type Vehicle = {
  id: string;
  name: string;
  model: string | null;
  plateNumber: string;
};

type DriverVehicleAssignment = {
  id: string;
  startAt: string;
  endAt: string | null;
  driver: { id: string; fullName: string; phone: string; user?: { login: string } };
};

function intlLocaleFor(lang: Lang): string {
  if (lang === 'ru') return 'ru-RU';
  if (lang === 'uzCyrl') return 'ru-RU';
  return 'uz-Latn-UZ';
}

function formatDateTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat(intlLocaleFor(lang), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatDuration(ms: number, lang: Lang): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;
  const days = Math.floor(ms / dayMs);
  const hours = Math.floor((ms % dayMs) / hourMs);
  const minutes = Math.floor((ms % hourMs) / minuteMs);
  if (lang === 'ru') {
    const parts: string[] = [];
    if (days) parts.push(`${days} д`);
    if (hours) parts.push(`${hours} ч`);
    if (!days && !hours) parts.push(`${minutes} мин`);
    else if (minutes) parts.push(`${minutes} мин`);
    return parts.join(' ') || '0 мин';
  }
  const parts: string[] = [];
  if (days) parts.push(`${days} kun`);
  if (hours) parts.push(`${hours} soat`);
  if (!days && !hours) parts.push(`${minutes} daqiqa`);
  else if (minutes) parts.push(`${minutes} daqiqa`);
  return parts.join(' ') || '0 daqiqa';
}

export function VehicleDriverHistoryPage() {
  const { vehicleId } = useParams();
  const { t, lang } = useI18n();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [rows, setRows] = useState<DriverVehicleAssignment[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const title = useMemo(() => {
    if (!vehicle) return t('vehicleDriverHistoryTitle');
    return `${t('vehicleDriverHistoryTitle')} — ${vehicle.plateNumber}`;
  }, [t, vehicle]);

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const [v, h] = await Promise.all([
          api<Vehicle>(`/vehicles/${vehicleId}`),
          api<DriverVehicleAssignment[]>(`/vehicles/${vehicleId}/driver-history`),
        ]);
        if (cancelled) return;
        setVehicle(v);
        setRows(h);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  return (
    <div className="app-page">
      <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/vehicles"
            className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
          >
            <ArrowLeft size={16} aria-hidden />
            {t('vehicleDriverHistoryBack')}
          </Link>
          <h1 className="app-page-title">{title}</h1>
          {vehicle ? (
            <div className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
              <span>{vehicle.name}</span>
              {vehicle.model ? <span className="text-slate-400"> ({vehicle.model})</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap">
          <table className="app-table-inner text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="p-3">{t('fullName')}</th>
                <th className="p-3">{t('phone')}</th>
                <th className="p-3">{t('vehicleDriverHistoryStart')}</th>
                <th className="p-3">{t('vehicleDriverHistoryEnd')}</th>
                <th className="p-3">{t('vehicleDriverHistoryDuration')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="app-table-row">
                  <td className="p-3 text-slate-500 dark:text-slate-400" colSpan={5}>
                    {t('vehicleDriverHistoryEmpty')}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const start = new Date(r.startAt).getTime();
                  const endMs = r.endAt ? new Date(r.endAt).getTime() : Date.now();
                  const duration = Number.isFinite(start) && Number.isFinite(endMs) ? endMs - start : NaN;
                  return (
                    <tr key={r.id} className="app-table-row">
                      <td className="p-3 font-medium text-slate-900 dark:text-white">{r.driver.fullName}</td>
                      <td className="p-3 font-mono text-xs text-slate-600 dark:text-slate-300">{r.driver.phone}</td>
                      <td className="p-3 whitespace-nowrap text-slate-700 dark:text-slate-200">{formatDateTime(r.startAt, lang)}</td>
                      <td className="p-3 whitespace-nowrap text-slate-700 dark:text-slate-200">
                        {r.endAt ? formatDateTime(r.endAt, lang) : <span className="text-blue-700 dark:text-blue-300">{t('vehicleDriverHistoryCurrent')}</span>}
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-700 dark:text-slate-200">
                        {r.endAt ? formatDuration(duration, lang) : `${formatDuration(duration, lang)} (${t('vehicleDriverHistoryCurrent')})`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
