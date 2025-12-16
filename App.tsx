
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { TrackingView } from './components/TrackingView';
import { dbService } from './services/dbService';
import { getCurrentPeriod } from './utils/helpers';
import { exportToExcel } from './services/exportService';
import { LayoutDashboard, Table, Plus, LogOut, Download, Menu, X, Search, CalendarPlus, Languages } from 'lucide-react';
import { ProjectStatus } from './types';
import { DEFAULT_UNIT_PRICE } from './constants';
import { useLanguage } from './contexts/LanguageContext';

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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState('2024-H2'); // Default to data period
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
    type: 'Mechanical Design',
    status: ProjectStatus.ACTIVE,
    software: 'AutoCAD',
    unit_price: DEFAULT_UNIT_PRICE
  });
  const projectTypeOptions = [
    { value: 'Mechanical Design', label: t('project.type.mechanical') },
    { value: 'Software', label: t('project.type.software') },
    { value: 'Translation', label: t('project.type.translation') },
    { value: 'Other', label: t('project.type.other') },
  ];

  // Init Data
  useEffect(() => {
    const init = async () => {
        const periods = await dbService.getPeriods();
        setAvailablePeriods(periods);
        // Force default to 2024-H2 if available to match the seed data
        if (periods.includes('2024-H2')) {
            setCurrentPeriod('2024-H2');
        } else if (periods.length > 0) {
            setCurrentPeriod(periods[0]);
        }
    };
    if (isLoggedIn) {
        init();
    }
  }, [isLoggedIn]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbService.createProject(newProject);
      setIsProjectModalOpen(false);
      setNewProject({
        code: '',
        name: '',
        type: 'Mechanical Design',
        status: ProjectStatus.ACTIVE,
        software: 'AutoCAD',
        unit_price: DEFAULT_UNIT_PRICE
      });
      // Force reload to update views
      window.location.reload();
    } catch (err) {
      alert(t('alerts.projectCreateError'));
      console.error(err);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
      e.preventDefault();
      const label = `${newPeriodInput.year}-${newPeriodInput.type}`;
      const updated = await dbService.addPeriod(label);
      setAvailablePeriods(updated);
      setCurrentPeriod(label);
      setIsPeriodModalOpen(false);
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

  if (!isLoggedIn) return <Auth onLogin={() => setIsLoggedIn(true)} />;

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
          </nav>
          <div className="p-4 border-t border-slate-700">
            <div className="flex items-center mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
                A
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium truncate w-32">{t('app.adminUser')}</p>
              </div>
            </div>
            <button 
              onClick={() => setIsLoggedIn(false)}
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
                <button onClick={() => setIsLoggedIn(false)} className="block w-full text-left py-3 text-red-400">{t('nav.signOut')}</button>
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
                onClick={() => setIsProjectModalOpen(true)}
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
              <Route path="/tracking" element={<TrackingView currentPeriodLabel={currentPeriod} searchQuery={searchQuery} />} />
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
              <button onClick={() => setIsProjectModalOpen(false)}><X className="text-gray-400 hover:text-gray-600"/></button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.code')}</label>
                  <input required type="text" className="block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={newProject.code} onChange={e => setNewProject({...newProject, code: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.name')}</label>
                  <input required type="text" className="block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.type')}</label>
                  <select className="block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={newProject.type} onChange={e => setNewProject({...newProject, type: e.target.value})}>
                    {projectTypeOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                   <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.unitPrice')}</label>
                  <input required type="number" className="block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={newProject.unit_price} onChange={e => setNewProject({...newProject, unit_price: parseInt(e.target.value)})} />
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xs animate-in fade-in zoom-in duration-200">
             <div className="p-4 border-b border-gray-100 flex justify-between items-center">
               <h3 className="text-md font-bold text-gray-800">{t('modals.period.title')}</h3>
               <button onClick={() => setIsPeriodModalOpen(false)}><X className="w-4 h-4 text-gray-400"/></button>
             </div>
             <form onSubmit={handleCreatePeriod} className="p-4 space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('modals.period.year')}</label>
                    <input 
                      type="number" 
                      className="block w-full border border-gray-300 rounded-md p-2 text-sm" 
                      value={newPeriodInput.year}
                      onChange={e => setNewPeriodInput({...newPeriodInput, year: parseInt(e.target.value)})} 
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('modals.period.half')}</label>
                    <select 
                      className="block w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newPeriodInput.type}
                      onChange={e => setNewPeriodInput({...newPeriodInput, type: e.target.value})}
                    >
                        <option value="H1">{t('modals.period.option.h1')}</option>
                        <option value="H2">{t('modals.period.option.h2')}</option>
                    </select>
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
      className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive 
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
