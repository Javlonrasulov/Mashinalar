import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n/I18nContext';

export function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const [loginStr, setLoginStr] = useState('admin');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(loginStr, password);
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : '';
      if (raw.includes('operator_no_pages')) setErr(t('operatorNoPages'));
      else setErr(raw || t('genericError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] min-h-screen items-center justify-center overflow-x-hidden overflow-y-auto bg-[#eef2f7] p-2 py-8 sm:p-4 dark:bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
        style={{
          background:
            'radial-gradient(900px 400px at 10% 0%, rgba(37,99,235,0.18), transparent 60%), radial-gradient(700px 360px at 90% 20%, rgba(245,158,11,0.15), transparent 55%)',
        }}
      />
      <form
        onSubmit={onSubmit}
        className="relative w-full min-w-0 max-w-md rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white shadow-md">
            M
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('appTitle')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('loginPortalSubtitle')}</p>
          </div>
        </div>
        {err && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {err}
          </div>
        )}
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('loginLabel')}</label>
        <input
          className="app-input mb-4"
          value={loginStr}
          onChange={(e) => setLoginStr(e.target.value)}
          autoComplete="username"
        />
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('password')}</label>
        <div className="relative mb-6">
          <input
            type={showPassword ? 'text' : 'password'}
            className="app-input pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('passwordHide') : t('passwordShow')}
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        <button type="submit" disabled={loading} className="app-btn-primary w-full py-2.5">
          {loading ? '…' : t('login')}
        </button>
      </form>
    </div>
  );
}
