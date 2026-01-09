
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
import { dbService } from './services/dbService';
import { exportToExcel } from './services/exportService';
import { LayoutDashboard, Table, Plus, LogOut, Download, Menu, X, Search, Languages, BarChart3, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
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
      console.log('[DEBUG App] Number of projects returned:', allProjects.length);

      if (allProjects.length === 0) {
        console.warn('[DEBUG App] No projects returned from getProjectsForCarryOver');
      }

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
      alert(`Error fetching projects: ${e instanceof Error ? e.message : 'Unknown error'}. Check console for details.`);
      setCurrentPeriodProjects([]);
      setIsPeriodModalOpen(true);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = `${newPeriodInput.year}-${newPeriodInput.type}`;

    // Check for duplicate period
    if (availablePeriods.includes(label)) {
      alert(t('alerts.duplicatePeriod', `Period ${label} already exists. Please select a different year or half.`));
      return;
    }

    try {
      const updated = await dbService.addPeriod(label);
      setAvailablePeriods(updated);

      // Handle Carry Over
      if (selectedCarryOverIds.length > 0) {
        await dbService.copyProjectsToPeriod(label, selectedCarryOverIds);
      }

      setCurrentPeriod(label);
      setIsPeriodModalOpen(false);
      alert(t('alerts.periodCreated', `Period ${label} created successfully!`));
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
            <NavLink to="/long-term-plan" icon={TrendingUp} label={t('nav.longTermPlan')} />
            <NavLink to="/monthly-plan-actual" icon={BarChart3} label={t('nav.monthlyPlanActual')} />
            <NavLink to="/period-management" icon={CalendarIcon} label={t('nav.periodManagement')} />
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
              <Link to="/long-term-plan" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-white border-b border-slate-700">{t('nav.longTermPlan')}</Link>
              <Link to="/monthly-plan-actual" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-white border-b border-slate-700">{t('nav.monthlyPlanActual')}</Link>
              <Link to="/period-management" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-white border-b border-slate-700">{t('nav.periodManagement')}</Link>
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-gray-200 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{t('modals.period.title', '新しい期間')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Create a new period and select projects to include</p>
              </div>
              <button
                onClick={() => setIsPeriodModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content - Scrollable */}
            <form onSubmit={handleCreatePeriod} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Year Input - Full Width */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('modals.period.year', 'Year')}
                  </label>
                  <input
                    type="number"
                    required
                    className="block w-full border-2 border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    value={newPeriodInput.year}
                    onChange={e => setNewPeriodInput({ ...newPeriodInput, year: parseInt(e.target.value) })}
                    placeholder="2025"
                  />
                </div>

                {/* Period Dropdown - Full Width */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('modals.period.half', 'Period')}
                  </label>
                  <select
                    required
                    className="block w-full border-2 border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer bg-white"
                    value={newPeriodInput.type}
                    onChange={e => setNewPeriodInput({ ...newPeriodInput, type: e.target.value })}
                  >
                    <option value="H1">{t('modals.period.option.h1', 'H1 (1月-6月 / Jan-Jun)')}</option>
                    <option value="H2">{t('modals.period.option.h2', 'H2 (7月-12月 / Jul-Dec)')}</option>
                  </select>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 pt-6">
                  {/* Projects Selection Header */}
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700">
                        既存プロジェクトを選択
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Select existing projects to include in this period
                      </p>
                    </div>
                  </div>

                  {/* Projects List */}
                  <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                    <div className="max-h-64 overflow-y-auto">
                      {currentPeriodProjects.length === 0 ? (
                        <div className="text-center py-12 px-4">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 mb-4">
                            <Plus className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-sm text-gray-600 font-medium mb-1">
                            プロジェクトがまだありません
                          </p>
                          <p className="text-xs text-gray-500">
                            先にプロジェクトを作成してください。
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {currentPeriodProjects.map(p => (
                            <label
                              key={p.id}
                              className="flex items-center space-x-3 p-3 hover:bg-blue-50 cursor-pointer transition-colors group"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 w-5 h-5 cursor-pointer"
                                checked={selectedCarryOverIds.includes(p.id)}
                                onChange={() => {
                                  setSelectedCarryOverIds(prev =>
                                    prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                  );
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700">
                                  {p.name}
                                </p>
                                {p.type && (
                                  <p className="text-xs text-gray-500 truncate">
                                    {p.type}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs font-mono text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                {p.code}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selection Controls - Inside the border */}
                    {currentPeriodProjects.length > 0 && (
                      <div className="flex justify-between items-center px-3 py-2 bg-gray-100 border-t border-gray-300">
                        <button
                          type="button"
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                          onClick={() => {
                            if (selectedCarryOverIds.length === currentPeriodProjects.length) {
                              setSelectedCarryOverIds([]);
                            } else {
                              setSelectedCarryOverIds(currentPeriodProjects.map(p => p.id));
                            }
                          }}
                        >
                          {selectedCarryOverIds.length === currentPeriodProjects.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-sm font-semibold text-gray-700">
                          {selectedCarryOverIds.length} selected
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button - Fixed at bottom */}
              <div className="p-6 pt-0">
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 rounded-lg text-base font-semibold hover:bg-blue-700 active:bg-blue-800 transition-all shadow-md hover:shadow-lg"
                >
                  {t('modals.period.submit', '期間を追加')}
                </button>
              </div>
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
