import { NavLink } from 'react-router';
import { useI18n } from '@/i18n/I18nContext';
import { clsx } from 'clsx';

export function ExpensesSubNav() {
  const { t } = useI18n();
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
      isActive
        ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
    );
  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800" aria-label="Expenses">
      <NavLink to="/expenses" end className={tabClass}>
        {t('navExpenses')}
      </NavLink>
      <NavLink to="/expenses/stats" className={tabClass}>
        {t('navExpensesStats')}
      </NavLink>
    </nav>
  );
}
