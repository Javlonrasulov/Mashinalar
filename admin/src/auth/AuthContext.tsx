import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearToken, getToken, setToken } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import type { AdminPageKey } from '@/lib/adminPages';

export type AuthUser = {
  id: string;
  role: string;
  login: string;
  position?: string | null;
  allowedPages?: AdminPageKey[] | string[];
  driver: null | { id: string; fullName: string; phone: string; vehicleId: string | null };
};

type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

type Ctx = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

function isAdminPanelUser(role: string) {
  return role === 'ADMIN' || role === 'OPERATOR';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTok] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    const onAuth = () => {
      setTok(null);
      setUser(null);
    };
    window.addEventListener('mashinalar:auth', onAuth);
    return () => window.removeEventListener('mashinalar:auth', onAuth);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const t0 = getToken();
      if (!t0) {
        setTok(null);
        setUser(null);
        setLoading(false);
        return;
      }
      setTok(t0);
      try {
        const me = await api<AuthUser>('/auth/me');
        if (!isAdminPanelUser(me.role)) {
          clearToken();
          setTok(null);
          setUser(null);
        } else if (!cancelled) {
          setUser(me);
        }
      } catch {
        clearToken();
        setTok(null);
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const t0 = getToken();
    if (!t0) {
      setTok(null);
      setUser(null);
      return;
    }
    setTok(t0);
    const me = await api<AuthUser>('/auth/me');
    if (!isAdminPanelUser(me.role)) {
      clearToken();
      setTok(null);
      setUser(null);
      return;
    }
    setUser(me);
  }, []);

  const login = useCallback(async (loginStr: string, password: string) => {
    const res = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: loginStr, password }),
    });
    if (!isAdminPanelUser(res.user.role)) {
      throw new Error(t('adminOnly'));
    }
    setToken(res.accessToken);
    setTok(res.accessToken);
    setUser(res.user);
  }, [t]);

  const logout = useCallback(() => {
    clearToken();
    setTok(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      logout,
      refresh,
    }),
    [token, user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('AuthProvider required');
  return v;
}
