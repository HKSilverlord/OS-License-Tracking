import React, { useState, useEffect, useMemo } from 'react';
import { Project, MonthlyRecord } from '../types';
import { dbService } from '../services/dbService';
import { formatCurrency } from '../utils/helpers';
import { TABLE_COLUMN_WIDTHS, STICKY_CLASSES } from '../utils/tableStyles';
import { exportTableToCSV, generateCSVFilename } from '../utils/csvExport';
import { Loader2, FileDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface YearlyDataViewProps {
  currentYear: number;
}

export const YearlyDataView: React.FC<YearlyDataViewProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<Record<string, MonthlyRecord[]>>({});
  const [loading, setLoading] = useState(true);

  // Constants for layout
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Use shared table styling constants
  const { codeReadOnly: LEFT_CODE_WIDTH, nameReadOnly: LEFT_NAME_WIDTH } = TABLE_COLUMN_WIDTHS;
  const { leftCell: stickyLeftClass, leftHeader: stickyLeftHeaderClass, header: stickyHeaderZ, corner: stickyCornerZ } = STICKY_CLASSES;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsData, recordsData] = await Promise.all([
        dbService.getProjects(),
        dbService.getAllRecords(currentYear) // Get all records for the year
      ]);

      // Filter projects by year (if period is set)
      const relevantProjects = projectsData.filter(p => !p.period || p.period.startsWith(currentYear.toString()));

      // Sort projects by code
      relevantProjects.sort((a, b) => a.code.localeCompare(b.code));

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
  }, [currentYear]);

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

    projects.forEach(project => {
      const projRecords = records[project.id] || [];
      const monthlyData = months.map(m => {
        const r = projRecords.find(rec => rec.month === m);
        return { plan: r?.planned_hours || 0, actual: r?.actual_hours || 0 };
      });

      const totalPlan = monthlyData.reduce((sum, d) => sum + d.plan, 0);
      const totalActual = monthlyData.reduce((sum, d) => sum + d.actual, 0);
      const totalRevenuePlan = totalPlan * (project.unit_price || 0);
      const totalRevenueActual = totalActual * (project.unit_price || 0);

      // Plan row
      rows.push([
        project.code,
        project.name,
        t('tracker.planShort'),
        ...monthlyData.map(d => d.plan > 0 ? d.plan.toString() : '-'),
        totalPlan > 0 ? totalPlan.toString() : '-',
        totalRevenuePlan > 0 ? totalRevenuePlan.toString() : '-'
      ]);

      // Actual row
      rows.push([
        project.code,
        project.name,
        t('tracker.actualShort'),
        ...monthlyData.map(d => d.actual > 0 ? d.actual.toString() : '-'),
        totalActual > 0 ? totalActual.toString() : '-',
        totalRevenueActual > 0 ? totalRevenueActual.toString() : '-'
      ]);
    });

    exportTableToCSV(headers, rows, generateCSVFilename(`yearly_data_${currentYear}`));
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 p-4 md:p-6 overflow-hidden space-y-6">

      {/* Table Section */}
      <div className="flex-1 min-h-0 flex flex-col bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gray-50">
          <h3 className="text-md font-bold text-slate-700">
            {t('totalView.tableHeader.title', 'Yearly Data Table')} - {currentYear}
          </h3>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            title={t('buttons.exportTable', 'Export Table')}
          >
            <FileDown className="w-4 h-4" />
            CSV
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto relative isolate custom-scrollbar">
          <table className="w-full min-w-max border-separate border-spacing-0">
            <thead className="bg-gray-50 sticky top-0 z-40">
              <tr>
                <th scope="col" style={{ left: 0, width: `${LEFT_CODE_WIDTH}px` }} className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                  {t('tracker.code')}
                </th>
                <th scope="col" style={{ left: `${LEFT_CODE_WIDTH}px`, width: `${LEFT_NAME_WIDTH}px` }} className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                  {t('tracker.projectName')}
                </th>
                <th scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b bg-gray-50 border-r`}>
                  {t('totalView.tableHeader.type')}
                </th>

                {months.map(m => (
                  <th key={m} scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20 border-b border-r border-gray-200 ${stickyHeaderZ}`}>
                    {language === 'ja' ? `${m}月` : m}
                  </th>
                ))}
                <th scope="col" className={`px-2 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-l bg-gray-100`}>
                  {t('totalView.tableHeader.total')}
                </th>
                <th scope="col" className={`px-2 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-l bg-amber-50`}>
                  {t('totalView.tableHeader.revenue')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {projects.map(project => {
                const projRecords = records[project.id] || [];
                const monthlyData = months.map(m => {
                  const r = projRecords.find(rec => rec.month === m);
                  return { plan: r?.planned_hours || 0, actual: r?.actual_hours || 0 };
                });

                const totalPlan = monthlyData.reduce((sum, d) => sum + d.plan, 0);
                const totalActual = monthlyData.reduce((sum, d) => sum + d.actual, 0);

                const totalRevenuePlan = totalPlan * (project.unit_price || 0);
                const totalRevenueActual = totalActual * (project.unit_price || 0);

                return (
                  <React.Fragment key={project.id}>
                    {/* Plan Row */}
                    <tr className="bg-white hover:bg-gray-50">
                      <td rowSpan={2} style={{ left: 0, width: `${LEFT_CODE_WIDTH}px` }} className={`px-3 py-3 text-sm font-medium text-gray-900 border-b ${stickyLeftClass} align-top`}>
                        {project.code}
                      </td>
                      <td rowSpan={2} style={{ left: `${LEFT_CODE_WIDTH}px`, width: `${LEFT_NAME_WIDTH}px` }} className={`px-3 py-3 text-sm text-gray-500 border-b ${stickyLeftClass} align-top`}>
                        <div className="truncate w-44" title={project.name}>{project.name}</div>
                      </td>
                      <td className="px-2 py-2 text-xs font-semibold text-gray-500 text-center border-r border-b bg-slate-50">
                        {t('tracker.planShort')}
                      </td>
                      {monthlyData.map((d, idx) => (
                        <td key={`p-${idx}`} className="px-1 py-2 text-xs text-right text-gray-500 border-r border-b">
                          {d.plan > 0 ? d.plan.toLocaleString() : '-'}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-xs font-bold text-gray-700 text-right border-l border-b bg-slate-50">
                        {totalPlan > 0 ? totalPlan.toLocaleString() : '-'}
                      </td>
                      <td className="px-2 py-2 text-xs font-bold text-amber-700 text-right border-l border-b bg-amber-50/30">
                        {totalRevenuePlan > 0 ? formatCurrency(totalRevenuePlan) : '-'}
                      </td>
                    </tr>

                    {/* Actual Row */}
                    <tr className="bg-white hover:bg-gray-50">
                      <td className="px-2 py-2 text-xs font-bold text-blue-600 text-center border-r border-b bg-blue-50/30">
                        {t('tracker.actualShort')}
                      </td>
                      {monthlyData.map((d, idx) => (
                        <td key={`a-${idx}`} className={`px-1 py-2 text-xs text-right border-r border-b font-medium ${d.actual > 0 ? 'text-blue-700 bg-blue-50/10' : 'text-gray-400'}`}>
                          {d.actual > 0 ? d.actual.toLocaleString() : '-'}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-xs font-bold text-blue-700 text-right border-l border-b bg-blue-50/30">
                        {totalActual > 0 ? totalActual.toLocaleString() : '-'}
                      </td>
                      <td className="px-2 py-2 text-xs font-bold text-emerald-700 text-right border-l border-b bg-emerald-50/30">
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
