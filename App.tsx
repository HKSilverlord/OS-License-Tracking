
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { TrackingView } from './components/TrackingView';
import { TotalView } from './components/TotalView';
import { YearlyDataView } from './components/YearlyDataView';
import { PeriodManagement } from './components/PeriodManagement';
import { LongTermPlanView } from './components/LongTermPlanView';
import { MonthlyPlanActualView } from './components/MonthlyPlanActualView';
import { DatabaseDiagnostic } from './components/DatabaseDiagnostic';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { NewPeriodModal } from './components/modals/NewPeriodModal';
import { dbService } from './services/dbService';
import { exportToExcel } from './services/exportService';
import { LayoutDashboard, Table, Plus, LogOut, Download, Menu, X, Search, Languages, BarChart3, Calendar as CalendarIcon, TrendingUp, Wrench, ChevronLeft, ChevronRight } from 'lucide-react';
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
        setCurrentYear(years[0]);
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

  if (!session) return <Auth />;

  // Computed prop for modals/views that might still need a specific period string fallback
  // For TrackingView, we will update it to accept year and handle H1/H2 internally.


  return (
    <Router>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Sidebar Desktop */}
        <aside
          className={`hidden md:flex flex-col bg-slate-900 text-white shadow-xl z-20 shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'
            }`}
        >
          <div className={`p-4 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-xl font-bold tracking-tight text-blue-400">{t('app.title')}</h1>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>

          <nav className="flex-1 px-2 space-y-2 mt-2">
            <NavLink to="/" icon={LayoutDashboard} label={t('nav.dashboard')} collapsed={sidebarCollapsed} />
            <NavLink to="/tracking" icon={Table} label={t('nav.tracking')} collapsed={sidebarCollapsed} />
            <NavLink to="/yearly-data" icon={Table} label={t('nav.yearlyData')} collapsed={sidebarCollapsed} />
            <NavLink to="/total" icon={BarChart3} label={t('nav.totalView')} collapsed={sidebarCollapsed} />
            <NavLink to="/long-term-plan" icon={TrendingUp} label={t('nav.longTermPlan')} collapsed={sidebarCollapsed} />
            <NavLink to="/monthly-plan-actual" icon={BarChart3} label={t('nav.monthlyPlanActual')} collapsed={sidebarCollapsed} />
            <NavLink to="/period-management" icon={CalendarIcon} label={t('nav.periodManagement')} collapsed={sidebarCollapsed} />
            <div className="pt-2 border-t border-slate-700 mx-2"></div>
            <NavLink to="/diagnostic" icon={Wrench} label="Database Fix" collapsed={sidebarCollapsed} />
          </nav>
          <div className="p-4 border-t border-slate-700">
            {!sidebarCollapsed ? (
              <>
                <div className="flex items-center mb-4 px-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold shrink-0">
                    {session.user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3 overflow-hidden">
                    <p className="text-sm font-medium truncate">{session.user.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full px-2 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  {t('nav.signOut')}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold" title={session.user.email}>
                  {session.user.email?.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center justify-center w-full py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                  title={t('nav.signOut')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 w-full bg-slate-900 text-white z-30 flex items-center justify-between p-4 shadow-md h-14">
          <h1 className="font-bold">{t('app.title')}</h1>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-800 bg-opacity-95 z-20 pt-20 px-6 md:hidden">
            <nav className="space-y-4">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-white border-b border-slate-700">{t('nav.dashboard')}</Link>
              <Link to="/tracking" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-white border-b border-slate-700">{t('nav.tracking')}</Link>
              <Link to="/yearly-data" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-white border-b border-slate-700">{t('nav.yearlyData')}</Link>
              <Link to="/total" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-white border-b border-slate-700">{t('nav.totalView')}</Link>
              <Link to="/long-term-plan" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-white border-b border-slate-700">{t('nav.longTermPlan')}</Link>
              <Link to="/monthly-plan-actual" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-white border-b border-slate-700">{t('nav.monthlyPlanActual')}</Link>
              <Link to="/period-management" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-white border-b border-slate-700">{t('nav.periodManagement')}</Link>
              <Link to="/diagnostic" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-white border-b border-slate-700">Database Fix</Link>
              <button onClick={handleSignOut} className="block w-full text-left py-3 text-red-400">{t('nav.signOut')}</button>
            </nav>
          </div>
        )}

        {/* Main Content */}
        {/* Added min-w-0 to prevent flex children from forcing overflow */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative md:static mt-14 md:mt-0 bg-slate-50 min-w-0">
          {/* Top Bar */}
          <header className="bg-white border-b border-slate-200 w-full flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3 shadow-sm z-10 shrink-0">
            <div className="flex items-center gap-2 w-full md:w-auto">
              {/* Period Selector (Year Only) */}
              <div className="flex items-center space-x-2 bg-slate-100 rounded-lg p-1">
                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                  className="bg-transparent border-none text-slate-900 text-sm focus:ring-0 font-medium cursor-pointer"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end w-full md:w-auto">
              <div className="w-full md:hidden">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('search.placeholder')}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={toggleLanguage}
                type="button"
                className="flex items-center px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-100 transition-colors shadow-sm"
                title={languageLabels[nextLanguage]}
              >
                <Languages className="w-4 h-4 mr-2 text-slate-500" />
                <span className="hidden sm:inline">{languageLabel}</span>
                <span className="sm:hidden font-semibold">{languageShort}</span>
              </button>
              <div className="hidden md:flex relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('search.placeholder')}
                  className="pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 lg:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                onClick={handleExport}
                className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                {t('buttons.export')}
              </button>
              <button
                onClick={handleOpenProjectModal}
                className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('buttons.project')}
              </button>
            </div>
          </header>

          {/* Page Content Container - No Scroll here, children handle it */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tracking" element={<TrackingView currentYear={currentYear} searchQuery={searchQuery} refreshTrigger={projectCreatedTrigger} />} />
              <Route path="/total" element={<TotalView currentYear={currentYear} />} />
              <Route path="/yearly-data" element={<YearlyDataView currentYear={currentYear} />} />
              <Route path="/long-term-plan" element={<LongTermPlanView />} />
              <Route path="/monthly-plan-actual" element={<MonthlyPlanActualView currentYear={currentYear} />} />
              <Route path="/period-management" element={<PeriodManagement />} />
              <Route path="/diagnostic" element={<DatabaseDiagnostic />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Modals */}
      <NewProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSuccess={handleProjectSuccess}
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

// Nav Link Component
const NavLink = ({ to, icon: Icon, label, collapsed }: any) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
        ? 'bg-blue-600 text-white shadow-md'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      title={collapsed ? label : ''}
    >
      <Icon className={`w-5 h-5 ${collapsed ? '' : 'mr-3'} ${isActive ? 'text-white' : 'text-slate-500'}`} />
      {!collapsed && label}
    </Link>
  );
};

export default App;
