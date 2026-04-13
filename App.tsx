
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { TrackingView } from './components/TrackingView';
import { TotalView } from './components/TotalView';
import { YearlyDataView } from './components/YearlyDataView';
import { PeriodManagement } from './components/PeriodManagement';
import { LongTermPlanView } from './components/LongTermPlanView';
import { MonthlyPlanActualView } from './components/MonthlyPlanActualView';
import { CatiaLicenseView } from './components/CatiaLicenseView';
import { DatabaseDiagnostic } from './components/DatabaseDiagnostic';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { NewPeriodModal } from './components/modals/NewPeriodModal';
import { dbService } from './services/dbService';
import { exportToExcel } from './services/exportService';
import { LayoutDashboard, Table, Plus, LogOut, Download, Menu, X, Search, Languages, BarChart3, Calendar as CalendarIcon, TrendingUp, Wrench, ChevronLeft, ChevronRight, Monitor, Moon, Sun } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';

function App() {
  const { t, language, toggleLanguage } = useLanguage();
  const languageLabels = {
    ja: t('buttons.language.jp'),
    en: t('buttons.language.en'),
    vn: t('buttons.language.vn'),
  };
  const languageShortMap = { ja: 'JP', en: 'EN', vn: 'VI' };
  const nextLanguage: keyof typeof languageLabels = language === 'ja' ? 'en' : language === 'en' ? 'vn' : 'ja';
  const languageLabel = languageLabels[language as keyof typeof languageLabels];
  const languageShort = languageShortMap[language as keyof typeof languageShortMap];

  const [session, setSession] = useState<Session | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Period State - Now Year based
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]); // Keep full list for modals/logic
  const [searchQuery, setSearchQuery] = useState('');

  // Theme State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);

  // Data for Modals
  const [nextProjectCode, setNextProjectCode] = useState('');
  const [projectCreatedTrigger, setProjectCreatedTrigger] = useState(0);

  // Auth & Init Data
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const init = async () => {
      const periods = await dbService.getPeriods();
      setAvailablePeriods(periods);

      // Extract unique years
      const years = Array.from(new Set(periods.map(p => parseInt(p.split('-')[0])))).sort((a, b) => b - a);
      setAvailableYears(years);

      if (years.length > 0) {
        const realYear = new Date().getFullYear();
        // Default to current real-time year if available, otherwise latest DB year
        setCurrentYear(years.includes(realYear) ? realYear : years[0]);
      }
    };
    if (session) {
      init();
    }
  }, [session]);

  // Listen for period created events to refresh the period list
  // Listen for period created events to refresh the period list
  useEffect(() => {
    const handlePeriodCreated = async (event: any) => {
      const periods = await dbService.getPeriods();
      setAvailablePeriods(periods);

      const years = Array.from(new Set(periods.map(p => parseInt(p.split('-')[0])))).sort((a, b) => b - a);
      setAvailableYears(years);

      // Set current period to the newly created one's year
      if (event.detail?.periodLabel) {
        const year = parseInt(event.detail.periodLabel.split('-')[0]);
        if (!isNaN(year)) setCurrentYear(year);
      }
    };

    window.addEventListener('periodCreated', handlePeriodCreated);
    return () => window.removeEventListener('periodCreated', handlePeriodCreated);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleOpenProjectModal = async () => {
    try {
      // Default to H1 of current year for new projects if possible, or just pass currentYear and let modal handle
      // But getNextProjectCode requires a full period label.
      // Let's assume H1 for now or find the latest period in the current year.
      const targetPeriod = availablePeriods.find(p => p.startsWith(`${currentYear}-`)) || `${currentYear}-H1`;

      const nextCode = await dbService.getNextProjectCode(targetPeriod);
      setNextProjectCode(nextCode);
      setIsProjectModalOpen(true);
    } catch (error) {
      console.error("Failed to generate project code", error);
      // Fallback: open modal anyway, code will be auto-generated on submit
      setIsProjectModalOpen(true);
    }
  };

  const handleProjectSuccess = () => {
    setProjectCreatedTrigger(prev => prev + 1);
  };

  const handlePeriodSuccess = async (newPeriodLabel: string) => {
    const periods = await dbService.getPeriods();
    setAvailablePeriods(periods);

    const years = Array.from(new Set(periods.map(p => parseInt(p.split('-')[0])))).sort((a, b) => b - a);
    setAvailableYears(years);

    const year = parseInt(newPeriodLabel.split('-')[0]);
    if (!isNaN(year)) setCurrentYear(year);
  };

  const handleExport = async () => {
    try {
      const projects = await dbService.getProjects();
      const records = await dbService.getRecords(currentPeriod);
      const exportData = projects.map(p => {
        const pRecords: any = {};
        records.filter(r => r.project_id === p.id).forEach(r => {
          pRecords[`${r.year}-${r.month}`] = r;
        });
        return { ...p, records: pRecords };
      });
      // Export for the whole year? or just active view? 
      // Original was currentPeriod. Let's use currentYear for now as filename suffix
      exportToExcel(exportData, currentYear.toString());
    } catch (e) {
      console.error(e);
      alert(t('alerts.exportFailed'));
    }
  };

  if (!session) return <Auth />;

  // Computed prop for modals/views that might still need a specific period string fallback
  // For TrackingView, we will update it to accept year and handle H1/H2 internally.


  return (
    <Router>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Sidebar Desktop */}
        <aside
          className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-800 text-white z-20 shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-64'
            }`}
        >
          <div className={`p-5 flex items-center border-b border-slate-800 min-h-[72px] ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                  <LayoutDashboard className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-bold tracking-tight text-white">{t('app.title')}</h1>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3 space-y-6">
            <div>
              {!sidebarCollapsed && <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Analytics</p>}
              <nav className="space-y-1">
                <NavLink to="/" icon={LayoutDashboard} label={t('nav.dashboard')} collapsed={sidebarCollapsed} />
                <NavLink to="/yearly-data" icon={Table} label={t('nav.yearlyData')} collapsed={sidebarCollapsed} />
                <NavLink to="/total" icon={BarChart3} label={t('nav.totalView')} collapsed={sidebarCollapsed} />
                <NavLink to="/monthly-plan-actual" icon={BarChart3} label={t('nav.monthlyPlanActual')} collapsed={sidebarCollapsed} />
              </nav>
            </div>

            <div>
              {!sidebarCollapsed && <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Management</p>}
              <nav className="space-y-1">
                <NavLink to="/tracking" icon={Table} label={t('nav.tracking')} collapsed={sidebarCollapsed} />
                <NavLink to="/catia-license" icon={Monitor} label={t('nav.catiaLicense')} collapsed={sidebarCollapsed} />
                <NavLink to="/long-term-plan" icon={TrendingUp} label={t('nav.longTermPlan')} collapsed={sidebarCollapsed} />
                <NavLink to="/period-management" icon={CalendarIcon} label={t('nav.periodManagement')} collapsed={sidebarCollapsed} />
              </nav>
            </div>

            <div>
              {!sidebarCollapsed && <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tools</p>}
              <nav className="space-y-1">
                <NavLink to="/diagnostic" icon={Wrench} label="Database Fix" collapsed={sidebarCollapsed} />
              </nav>
            </div>
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-900/50">
            {!sidebarCollapsed ? (
              <>
                <div className="flex items-center mb-4 px-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-sm font-bold text-white shadow-sm shrink-0 border-2 border-slate-800">
                    {session.user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3 overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">{session.user.email}</p>
                    <p className="text-xs text-slate-400 truncate">Administrator</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t('nav.signOut')}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-sm font-bold text-white shadow-sm border-2 border-slate-800 cursor-pointer" title={session.user.email}>
                  {session.user.email?.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center justify-center w-10 h-10 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
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
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
               <LayoutDashboard className="w-4 h-4 text-white" />
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
              <div className="my-4 border-t border-slate-200 dark:border-slate-800"></div>
              <MobileNavLink to="/diagnostic" icon={Wrench} label="Database Fix" onClick={() => setMobileMenuOpen(false)} />
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
            <div className="flex items-center gap-4 w-full md:w-auto">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 hidden lg:block tracking-wide uppercase">
                <RouteName />
              </h2>
              {/* Period Selector (Year Only) */}
              <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                  className="bg-transparent border-none text-slate-900 dark:text-white text-sm focus:ring-0 font-bold cursor-pointer"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end w-full md:w-auto">
              {/* Search - Mobile */}
              <div className="w-full md:hidden mb-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t('search.placeholder')}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <button
                onClick={toggleLanguage}
                type="button"
                className="flex items-center px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                title={languageLabels[nextLanguage]}
              >
                <Languages className="w-4 h-4 md:mr-2 text-slate-500" />
                <span className="hidden md:inline">{languageLabel}</span>
              </button>

              {/* Search - Desktop */}
              <div className="hidden md:flex relative group">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder={t('search.placeholder')}
                  className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 w-48 xl:w-64 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

              <button
                onClick={handleExport}
                className="flex items-center px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">{t('buttons.export')}</span>
              </button>
              
              <button
                onClick={handleOpenProjectModal}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">{t('buttons.project')}</span>
              </button>
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
    '/diagnostic': 'Database Diagnostic'
  };
  
  return <>{map[location.pathname] || ''}</>;
};

// Main Routes with Page Transitions
const MainRoutes = ({ currentYear, searchQuery, projectCreatedTrigger }: { currentYear: number, searchQuery: string, projectCreatedTrigger: number }) => {
  const location = useLocation();

  const pageVariants = {
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

  const PageWrapper = ({ children }: { children: React.ReactNode }) => (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={pageVariants}
      className="flex-1 flex flex-col h-full w-full absolute inset-0"
    >
      {children}
    </motion.div>
  );

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
        <Route path="/tracking" element={<PageWrapper><TrackingView currentYear={currentYear} searchQuery={searchQuery} refreshTrigger={projectCreatedTrigger} /></PageWrapper>} />
        <Route path="/catia-license" element={<PageWrapper><CatiaLicenseView currentYear={currentYear} /></PageWrapper>} />
        <Route path="/total" element={<PageWrapper><TotalView currentYear={currentYear} /></PageWrapper>} />
        <Route path="/yearly-data" element={<PageWrapper><YearlyDataView currentYear={currentYear} /></PageWrapper>} />
        <Route path="/long-term-plan" element={<PageWrapper><LongTermPlanView /></PageWrapper>} />
        <Route path="/monthly-plan-actual" element={<PageWrapper><MonthlyPlanActualView currentYear={currentYear} /></PageWrapper>} />
        <Route path="/period-management" element={<PageWrapper><PeriodManagement /></PageWrapper>} />
        <Route path="/diagnostic" element={<PageWrapper><DatabaseDiagnostic /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
};

// Nav Link Component
const NavLink = ({ to, icon: Icon, label, collapsed }: any) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center ${collapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative group ${isActive
        ? 'bg-blue-600/10 text-blue-400'
        : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
        }`}
      title={collapsed ? label : ''}
    >
      <Icon className={`w-5 h-5 shrink-0 ${collapsed ? '' : 'mr-3'} ${isActive ? 'text-blue-500' : 'text-slate-500 group-hover:text-slate-300'}`} />
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && (
        <div className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
          {label}
        </div>
      )}
      {isActive && !collapsed && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />
      )}
    </Link>
  );
};

const MobileNavLink = ({ to, icon: Icon, label, onClick }: any) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      onClick={onClick}
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
