
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Project, MonthlyRecord, PeriodType } from '../types';
import { dbService } from '../services/dbService';
import { getMonthsForPeriod, formatCurrency } from '../utils/helpers';
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
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

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
      setProjects(projectsData);
      
      // Group records by project ID
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

  const handleValueChange = async (
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

    setSavingId(`${projectId}-${month}-${field}`);
    try {
      await dbService.upsertRecord({
        project_id: projectId,
        period_label: currentPeriodLabel,
        year,
        month,
        [field]: numValue
      });
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSavingId(null);
    }
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
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-600"/></div>;
  }

  // Sticky Positioning Constants
  // Left Columns Widths: Select (16/64px), Code (28/112px), Name (48/192px), Price (24/96px)
  const LEFT_SELECT_WIDTH = 64;
  const LEFT_1_WIDTH = 112; 
  const LEFT_2_WIDTH = 192;
  const LEFT_3_WIDTH = 96;
  
  // Right Columns Widths: Rev Act (28/112px), Rev Plan (28/112px), Hrs Act (24/96px), Hrs Plan (24/96px)
  const RIGHT_1_WIDTH = 112; 
  const RIGHT_2_WIDTH = 112;
  const RIGHT_3_WIDTH = 96;
  const RIGHT_4_WIDTH = 96;

  // CSS for Sticky Columns
  const stickyLeftClass = "sticky left-0 bg-white z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]";
  const stickyLeftHeaderClass = "sticky left-0 bg-gray-50 z-30 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]";
  
  const stickyRightClass = "sticky right-0 bg-white z-20 border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]";
  const stickyRightHeaderClass = "sticky right-0 bg-gray-50 z-30 border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]";

  // Header needs higher Z-index than cells
  const stickyHeaderZ = "z-40";
  const stickyCornerZ = "z-50";

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
        <table className="min-w-max border-separate border-spacing-0">
          <thead className="bg-gray-50 sticky top-0 z-40">
            <tr>
              {/* Frozen Left Columns */}
              <th scope="col" style={{left: 0, width: `${LEFT_SELECT_WIDTH}px`}} className={`px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                <input 
                  type="checkbox" 
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  disabled={filteredProjects.length === 0}
                  title={t('tracker.select')}
                />
              </th>
              <th scope="col" style={{left: `${LEFT_SELECT_WIDTH}px`, width: `${LEFT_1_WIDTH}px`}} className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>{t('tracker.code')}</th>
              <th scope="col" style={{left: `${LEFT_SELECT_WIDTH + LEFT_1_WIDTH}px`, width: `${LEFT_2_WIDTH}px`}} className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>{t('tracker.projectName')}</th>
              <th scope="col" style={{left: `${LEFT_SELECT_WIDTH + LEFT_1_WIDTH + LEFT_2_WIDTH}px`, width: `${LEFT_3_WIDTH}px`}} className={`px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>{t('tracker.unitPrice')}</th>
              
              {/* Scrollable Month Columns */}
              {months.map(m => (
                <th key={m} scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32 border-b border-l border-gray-200 ${stickyHeaderZ}`}>
                  {formatMonthLabel(m)}<br/>
                  <span className="text-[10px] text-gray-400">{t('tracker.monthSubLabel')}</span>
                </th>
              ))}

              {/* Frozen Right Columns (Totals) */}
              <th scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-l border-b bg-blue-50/90 ${stickyRightHeaderClass} ${stickyCornerZ}`} style={{right: `${RIGHT_1_WIDTH + RIGHT_2_WIDTH + RIGHT_3_WIDTH}px`, width: `${RIGHT_4_WIDTH}px`}}>{t('tracker.totalHrsPlan')}</th>
              <th scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-l border-b bg-green-50/90 ${stickyRightHeaderClass} ${stickyCornerZ}`} style={{right: `${RIGHT_1_WIDTH + RIGHT_2_WIDTH}px`, width: `${RIGHT_3_WIDTH}px`}}>{t('tracker.totalHrsActual')}</th>
              <th scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-l border-b bg-blue-50/90 ${stickyRightHeaderClass} ${stickyCornerZ}`} style={{right: `${RIGHT_1_WIDTH}px`, width: `${RIGHT_2_WIDTH}px`}}>{t('tracker.revenuePlan')}</th>
              <th scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-l border-b bg-green-50/90 ${stickyRightHeaderClass} ${stickyCornerZ}`} style={{right: 0, width: `${RIGHT_1_WIDTH}px`}}>{t('tracker.revenueActual')}</th>
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
                <tr key={project.id} className="hover:bg-gray-50 group">
                  {/* Frozen Left Cells */}
                  <td style={{left: 0, width: `${LEFT_SELECT_WIDTH}px`}} className={`px-3 py-3 whitespace-nowrap text-sm text-gray-500 ${stickyLeftClass}`}>
                    <div className="flex items-center gap-2">
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
                        className="text-red-500 hover:text-red-700 disabled:opacity-60"
                        title={t('tracker.deleteSingle')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td style={{left: `${LEFT_SELECT_WIDTH}px`, width: `${LEFT_1_WIDTH}px`}} className={`px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 ${stickyLeftClass}`}>{project.code}</td>
                  <td style={{left: `${LEFT_SELECT_WIDTH + LEFT_1_WIDTH}px`, width: `${LEFT_2_WIDTH}px`}} className={`px-3 py-4 whitespace-nowrap text-sm text-gray-500 ${stickyLeftClass}`} title={project.name}>
                      <div className="truncate w-40">{project.name}</div>
                  </td>
                  <td style={{left: `${LEFT_SELECT_WIDTH + LEFT_1_WIDTH + LEFT_2_WIDTH}px`, width: `${LEFT_3_WIDTH}px`}} className={`px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-center ${stickyLeftClass}`}>{project.unit_price.toLocaleString()}</td>
                  
                  {/* Month Cells */}
                  {months.map(m => {
                    const record = projRecords.find(r => r.month === m);
                    const plan = record?.planned_hours ?? 0;
                    const actual = record?.actual_hours ?? 0;
                    const isSavingP = savingId === `${project.id}-${m}-planned_hours`;
                    const isSavingA = savingId === `${project.id}-${m}-actual_hours`;

                    return (
                      <td key={m} className="px-1 py-2 whitespace-nowrap border-l border-gray-100 align-middle">
                        <div className="flex space-x-1">
                          <div className="relative flex-1">
                             <input 
                              type="number"
                              className="w-full text-xs border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-right px-1 py-1 bg-blue-50/30 focus:bg-white transition-colors"
                              value={plan === 0 ? '' : plan}
                              placeholder="-"
                              onChange={(e) => handleValueChange(project.id, m, 'planned_hours', e.target.value)}
                            />
                            {isSavingP && <Save className="w-2 h-2 absolute top-1 right-1 text-blue-500 animate-pulse" />}
                          </div>
                          <div className="relative flex-1">
                            <input 
                              type="number" 
                              className={`w-full text-xs border-gray-300 rounded focus:ring-green-500 focus:border-green-500 text-right px-1 py-1 transition-colors ${actual > 0 ? 'bg-green-50 font-medium border-green-200' : 'bg-white'}`}
                              value={actual === 0 ? '' : actual}
                              placeholder="-"
                              onChange={(e) => handleValueChange(project.id, m, 'actual_hours', e.target.value)}
                            />
                             {isSavingA && <Save className="w-2 h-2 absolute top-1 right-1 text-green-500 animate-pulse" />}
                          </div>
                        </div>
                      </td>
                    );
                  })}

                  {/* Frozen Right Cells (Totals) */}
                  <td style={{right: `${RIGHT_1_WIDTH + RIGHT_2_WIDTH + RIGHT_3_WIDTH}px`}} className={`px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-600 text-right bg-blue-50/50 ${stickyRightClass}`}>
                      {totalPlannedHrs > 0 ? totalPlannedHrs.toLocaleString() : '-'}
                  </td>
                  <td style={{right: `${RIGHT_1_WIDTH + RIGHT_2_WIDTH}px`}} className={`px-2 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right bg-green-50/50 ${stickyRightClass}`}>
                      {totalActualHrs > 0 ? totalActualHrs.toLocaleString() : '-'}
                  </td>
                  <td style={{right: `${RIGHT_1_WIDTH}px`}} className={`px-2 py-4 whitespace-nowrap text-xs text-gray-500 text-right bg-blue-50/50 ${stickyRightClass}`}>
                      {totalPlannedRev > 0 ? formatCurrency(totalPlannedRev) : '-'}
                  </td>
                  <td style={{right: 0}} className={`px-2 py-4 whitespace-nowrap text-xs font-bold text-gray-900 text-right bg-green-50/50 ${stickyRightClass}`}>
                      {totalActualRev > 0 ? formatCurrency(totalActualRev) : '-'}
                  </td>
                </tr>
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
