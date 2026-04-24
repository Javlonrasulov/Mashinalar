import { useEffect, useId, useMemo, useState } from 'react';
import { NavLink, Outlet, matchPath, useLocation } from 'react-router';
import {
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Fuel,
  Gauge,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Moon,
  Receipt,
  Droplets,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/auth/AuthContext';
import { useI18n, type Lang } from '@/i18n/I18nContext';
import { clsx } from 'clsx';
import { api } from '@/lib/api';

const nav = [
  { to: '/', icon: LayoutDashboard, key: 'navDashboard' as const },
  { to: '/map', icon: Map, key: 'navMap' as const },
  { to: '/vehicles', icon: Car, key: 'navVehicles' as const },
  { to: '/drivers', icon: Users, key: 'navDrivers' as const },
  { to: '/tasks', icon: ClipboardList, key: 'navTasks' as const },
  { to: '/fuel', icon: Fuel, key: 'navFuel' as const },
  { to: '/daily-km', icon: Gauge, key: 'navDailyKm' as const },
  { to: '/oil', icon: Droplets, key: 'navOil' as const },
  { to: '/expenses', icon: Receipt, key: 'navExpenses' as const },
];

function usePageTitle() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const ordered: { path: string; end?: boolean; key: string }[] = [
    { path: '/map', key: 'navMap' },
    { path: '/vehicles', key: 'navVehicles' },
    { path: '/drivers', key: 'navDrivers' },
    { path: '/tasks', key: 'navTasks' },
    { path: '/fuel', key: 'navFuel' },
    { path: '/daily-km', key: 'navDailyKm' },
    { path: '/oil', key: 'navOil' },
    { path: '/expenses/stats', key: 'navExpensesStats' },
    { path: '/expenses', key: 'navExpenses' },
    { path: '/', end: true, key: 'navDashboard' },
  ];
  for (const item of ordered) {
    if (matchPath({ path: item.path, end: item.end ?? false }, pathname)) {
      return t(item.key);
    }
  }
  return t('navDashboard');
}

const LANG_ITEMS: { id: Lang; code: string; label: string; sub: string }[] = [
  { id: 'uzCyrl', code: 'UZ', label: 'Oʻzbek (Kiril)', sub: 'КИ' },
  { id: 'uzLatn', code: 'UZ', label: "Oʻzbek (Lotin)", sub: 'LT' },
  { id: 'ru', code: 'RU', label: 'Русский', sub: 'RU' },
];

