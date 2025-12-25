import React, { useState, useEffect, useMemo } from 'react';
import { Project, MonthlyRecord } from '../types';
import { dbService } from '../services/dbService';
import { formatCurrency } from '../utils/helpers';
import { Loader2, TrendingUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

interface TotalViewProps {
  currentYear: number;
}

export const TotalView: React.FC<TotalViewProps> = ({ currentYear }) => {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<Record<string, MonthlyRecord[]>>({});
  const [loading, setLoading] = useState(true);

  // Constants for layout
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const LEFT_CODE_WIDTH = 100;
  const LEFT_NAME_WIDTH = 200;
  
  const stickyLeftClass = "sticky left-0 bg-white z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]";
  const stickyLeftHeaderClass = "sticky left-0 bg-gray-50 z-30 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]";
  const stickyHeaderZ = "z-40";
  const stickyCornerZ = "z-50";

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [projectsData, recordsData] = await Promise.all([
          dbService.getProjects(),
          dbService.getAllRecords(currentYear) // Get all records for the year
        ]);
        setProjects(projectsData);

        const groupedRecords: Record<string, MonthlyRecord[]> = {};
        recordsData.forEach(r => {
          if (!groupedRecords[r.project_id]) groupedRecords[r.project_id] = [];
          groupedRecords[r.project_id].push(r);
        });
        setRecords(groupedRecords);
      } catch (error) {
        console.error("Failed to load data for Total View", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentYear]);

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const data = months.map(m => ({
      name: new Date(currentYear, m - 1).toLocaleString('en-US', { month: 'short' }),
      month: m,
      plan: 0,
      actual: 0,
      accPlan: 0,
      accActual: 0
    }));

    // Aggregate monthly totals
    projects.forEach(p => {
      const projRecords = records[p.id] || [];
      projRecords.forEach(r => {
        if (r.month >= 1 && r.month <= 12) {
          data[r.month - 1].plan += Number(r.planned_hours) || 0;
          data[r.month - 1].actual += Number(r.actual_hours) || 0;
        }
      });
    });

    // Calculate accumulations
    let runningPlan = 0;
    let runningActual = 0;
    data.forEach(d => {
      runningPlan += d.plan;
      runningActual += d.actual;
      d.accPlan = runningPlan;
      d.accActual = runningActual;
    });

    return data;
  }, [projects, records, currentYear]);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-600"/></div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 p-4 md:p-6 overflow-hidden space-y-6">
      
      {/* 1. Chart Section */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-96 flex flex-col shrink-0">
         <h3 className="text-md font-bold text-slate-700 mb-2 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
            {t('totalView.chartTitle', `Yearly Overview - ${currentYear}`)}
         </h3>
         <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis yAxisId="left" orientation="left" fontSize={11} label={{ value: 'Monthly Hours', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" fontSize={11} label={{ value: 'Accumulated', angle: 90, position: 'insideRight' }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="plan" name={t('tracker.planShort', 'Plan')} fill="#94a3b8" radius={[4, 4, 0, 0]}>
                   <LabelList dataKey="plan" position="top" fontSize={10} formatter={(val:number) => val > 0 ? val : ''} />
                </Bar>
                <Bar yAxisId="left" dataKey="actual" name={t('tracker.actualShort', 'Actual')} fill="#3b82f6" radius={[4, 4, 0, 0]}>
                   <LabelList dataKey="actual" position="top" fontSize={10} formatter={(val:number) => val > 0 ? val : ''} />
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="accPlan" name={t('dashboard.chart.accPlan', 'Acc. Plan')} stroke="#64748b" strokeDasharray="5 5" dot={false} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="accActual" name={t('dashboard.chart.accActual', 'Acc. Actual')} stroke="#10b981" strokeWidth={2}>
                    <LabelList dataKey="accActual" position="top" offset={10} fontSize={10} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
         </div>
      </div>

      {/* 2. Table Section */}
      <div className="flex-1 min-h-0 w-full overflow-auto border rounded-lg shadow-sm bg-white relative isolate custom-scrollbar">
        <table className="min-w-max border-separate border-spacing-0">
          <thead className="bg-gray-50 sticky top-0 z-40">
            <tr>
              <th scope="col" style={{left: 0, width: `${LEFT_CODE_WIDTH}px`}} className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                {t('tracker.code')}
              </th>
              <th scope="col" style={{left: `${LEFT_CODE_WIDTH}px`, width: `${LEFT_NAME_WIDTH}px`}} className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                {t('tracker.projectName')}
              </th>
              <th scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b bg-gray-50 border-r`}>
                Type
              </th>
              
              {months.map(m => (
                <th key={m} scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20 border-b border-r border-gray-200 ${stickyHeaderZ}`}>
                   {m}
                </th>
              ))}
               <th scope="col" className={`px-2 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-l bg-gray-100`}>
                 Total
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

              return (
                <React.Fragment key={project.id}>
                  {/* Plan Row */}
                  <tr className="bg-white hover:bg-gray-50">
                    <td rowSpan={2} style={{left: 0, width: `${LEFT_CODE_WIDTH}px`}} className={`px-3 py-3 text-sm font-medium text-gray-900 border-b ${stickyLeftClass} align-top`}>
                      {project.code}
                    </td>
                    <td rowSpan={2} style={{left: `${LEFT_CODE_WIDTH}px`, width: `${LEFT_NAME_WIDTH}px`}} className={`px-3 py-3 text-sm text-gray-500 border-b ${stickyLeftClass} align-top`}>
                       <div className="truncate w-44" title={project.name}>{project.name}</div>
                    </td>
                    <td className="px-2 py-2 text-xs font-semibold text-gray-500 text-center border-r border-b bg-slate-50">
                      {t('tracker.planShort', 'Plan')}
                    </td>
                    {monthlyData.map((d, idx) => (
                      <td key={`p-${idx}`} className="px-1 py-2 text-xs text-right text-gray-500 border-r border-b">
                        {d.plan > 0 ? d.plan.toLocaleString() : '-'}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-xs font-bold text-gray-700 text-right border-l border-b bg-slate-50">
                       {totalPlan > 0 ? totalPlan.toLocaleString() : '-'}
                    </td>
                  </tr>
                  
                  {/* Actual Row */}
                  <tr className="bg-white hover:bg-gray-50">
                    <td className="px-2 py-2 text-xs font-bold text-blue-600 text-center border-r border-b bg-blue-50/30">
                      {t('tracker.actualShort', 'Actual')}
                    </td>
                    {monthlyData.map((d, idx) => (
                      <td key={`a-${idx}`} className={`px-1 py-2 text-xs text-right border-r border-b font-medium ${d.actual > 0 ? 'text-blue-700 bg-blue-50/10' : 'text-gray-400'}`}>
                        {d.actual > 0 ? d.actual.toLocaleString() : '-'}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-xs font-bold text-blue-700 text-right border-l border-b bg-blue-50/30">
                       {totalActual > 0 ? totalActual.toLocaleString() : '-'}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
