import React, { lazy, Suspense, useCallback, useMemo } from 'react';
import { HashRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
  BarChart3,
  CalendarRange,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  Monitor,
  Table,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { Auth } from './components/Auth';
import { AppShell } from './components/shell/AppShell';
import type { NavGroupDef } from './components/shell/Sidebar';
import { AppIcon } from './components/ui/AppIcon';
import { Skeleton } from './components/ui/Skeleton';
import { useLanguage } from './contexts/LanguageContext';
import { useUserRole } from './contexts/UserRoleContext';
import { YearProvider } from './contexts/YearContext';
import { useAuthSession } from './hooks/useAuthSession';
import { usePeriodCatalog } from './hooks/usePeriodCatalog';
import { confirmNavigation } from './utils/navigationGuard';

// Route views are code-split: each one is a separate chunk fetched when the user
// first navigates to it. Recharts alone is ~7 MB installed and only four views
// use it, so shipping every view in the initial bundle made the first paint pay
// for pages most sessions never open.
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const TrackingView = lazy(() => import('./components/TrackingView').then(m => ({ default: m.TrackingView })));
const TotalView = lazy(() => import('./components/TotalView').then(m => ({ default: m.TotalView })));
const YearlyDataView = lazy(() => import('./components/YearlyDataView').then(m => ({ default: m.YearlyDataView })));
const PeriodManagement = lazy(() => import('./components/PeriodManagement').then(m => ({ default: m.PeriodManagement })));
const LongTermPlanView = lazy(() => import('./components/LongTermPlanView').then(m => ({ default: m.LongTermPlanView })));
const MonthlyPlanActualView = lazy(() => import('./components/MonthlyPlanActualView').then(m => ({ default: m.MonthlyPlanActualView })));
const CatiaLicenseView = lazy(() => import('./components/CatiaLicenseView').then(m => ({ default: m.CatiaLicenseView })));
const DatabaseDiagnostic = lazy(() => import('./components/DatabaseDiagnostic').then(m => ({ default: m.DatabaseDiagnostic })));

/** Shown while the saved session is read back, so a signed-in user never sees the sign-in form flash. */
const Splash: React.FC = () => (
  <div className="grid h-dvh place-items-center bg-slate-50 dark:bg-slate-950" role="status" aria-busy="true">
    <AppIcon size={52} className="animate-fade-in [animation-delay:200ms]" />
  </div>
);

function App() {
  const { t } = useLanguage();
  const { isAdmin } = useUserRole();
  const { ready, session, userId, signOut } = useAuthSession();
  const { availablePeriods, availableYears, currentYear, setCurrentYear } = usePeriodCatalog(userId);

  /** Every year change goes through the unsaved-changes guard. */
  const requestYear = useCallback((next: number): boolean => {
    if (next === currentYear) return true;
    if (!confirmNavigation()) return false;
    setCurrentYear(next);
    return true;
  }, [currentYear, setCurrentYear]);

  const handleSignOut = useCallback(async () => {
    // Signing out unmounts every view; treat it as navigation so unsaved edits prompt.
    if (!confirmNavigation()) return;
    await signOut();
  }, [signOut]);

  const groups = useMemo<NavGroupDef[]>(() => {
    const result: NavGroupDef[] = [
      {
        id: 'analytics',
        label: t('nav.analytics', 'Analytics'),
        items: [
          { to: '/', icon: LayoutDashboard, label: t('nav.dashboard', 'Dashboard') },
          { to: '/total', icon: BarChart3, label: t('nav.totalView', 'Cumulative hours') },
          { to: '/monthly-plan-actual', icon: LineChart, label: t('nav.monthlyPlanActual', 'Monthly plan vs actual') },
          { to: '/yearly-data', icon: Table, label: t('nav.yearlyData', 'Annual data') },
          { to: '/long-term-plan', icon: TrendingUp, label: t('nav.longTermPlan', 'Long-term plan') },
        ],
      },
      {
        id: 'management',
        label: t('nav.management', 'Management'),
        items: [
          { to: '/tracking', icon: ClipboardList, label: t('nav.tracking', 'Project tracking') },
          { to: '/catia-license', icon: Monitor, label: t('nav.catiaLicense', 'CATIA licenses') },
          { to: '/period-management', icon: CalendarRange, label: t('nav.periodManagement', 'Periods') },
        ],
      },
    ];
    // The diagnostic page writes to period_projects and dumps table samples.
    // RLS already rejects a non-admin's write, but the tool has no business
    // being in a viewer's navigation at all.
    if (isAdmin) {
      result.push({
        id: 'tools',
        label: t('nav.tools', 'Tools'),
        items: [{ to: '/diagnostic', icon: Wrench, label: t('nav.diagnostic', 'Database repair') }],
      });
    }
    return result;
  }, [t, isAdmin]);

  if (!ready) return <Splash />;
  if (!session) return <Auth />;

  return (
    <Router>
      <YearProvider
        year={currentYear}
        years={availableYears}
        periods={availablePeriods}
        requestYear={requestYear}
      >
        <AppShell
          groups={groups}
          account={{ email: session.user.email ?? '', isAdmin, onSignOut: () => { void handleSignOut(); } }}
        >
          <MainRoutes currentYear={currentYear} />
        </AppShell>
      </YearProvider>
    </Router>
  );
}

// Module scope: a stable identity keeps PageWrapper from remounting pages.
const pageVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeOut' } },
};

/** Shown while a route's code is still downloading: the shape of a page. */
const RouteFallback: React.FC = () => (
  <div className="h-full px-4 pt-6 sm:px-6 lg:px-8" aria-busy="true">
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  </div>
);

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial="initial"
    animate="enter"
    exit="exit"
    variants={pageVariants}
    className="absolute inset-0 flex flex-col"
  >
    {/* Inside the animated wrapper, so a chunk still loading does not stall the
        page transition and leave the previous route frozen on screen. */}
    <Suspense fallback={<RouteFallback />}>{children}</Suspense>
  </motion.div>
);

const MainRoutes: React.FC<{ currentYear: number }> = ({ currentYear }) => {
  const location = useLocation();
  const { isAdmin } = useUserRole();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><Dashboard currentYear={currentYear} /></PageWrapper>} />
        <Route path="/tracking" element={<PageWrapper><TrackingView currentYear={currentYear} /></PageWrapper>} />
        <Route path="/catia-license" element={<PageWrapper><CatiaLicenseView currentYear={currentYear} /></PageWrapper>} />
        <Route path="/total" element={<PageWrapper><TotalView currentYear={currentYear} /></PageWrapper>} />
        <Route path="/yearly-data" element={<PageWrapper><YearlyDataView currentYear={currentYear} /></PageWrapper>} />
        <Route path="/long-term-plan" element={<PageWrapper><LongTermPlanView /></PageWrapper>} />
        <Route path="/monthly-plan-actual" element={<PageWrapper><MonthlyPlanActualView currentYear={currentYear} /></PageWrapper>} />
        <Route path="/period-management" element={<PageWrapper><PeriodManagement /></PageWrapper>} />
        {/* Kept as a route so a bookmarked URL redirects instead of dead-ending. */}
        <Route
          path="/diagnostic"
          element={isAdmin ? <PageWrapper><DatabaseDiagnostic /></PageWrapper> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

export default App;
