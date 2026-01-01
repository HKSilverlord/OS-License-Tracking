
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { TrackingView } from './components/TrackingView';
import { TotalView } from './components/TotalView';
import { YearlyDataView } from './components/YearlyDataView';
import { dbService } from './services/dbService';
import { exportToExcel } from './services/exportService';
import { LayoutDashboard, Table, Plus, LogOut, Download, Menu, X, Search, CalendarPlus, Languages, BarChart3 } from 'lucide-react';
import { ProjectStatus } from './types';
import { DEFAULT_UNIT_PRICE } from './constants';
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

  // Form States
  const [newPeriodInput, setNewPeriodInput] = useState({ year: new Date().getFullYear(), type: 'H1' });
  const [newProject, setNewProject] = useState({
    code: '',
    name: '',
    type: '',
    status: ProjectStatus.ACTIVE,
    software: 'AutoCAD',
    unit_price: DEFAULT_UNIT_PRICE
  });
  const [currentPeriodProjects, setCurrentPeriodProjects] = useState<any[]>([]);
  const [selectedCarryOverIds, setSelectedCarryOverIds] = useState<string[]>([]);
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbService.createProject({
        ...newProject,
        period: currentPeriod
      });
      setIsProjectModalOpen(false);
      setNewProject({
        code: '',
        name: '',
        type: '',
        status: ProjectStatus.ACTIVE,
        software: 'AutoCAD',
        unit_price: DEFAULT_UNIT_PRICE
      });
      // Trigger refresh in TrackingView
      setProjectCreatedTrigger(prev => prev + 1);
      alert(t('alerts.projectCreated', 'Project created successfully!'));
    } catch (err) {
      alert(t('alerts.projectCreateError'));
      console.error(err);
    }
  };

  const handleOpenProjectModal = async () => {
    try {
      const nextCode = await dbService.getNextProjectCode(currentPeriod);
      setNewProject(prev => ({ ...prev, code: nextCode }));
      setIsProjectModalOpen(true);
    } catch (error) {
      console.error("Failed to generate project code", error);
      // Fallback: open modal anyway, code will be auto-generated on submit
      setIsProjectModalOpen(true);
    }
  };

  const handleOpenPeriodModal = async () => {
    // Fetch ALL unique projects for carry-over selection
    try {
      console.log('[DEBUG App] Fetching all projects for carryover...');
      const allProjects = await dbService.getProjectsForCarryOver();
      console.log('[DEBUG App] All unique projects:', allProjects);

      setCurrentPeriodProjects(allProjects);

      // Calculate next period based on current period
      if (currentPeriod) {
        const [yearStr, half] = currentPeriod.split('-');
        const year = parseInt(yearStr);
        if (half === 'H1') {
          setNewPeriodInput({ year, type: 'H2' });
        } else {
          setNewPeriodInput({ year: year + 1, type: 'H1' });
        }
      } else {
        // Default to current year if no period selected
        setNewPeriodInput({ year: new Date().getFullYear(), type: 'H1' });
      }

      setSelectedCarryOverIds([]); // Reset selection
      setIsPeriodModalOpen(true);
    } catch (e) {
      console.error("[DEBUG App] Failed to fetch projects for period modal", e);
      setCurrentPeriodProjects([]);
      setIsPeriodModalOpen(true);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = `${newPeriodInput.year}-${newPeriodInput.type}`;
    try {
      const updated = await dbService.addPeriod(label);
      setAvailablePeriods(updated);

      // Handle Carry Over
      if (selectedCarryOverIds.length > 0) {
        await dbService.copyProjectsToPeriod(label, selectedCarryOverIds);
      }

      setCurrentPeriod(label);
      setIsPeriodModalOpen(false);
    } catch (e) {
      console.error(e);
      alert('Failed to create period');
    }
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
            <NavLink to="/total" icon={BarChart3} label={t('nav.totalView')} />
            <NavLink to="/yearly-data" icon={Table} label={t('nav.yearlyData')} />
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
              <Link to="/total" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-white border-b border-slate-700">{t('nav.totalView')}</Link>
              <Link to="/yearly-data" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-white border-b border-slate-700">{t('nav.yearlyData')}</Link>
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
              <button
                onClick={() => setIsPeriodModalOpen(true)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-blue-600 transition-colors"
                title={t('modals.period.title')}
              >
                <CalendarPlus className="w-5 h-5" />
              </button>
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
            </Routes>
          </div>
        </main>
      </div>

      {/* New Project Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">{t('modals.project.title')}</h3>
              <button onClick={() => setIsProjectModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.code')}</label>
                  <input required readOnly type="text" className="block w-full border border-gray-300 rounded-md p-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed focus:ring-blue-500 focus:border-blue-500" value={newProject.code} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.name')}</label>
                  <input required type="text" className="block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.type')}</label>
                  <input type="text" className="block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={newProject.type} onChange={e => setNewProject({ ...newProject, type: e.target.value })} placeholder={t('modals.project.typePlaceholder')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.software')}</label>
                  <input type="text" className="block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={newProject.software} onChange={e => setNewProject({ ...newProject, software: e.target.value })} placeholder={t('modals.project.softwarePlaceholder')} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.unitPrice')}</label>
                  <input required type="number" className="block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={newProject.unit_price} onChange={e => setNewProject({ ...newProject, unit_price: parseInt(e.target.value) })} />
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">{t('modals.actions.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">{t('modals.project.submit')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Period Modal */}
      {isPeriodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-md font-bold text-gray-800">{t('modals.period.title')}</h3>
              <button onClick={() => setIsPeriodModalOpen(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreatePeriod} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('modals.period.year')}</label>
                  <input
                    type="number"
                    className="block w-full border border-gray-300 rounded-md p-2 text-sm"
                    value={newPeriodInput.year}
                    onChange={e => setNewPeriodInput({ ...newPeriodInput, year: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('modals.period.half')}</label>
                  <select
                    className="block w-full border border-gray-300 rounded-md p-2 text-sm"
                    value={newPeriodInput.type}
                    onChange={e => setNewPeriodInput({ ...newPeriodInput, type: e.target.value })}
                  >
                    <option value="H1">{t('modals.period.option.h1')}</option>
                    <option value="H2">{t('modals.period.option.h2')}</option>
                  </select>
                </div>
              </div>

              {/* Carry Over Projects Selection */}
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  既存プロジェクトを選択 (Select existing projects):
                </p>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1 bg-gray-50">
                  {currentPeriodProjects.length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-2">プロジェクトがまだありません。先にプロジェクトを作成してください。</p>
                  ) : (
                    currentPeriodProjects.map(p => (
                      <label key={p.id} className="flex items-center space-x-2 text-sm p-1 hover:bg-white rounded cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          checked={selectedCarryOverIds.includes(p.id)}
                          onChange={() => {
                            setSelectedCarryOverIds(prev =>
                              prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                            );
                          }}
                        />
                        <span className="truncate flex-1">{p.name}</span>
                        <span className="text-xs text-gray-400">{p.code}</span>
                      </label>
                    ))
                  )}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => {
                      if (selectedCarryOverIds.length === currentPeriodProjects.length) setSelectedCarryOverIds([]);
                      else setSelectedCarryOverIds(currentPeriodProjects.map(p => p.id));
                    }}
                  >
                    {selectedCarryOverIds.length === currentPeriodProjects.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-xs text-gray-500">{selectedCarryOverIds.length} projects selected</span>
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md text-sm hover:bg-blue-700">{t('modals.period.submit')}</button>
            </form>
          </div>
        </div>
      )}
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
