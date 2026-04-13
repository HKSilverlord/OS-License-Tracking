import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Project, MonthlyRecord } from '../types';
import { dbService } from '../services/dbService';
import { formatCurrency } from '../utils/helpers';
import { TABLE_COLUMN_WIDTHS, STICKY_CLASSES } from '../utils/tableStyles';
import { exportTableToCSV, generateCSVFilename } from '../utils/csvExport';
import { Loader2, FileDown, Copy, Check } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useLanguage } from '../contexts/LanguageContext';

interface YearlyDataViewProps {
  currentYear: number;
}

export const YearlyDataView: React.FC<YearlyDataViewProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<Record<string, MonthlyRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Constants for layout
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Use shared table styling constants
  const { no: LEFT_NO_WIDTH, nameReadOnly: LEFT_NAME_WIDTH } = TABLE_COLUMN_WIDTHS;
  const { leftCell: stickyLeftClass, leftHeader: stickyLeftHeaderClass, header: stickyHeaderZ, corner: stickyCornerZ } = STICKY_CLASSES;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [periodsLabel, recordsData] = await Promise.all([
        dbService.getPeriods(),
        dbService.getAllRecords(currentYear)
      ]);

      // Identify periods belonging to this year
      // e.g. "2025-H1", "2025-H2"
      const yearPeriods = periodsLabel.filter(p => p.startsWith(currentYear.toString()));

      // Fetch projects for each relevant period
      // This ensures we get projects even if they are linked via period_projects (Shared model)
      const projectPromises = yearPeriods.map(p => dbService.getProjects(p));
      const projectsArrays = await Promise.all(projectPromises);

      // Flatten and deduplicate by ID
      const allProjects = projectsArrays.flat();
      const uniqueProjectsMap = new Map<string, Project>();
      allProjects.forEach(p => {
        if (p && p.id) uniqueProjectsMap.set(p.id, p);
      });
      const relevantProjects = Array.from(uniqueProjectsMap.values());

      // Sort projects by code
      relevantProjects.sort((a, b) => (a.code || '').localeCompare(b.code || ''));

      setProjects(relevantProjects);

      const groupedRecords: Record<string, MonthlyRecord[]> = {};
      recordsData.forEach(r => {
        if (!groupedRecords[r.project_id]) groupedRecords[r.project_id] = [];
        groupedRecords[r.project_id].push(r);
      });
      setRecords(groupedRecords);
    } catch (error) {
      console.error("Failed to load data for Yearly Data View", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear]);

  // Compute monthly totals for all projects in this year
  const monthlyTotals = useMemo(() => {
    const totals = months.map(m => {
      let planSum = 0;
      let actualSum = 0;
      projects.forEach(project => {
        const projRecords = records[project.id] || [];
        const rec = projRecords.find(r => r.month === m);
        if (rec) {
          planSum += rec.planned_hours || 0;
          actualSum += rec.actual_hours || 0;
        }
      });
      return { month: m, plan: planSum, actual: actualSum };
    });
    return totals;
  }, [projects, records]);

  // Compute accumulated (running) totals from monthlyTotals
  const accumulatedTotals = useMemo(() => {
    let runningPlan = 0;
    let runningActual = 0;
    return monthlyTotals.map(mt => {
      runningPlan += mt.plan;
      runningActual += mt.actual;
      return { month: mt.month, accPlan: runningPlan, accActual: runningActual };
    });
  }, [monthlyTotals]);

  // Listen for data updates from other tabs
  useEffect(() => {
    const handleDataUpdated = () => {
      fetchData();
    };

    window.addEventListener('dataUpdated', handleDataUpdated);
    return () => window.removeEventListener('dataUpdated', handleDataUpdated);
  }, [currentYear]);

  // CSV Export Function
  const handleExportCSV = () => {
    const headers = [
      t('tracker.code'),
      t('tracker.projectName'),
      t('totalView.tableHeader.type'),
      ...months.map(m => m.toString()),
      t('totalView.tableHeader.total'),
      t('totalView.tableHeader.revenue')
    ];

    const rows: string[][] = [];

    // Use current state 'projects' which is already filtered correctly
    projects.forEach(project => {
      const projRecords = records[project.id] || [];
      const monthlyData = months.map(m => {
        const r = projRecords.find(rec => rec.month === m);
        return { plan: r?.planned_hours || 0, actual: r?.actual_hours || 0 };
      });

      const totalPlan = monthlyData.reduce((sum, d) => sum + d.plan, 0);
      const totalActual = monthlyData.reduce((sum, d) => sum + d.actual, 0);
      const totalRevenuePlan = totalPlan * (project.plan_price || project.unit_price || 0);
      const totalRevenueActual = totalActual * (project.actual_price || project.unit_price || 0);

      // Plan row
      const planRow = [
        project.code,
        project.name,
        t('tracker.planShort'),
        ...monthlyData.map(d => d.plan > 0 ? d.plan.toString() : '-'),
        totalPlan > 0 ? totalPlan.toString() : '-',
        totalRevenuePlan > 0 ? totalRevenuePlan.toString() : '-'
      ];

      // Actual row
      const actualRow = [
        project.code,
        project.name,
        t('tracker.actualShort'),
        ...monthlyData.map(d => d.actual > 0 ? d.actual.toString() : '-'),
        totalActual > 0 ? totalActual.toString() : '-',
        totalRevenueActual > 0 ? totalRevenueActual.toString() : '-'
      ];

      rows.push(planRow);
      rows.push(actualRow);
    });

    exportTableToCSV(headers, rows, generateCSVFilename(`yearly_data_${currentYear}`));
  };

  const handleCopyImage = async () => {
    const tableElement = document.getElementById('yearly-data-table');
    if (!tableElement) return;

    setIsCopying(true);
    setCopySuccess(false);

    try {
      // Temporarily stash container styles that might cause clipping
      const container = tableElement.parentElement;
      const originalOverflow = container?.style.overflow;
      const originalMaxHeight = container?.style.maxHeight;
      if (container) {
        container.style.overflow = 'visible';
        container.style.maxHeight = 'none';
      }

      const canvas = await html2canvas(tableElement, {
        scale: 2, // High resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: tableElement.scrollWidth,
        windowHeight: tableElement.scrollHeight,
      });

      // Restore container styles
      if (container) {
        container.style.overflow = originalOverflow || '';
        container.style.maxHeight = originalMaxHeight || '';
      }

      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
          } catch (err) {
            console.error('Failed to write to clipboard:', err);
            alert('Failed to copy image to clipboard. Try saving CSV instead.');
          }
        }
      }, 'image/png', 1.0);
    } catch (err) {
      console.error('Failed to generate image:', err);
      alert('Error generating table image.');
    } finally {
      setIsCopying(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-hidden space-y-6">

      {/* Table Section */}
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <h3 className="text-md font-bold text-slate-700 dark:text-slate-100">
            {t('totalView.tableHeader.title', 'Yearly Data Table')} - {currentYear}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleCopyImage}
              disabled={isCopying}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors shadow-sm ${copySuccess
                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
            >
              {isCopying ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500 dark:text-slate-400" />
              ) : copySuccess ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              )}
              {isCopying ? 'Copying...' : copySuccess ? 'Copied!' : 'Copy Image'}
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
              title={t('buttons.exportTable', 'Export Table')}
            >
              <FileDown className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto relative isolate custom-scrollbar">
          <table id="yearly-data-table" className="w-full min-w-max border-separate border-spacing-0">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-40">
              <tr>
                <th scope="col" style={{ left: 0, width: `${LEFT_NO_WIDTH}px` }} className={`px-3 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                  {t('tracker.no')}
                </th>
                <th scope="col" style={{ left: `${LEFT_NO_WIDTH}px`, width: `${LEFT_NAME_WIDTH}px` }} className={`px-3 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                  {t('tracker.projectName')}
                </th>
                <th scope="col" className={`px-2 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800`}>
                  {t('totalView.tableHeader.type')}
                </th>

                {months.map(m => (
                  <th key={m} scope="col" className={`px-2 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-20 border-b border-r border-slate-200 dark:border-slate-700 ${stickyHeaderZ}`}>
                    {language === 'ja' ? `${m}月` : m}
                  </th>
                ))}
                <th scope="col" className={`px-2 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-l border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80`}>
                  {t('totalView.tableHeader.total')}
                </th>
                <th scope="col" className={`px-2 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-l border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20`}>
                  {t('totalView.tableHeader.revenue')}
                </th>
              </tr>

              {/* Summary Row: Plan Total */}
              <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700">
                <td style={{ left: 0, width: `${LEFT_NO_WIDTH}px` }} className={`px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 text-center border-b border-slate-300 dark:border-slate-700 ${stickyLeftHeaderClass} ${stickyCornerZ} bg-slate-100 dark:bg-slate-800`} rowSpan={4}>
                  Σ
                </td>
                <td style={{ left: `${LEFT_NO_WIDTH}px`, width: `${LEFT_NAME_WIDTH}px` }} className={`px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 ${stickyLeftHeaderClass} ${stickyCornerZ} bg-slate-100 dark:bg-slate-800`} rowSpan={4}>
                  {t('totalView.tableHeader.total', 'TOTAL')}
                </td>
                <td className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center border-r border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                  {t('tracker.planShort')}
                </td>
                {monthlyTotals.map((d, idx) => (
                  <td key={`sp-${idx}`} className="px-1 py-2 text-xs font-bold text-right text-slate-600 dark:text-slate-300 border-r border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    {d.plan > 0 ? d.plan.toLocaleString() : '-'}
                  </td>
                ))}
                <td className="px-2 py-2 border-l border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"></td>
                <td className="px-2 py-2 border-l border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"></td>
              </tr>

              {/* Summary Row: Actual Total */}
              <tr className="bg-blue-50/60 dark:bg-blue-900/30 border-b-2 border-slate-300 dark:border-slate-700">
                <td className="px-2 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 text-center border-r border-b-2 border-slate-300 dark:border-slate-700 bg-blue-50/60 dark:bg-blue-900/30">
                  {t('tracker.actualShort')}
                </td>
                {monthlyTotals.map((d, idx) => (
                  <td key={`sa-${idx}`} className="px-1 py-2 text-xs font-bold text-right text-blue-700 dark:text-blue-300 border-r border-b-2 border-slate-300 dark:border-slate-700 bg-blue-50/60 dark:bg-blue-900/30">
                    {d.actual > 0 ? d.actual.toLocaleString() : '-'}
                  </td>
                ))}
                <td className="px-2 py-2 border-l border-b-2 border-slate-300 dark:border-slate-700 bg-blue-50/60 dark:bg-blue-900/30"></td>
                <td className="px-2 py-2 border-l border-b-2 border-slate-300 dark:border-slate-700 bg-blue-50/60 dark:bg-blue-900/30"></td>
              </tr>

              {/* Summary Row: Accumulated Plan Total */}
              <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700">
                <td className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center border-r border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                  {t('tracker.planShort')} (累計)
                </td>
                {accumulatedTotals.map((d, idx) => (
                  <td key={`sap-${idx}`} className="px-1 py-2 text-xs font-bold text-right text-slate-600 dark:text-slate-300 border-r border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    {d.accPlan > 0 ? d.accPlan.toLocaleString() : '-'}
                  </td>
                ))}
                <td className="px-2 py-2 border-l border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"></td>
                <td className="px-2 py-2 border-l border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"></td>
              </tr>

              {/* Summary Row: Accumulated Actual Total */}
              <tr className="bg-blue-50/60 dark:bg-blue-900/30 border-b-2 border-slate-400 dark:border-slate-600">
                <td className="px-2 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 text-center border-r border-b-2 border-slate-400 dark:border-slate-600 bg-blue-50/60 dark:bg-blue-900/30">
                  {t('tracker.actualShort')} (累計)
                </td>
                {accumulatedTotals.map((d, idx) => (
                  <td key={`saa-${idx}`} className="px-1 py-2 text-xs font-bold text-right text-blue-700 dark:text-blue-300 border-r border-b-2 border-slate-400 dark:border-slate-600 bg-blue-50/60 dark:bg-blue-900/30">
                    {d.accActual > 0 ? d.accActual.toLocaleString() : '-'}
                  </td>
                ))}
                <td className="px-2 py-2 border-l border-b-2 border-slate-400 dark:border-slate-600 bg-blue-50/60 dark:bg-blue-900/30"></td>
                <td className="px-2 py-2 border-l border-b-2 border-slate-400 dark:border-slate-600 bg-blue-50/60 dark:bg-blue-900/30"></td>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
              {projects.map((project, index) => {
                const projRecords = records[project.id] || [];
                const monthlyData = months.map(m => {
                  const r = projRecords.find(rec => rec.month === m);
                  return { plan: r?.planned_hours || 0, actual: r?.actual_hours || 0 };
                });

                const totalPlan = monthlyData.reduce((sum, d) => sum + d.plan, 0);
                const totalActual = monthlyData.reduce((sum, d) => sum + d.actual, 0);

                const totalRevenuePlan = totalPlan * (project.plan_price || project.unit_price || 0);
                const totalRevenueActual = totalActual * (project.actual_price || project.unit_price || 0);

                return (
                  <React.Fragment key={project.id}>
                    {/* Plan Row */}
                    <tr className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td rowSpan={2} style={{ left: 0, width: `${LEFT_NO_WIDTH}px` }} className={`px-3 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 ${stickyLeftClass} align-top text-center`}>
                        {index + 1}
                      </td>
                      <td rowSpan={2} style={{ left: `${LEFT_NO_WIDTH}px`, width: `${LEFT_NAME_WIDTH}px` }} className={`px-3 py-3 text-sm text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 ${stickyLeftClass} align-top`}>
                        <div className="truncate w-44" title={project.name}>{project.name}</div>
                      </td>
                      <td className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center border-r border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        {t('tracker.planShort')}
                      </td>
                      {monthlyData.map((d, idx) => (
                        <td key={`p-${idx}`} className="px-1 py-2 text-xs text-right text-slate-500 dark:text-slate-400 border-r border-b border-slate-200 dark:border-slate-700">
                          {d.plan > 0 ? d.plan.toLocaleString() : '-'}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-right border-l border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        {totalPlan > 0 ? totalPlan.toLocaleString() : '-'}
                      </td>
                      <td className="px-2 py-2 text-xs font-bold text-amber-700 dark:text-amber-400 text-right border-l border-b border-slate-200 dark:border-slate-700 bg-amber-50/30 dark:bg-amber-900/20">
                        {totalRevenuePlan > 0 ? formatCurrency(totalRevenuePlan) : '-'}
                      </td>
                    </tr>

                    {/* Actual Row */}
                    <tr className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-2 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 text-center border-r border-b border-slate-200 dark:border-slate-700 bg-blue-50/30 dark:bg-blue-900/20">
                        {t('tracker.actualShort')}
                      </td>
                      {monthlyData.map((d, idx) => (
                        <td key={`a-${idx}`} className={`px-1 py-2 text-xs text-right border-r border-b border-slate-200 dark:border-slate-700 font-medium ${d.actual > 0 ? 'text-blue-700 dark:text-blue-400 bg-blue-50/10 dark:bg-blue-900/10' : 'text-slate-400 dark:text-slate-500'}`}>
                          {d.actual > 0 ? d.actual.toLocaleString() : '-'}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-xs font-bold text-blue-700 dark:text-blue-400 text-right border-l border-b border-slate-200 dark:border-slate-700 bg-blue-50/30 dark:bg-blue-900/20">
                        {totalActual > 0 ? totalActual.toLocaleString() : '-'}
                      </td>
                      <td className="px-2 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 text-right border-l border-b border-slate-200 dark:border-slate-700 bg-emerald-50/30 dark:bg-emerald-900/20">
                        {totalRevenueActual > 0 ? formatCurrency(totalRevenueActual) : '-'}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
