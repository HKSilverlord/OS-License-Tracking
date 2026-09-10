
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Auth } from './components/Auth';

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
import { Skeleton } from './components/ui/Skeleton';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { NewPeriodModal } from './components/modals/NewPeriodModal';
import { dbService } from './services/dbService';
import { exportYearToExcel } from './services/exportService';
import { LayoutDashboard, Table, Plus, LogOut, Download, Menu, X, Search, Languages, BarChart3, Calendar as CalendarIcon, TrendingUp, Wrench, ChevronLeft, ChevronRight, Monitor, Moon, Sun, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLanguage, SUPPORTED_LANGUAGES } from './contexts/LanguageContext';
import { useAuthSession } from './hooks/useAuthSession';
import { usePeriodCatalog } from './hooks/usePeriodCatalog';
import { useDarkMode } from './hooks/useDarkMode';
import { useUserRole } from './contexts/UserRoleContext';
import { useToast } from './contexts/ToastContext';
import { confirmNavigation } from './utils/navigationGuard';
import { createLogger } from './utils/logger';

const log = createLogger('App');

/** The only route that consumes the top-bar search query (U5). */
const SEARCHABLE_PATH = '/tracking';

function App() {
  const { t, language, setLanguage } = useLanguage();
  const { isAdmin } = useUserRole();
  const toast = useToast();

  const { session, userId, signOut } = useAuthSession();
  const {
    availablePeriods,
    availableYears,
    currentYear,
    setCurrentYear,
    refreshFor: refreshPeriodsFor,
  } = usePeriodCatalog(userId);
  const [darkMode, setDarkMode] = useDarkMode();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);

  // Data for Modals
  const [nextProjectCode, setNextProjectCode] = useState('');
  const [projectCreatedTrigger, setProjectCreatedTrigger] = useState(0);

  const handleSignOut = async () => {
    // Signing out unmounts every view; treat it as navigation so unsaved edits prompt (U3).
    if (!confirmNavigation()) return;
    await signOut();
  };

  const handleOpenProjectModal = async () => {
    // Default to the first period of the current year; getNextProjectCode needs a full period label.
    const targetPeriod = availablePeriods.find(p => p.startsWith(`${currentYear}-`)) || `${currentYear}-H1`;

    try {
      const nextCode = await dbService.getNextProjectCode(targetPeriod);
      setNextProjectCode(nextCode);
    } catch (error) {
      // A8: never swallow this — the modal still opens, but with an empty code the user can type.
      log.error('Failed to generate project code', error);
      setNextProjectCode('');
      toast.error(t('toast.codeFailed', 'Could not generate a project code'));
    } finally {
      setIsProjectModalOpen(true);
    }
  };

  const handleProjectSuccess = () => {
    setProjectCreatedTrigger(prev => prev + 1);
  };

  const handlePeriodSuccess = (newPeriodLabel: string) => refreshPeriodsFor(newPeriodLabel);

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    // A year's export is two DB round-trips plus a file write; without this guard a
    // double-click runs the whole thing twice and downloads two identical workbooks.
    if (isExporting) return;
    setIsExporting(true);
    try {
      await exportYearToExcel(currentYear);
      toast.success(t('toast.exportDone', 'Export complete'));
    } catch (e) {
      log.error('Export failed', e);
      toast.error(t('toast.exportFailed', 'Export failed'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextYear = parseInt(e.target.value, 10);
    if (isNaN(nextYear) || nextYear === currentYear) return;
    if (!confirmNavigation()) {
      // Controlled <select>: put the DOM back where it was, since state does not change.
      e.target.value = String(currentYear);
      return;
    }
    setCurrentYear(nextYear);
  };

  const clearSearch = useCallback(() => {
    setSearchQuery(prev => (prev === '' ? prev : ''));
  }, []);

  if (!session) return <Auth />;

  return (
    <Router>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
        {/* Sidebar Desktop */}
        <aside
          className={`hidden md:flex flex-col bg-slate-900 dark:bg-slate-900 border-r border-slate-800 dark:border-slate-800 text-white z-20 shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-64'
            }`}
        >
          <div className={`p-5 flex items-center border-b border-slate-800 dark:border-slate-800 min-h-[72px] ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-600 flex items-center justify-center shrink-0">
                  <LayoutDashboard className="w-4 h-4 text-white dark:text-white" />
                </div>
                <h1 className="text-lg font-bold tracking-tight text-white dark:text-white">{t('app.title')}</h1>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-400 hover:text-white dark:hover:text-white transition-colors"
            >
              {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3 space-y-6">
            <div>
              {!sidebarCollapsed && <p className="px-3 text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-2">Analytics</p>}
              <nav className="space-y-1">
                <NavLink to="/" icon={LayoutDashboard} label={t('nav.dashboard')} collapsed={sidebarCollapsed} />
                <NavLink to="/yearly-data" icon={Table} label={t('nav.yearlyData')} collapsed={sidebarCollapsed} />
                <NavLink to="/total" icon={BarChart3} label={t('nav.totalView')} collapsed={sidebarCollapsed} />
                <NavLink to="/monthly-plan-actual" icon={BarChart3} label={t('nav.monthlyPlanActual')} collapsed={sidebarCollapsed} />
              </nav>
            </div>

            <div>
              {!sidebarCollapsed && <p className="px-3 text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-2">Management</p>}
              <nav className="space-y-1">
                <NavLink to="/tracking" icon={Table} label={t('nav.tracking')} collapsed={sidebarCollapsed} />
                <NavLink to="/catia-license" icon={Monitor} label={t('nav.catiaLicense')} collapsed={sidebarCollapsed} />
                <NavLink to="/long-term-plan" icon={TrendingUp} label={t('nav.longTermPlan')} collapsed={sidebarCollapsed} />
                <NavLink to="/period-management" icon={CalendarIcon} label={t('nav.periodManagement')} collapsed={sidebarCollapsed} />
              </nav>
            </div>

            {/* The diagnostic page writes to period_projects and dumps table samples.
                RLS already rejects a non-admin's write, but the tool has no business
                being in a viewer's navigation at all. */}
            {isAdmin && (
              <div>
                {!sidebarCollapsed && <p className="px-3 text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-2">{t('nav.tools', 'Tools')}</p>}
                <nav className="space-y-1">
                  <NavLink to="/diagnostic" icon={Wrench} label={t('nav.diagnostic', 'Database Fix')} collapsed={sidebarCollapsed} />
                </nav>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-800 dark:border-slate-800 bg-slate-900/50 dark:bg-slate-900/50">
            {!sidebarCollapsed ? (
              <>
                <div className="flex items-center mb-4 px-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 dark:from-blue-600 dark:to-sky-400 flex items-center justify-center text-sm font-bold text-white dark:text-white shadow-sm shrink-0 border-2 border-slate-800 dark:border-slate-800">
                    {session.user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3 overflow-hidden">
                    <p className="text-sm font-medium text-white dark:text-white truncate">{session.user.email}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-400 truncate">
                      {isAdmin ? 'Administrator' : 'Viewer'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-slate-300 dark:text-slate-300 hover:text-white dark:hover:text-white hover:bg-slate-800 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700 dark:hover:border-slate-700"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t('nav.signOut')}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 dark:from-blue-600 dark:to-sky-400 flex items-center justify-center text-sm font-bold text-white dark:text-white shadow-sm border-2 border-slate-800 dark:border-slate-800 cursor-pointer" title={session.user.email}>
                  {session.user.email?.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center justify-center w-10 h-10 text-slate-400 dark:text-slate-400 hover:text-white dark:hover:text-white hover:bg-slate-800 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title={t('nav.signOut')}
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 flex items-center justify-between p-4 h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-600 flex items-center justify-center shrink-0">
              <LayoutDashboard className="w-4 h-4 text-white dark:text-white" />
            </div>
            <h1 className="font-bold text-slate-900 dark:text-white">{t('app.title')}</h1>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-600 dark:text-slate-300">
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-white dark:bg-slate-900 z-20 pt-16 flex flex-col md:hidden animate-fade-in">
            <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
              <MobileNavLink to="/" icon={LayoutDashboard} label={t('nav.dashboard')} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink to="/tracking" icon={Table} label={t('nav.tracking')} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink to="/catia-license" icon={Monitor} label={t('nav.catiaLicense')} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink to="/yearly-data" icon={Table} label={t('nav.yearlyData')} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink to="/total" icon={BarChart3} label={t('nav.totalView')} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink to="/long-term-plan" icon={TrendingUp} label={t('nav.longTermPlan')} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink to="/monthly-plan-actual" icon={BarChart3} label={t('nav.monthlyPlanActual')} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink to="/period-management" icon={CalendarIcon} label={t('nav.periodManagement')} onClick={() => setMobileMenuOpen(false)} />
              {isAdmin && (
                <>
                  <div className="my-4 border-t border-slate-200 dark:border-slate-800"></div>
                  <MobileNavLink to="/diagnostic" icon={Wrench} label={t('nav.diagnostic', 'Database Fix')} onClick={() => setMobileMenuOpen(false)} />
                </>
              )}
            </nav>
            <div className="p-6 border-t border-slate-200 dark:border-slate-800">
              <button onClick={handleSignOut} className="flex items-center justify-center w-full py-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl font-medium">
                <LogOut className="w-5 h-5 mr-2" />
                {t('nav.signOut')}
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        {/* Added min-w-0 to prevent flex children from forcing overflow */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative md:static mt-16 md:mt-0 bg-slate-50 dark:bg-slate-950 min-w-0 transition-colors duration-200">
          {/* Top Bar */}
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 w-full flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3 min-h-[72px] shrink-0 transition-colors duration-200 z-10">
            {/* U5: drops the query as soon as the route stops consuming it. */}
            <SearchRouteReset onLeaveSearchableRoute={clearSearch} />

            <div className="flex items-center gap-4 w-full md:w-auto">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 hidden lg:block tracking-wide uppercase">
                <RouteName />
              </h2>
              {/* Period Selector (Year Only) — the single year control of the app (U1) */}
              <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                <select
                  value={currentYear}
                  onChange={handleYearChange}
                  className="bg-transparent border-none text-slate-900 dark:text-white text-sm focus:ring-0 font-bold cursor-pointer"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end w-full md:w-auto">
              {/* Search - Mobile (only on routes that consume it) */}
              <TopBarSearch
                variant="mobile"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t('search.placeholder', 'Search projects…')}
              />

              {/* Theme Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Language selector (U4) — one click to any language, no cycling */}
              <div
                role="group"
                aria-label={t('language.select', 'Select language')}
                className="flex items-center gap-0.5 p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <Languages className="w-4 h-4 mx-1 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                {SUPPORTED_LANGUAGES.map(({ code, label, short }) => {
                  const isCurrent = language === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLanguage(code)}
                      title={label}
                      aria-pressed={isCurrent}
                      className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${isCurrent
                        ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                    >
                      {short}
                    </button>
                  );
                })}
              </div>

              {/* Search - Desktop (only on routes that consume it) */}
              <TopBarSearch
                variant="desktop"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t('search.placeholder', 'Search projects…')}
              />

              <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

              <button
                onClick={handleExport}
                disabled={isExporting}
                aria-busy={isExporting}
                className="flex items-center px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isExporting
                  ? <Loader2 className="w-4 h-4 md:mr-2 animate-spin" />
                  : <Download className="w-4 h-4 md:mr-2" />}
                <span className="hidden md:inline">{t('buttons.export')}</span>
              </button>

              {isAdmin && (
                <button
                  onClick={handleOpenProjectModal}
                  className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white dark:text-white text-sm font-medium rounded-lg transition-all shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">{t('buttons.project')}</span>
                </button>
              )}
            </div>
          </header>

          {/* Page Content Container - No Scroll here, children handle it */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <MainRoutes
              currentYear={currentYear}
              searchQuery={searchQuery}
              projectCreatedTrigger={projectCreatedTrigger}
            />
          </div>
        </main>
      </div>

      {/* Modals */}
      <NewProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSuccess={handleProjectSuccess}
        initialCode={nextProjectCode}
        currentPeriod={availablePeriods.find(p => p.startsWith(`${currentYear}-`)) || `${currentYear}-H1`}
      />

      <NewPeriodModal
        isOpen={isPeriodModalOpen}
        onClose={() => setIsPeriodModalOpen(false)}
        onSuccess={handlePeriodSuccess}
        availablePeriods={availablePeriods}
        currentPeriod={availablePeriods.find(p => p.startsWith(`${currentYear}-`)) || `${currentYear}-H1`}
      />
    </Router>
  );
}

/**
 * U5 — the top-bar search only exists on routes that actually consume it.
 * `useLocation` only works below <Router>, so the check lives in this child.
 */
interface TopBarSearchProps {
  variant: 'mobile' | 'desktop';
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

const TopBarSearch: React.FC<TopBarSearchProps> = ({ variant, value, onChange, placeholder }) => {
  const location = useLocation();
  if (location.pathname !== SEARCHABLE_PATH) return null;

  if (variant === 'mobile') {
    return (
      <div className="w-full md:hidden mb-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            aria-label={placeholder}
            placeholder={placeholder}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="hidden md:flex relative group">
      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors" />
      <input
        type="text"
        aria-label={placeholder}
        placeholder={placeholder}
        className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 w-48 xl:w-64 transition-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

/** Renders nothing; clears the search query whenever the route stops consuming it (U5). */
const SearchRouteReset: React.FC<{ onLeaveSearchableRoute: () => void }> = ({ onLeaveSearchableRoute }) => {
  const location = useLocation();
  const isSearchable = location.pathname === SEARCHABLE_PATH;

  useEffect(() => {
    if (!isSearchable) onLeaveSearchableRoute();
  }, [isSearchable, onLeaveSearchableRoute]);

  return null;
};

// Helper to get route name
const RouteName = () => {
  const location = useLocation();
  const { t } = useLanguage();

  const map: Record<string, string> = {
    '/': t('nav.dashboard'),
    '/tracking': t('nav.tracking'),
    '/catia-license': t('nav.catiaLicense'),
    '/yearly-data': t('nav.yearlyData'),
    '/total': t('nav.totalView'),
    '/long-term-plan': t('nav.longTermPlan'),
    '/monthly-plan-actual': t('nav.monthlyPlanActual'),
    '/period-management': t('nav.periodManagement'),
    '/diagnostic': t('nav.diagnostic', 'Database Fix'),
  };

  return <>{map[location.pathname] || ''}</>;
};

// Page transition variants (module scope: a stable identity keeps PageWrapper from remounting pages)
const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 10,
    scale: 0.99
  },
  enter: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 1, 0.5, 1]
    }
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.99,
    transition: {
      duration: 0.3,
      ease: [0.25, 1, 0.5, 1]
    }
  }
};

/** Placeholder shown while a route chunk is still downloading. */
const RouteFallback = () => (
  <div className="flex-1 p-6 space-y-4">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
    <Skeleton className="h-64 w-full" />
  </div>
);

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial="initial"
    animate="enter"
    exit="exit"
    variants={pageVariants}
    className="flex-1 flex flex-col h-full w-full absolute inset-0"
  >
    {/* Inside the animated wrapper, so a chunk still loading does not stall the
        page transition and leave the previous route frozen on screen. */}
    <Suspense fallback={<RouteFallback />}>{children}</Suspense>
  </motion.div>
);

// Main Routes with Page Transitions
const MainRoutes = ({ currentYear, searchQuery, projectCreatedTrigger }: { currentYear: number, searchQuery: string, projectCreatedTrigger: number }) => {
  const location = useLocation();
  const { isAdmin } = useUserRole();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><Dashboard currentYear={currentYear} /></PageWrapper>} />
        <Route path="/tracking" element={<PageWrapper><TrackingView currentYear={currentYear} searchQuery={searchQuery} refreshTrigger={projectCreatedTrigger} /></PageWrapper>} />
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
      </Routes>
    </AnimatePresence>
  );
};

// Nav Link Component
interface NavLinkProps {
  to: string;
  icon: LucideIcon;
  label: string;
  collapsed?: boolean;
}

const NavLink: React.FC<NavLinkProps> = ({ to, icon: Icon, label, collapsed }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  // U3: never leave a view with unsaved changes without asking.
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!confirmNavigation()) {
      e.preventDefault();
    }
  };

  return (
    <Link
      to={to}
      onClick={handleClick}
      className={`flex items-center ${collapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative group ${isActive
        ? 'bg-blue-600/10 dark:bg-blue-600/10 text-blue-400 dark:text-blue-400'
        : 'text-slate-400 dark:text-slate-400 hover:bg-slate-800/60 dark:hover:bg-slate-800/60 hover:text-white dark:hover:text-white'
        }`}
      title={collapsed ? label : ''}
    >
      <Icon className={`w-5 h-5 shrink-0 ${collapsed ? '' : 'mr-3'} ${isActive ? 'text-blue-500 dark:text-blue-500' : 'text-slate-500 dark:text-slate-500 group-hover:text-slate-300 dark:group-hover:text-slate-300'}`} />
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && (
        <div className="absolute left-14 bg-slate-800 dark:bg-slate-800 text-white dark:text-white text-xs px-2 py-1 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
          {label}
        </div>
      )}
      {isActive && !collapsed && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 dark:bg-blue-500 rounded-r-full" />
      )}
    </Link>
  );
};

interface MobileNavLinkProps {
  to: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

const MobileNavLink: React.FC<MobileNavLinkProps> = ({ to, icon: Icon, label, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  // U3: guard first, and only close the mobile menu when the navigation actually happens.
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!confirmNavigation()) {
      e.preventDefault();
      return;
    }
    onClick();
  };

  return (
    <Link
      to={to}
      onClick={handleClick}
      className={`flex items-center px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${isActive
        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
    >
      <Icon className={`w-6 h-6 mr-4 ${isActive ? 'text-blue-600 dark:text-blue-500' : 'text-slate-400 dark:text-slate-500'}`} />
      {label}
    </Link>
  );
};

export default App;
