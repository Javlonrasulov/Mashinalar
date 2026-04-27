import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import { formatDateTime, formatDuration } from '@/lib/assignmentDisplay';

type Row = {
  id: string;
  startAt: string;
  endAt: string | null;
  driver: { id: string; fullName: string; phone: string };
  vehicle: { id: string; plateNumber: string; name: string; model: string | null };
};

export function VehiclesAllDriverHistoryPage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const list = await api<Row[]>('/vehicles/assignments');
        if (!cancelled) setRows(list);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app-page">
      <div className="mb-3">
        <Link
          to="/vehicles"
          className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
        >
          <ArrowLeft size={16} aria-hidden />
          {t('vehicleDriverHistoryBack')}
        </Link>
        <h1 className="app-page-title">{t('vehicleFleetHistoryTitle')}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{t('vehicleFleetHistorySubtitle')}</p>
      </div>

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
                <th className="p-3">{t('fleetHistoryColVehicle')}</th>
                <th className="p-3">{t('fullName')}</th>
                <th className="p-3">{t('phone')}</th>
                <th className="p-3">{t('vehicleDriverHistoryStart')}</th>
                <th className="p-3">{t('vehicleDriverHistoryEnd')}</th>
                <th className="p-3">{t('vehicleDriverHistoryDuration')}</th>
                <th className="p-3">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="app-table-row">
                  <td className="p-3 text-slate-500 dark:text-slate-400" colSpan={7}>
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
                      <td className="p-3">
                        <div className="font-mono font-semibold text-slate-900 dark:text-white">{r.vehicle.plateNumber}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          {r.vehicle.name}
                          {r.vehicle.model ? <span className="text-slate-400"> ({r.vehicle.model})</span> : null}
                        </div>
                      </td>
                      <td className="p-3 font-medium text-slate-900 dark:text-white">{r.driver.fullName}</td>
                      <td className="p-3 font-mono text-xs text-slate-600 dark:text-slate-300">{r.driver.phone}</td>
                      <td className="p-3 whitespace-nowrap text-slate-700 dark:text-slate-200">{formatDateTime(r.startAt, lang)}</td>
                      <td className="p-3 whitespace-nowrap text-slate-700 dark:text-slate-200">
                        {r.endAt ? (
                          formatDateTime(r.endAt, lang)
                        ) : (
                          <span className="text-blue-700 dark:text-blue-300">{t('vehicleDriverHistoryCurrent')}</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-700 dark:text-slate-200">
                        {r.endAt ? formatDuration(duration, lang) : `${formatDuration(duration, lang)} (${t('vehicleDriverHistoryCurrent')})`}
                      </td>
                      <td className="p-3">
                        <Link
                          to={`/vehicles/${r.vehicle.id}/history`}
                          className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
                        >
                          {t('fleetHistoryOpenVehicle')}
                        </Link>
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
