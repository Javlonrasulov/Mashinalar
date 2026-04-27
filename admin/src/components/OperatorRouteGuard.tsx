import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/auth/AuthContext';
import { firstAllowedHref, pathnameToAdminPageKey } from '@/lib/adminPages';

export function OperatorRouteGuard() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!user) return null;

  if (user.role === 'ADMIN') {
    return <Outlet />;
  }

  if (user.role === 'OPERATOR') {
    const key = pathnameToAdminPageKey(pathname);
    if (key == null) {
      return <Navigate to={firstAllowedHref(user.allowedPages)} replace />;
    }
    if (user.allowedPages?.includes(key)) {
      return <Outlet />;
    }
    return <Navigate to={firstAllowedHref(user.allowedPages)} replace />;
  }

  return <Navigate to="/" replace />;
}
