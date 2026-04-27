import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ThemeProvider } from 'next-themes';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { I18nProvider } from '@/i18n/I18nContext';
import { OperatorRouteGuard } from '@/components/OperatorRouteGuard';
import { ShellLayout } from '@/components/ShellLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MapPage } from '@/pages/MapPage';
import { VehiclesPage } from '@/pages/VehiclesPage';
import { VehiclesLayout } from '@/pages/VehiclesLayout';
import { VehicleCategoriesPage } from '@/pages/VehicleCategoriesPage';
import { VehicleDriverHistoryPage } from '@/pages/VehicleDriverHistoryPage';
import { VehicleDeadlinesPage } from '@/pages/VehicleDeadlinesPage';
import { VehiclesAllDriverHistoryPage } from '@/pages/VehiclesAllDriverHistoryPage';
import { DriversPage } from '@/pages/DriversPage';
import { TasksPage } from '@/pages/TasksPage';
import { FuelPage } from '@/pages/FuelPage';
import { DailyKmPage } from '@/pages/DailyKmPage';
import { DailyKmGapsPage } from '@/pages/DailyKmGapsPage';
import { OilPage } from '@/pages/OilPage';
import { ExpensesPage } from '@/pages/ExpensesPage';
import { ExpensesStatsPage } from '@/pages/ExpensesStatsPage';
import { SystemUsersPage } from '@/pages/SystemUsersPage';

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

function Shell() {
  const { token, loading, user } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[100dvh] min-h-screen items-center justify-center overflow-x-hidden bg-[#f4f6f9] px-3 text-slate-500 dark:bg-slate-950">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          …
        </span>
      </div>
    );
  }
  if (!token || !user) {
    return <LoginPage />;
  }
  return (
    <Routes>
      <Route element={<ShellLayout />}>
        <Route
          path="system-users"
          element={
            <RequireAdmin>
              <SystemUsersPage />
            </RequireAdmin>
          }
        />
        <Route element={<OperatorRouteGuard />}>
          <Route index element={<DashboardPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="vehicle-categories" element={<Navigate to="/vehicles/categories" replace />} />
          <Route path="vehicles" element={<VehiclesLayout />}>
            <Route index element={<VehiclesPage />} />
            <Route path="categories" element={<VehicleCategoriesPage />} />
            <Route path="inspection" element={<VehicleDeadlinesPage kind="inspection" />} />
            <Route path="insurance" element={<VehicleDeadlinesPage kind="insurance" />} />
            <Route path="gas-balloon" element={<VehicleDeadlinesPage kind="gasBalloon" />} />
            <Route path="history" element={<VehiclesAllDriverHistoryPage />} />
            <Route path=":vehicleId/history" element={<VehicleDriverHistoryPage />} />
          </Route>
          <Route path="drivers" element={<DriversPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="fuel" element={<FuelPage />} />
          <Route path="daily-km" element={<DailyKmPage />} />
          <Route path="daily-km/gaps" element={<DailyKmGapsPage />} />
          <Route path="oil" element={<OilPage />} />
          <Route path="expenses/stats" element={<ExpensesStatsPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
