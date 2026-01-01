import React, { useState, useEffect, useMemo } from 'react';
import { Project, MonthlyRecord } from '../types';
import { dbService } from '../services/dbService';
import { exportChartToSVG, exportChartToPNG, exportChartDataToCSV, generateChartFilename } from '../utils/chartExport';
import { Loader2, TrendingUp, Download } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

interface TotalViewProps {
  currentYear: number;
}

export const TotalView: React.FC<TotalViewProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<Record<string, MonthlyRecord[]>>({});
  const [loading, setLoading] = useState(true);

  // Constants for layout
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const locale = language === 'ja' ? 'ja-JP' : language === 'vn' ? 'vi-VN' : 'en-US';
    const data = months.map(m => ({
      name: new Date(currentYear, m - 1).toLocaleString(locale, { month: 'short' }),
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
  }, [projects, records, currentYear, language]);

  // Fixed Y-axis: 0-21000 with 1000 unit intervals
  const yAxisMax = 21000;
  const yAxisTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i <= yAxisMax; i += 1000) {
      ticks.push(i);
    }
    return ticks;
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 p-4 md:p-6 overflow-hidden">

      {/* 1. Chart Section - Full Page */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-md font-bold text-slate-700 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
            {t('totalView.chartTitle')} - {currentYear}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => exportChartToSVG('total-view-chart', generateChartFilename(`yearly_overview_${currentYear}`, 'svg'))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              title="Export as SVG (vector, best quality)"
            >
              <Download className="w-4 h-4" />
              SVG
            </button>
            <button
              onClick={() => exportChartDataToCSV(chartData, generateChartFilename(`yearly_data_${currentYear}`, 'csv'))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Export chart data as CSV"
            >
              <Download className="w-4 h-4" />
              Data
            </button>
          </div>
        </div>
        <div id="total-view-chart" className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis yAxisId="left" orientation="left" fontSize={11} domain={[0, yAxisMax]} ticks={yAxisTicks} label={{ value: t('totalView.axis.monthlyHours'), angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" fontSize={11} domain={[0, yAxisMax]} ticks={yAxisTicks} label={{ value: t('totalView.axis.accumulated'), angle: 90, position: 'insideRight' }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="plan" name={t('tracker.planShort')} fill="#94a3b8" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="plan" position="top" fontSize={10} formatter={(val: number) => val > 0 ? val : ''} />
              </Bar>
              <Bar yAxisId="left" dataKey="actual" name={t('tracker.actualShort')} fill="#3b82f6" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="actual" position="top" fontSize={10} formatter={(val: number) => val > 0 ? val : ''} />
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="accPlan" name={t('dashboard.chart.accPlan')} stroke="#64748b" strokeDasharray="5 5" dot={false} strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="accActual" name={t('dashboard.chart.accActual')} stroke="#10b981" strokeWidth={2}>
                <LabelList dataKey="accActual" position="top" offset={10} fontSize={10} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Table Section Removed - check YearlyDataView.tsx */}
    </div>
  );
};