function LanguageMenu({
  value,
  onChange,
  menuAlign = 'end',
}: {
  value: Lang;
  onChange: (l: Lang) => void;
  /** `end`: o‘ng tomonga (desktop). `start`: chap tomonga (tor ekranda tugma chapda). */
  menuAlign?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const rootDomId = useId().replace(/:/g, '');

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!(e.target instanceof Node)) return;
      const root = document.getElementById(`lang-menu-root-${rootDomId}`);
      if (!root) return;
      if (!root.contains(e.target)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (!open) return;
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, rootDomId]);

  const active = LANG_ITEMS.find((x) => x.id === value) ?? LANG_ITEMS[0];

  return (
    <div id={`lang-menu-root-${rootDomId}`} className="relative z-[70] shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:min-h-0 sm:min-w-0 sm:gap-2 sm:px-3 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="font-semibold tabular-nums">{active.sub}</span>
        <ChevronDown size={16} className={clsx('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className={clsx(
            'absolute z-[100] mt-2 w-[min(260px,calc(100vw-1rem))] max-w-[calc(100vw-0.75rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900',
            menuAlign === 'end' ? 'right-0' : 'left-0',
          )}
        >
          <div className="p-2">
            {LANG_ITEMS.map((x) => {
              const isActive = x.id === value;
              return (
                <button
                  key={x.id}
                  role="menuitemradio"
                  aria-checked={isActive}
                  type="button"
                  onClick={() => {
                    onChange(x.id);
                    setOpen(false);
                  }}
                  className={clsx(
                    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition',
                    isActive
                      ? 'bg-blue-50 text-slate-900 dark:bg-blue-950/40 dark:text-white'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/70',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="w-7 text-xs font-semibold text-blue-600 dark:text-blue-400">{x.code}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{x.label}</div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">{x.sub}</div>
                    </div>
                  </div>
                  {isActive && <Check size={18} className="shrink-0 text-blue-600 dark:text-blue-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ShellLayout() {
  const { logout, user, refresh } = useAuth();
  const { t, lang, setLang } = useI18n();
  const pageTitle = usePageTitle();
  const { setTheme, resolvedTheme } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [credOpen, setCredOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mashinalar_sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    try {
      localStorage.setItem('mashinalar_sidebar', sidebarCollapsed ? 'collapsed' : 'expanded');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const asideClass = clsx(
    'flex shrink-0 flex-col border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900',
    'fixed inset-y-0 left-0 z-50 w-[min(100vw-1rem,280px)] max-w-[90vw] border-r shadow-xl transition-transform duration-200 ease-out',
    clsx(
      'lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:shadow-none',
      sidebarCollapsed ? 'lg:w-[84px]' : 'lg:w-[260px]',
    ),
    sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
  );

  const initialLogin = useMemo(() => user?.login ?? '', [user?.login]);

  return (
    <div className="flex min-h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-[#f4f6f9] text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={asideClass} aria-label="Navigation">
        <div
          className={clsx(
            'flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800',
            sidebarCollapsed ? 'px-3 py-4' : 'px-4 py-4 sm:px-5',
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm">
              M
            </div>
            <div className={clsx('min-w-0', sidebarCollapsed && 'hidden lg:block lg:sr-only')}>
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{t('appTitle')}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="app-btn-ghost shrink-0 p-2 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <nav
          className={clsx(
            'flex-1 space-y-0.5 overflow-y-auto overscroll-y-contain py-3 sm:py-4',
            sidebarCollapsed ? 'px-2' : 'px-3',
          )}
        >
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center rounded-xl border-l-[3px] py-2.5 text-sm font-medium transition-colors',
                  sidebarCollapsed ? 'justify-center gap-0 px-2' : 'gap-3 pl-3 pr-3',
                  isActive
                    ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-100'
                    : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                )
              }
            >
              <item.icon size={18} className="shrink-0 opacity-90" />
              {!sidebarCollapsed && <span className="min-w-0 break-words">{t(item.key)}</span>}
            </NavLink>
          ))}
        </nav>

        <div
          className={clsx(
            'border-t border-slate-100 dark:border-slate-800',
            sidebarCollapsed ? 'p-2' : 'p-3 sm:p-4',
          )}
        >
          <button
            type="button"
            className={clsx(
              'app-btn-ghost hidden w-full items-center justify-center gap-2 p-2 lg:inline-flex',
              !sidebarCollapsed && 'justify-end',
            )}
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? t('sidebarExpand') : t('sidebarCollapse')}
            title={sidebarCollapsed ? t('sidebarExpand') : t('sidebarCollapse')}
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!sidebarCollapsed && (
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300" aria-hidden>
                {t('sidebarCollapse')}
              </span>
            )}
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 overflow-visible border-b border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
          <div className="w-full min-w-0 overflow-visible px-2 py-2 sm:px-4 md:px-6">
            {/* Desktop/tablet: single-row navbar (like screenshot) */}
            <div className="hidden h-12 min-w-0 items-center justify-between gap-3 sm:flex">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className="app-btn-ghost shrink-0 p-2 lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open menu"
                  aria-expanded={sidebarOpen}
                >
                  <Menu size={22} />
                </button>
                <div className="min-w-0">
                  <h1 className="truncate text-left text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
                    {pageTitle}
                  </h1>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t('appTitle')}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="app-btn-ghost shrink-0 p-2"
                  onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                  aria-label={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                >
                  {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <LanguageMenu value={lang} onChange={setLang} />

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCredOpen(true)}
                    className="flex items-center gap-2 rounded-xl px-1.5 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    aria-label={t('credTitle')}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      {(user?.login ?? 'A').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="hidden min-w-0 max-w-[180px] md:block">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{t('userLabel')}</p>
                      <p className="truncate text-xs text-slate-500">{user?.login}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="app-btn-ghost shrink-0 p-2"
                    title={t('logout')}
                    aria-label={t('logout')}
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile: bitta qator — til va tema o‘ngda (pastki qator olib tashlangan, burger bilan ustma-ust tushmasin) */}
            <div className="sm:hidden">
              <div className="flex min-h-11 min-w-0 items-center gap-2 py-0.5">
                <button
                  type="button"
                  className="app-btn-ghost order-1 shrink-0 p-2"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open menu"
                  aria-expanded={sidebarOpen}
                >
                  <Menu size={22} />
                </button>
                <div className="order-2 min-w-0 flex-1">
                  <h1 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{pageTitle}</h1>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{t('appTitle')}</p>
                </div>
                <div className="order-3 flex shrink-0 items-center gap-1.5 pl-1">
                  <button
                    type="button"
                    className="app-btn-ghost shrink-0 p-2"
                    onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                    aria-label={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                  >
                    {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                  <LanguageMenu value={lang} onChange={setLang} menuAlign="end" />
                  <button
                    type="button"
                    onClick={() => setCredOpen(true)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white"
                    aria-label={t('credTitle')}
                    title={t('credTitle')}
                  >
                    {(user?.login ?? 'A').slice(0, 1).toUpperCase()}
                  </button>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="app-btn-ghost shrink-0 p-2"
                    title={t('logout')}
                    aria-label={t('logout')}
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {credOpen && (
          <CredentialsModal
            initialLogin={initialLogin}
            onClose={() => setCredOpen(false)}
            onSaved={async () => {
              await refresh();
              setCredOpen(false);
            }}
          />
        )}

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#f4f6f9] pb-[env(safe-area-inset-bottom,0)] dark:bg-slate-950">
          <div className="w-full min-w-0 p-2 sm:p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function CredentialsModal({
  initialLogin,
  onClose,
  onSaved,
}: {
  initialLogin: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [login, setLogin] = useState(initialLogin);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLogin(initialLogin);
  }, [initialLogin]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (newPassword || newPassword2) {
      if (newPassword !== newPassword2) {
        setErr(t('passwordMismatch'));
        return;
      }
    }
    setLoading(true);
    try {
      await api('/auth/credentials', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword,
          login: login.trim(),
          newPassword: newPassword || undefined,
        }),
      });
      await onSaved();
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : t('genericError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label={t('cancel')}
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('credTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('credDesc')}</p>
          </div>
          <button type="button" className="app-btn-ghost p-2" onClick={onClose} aria-label={t('cancel')}>
            <X size={18} />
          </button>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('loginLabel')}</label>
            <input className="app-input" value={login} onChange={(e) => setLogin(e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('currentPassword')}</label>
            <input
              type="password"
              className="app-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('newPassword')}</label>
            <input
              type="password"
              className="app-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('newPasswordConfirm')}</label>
            <input
              type="password"
              className="app-input"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="mt-2 flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" className="app-btn-ghost px-4" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className="app-btn-primary px-5" disabled={loading}>
              {loading ? '…' : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
