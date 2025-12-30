import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Project, MonthlyRecord, PeriodType } from '../types';
import { dbService } from '../services/dbService';
import { getMonthsForPeriod, formatCurrency } from '../utils/helpers';
import { TABLE_COLUMN_WIDTHS, STICKY_CLASSES, calculateLeftPosition, calculateRightPosition } from '../utils/tableStyles';
import { Save, Loader2, Trash2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface TrackingViewProps {
  currentPeriodLabel: string; // e.g. "2024-H1"
  searchQuery: string;
}

export const TrackingView: React.FC<TrackingViewProps> = ({ currentPeriodLabel, searchQuery }) => {
  const { t, language } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<Record<string, MonthlyRecord[]>>({}); // Key: ProjectId
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({}); // Key: `${projectId}-${month}-${field}`
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Debounce refs
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

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

  const allFilteredSelected = filteredProjects.length > 0 && filteredProjects.every(p => selectedIds.includes(p.id));
  const hasSelection = selectedIds.length > 0;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsData, recordsData] = await Promise.all([
        dbService.getProjects(),
        dbService.getRecords(currentPeriodLabel)
      ]);

      // Sort projects by code
      projectsData.sort((a, b) => a.code.localeCompare(b.code));

      setProjects(projectsData);

      const groupedRecords: Record<string, MonthlyRecord[]> = {};
      recordsData.forEach(r => {
        if (!groupedRecords[r.project_id]) groupedRecords[r.project_id] = [];
        groupedRecords[r.project_id].push(r);
      });
      setRecords(groupedRecords);
      setSelectedIds(prev => prev.filter(id => projectsData.some(p => p.id === id)));
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  }, [currentPeriodLabel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cleanup debounce timers on unmount and period change
  useEffect(() => {
    return () => {
      // Clear all pending timers on unmount
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
      debounceTimers.current = {};
    };
  }, []);

  useEffect(() => {
    // Clear all pending timers when period changes
    Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
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

  const toggleSelect = (projectId: string) => {
    setSelectedIds(prev => prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]);
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredProjects.some(p => p.id === id)));
    } else {
      const idsToAdd = filteredProjects.map(p => p.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
    }
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
      setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    } catch (error) {
      console.error("Failed to delete projects", error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  // Use shared table styling constants
  const { select: LEFT_SELECT_WIDTH, code: LEFT_CODE_WIDTH, name: LEFT_NAME_WIDTH, price: LEFT_PRICE_WIDTH, totalHrs: RIGHT_TOTAL_HRS_WIDTH, totalRev: RIGHT_TOTAL_REV_WIDTH } = TABLE_COLUMN_WIDTHS;

  const { leftCell: stickyLeftClass, leftHeader: stickyLeftHeaderClass, rightCell: stickyRightClass, rightHeader: stickyRightHeaderClass, header: stickyHeaderZ, corner: stickyCornerZ } = STICKY_CLASSES;

  return (
    <div className="flex flex-col h-full bg-slate-50 p-4 md:p-6 overflow-hidden">
      <div className="flex-1 min-h-0 w-full overflow-auto border rounded-lg shadow-sm bg-white relative isolate custom-scrollbar">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-white">
          <div className="text-sm text-gray-600">
            {t('tracker.selectedLabel')}: <span className="font-semibold text-gray-800">{selectedIds.length}</span> / {filteredProjects.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={filteredProjects.length === 0}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {allFilteredSelected ? t('tracker.clearSelection') : t('tracker.selectAll')}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteProjects(selectedIds)}
              disabled={!hasSelection || deleting}
              className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center shadow-sm"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('tracker.deleteSelected')}{hasSelection ? ` (${selectedIds.length})` : ''}
            </button>
          </div>
        </div>

        <table className="w-full min-w-max border-separate border-spacing-0">
          <thead className="bg-gray-50 sticky top-0 z-40">
            <tr>
              {/* Frozen Left Columns */}
              <th scope="col" style={{ left: 0, width: `${LEFT_SELECT_WIDTH}px` }} className={`px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  disabled={filteredProjects.length === 0}
                />
              </th>
              <th scope="col" style={{ left: `${LEFT_SELECT_WIDTH}px`, width: `${LEFT_CODE_WIDTH}px` }} className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>{t('tracker.code')}</th>
              <th scope="col" style={{ left: `${LEFT_SELECT_WIDTH + LEFT_CODE_WIDTH}px`, width: `${LEFT_NAME_WIDTH}px` }} className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>{t('tracker.projectName')}</th>
              <th scope="col" style={{ left: `${LEFT_SELECT_WIDTH + LEFT_CODE_WIDTH + LEFT_NAME_WIDTH}px`, width: `${LEFT_PRICE_WIDTH}px` }} className={`px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>{t('tracker.unitPrice')}</th>

              <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16 border-b border-r bg-gray-50">Type</th>

              {/* Scrollable Month Columns */}
              {months.map(m => (
                <th key={m} scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24 border-b border-r border-gray-200 ${stickyHeaderZ}`}>
                  {formatMonthLabel(m)}
                </th>
              ))}

              {/* Frozen Right Columns (Totals) */}
              <th scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-l border-b bg-gray-100 ${stickyRightHeaderClass} ${stickyCornerZ}`} style={{ right: `${RIGHT_TOTAL_REV_WIDTH}px`, width: `${RIGHT_TOTAL_HRS_WIDTH}px` }}>Total Hrs</th>
              <th scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-l border-b bg-gray-100 ${stickyRightHeaderClass} ${stickyCornerZ}`} style={{ right: 0, width: `${RIGHT_TOTAL_REV_WIDTH}px` }}>Revenue</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProjects.map(project => {
              const projRecords = records[project.id] || [];
              const totalPlannedHrs = projRecords.reduce((sum, r) => sum + (r.planned_hours || 0), 0);
              const totalActualHrs = projRecords.reduce((sum, r) => sum + (r.actual_hours || 0), 0);
              const totalPlannedRev = totalPlannedHrs * project.unit_price;
              const totalActualRev = totalActualHrs * project.unit_price;

              return (
                <React.Fragment key={project.id}>
                  {/* ROW 1: Plan */}
                  <tr className="hover:bg-gray-50 group">
                    <td rowSpan={2} style={{ left: 0, width: `${LEFT_SELECT_WIDTH}px` }} className={`px-3 py-3 text-center ${stickyLeftClass} align-top`}>
                      <div className="flex items-center justify-center h-full gap-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                          checked={selectedIds.includes(project.id)}
                          onChange={() => toggleSelect(project.id)}
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteProjects([project.id])}
                          disabled={deleting}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td rowSpan={2} style={{ left: `${LEFT_SELECT_WIDTH}px`, width: `${LEFT_CODE_WIDTH}px` }} className={`px-3 py-3 text-sm font-medium text-gray-900 ${stickyLeftClass} align-top`}>
                      {project.code}
                    </td>
                    <td rowSpan={2} style={{ left: `${LEFT_SELECT_WIDTH + LEFT_CODE_WIDTH}px`, width: `${LEFT_NAME_WIDTH}px` }} className={`px-3 py-3 text-sm text-gray-500 ${stickyLeftClass} align-top`}>
                      <div className="truncate w-44" title={project.name}>{project.name}</div>
                    </td>
                    <td rowSpan={2} style={{ left: `${LEFT_SELECT_WIDTH + LEFT_CODE_WIDTH + LEFT_NAME_WIDTH}px`, width: `${LEFT_PRICE_WIDTH}px` }} className={`px-3 py-3 text-sm text-gray-500 text-center ${stickyLeftClass} align-top`}>
                      {project.unit_price.toLocaleString()}
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
                        <td key={`p-${m}`} className="px-1 py-1 border-r border-b relative">
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

                    {/* Plan Totals */}
                    <td style={{ right: `${RIGHT_TOTAL_REV_WIDTH}px` }} className={`px-2 py-2 text-xs font-medium text-gray-600 text-right border-l border-b bg-gray-50 ${stickyRightClass}`}>
                      {totalPlannedHrs > 0 ? totalPlannedHrs.toLocaleString() : '-'}
                    </td>
                    <td style={{ right: 0 }} className={`px-2 py-2 text-xs text-gray-500 text-right border-l border-b bg-gray-50 ${stickyRightClass}`}>
                      {totalPlannedRev > 0 ? formatCurrency(totalPlannedRev) : '-'}
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
                        <td key={`a-${m}`} className="px-1 py-1 border-r border-b relative">
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

                    {/* Actual Totals */}
                    <td style={{ right: `${RIGHT_TOTAL_REV_WIDTH}px` }} className={`px-2 py-2 text-xs font-bold text-gray-900 text-right border-l border-b bg-green-50/30 ${stickyRightClass}`}>
                      {totalActualHrs > 0 ? totalActualHrs.toLocaleString() : '-'}
                    </td>
                    <td style={{ right: 0 }} className={`px-2 py-2 text-xs font-bold text-gray-900 text-right border-l border-b bg-green-50/30 ${stickyRightClass}`}>
                      {totalActualRev > 0 ? formatCurrency(totalActualRev) : '-'}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filteredProjects.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            {t('tracker.noResults')}
          </div>
        )}
      </div>
    </div>
  );
};