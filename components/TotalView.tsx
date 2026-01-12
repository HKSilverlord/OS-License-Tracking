import React, { useState, useEffect, useMemo } from 'react';
import { MonthlyRecord } from '../types';
import { dbService } from '../services/dbService';
import { exportChartToSVG, exportChartToPNG, exportChartDataToCSV, generateChartFilename, copyChartToClipboard } from '../utils/chartExport';
import { Loader2, TrendingUp, Download, Palette, Copy, Image } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, TooltipProps } from 'recharts';

interface TotalViewProps {
  currentYear: number;
}

interface ChartColors {
  plan: string;
  actual: string;
  accPlan: string;
  accActual: string;
}

export const TotalView: React.FC<TotalViewProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const [allRecords, setAllRecords] = useState<MonthlyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  // Load initial colors from localStorage or default
  const [chartColors, setChartColors] = useState<ChartColors>(() => {
    const saved = localStorage.getItem('totalView_chartColors');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved chart colors', e);
      }
    }
    return {
      plan: '#94a3b8',
      actual: '#3b82f6',
      accPlan: '#64748b',
      accActual: '#10b981'
    };
  });

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('totalView_chartColors', JSON.stringify(chartColors));
  }, [chartColors]);

  // Constants for layout
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const fetchData = async () => {
    setLoading(true);
    try {
      const recordsData = await dbService.getAllRecords(currentYear);
      setAllRecords(recordsData);
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

    // Aggregate monthly totals from all records directly
    allRecords.forEach(r => {
      if (r.month >= 1 && r.month <= 12) {
        data[r.month - 1].plan += Number(r.planned_hours) || 0;
        data[r.month - 1].actual += Number(r.actual_hours) || 0;
      }
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
  }, [allRecords, currentYear, language]);

  // Fixed Y-axis: 0-21000 with 1000 unit intervals
  const yAxisMax = 21000;
  const yAxisTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i <= yAxisMax; i += 1000) {
      ticks.push(i);
    }
    return ticks;
  }, []);

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const plan = data.plan || 0;
    const actual = data.actual || 0;
    const accPlan = data.accPlan || 0;
    const accActual = data.accActual || 0;

    // Calculate GAP
    const timeGap = accActual - accPlan;
    const percentGap = accPlan !== 0 ? ((timeGap / accPlan) * 100) : 0;

    return (
      <div className="bg-white p-3 border border-slate-300 rounded-lg shadow-lg">
        <p className="font-semibold text-slate-800 mb-2 border-b border-slate-200 pb-1">
          {data.name}
        </p>
        <div className="space-y-1.5 text-sm">
          {/* Order: 計画, 実績, 累計計画, 累計実績 */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.plan }}></div>
              <span className="text-slate-700">{t('tracker.planShort')}:</span>
            </div>
            <span className="font-medium text-slate-900">{plan.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.actual }}></div>
              <span className="text-slate-700">{t('tracker.actualShort')}:</span>
            </div>
            <span className="font-medium text-slate-900">{actual.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded border-2" style={{ borderColor: chartColors.accPlan }}></div>
              <span className="text-slate-700">{t('dashboard.chart.accPlan')}:</span>
            </div>
            <span className="font-medium text-slate-900">{accPlan.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded border-2" style={{ borderColor: chartColors.accActual }}></div>
              <span className="text-slate-700">{t('dashboard.chart.accActual')}:</span>
            </div>
            <span className="font-medium text-slate-900">{accActual.toLocaleString()}</span>
          </div>

          {/* GAP Section */}
          <div className="border-t border-slate-200 pt-2 mt-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-700 font-medium">時間 GAP:</span>
              <span className={`font-semibold ${timeGap >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {timeGap >= 0 ? '+' : ''}{timeGap.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-700 font-medium">% GAP:</span>
              <span className={`font-semibold ${percentGap >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {percentGap >= 0 ? '+' : ''}{percentGap.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 p-4 md:p-6 overflow-hidden">

      {/* 1. Chart Section - Full Page */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-md font-bold text-slate-700 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
            {t('totalView.chartTitle')} - {currentYear}
          </h3>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              title="Customize chart colors"
            >
              <Palette className="w-4 h-4" />
              Colors
            </button>
            <button
              onClick={() => copyChartToClipboard('total-view-chart')}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              title="Copy chart to clipboard (paste into PowerPoint, Word, etc.)"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
            <button
              onClick={() => exportChartToPNG('total-view-chart', generateChartFilename(`yearly_overview_${currentYear}`, 'png'))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
              title="Export as PNG image"
            >
              <Image className="w-4 h-4" />
              PNG
            </button>
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

        {/* Color Picker Section */}
        {showColorPicker && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Customize Chart Colors
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">{t('tracker.planShort')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={chartColors.plan}
                    onChange={(e) => setChartColors({ ...chartColors, plan: e.target.value })}
                    className="w-10 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={chartColors.plan}
                    onChange={(e) => setChartColors({ ...chartColors, plan: e.target.value })}
                    className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">{t('tracker.actualShort')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={chartColors.actual}
                    onChange={(e) => setChartColors({ ...chartColors, actual: e.target.value })}
                    className="w-10 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={chartColors.actual}
                    onChange={(e) => setChartColors({ ...chartColors, actual: e.target.value })}
                    className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">{t('dashboard.chart.accPlan')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={chartColors.accPlan}
                    onChange={(e) => setChartColors({ ...chartColors, accPlan: e.target.value })}
                    className="w-10 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={chartColors.accPlan}
                    onChange={(e) => setChartColors({ ...chartColors, accPlan: e.target.value })}
                    className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">{t('dashboard.chart.accActual')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={chartColors.accActual}
                    onChange={(e) => setChartColors({ ...chartColors, accActual: e.target.value })}
                    className="w-10 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={chartColors.accActual}
                    onChange={(e) => setChartColors({ ...chartColors, accActual: e.target.value })}
                    className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        <div id="total-view-chart" className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis yAxisId="left" orientation="left" fontSize={11} domain={[0, yAxisMax]} ticks={yAxisTicks} label={{ value: t('totalView.axis.monthlyHours'), angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" fontSize={11} domain={[0, yAxisMax]} ticks={yAxisTicks} label={{ value: t('totalView.axis.accumulated'), angle: 90, position: 'insideRight' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="left" dataKey="plan" name={t('tracker.planShort')} fill={chartColors.plan} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="plan" position="top" fontSize={10} formatter={(val: number) => val > 0 ? val : ''} />
              </Bar>
              <Bar yAxisId="left" dataKey="actual" name={t('tracker.actualShort')} fill={chartColors.actual} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="actual" position="top" fontSize={10} formatter={(val: number) => val > 0 ? val : ''} />
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="accPlan" name={t('dashboard.chart.accPlan')} stroke={chartColors.accPlan} strokeDasharray="5 5" dot={false} strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="accActual" name={t('dashboard.chart.accActual')} stroke={chartColors.accActual} strokeWidth={2}>
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
