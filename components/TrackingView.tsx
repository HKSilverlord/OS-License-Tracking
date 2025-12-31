import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Project, MonthlyRecord, PeriodType } from '../types';
import { dbService } from '../services/dbService';
import { getMonthsForPeriod } from '../utils/helpers';
import { TABLE_COLUMN_WIDTHS, STICKY_CLASSES } from '../utils/tableStyles';
import { Save, Loader2, Trash2, MoreVertical, Edit, Trash } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ScrollContainer } from './ScrollContainer';

interface TrackingViewProps {
  currentPeriodLabel: string; // e.g. "2024-H1"
  searchQuery: string;
  refreshTrigger?: number; // Trigger to refresh data when project is created
}

export const TrackingView: React.FC<TrackingViewProps> = ({ currentPeriodLabel, searchQuery, refreshTrigger }) => {
  const { t, language } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<Record<string, MonthlyRecord[]>>({}); // Key: ProjectId
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({}); // Key: `${projectId}-${month}-${field}`
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Debounce refs
  const debounceTimers = useRef<Record<string, any>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [yearStr, typeStr] = currentPeriodLabel.split('-');
  const year = parseInt(yearStr);
  const periodType = typeStr as PeriodType;
  const months = useMemo(() => getMonthsForPeriod(year, periodType), [year, periodType]);

  const formatMonthLabel = useCallback((month: number) => {
    if (language === 'ja') return `${month}月`;
    if (language === 'vn') return `Tháng ${month}`;
    return new Date(2000, month - 1).toLocaleString('en-US', { month: 'short' });
  }, [language]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.code.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsData, recordsData] = await Promise.all([
        dbService.getProjects(currentPeriodLabel),
        dbService.getRecords(currentPeriodLabel)
      ]);

      // Sort projects by created_at which effectively sorts by number since they are sequential
      // or we can sort by name if preferred. Let's stick to created_at for stability.
      // dbService.getProjects already sorts by created_at.

      setProjects(projectsData);

      const groupedRecords: Record<string, MonthlyRecord[]> = {};
      recordsData.forEach(r => {
        if (!groupedRecords[r.project_id]) groupedRecords[r.project_id] = [];
        groupedRecords[r.project_id].push(r);
      });
      setRecords(groupedRecords);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  }, [currentPeriodLabel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh data when a new project is created
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchData().then(() => {
        // Scroll to bottom after data is loaded to show the new project
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
        }, 100);
      });
    }
  }, [refreshTrigger, fetchData]);

  // Cleanup debounce timers on unmount and period change
  useEffect(() => {
    return () => {
      // Clear all pending timers on unmount
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer as any));
      debounceTimers.current = {};
    };
  }, []);

  useEffect(() => {
    // Clear all pending timers when period changes
    Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer as any));
    debounceTimers.current = {};
  }, [currentPeriodLabel]);

  const saveRecord = async (projectId: string, month: number, field: 'planned_hours' | 'actual_hours', value: number) => {
    const key = `${projectId}-${month}-${field}`;
    setSavingStatus(prev => ({ ...prev, [key]: true }));

    try {
      await dbService.upsertRecord({
        project_id: projectId,
        period_label: currentPeriodLabel,
        year,
        month,
        [field]: value
      });
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSavingStatus(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleValueChange = (
    projectId: string,
    month: number,
    field: 'planned_hours' | 'actual_hours',
    value: string
  ) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

    // Optimistic Update
    setRecords(prev => {
      const projectRecords = prev[projectId] ? [...prev[projectId]] : [];
      const existingIndex = projectRecords.findIndex(r => r.month === month);

      if (existingIndex >= 0) {
        projectRecords[existingIndex] = { ...projectRecords[existingIndex], [field]: numValue };
      } else {
        projectRecords.push({
          project_id: projectId,
          period_label: currentPeriodLabel,
          year,
          month,
          planned_hours: field === 'planned_hours' ? numValue : 0,
          actual_hours: field === 'actual_hours' ? numValue : 0
        });
      }
      return { ...prev, [projectId]: projectRecords };
    });

    // Debounce Save
    const key = `${projectId}-${month}-${field}`;
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    debounceTimers.current[key] = setTimeout(() => {
      saveRecord(projectId, month, field, numValue);
      delete debounceTimers.current[key];
    }, 800); // Autosave after 800ms of inactivity
  };

  const handleDeleteProjects = async (ids: string[]) => {
    if (!ids.length) return;
    const targets = projects.filter(p => ids.includes(p.id));
    const confirmMessage = ids.length === 1
      ? t('tracker.confirmDeleteOne', 'Delete project "{name}"? This removes its records.').replace('{name}', targets[0]?.name || '')
      : t('tracker.confirmDeleteMany', 'Delete {count} projects and their records?').replace('{count}', `${ids.length}`);
    const nameList = targets.map(t => t.name).join(', ');
    const message = nameList ? `${confirmMessage}\n${nameList}` : confirmMessage;

    if (!window.confirm(message)) return;

    setDeleting(true);
    try {
      await dbService.deleteProjects(ids);
      setProjects(prev => prev.filter(p => !ids.includes(p.id)));
      setRecords(prev => {
        const updated = { ...prev };
        ids.forEach(id => { delete updated[id]; });
        return updated;
      });
    } catch (error) {
      console.error("Failed to delete projects", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateProject = async (id: string, updates: Partial<Project>) => {
    try {
      const updated = await dbService.updateProject(id, updates);
      setProjects(prev => prev.map(p => p.id === id ? updated : p));
    } catch (error) {
      console.error("Failed to update project", error);
      alert("Failed to update project");
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  // Use shared table styling constants
  const { no: LEFT_NO_WIDTH, code: LEFT_CODE_WIDTH, name: LEFT_NAME_WIDTH, software: LEFT_SOFTWARE_WIDTH, businessContent: BUSINESS_CONTENT_WIDTH, month: MONTH_WIDTH, actions: RIGHT_ACTIONS_WIDTH } = TABLE_COLUMN_WIDTHS;

  const { leftCell: stickyLeftClass, leftHeader: stickyLeftHeaderClass, rightCell: stickyRightClass, rightHeader: stickyRightHeaderClass, header: stickyHeaderZ, corner: stickyCornerZ } = STICKY_CLASSES;

  return (
    <div className="flex flex-col h-full bg-slate-50 p-2 sm:p-4 md:p-6 overflow-hidden">
      <div className="flex-1 min-h-0 w-full border rounded-lg shadow-sm bg-white relative isolate">
        <ScrollContainer ref={scrollContainerRef} className="flex-1">
          <table key={currentPeriodLabel} className="w-full min-w-max border-separate border-spacing-0">
          <thead className="bg-gray-50 sticky top-0 z-40">
            <tr>
              {/* No. Column */}
              <th scope="col" style={{ left: 0, width: `${LEFT_NO_WIDTH}px` }} className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                {t('tracker.no')}
              </th>
              {/* Code Column */}
              <th scope="col" style={{ left: `${LEFT_NO_WIDTH}px`, width: `${LEFT_CODE_WIDTH}px` }} className={`px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                {t('tracker.code')}
              </th>
              {/* Company Name Column (now includes price below) */}
              <th scope="col" style={{ left: `${LEFT_NO_WIDTH + LEFT_CODE_WIDTH}px`, width: `${LEFT_NAME_WIDTH}px` }} className={`px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                {t('tracker.projectName')}
              </th>
              {/* Software Column */}
              <th scope="col" style={{ left: `${LEFT_NO_WIDTH + LEFT_CODE_WIDTH + LEFT_NAME_WIDTH}px`, width: `${LEFT_SOFTWARE_WIDTH}px` }} className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                {t('tracker.software')}
              </th>

              <th scope="col" style={{ width: `${BUSINESS_CONTENT_WIDTH}px` }} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b bg-gray-50 border-r">
                {t('tracker.businessContent')}
              </th>

              {/* Row Type Column (Plan/Actual) */}
              <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b bg-gray-50 border-r w-16">
                {t('tracker.type')}
              </th>

              {/* Scrollable Month Columns */}
              {months.map((m) => (
                <th key={m} scope="col" style={{ width: `${MONTH_WIDTH}px` }} className={`px-1 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 ${stickyHeaderZ}`}>
                  {formatMonthLabel(m)}
                </th>
              ))}

              {/* Actions Column (3-dot menu) */}
              <th scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyRightHeaderClass} ${stickyCornerZ}`} style={{ right: 0, width: `${RIGHT_ACTIONS_WIDTH}px` }}>
                {t('tracker.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProjects.map((project, index) => {
              const projRecords = records[project.id] || [];

              return (
                <React.Fragment key={project.id}>
                  {/* ROW 1: Plan */}
                  <tr className="hover:bg-gray-50 group">
                    {/* No. Cell */}
                    <td rowSpan={2} style={{ left: 0, width: `${LEFT_NO_WIDTH}px` }} className={`px-2 py-3 text-center text-sm font-medium text-gray-500 ${stickyLeftClass} align-top`}>
                      {index + 1}
                    </td>
                    {/* Code Cell */}
                    <td rowSpan={2} style={{ left: `${LEFT_NO_WIDTH}px`, width: `${LEFT_CODE_WIDTH}px` }} className={`px-2 py-3 text-sm font-medium text-gray-900 ${stickyLeftClass} align-top`}>
                      {project.code}
                    </td>
                    {/* Company Name Cell (with price below) */}
                    <td rowSpan={2} style={{ left: `${LEFT_NO_WIDTH + LEFT_CODE_WIDTH}px`, width: `${LEFT_NAME_WIDTH}px` }} className={`px-2 py-2 text-sm text-gray-700 border-b ${stickyLeftClass} align-top group-hover:bg-gray-50`}>
                      <div className="font-medium truncate" title={project.name}>{project.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{project.unit_price.toLocaleString()} JPY/hours</div>
                    </td>
                    {/* Software Cell */}
                    <td rowSpan={2} style={{ left: `${LEFT_NO_WIDTH + LEFT_CODE_WIDTH + LEFT_NAME_WIDTH}px`, width: `${LEFT_SOFTWARE_WIDTH}px` }} className={`px-2 py-2 text-xs text-gray-600 text-center border-b ${stickyLeftClass} align-top group-hover:bg-gray-50`}>
                      <input
                        type="text"
                        className="w-full text-xs border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-center px-1 py-1 bg-transparent"
                        value={project.software || ''}
                        onChange={(e) => handleUpdateProject(project.id, { software: e.target.value })}
                        placeholder="CAD"
                      />
                    </td>
                    {/* Business Content Cell */}
                    <td rowSpan={2} style={{ width: `${BUSINESS_CONTENT_WIDTH}px` }} className="px-2 py-2 text-xs text-gray-500 text-center border-r border-b bg-white align-top p-0 group-hover:bg-gray-50">
                      <textarea
                        className="w-full h-full min-h-[50px] border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs p-2 bg-transparent resize-none"
                        value={project.type || ''}
                        onChange={(e) => handleUpdateProject(project.id, { type: e.target.value })}
                        placeholder={t('tracker.businessContent')}
                      />
                    </td>

                    {/* Plan Label */}
                    <td className="px-2 py-2 text-xs font-semibold text-gray-500 text-center border-r border-b bg-slate-50">
                      {t('tracker.planShort')}
                    </td>

                    {/* Plan Inputs */}
                    {months.map(m => {
                      const record = projRecords.find(r => r.month === m);
                      const plan = record?.planned_hours ?? 0;
                      const isSaving = savingStatus[`${project.id}-${m}-planned_hours`];

                      return (
                        <td key={`p-${m}`} className="px-0.5 py-1 border-r border-b relative" style={{ width: `${MONTH_WIDTH}px` }}>
                          <input
                            type="number"
                            className="w-full text-xs border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-right px-1 py-1 bg-white focus:bg-blue-50 transition-colors"
                            value={plan === 0 ? '' : plan}
                            placeholder="-"
                            onChange={(e) => handleValueChange(project.id, m, 'planned_hours', e.target.value)}
                          />
                          {isSaving && <Save className="w-2 h-2 absolute top-1 right-1 text-blue-500 animate-pulse" />}
                        </td>
                      );
                    })}

                    {/* Actions Cell (3-dot menu) */}
                    <td rowSpan={2} className={`px-2 py-3 text-center border-b ${stickyRightClass} align-top`} style={{ right: 0, width: `${RIGHT_ACTIONS_WIDTH}px` }}>
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === project.id ? null : project.id);
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                        </button>
                        {openMenuId === project.id && (
                          <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProjects([project.id]);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* ROW 2: Actual */}
                  <tr className="hover:bg-gray-50 group">
                    {/* Actual Label */}
                    <td className="px-2 py-2 text-xs font-bold text-blue-600 text-center border-r border-b bg-blue-50/30">
                      {t('tracker.actualShort')}
                    </td>

                    {/* Actual Inputs */}
                    {months.map(m => {
                      const record = projRecords.find(r => r.month === m);
                      const actual = record?.actual_hours ?? 0;
                      const isSaving = savingStatus[`${project.id}-${m}-actual_hours`];

                      return (
                        <td key={`a-${m}`} className="px-0.5 py-1 border-r border-b relative" style={{ width: `${MONTH_WIDTH}px` }}>
                          <input
                            type="number"
                            className={`w-full text-xs border-gray-300 rounded focus:ring-green-500 focus:border-green-500 text-right px-1 py-1 transition-colors ${actual > 0 ? 'bg-green-50 font-medium text-green-700' : 'bg-white'}`}
                            value={actual === 0 ? '' : actual}
                            placeholder="-"
                            onChange={(e) => handleValueChange(project.id, m, 'actual_hours', e.target.value)}
                          />
                          {isSaving && <Save className="w-2 h-2 absolute top-1 right-1 text-green-500 animate-pulse" />}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        </ScrollContainer>

        {filteredProjects.length === 0 && (
          <div className="p-4 sm:p-8 text-center text-gray-500 text-sm sm:text-base">
            {t('tracker.noResults')}
          </div>
        )}
      </div>
    </div>
  );
};