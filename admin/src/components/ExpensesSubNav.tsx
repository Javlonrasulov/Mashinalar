import { NavLink } from 'react-router';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { clsx } from 'clsx';

export function ExpensesSubNav() {
  const { t } = useI18n();
  const { user } = useAuth();
  const pages = user?.allowedPages;
  const showList = user?.role === 'ADMIN' || !pages || pages.includes('EXPENSES');
  const showStats = user?.role === 'ADMIN' || !pages || pages.includes('EXPENSES_STATS');
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
      isActive
        ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
    );
  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800" aria-label="Expenses">
      {showList && (
        <NavLink to="/expenses" end className={tabClass}>
          {t('navExpenses')}
        </NavLink>
      )}
      {showStats && (
        <NavLink to="/expenses/stats" className={tabClass}>
          {t('navExpensesStats')}
        </NavLink>
      )}
    </nav>
  );
}
