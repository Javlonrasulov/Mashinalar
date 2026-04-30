import { useEffect, useMemo, useRef, useState } from 'react';
import { Droplets, Maximize2, Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { api, API_BASE } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';

type OilOverviewRow = {
  vehicleId: string;
  name: string;
  plateNumber: string;
  driverLogin: string | null;
  lastOilChangeKm: number | null;
  lastOilChangeAt: string | null;
  oilChangeIntervalKm: number | null;
  nextOilChangeKm: number | null;
  estimatedCurrentKm: number;
  kmRemainingToNext: number | null;
  oilUrgency: 'unknown' | 'ok' | 'soon' | 'overdue';
};

type OilHistoryRow = {
  id: string;
  kmAtChange: string;
  photoUrl: string | null;
  createdAt: string;
  plateNumber: string;
  vehicleName: string;
  driverLogin: string;
};

function fmtKm(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function photoHref(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
}

function rowMatchesQuery(q: string, parts: (string | null | undefined)[]): boolean {
  if (!q) return true;
  const n = q.toLowerCase();
  return parts.some((p) => (p ?? '').toLowerCase().includes(n));
}

export function OilPage() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<OilOverviewRow[]>([]);
  const [history, setHistory] = useState<OilHistoryRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<{ src: string; title: string } | null>(null);
  const [photoFs, setPhotoFs] = useState(false);
  const photoStageRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = () => {
    setErr(null);
    Promise.all([
      api<OilOverviewRow[]>('/oil-change-reports/admin/overview'),
      api<OilHistoryRow[]>('/oil-change-reports/admin/list?limit=80'),
    ])
      .then(([o, h]) => {
        setOverview(o);
        setHistory(h);
      })
      .catch((e: Error) => setErr(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!photoModal) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setPhotoModal(null);
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [photoModal]);

  useEffect(() => {
    if (!photoModal) {
      setPhotoFs(false);
      return;
    }
    const sync = () => {
      const el = photoStageRef.current;
      setPhotoFs(Boolean(el && document.fullscreenElement === el));
    };
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [photoModal]);

  function urgencyLabel(u: OilOverviewRow['oilUrgency']) {
    switch (u) {
      case 'overdue':
        return t('oilUrgency_overdue');
      case 'soon':
        return t('oilUrgency_soon');
      case 'ok':
        return t('oilUrgency_ok');
      default:
        return t('oilUrgency_unknown');
    }
  }

  function rowTone(u: OilOverviewRow['oilUrgency']) {
    if (u === 'overdue') {
      return 'bg-red-100 text-red-950 dark:bg-red-950/50 dark:text-red-50 border-red-200 dark:border-red-900';
    }
    if (u === 'soon') {
      return 'bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50 border-amber-200 dark:border-amber-900';
    }
    return 'bg-white text-slate-800 dark:bg-slate-900/60 dark:text-slate-100 border-slate-200 dark:border-slate-700';
  }

  const searchTrim = searchQuery.trim();
  const filteredOverview = useMemo(() => {
    if (!searchTrim) return overview;
    return overview.filter((r) =>
      rowMatchesQuery(searchTrim, [
        r.plateNumber,
        r.name,
        r.driverLogin,
        fmtKm(r.lastOilChangeKm),
        r.oilChangeIntervalKm != null ? String(r.oilChangeIntervalKm) : '',
        fmtKm(r.estimatedCurrentKm),
        fmtKm(r.nextOilChangeKm),
        fmtKm(r.kmRemainingToNext),
        urgencyLabel(r.oilUrgency),
      ]),
    );
  }, [overview, searchTrim, t]);

  const filteredHistory = useMemo(() => {
    if (!searchTrim) return history;
    return history.filter((h) =>
      rowMatchesQuery(searchTrim, [h.plateNumber, h.vehicleName, h.driverLogin, h.kmAtChange]),
    );
  }, [history, searchTrim]);

  return (
    <div className="app-page">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Droplets className="h-8 w-8 text-sky-600 dark:text-sky-400" />
        <h1 className="app-page-title !mb-0">{t('oilPageTitle')}</h1>
        <button type="button" className="app-btn-secondary text-sm" onClick={load}>
          {t('refresh')}
        </button>
      </div>
      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="app-card-pad mb-6 min-w-0 overflow-x-auto">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('oilOverviewTitle')}</h2>
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
                placeholder={t('oilSearchPlaceholder')}
                aria-label={t('oilSearchPlaceholder')}
                autoComplete="off"
              />
            </div>
          </div>
        </div>
        <table className="min-w-[920px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <th className="py-2 pr-3">{t('oilColPlate')}</th>
              <th className="py-2 pr-3">{t('oilColDriver')}</th>
              <th className="py-2 pr-3">{t('oilColLastKm')}</th>
              <th className="py-2 pr-3">{t('oilColInterval')}</th>
              <th className="py-2 pr-3">{t('oilColEstKm')}</th>
              <th className="py-2 pr-3">{t('oilColNextKm')}</th>
              <th className="py-2 pr-3">{t('oilColRemain')}</th>
              <th className="py-2">{t('oilColUrgency')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredOverview.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t('oilSearchNoResults')}
                </td>
              </tr>
            ) : (
              filteredOverview.map((r) => (
                <tr
                  key={r.vehicleId}
                  className={clsx('border-b border-slate-100 dark:border-slate-800', rowTone(r.oilUrgency))}
                >
                  <td className="py-2 pr-3 font-medium">
                    {r.plateNumber}
                    <div className="text-xs font-normal opacity-80">{r.name}</div>
                  </td>
                  <td className="py-2 pr-3">{r.driverLogin ?? '—'}</td>
                  <td className="py-2 pr-3">{fmtKm(r.lastOilChangeKm)}</td>
                  <td className="py-2 pr-3">{r.oilChangeIntervalKm ?? '—'}</td>
                  <td className="py-2 pr-3">{fmtKm(r.estimatedCurrentKm)}</td>
                  <td className="py-2 pr-3">{fmtKm(r.nextOilChangeKm)}</td>
                  <td className="py-2 pr-3">{fmtKm(r.kmRemainingToNext)}</td>
                  <td className="py-2 font-semibold">{urgencyLabel(r.oilUrgency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="app-card-pad min-w-0 overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('oilHistoryTitle')}</h2>
        <table className="min-w-[720px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <th className="py-2 pr-3">{t('oilHistoryTableWhen')}</th>
              <th className="py-2 pr-3">{t('oilColPlate')}</th>
              <th className="py-2 pr-3">{t('oilHistoryTableWho')}</th>
              <th className="py-2 pr-3">{t('oilHistoryTableKm')}</th>
              <th className="py-2">{t('oilHistoryTableTablo')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t('oilSearchNoResults')}
                </td>
              </tr>
            ) : (
              filteredHistory.map((h) => (
                <tr key={h.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3">{new Date(h.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    {h.plateNumber}
                    <div className="text-xs opacity-70">{h.vehicleName}</div>
                  </td>
                  <td className="py-2 pr-3">{h.driverLogin}</td>
                  <td className="py-2 pr-3">{h.kmAtChange}</td>
                  <td className="py-2">
                    {photoHref(h.photoUrl) ? (
                      <button
                        type="button"
                        className="group relative h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-0 shadow-sm transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-600 dark:bg-slate-800"
                        aria-label={t('oilHistoryTableTablo')}
                        onClick={() =>
                          setPhotoModal({
                            src: photoHref(h.photoUrl)!,
                            title: `${h.plateNumber} · ${h.kmAtChange} ${t('oilHistoryTableKm')}`,
                          })
                        }
                      >
                        <img
                          src={photoHref(h.photoUrl)!}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {photoModal && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[6000] bg-slate-900/60 backdrop-blur-[1px]"
            aria-label={t('cancel')}
            onClick={() => setPhotoModal(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-[6100] w-[min(96vw,980px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{photoModal.title}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="app-btn-ghost inline-flex items-center gap-2 px-3 py-2"
                  onClick={async () => {
                    const el = photoStageRef.current;
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
                  <span className="hidden sm:inline">{photoFs ? t('exitFullScreen') : t('fullScreen')}</span>
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
                    setPhotoModal(null);
                  }}
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
            </div>
            <div
              ref={photoStageRef}
              className="flex min-h-[min(78vh,820px)] items-center justify-center bg-slate-950 [:fullscreen]:min-h-screen [:fullscreen]:w-screen"
            >
              <img
                src={photoModal.src}
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
