import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  CheckSquare,
  Square,
  Loader2
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { Project, PeriodType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface PeriodWithCount {
  label: string;
  year: number;
  half: 'H1' | 'H2';
  created_at: string;
  project_count: number;
}

export const PeriodManagement: React.FC = () => {
  const { t } = useLanguage();

  // State
  const [periods, setPeriods] = useState<PeriodWithCount[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodWithCount | null>(null);

  // Form state
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formHalf, setFormHalf] = useState<'H1' | 'H2'>('H1');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [periodsData, projectsData] = await Promise.all([
        dbService.getPeriodsWithProjectCount(),
        dbService.getAllProjectsForPeriodManagement()
      ]);
      setPeriods(periodsData);
      setAllProjects(projectsData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Filter projects by search query
  const filteredProjects = allProjects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle project selection
  const toggleProject = (projectId: string) => {
    setSelectedProjectIds(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  // Select/Deselect all
  const selectAll = () => {
    setSelectedProjectIds(filteredProjects.map(p => p.id));
  };

  const deselectAll = () => {
    setSelectedProjectIds([]);
  };

  // Create period
  const handleCreatePeriod = async () => {
    if (selectedProjectIds.length === 0) {
      alert(t('pleaseSelectAtLeastOneProject', 'Please select at least one project'));
      return;
    }

    try {
      setSubmitting(true);
      await dbService.createPeriodWithProjects(formYear, formHalf, selectedProjectIds);

      const periodLabel = `${formYear}-${formHalf}`;

      // Dispatch custom event to notify App.tsx to refresh periods
      window.dispatchEvent(new CustomEvent('periodCreated', {
        detail: { periodLabel }
      }));

      alert(t('periodCreatedSuccessfully', 'Period created successfully'));
      setIsCreateModalOpen(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      console.error('Error creating period:', error);
      if (error.code === '23505') {
        alert(t('periodAlreadyExists', 'This period already exists'));
      } else {
        alert(t('failedToCreatePeriod', 'Failed to create period'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Edit period - load existing projects
  const handleEditClick = async (period: PeriodWithCount) => {
    try {
      setSelectedPeriod(period);
      const periodProjects = await dbService.getProjectsForPeriod(period.label);
      setSelectedProjectIds(periodProjects.map(p => p.id));
      setIsEditModalOpen(true);
    } catch (error) {
      console.error('Error loading period projects:', error);
      alert('Failed to load period projects');
    }
  };

  // Update period projects
  const handleUpdatePeriod = async () => {
    if (!selectedPeriod) return;

    try {
      setSubmitting(true);
      await dbService.updatePeriodProjects(selectedPeriod.label, selectedProjectIds);
      alert(t('periodUpdatedSuccessfully', 'Period updated successfully'));
      setIsEditModalOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Error updating period:', error);
      alert(t('failedToUpdatePeriod', 'Failed to update period'));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete period
  const handleDeletePeriod = async (period: PeriodWithCount) => {
    const confirmMsg = t(
      'confirmDeletePeriod',
      `Are you sure you want to delete period ${period.label}? This will remove all project assignments.`
    );

    if (!confirm(confirmMsg.replace('${period.label}', period.label))) return;

    try {
      await dbService.deletePeriod(period.label);
      alert(t('periodDeletedSuccessfully', 'Period deleted successfully'));
      await loadData();
    } catch (error) {
      console.error('Error deleting period:', error);
      alert(t('failedToDeletePeriod', 'Failed to delete period'));
    }
  };

  // Reset form
  const resetForm = () => {
    setFormYear(new Date().getFullYear());
    setFormHalf('H1');
    setSelectedProjectIds([]);
    setSearchQuery('');
    setSelectedPeriod(null);
  };

  // Close modals
  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    resetForm();
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    resetForm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {t('periodManagement', '期間管理 / Period Management')}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {t('managePeriods', 'Create and manage periods with project assignments')}
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('createNewPeriod', 'Create New Period')}
        </button>
      </div>

      {/* Existing Periods List */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {t('existingPeriods', 'Existing Periods')}
          </h2>
        </div>

        <div className="divide-y divide-slate-200">
          {periods.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('noPeriodsYet', 'No periods created yet')}</p>
            </div>
          ) : (
            periods.map(period => (
              <div key={period.label} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-slate-900">
                        {period.year} {period.half}
                        <span className="text-sm font-normal text-slate-600 ml-2">
                          ({period.half === 'H1' ? '1月-6月' : '7月-12月'})
                        </span>
                      </h3>
                    </div>
                    <div className="ml-8 mt-2 space-y-1 text-sm text-slate-600">
                      <p>
                        {t('projectCount', 'Projects')}: <span className="font-semibold">{period.project_count}</span>
                      </p>
                      <p>
                        {t('lastUpdated', 'Last updated')}: {new Date(period.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditClick(period)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t('edit', 'Edit')}
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeletePeriod(period)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title={t('delete', 'Delete')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Period Modal */}
      {isCreateModalOpen && (
        <PeriodFormModal
          title={t('createNewPeriod', 'Create New Period')}
          year={formYear}
          half={formHalf}
          selectedProjectIds={selectedProjectIds}
          allProjects={filteredProjects}
          searchQuery={searchQuery}
          submitting={submitting}
          onYearChange={setFormYear}
          onHalfChange={setFormHalf}
          onSearchChange={setSearchQuery}
          onToggleProject={toggleProject}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onSubmit={handleCreatePeriod}
          onClose={closeCreateModal}
          t={t}
        />
      )}

      {/* Edit Period Modal */}
      {isEditModalOpen && selectedPeriod && (
        <PeriodFormModal
          title={`${t('editPeriod', 'Edit Period')}: ${selectedPeriod.label}`}
          year={selectedPeriod.year}
          half={selectedPeriod.half}
          selectedProjectIds={selectedProjectIds}
          allProjects={filteredProjects}
          searchQuery={searchQuery}
          submitting={submitting}
          isEditMode={true}
          onSearchChange={setSearchQuery}
          onToggleProject={toggleProject}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onSubmit={handleUpdatePeriod}
          onClose={closeEditModal}
          t={t}
        />
      )}
    </div>
  );
};

// Period Form Modal Component
interface PeriodFormModalProps {
  title: string;
  year: number;
  half: 'H1' | 'H2';
  selectedProjectIds: string[];
  allProjects: Project[];
  searchQuery: string;
  submitting: boolean;
  isEditMode?: boolean;
  onYearChange?: (year: number) => void;
  onHalfChange?: (half: 'H1' | 'H2') => void;
  onSearchChange: (query: string) => void;
  onToggleProject: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSubmit: () => void;
  onClose: () => void;
  t: (key: string, fallback: string) => string;
}

const PeriodFormModal: React.FC<PeriodFormModalProps> = ({
  title,
  year,
  half,
  selectedProjectIds,
  allProjects,
  searchQuery,
  submitting,
  isEditMode = false,
  onYearChange,
  onHalfChange,
  onSearchChange,
  onToggleProject,
  onSelectAll,
  onDeselectAll,
  onSubmit,
  onClose,
  t
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Year and Half Selection */}
          {!isEditMode && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('year', 'Year')}
                </label>
                <input
                  type="number"
                  min="2000"
                  max="2099"
                  value={year}
                  onChange={(e) => onYearChange?.(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('half', 'Half')}
                </label>
                <select
                  value={half}
                  onChange={(e) => onHalfChange?.(e.target.value as 'H1' | 'H2')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="H1">H1 (1月-6月 / Jan-Jun)</option>
                  <option value="H2">H2 (7月-12月 / Jul-Dec)</option>
                </select>
              </div>
            </div>
          )}

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('searchProjects', 'Search Projects')}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t('searchPlaceholder', 'Search by name, code, or type...')}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Select All / Deselect All */}
          <div className="flex items-center justify-between py-2 border-y border-slate-200">
            <span className="text-sm font-medium text-slate-700">
              {selectedProjectIds.length} {t('projectsSelected', 'projects selected')}
            </span>
            <div className="flex gap-2">
              <button
                onClick={onSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('selectAll', 'Select All')}
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={onDeselectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('deselectAll', 'Deselect All')}
              </button>
            </div>
          </div>

          {/* Project List */}
          <div className="border border-slate-200 rounded-lg max-h-96 overflow-y-auto">
            {allProjects.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p>{t('noProjectsFound', 'No projects found')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {allProjects.map(project => (
                  <label
                    key={project.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjectIds.includes(project.id)}
                      onChange={() => onToggleProject(project.id)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{project.name}</span>
                        <span className="text-xs text-slate-500">({project.code})</span>
                      </div>
                      <div className="text-sm text-slate-600">
                        {project.type} • {project.software}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {t('cancel', 'Cancel')}
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || selectedProjectIds.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditMode ? t('updatePeriod', 'Update Period') : t('createPeriod', 'Create Period')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PeriodManagement;
