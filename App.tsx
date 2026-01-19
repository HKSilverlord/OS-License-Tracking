
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
import { LayoutDashboard, Table, Plus, LogOut, Download, Menu, X, Search, Languages, BarChart3, Calendar as CalendarIcon, TrendingUp, Wrench } from 'lucide-react';
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
  const [currentPeriod, setCurrentPeriod] = useState(''); // Will be set by init
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
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
      if (periods.length > 0) {
        // Default to the most recent period (first in the list as it's sorted desc)
        setCurrentPeriod(periods[0]);
      }
    };
    if (session) {
      init();
    }
  }, [session]);

  // Listen for period created events to refresh the period list
  useEffect(() => {
    const handlePeriodCreated = async (event: any) => {
      const periods = await dbService.getPeriods();
      setAvailablePeriods(periods);
      // Set current period to the newly created one
      if (event.detail?.periodLabel) {
        setCurrentPeriod(event.detail.periodLabel);
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
      const nextCode = await dbService.getNextProjectCode(currentPeriod);
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
    setCurrentPeriod(newPeriodLabel);
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
      exportToExcel(exportData, currentPeriod);
    } catch (e) {
      console.error(e);
      alert(t('alerts.exportFailed'));
    }
  };

  if (!session) return <Auth />;

  const currentYear = parseInt(currentPeriod.split('-')[0]) || new Date().getFullYear();

  return (
    <Router>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Sidebar Desktop */}
        <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shadow-xl z-20 shrink-0">
          <div className="p-6">
            <h1 className="text-xl font-bold tracking-tight text-blue-400">{t('app.title')}</h1>
            <p className="text-xs text-slate-400 mt-1">{t('app.subtitle')}</p>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            <NavLink to="/" icon={LayoutDashboard} label={t('nav.dashboard')} />
            <NavLink to="/tracking" icon={Table} label={t('nav.tracking')} />
            <NavLink to="/yearly-data" icon={Table} label={t('nav.yearlyData')} />
            <NavLink to="/total" icon={BarChart3} label={t('nav.totalView')} />
            <NavLink to="/long-term-plan" icon={TrendingUp} label={t('nav.longTermPlan')} />
            <NavLink to="/monthly-plan-actual" icon={BarChart3} label={t('nav.monthlyPlanActual')} />
            <NavLink to="/period-management" icon={CalendarIcon} label={t('nav.periodManagement')} />
            <div className="pt-2 border-t border-slate-700"></div>
            <NavLink to="/diagnostic" icon={Wrench} label="Database Fix" />
          </nav>
          <div className="p-4 border-t border-slate-700">
            <div className="flex items-center mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
                {session.user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium truncate w-32">{session.user.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-2 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            >
              <LogOut className="w-4 h-4 mr-3" />
              {t('nav.signOut')}
            </button>
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
              {/* Period Selector */}
              <div className="flex items-center space-x-2 bg-slate-100 rounded-lg p-1">
                <select
                  value={currentPeriod}
                  onChange={(e) => setCurrentPeriod(e.target.value)}
                  className="bg-transparent border-none text-slate-900 text-sm focus:ring-0 font-medium cursor-pointer"
                >
                  {availablePeriods.map(p => (
                    <option key={p} value={p}>{p}</option>
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
              <Route path="/tracking" element={<TrackingView currentPeriodLabel={currentPeriod} searchQuery={searchQuery} refreshTrigger={projectCreatedTrigger} />} />
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
        initialCode={nextProjectCode}
        currentPeriod={currentPeriod}
      />

      <NewPeriodModal
        isOpen={isPeriodModalOpen}
        onClose={() => setIsPeriodModalOpen(false)}
        onSuccess={handlePeriodSuccess}
        availablePeriods={availablePeriods}
        currentPeriod={currentPeriod}
      />
    </Router>
  );
}

// Nav Link Component
const NavLink = ({ to, icon: Icon, label }: any) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
        ? 'bg-blue-600 text-white shadow-md'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
    >
      <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : 'text-slate-500'}`} />
      {label}
    </Link>
  );
};

export default App;
