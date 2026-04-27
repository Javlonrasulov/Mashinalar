import { NavLink, Outlet } from 'react-router';
import { clsx } from 'clsx';
import { useI18n } from '@/i18n/I18nContext';

function subTabClass(isActive: boolean) {
  return clsx(
    'inline-flex min-h-[40px] items-center rounded-lg px-3 py-2 text-sm font-semibold transition',
    isActive
      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-white dark:ring-slate-700'
      : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white',
  );
}

export function VehiclesLayout() {
  const { t } = useI18n();
  return (
    <div className="app-page min-w-0 space-y-4">
      <nav
        aria-label={t('navVehicles')}
        className="flex flex-wrap gap-1 rounded-xl border border-slate-200/90 bg-slate-50/90 p-1 dark:border-slate-700 dark:bg-slate-900/60"
      >
        <NavLink to="/vehicles" end className={({ isActive }) => subTabClass(isActive)}>
          {t('vehiclesSubNavList')}
        </NavLink>
        <NavLink to="/vehicles/categories" className={({ isActive }) => subTabClass(isActive)}>
          {t('navVehicleCategories')}
        </NavLink>
        <NavLink to="/vehicles/inspection" className={({ isActive }) => subTabClass(isActive)}>
          {t('vehiclesSubNavInspection')}
        </NavLink>
        <NavLink to="/vehicles/insurance" className={({ isActive }) => subTabClass(isActive)}>
          {t('vehiclesSubNavInsurance')}
        </NavLink>
        <NavLink to="/vehicles/gas-balloon" className={({ isActive }) => subTabClass(isActive)}>
          {t('vehiclesSubNavGasBalloon')}
        </NavLink>
        <NavLink to="/vehicles/history" className={({ isActive }) => subTabClass(isActive)}>
          {t('vehiclesSubNavFleetHistory')}
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
