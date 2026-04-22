import { useEffect, useState } from 'react';
import { AlertTriangle, Car, Gauge, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';

type Summary = {
  todayKm: number;
  activeVehicles: number;
  staleVehicles: { id: string; plateNumber: string; lastLocationAt: string | null; drivers: { fullName: string }[] }[];
  insuranceSoon: { id: string; plateNumber: string; insuranceEndDate: string | null }[];
  overdueTasks: unknown[];
  upcomingDeadlines: unknown[];
};

const iconStyles = [
  'bg-blue-600 shadow-blue-600/25',
  'bg-violet-600 shadow-violet-600/25',
  'bg-amber-500 shadow-amber-500/25',
];

function Kpi({
  title,
  value,
  icon: Icon,
  warn,
  toneIndex,
}: {
  title: string;
  value: string;
  icon: typeof Car;
  warn?: boolean;
  toneIndex: number;
}) {
  const tone = warn ? 'bg-amber-500 shadow-amber-500/25' : iconStyles[toneIndex % iconStyles.length];
  return (
    <div className={kpiCardClass(warn)}>
      <div className="flex items-start justify-between gap-3">
        <div className={clsx('app-kpi-icon', tone)}>
          <Icon size={20} strokeWidth={2} />
        </div>
        {warn && <AlertTriangle className="mt-0.5 shrink-0 text-amber-500" size={18} aria-hidden />}
      </div>
      <p className="mb-1 mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function kpiCardClass(warn: boolean | undefined) {
  return clsx(
    'app-card rounded-xl p-5 transition',
    warn &&
      'border-amber-200/90 ring-1 ring-amber-100 dark:border-amber-800/60 dark:ring-amber-900/40',
  );
}

export function DashboardPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Summary>('/dashboard/summary')
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (err) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{err}</div>;
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          …
        </span>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div>
        <h1 className="app-page-title">{t('navDashboard')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('appTitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi title={t('todayKm')} value={data.todayKm.toFixed(1)} icon={Gauge} toneIndex={0} />
        <Kpi title={t('activeVehicles')} value={String(data.activeVehicles)} icon={Car} toneIndex={1} />
        <Kpi
          title={t('staleDrivers')}
          value={String(data.staleVehicles.length)}
          icon={AlertTriangle}
          warn={data.staleVehicles.length > 0}
          toneIndex={2}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="app-card-pad min-w-0">
          <div className="mb-4 flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              <ShieldAlert size={18} />
            </div>
            <h2 className="min-w-0 break-words font-semibold text-slate-900 dark:text-white">{t('insuranceSoon')}</h2>
          </div>
          <ul className="space-y-3 text-sm">
            {data.insuranceSoon.length === 0 && (
              <li className="rounded-lg bg-slate-50 px-3 py-2 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                {t('all')}
              </li>
            )}
            {data.insuranceSoon.map((v) => (
              <li
                key={v.id}
                className="flex flex-col gap-1 rounded-lg border border-slate-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 dark:border-slate-800"
              >
                <span className="min-w-0 break-words font-mono font-medium">{v.plateNumber}</span>
                <span className="shrink-0 text-slate-500 dark:text-slate-400">
                  {v.insuranceEndDate ? new Date(v.insuranceEndDate).toLocaleDateString() : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="app-card-pad min-w-0">
          <div className="mb-4 flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle size={18} />
            </div>
            <h2 className="min-w-0 break-words font-semibold text-slate-900 dark:text-white">{t('overdueTasks')}</h2>
          </div>
          <ul className="space-y-3 text-sm">
            {(data.overdueTasks as { id: string; title: string; driver?: { fullName?: string } }[]).map((x) => (
              <li
                key={x.id}
                className="flex flex-col gap-1 rounded-lg border border-slate-100 px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3 dark:border-slate-800"
              >
                <span className="min-w-0 break-words">{x.title}</span>
                <span className="shrink-0 text-slate-500 dark:text-slate-400 sm:text-right">{x.driver?.fullName}</span>
              </li>
            ))}
            {data.overdueTasks.length === 0 && (
              <li className="rounded-lg bg-slate-50 px-3 py-2 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                {t('all')}
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
