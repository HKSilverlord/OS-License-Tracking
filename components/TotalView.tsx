import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MonthlyRecord } from '../types';
import { dbService } from '../services/dbService';
import { exportChartToSVG, exportChartToPNG, exportChartDataToCSV, generateChartFilename, copyChartToClipboard } from '../utils/chartExport';
import { Loader2, TrendingUp, Download, Palette, Copy, Image } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, TooltipProps, ReferenceArea, ReferenceLine } from 'recharts';

interface TotalViewProps {
  currentYear: number;
}

interface SeriesStyle {
  color: string;
  opacity: number;
  labelColor: string;
  fontSize: number;
  bold: boolean;
  stroke: boolean;
}

interface ChartColors {
  plan: SeriesStyle;
  actual: SeriesStyle;
  accPlan: SeriesStyle;
  accActual: SeriesStyle;
}

export const TotalView: React.FC<TotalViewProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const [allRecords, setAllRecords] = useState<MonthlyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pinnedMonth, setPinnedMonth] = useState<number | null>(null);
  const columnCoordsRef = useRef<Record<number, number>>({});
  
  // Load initial colors from localStorage or default
  const [chartColors, setChartColors] = useState<ChartColors>(() => {
    const saved = localStorage.getItem('totalView_chartColors');
    const defaults: ChartColors = {
      plan: { color: '#94a3b8', opacity: 1, labelColor: '#64748b', fontSize: 10, bold: true, stroke: false },
      actual: { color: '#3b82f6', opacity: 1, labelColor: '#1d4ed8', fontSize: 10, bold: true, stroke: false },
      accPlan: { color: '#64748b', opacity: 1, labelColor: '#64748b', fontSize: 10, bold: false, stroke: false },
      accActual: { color: '#10b981', opacity: 1, labelColor: '#059669', fontSize: 12, bold: true, stroke: true },
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration: if old format (string), convert to SeriesStyle
        if (typeof parsed.plan === 'string') {
          return {
            plan: { ...defaults.plan, color: parsed.plan },
            actual: { ...defaults.actual, color: parsed.actual },
            accPlan: { ...defaults.accPlan, color: parsed.accPlan },
            accActual: { ...defaults.accActual, color: parsed.accActual },
          };
        }
        // Merge to pick up any new fields added since last save
        return {
          plan: { ...defaults.plan, ...parsed.plan },
          actual: { ...defaults.actual, ...parsed.actual },
          accPlan: { ...defaults.accPlan, ...parsed.accPlan },
          accActual: { ...defaults.accActual, ...parsed.accActual },
        };
      } catch (e) {
        console.error('Failed to parse saved chart colors', e);
      }
    }
    return defaults;
  });

  const updateColor = (key: keyof ChartColors, field: keyof SeriesStyle, value: any) => {
    setChartColors(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  // Current month highlight
  const currentMonth = new Date().getFullYear() === currentYear ? new Date().getMonth() + 1 : null;
  const [showCurrentMonth, setShowCurrentMonth] = useState(true);

  // Custom outlined label renderer
  const OutlinedLabel = ({ x, y, value, dataKey, width = 0 }: any) => {
    if (!value || value === 0) return null;
    const style = (chartColors as any)[dataKey] as SeriesStyle;
    if (!style) return null;
    const tx = typeof x === 'number' && typeof width === 'number' ? x + width / 2 : x;
    const formatted = typeof value === 'number' && value > 999 ? value.toLocaleString() : value;
    return (
      <g>
        {style.stroke && (
          <text x={tx} y={y - 4} textAnchor="middle" fontSize={style.fontSize} fontWeight="bold" stroke="white" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke">
            {formatted}
          </text>
        )}
        <text x={tx} y={y - 4} textAnchor="middle" fontSize={style.fontSize} fontWeight={style.bold ? 'bold' : 'normal'} fill={style.labelColor}>
          {formatted}
        </text>
      </g>
    );
  };

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

  // Dynamic Y-axis max based on max accumulated values
  const { yAxisMax, yAxisTicks } = useMemo(() => {
    const maxPlan = Math.max(0, ...chartData.map(d => d.accPlan || 0));
    const maxActual = Math.max(0, ...chartData.map(d => d.accActual || 0));
    const max = Math.max(maxPlan, maxActual);
    const maxLimit = max > 0 ? Math.ceil(max / 1000) * 1000 + 1000 : 20000;
    
    const ticks = [];
    const step = Math.ceil(maxLimit / 10 / 1000) * 1000 || 1000;
    for (let i = 0; i <= maxLimit; i += step) {
      ticks.push(i);
    }
    return { yAxisMax: maxLimit, yAxisTicks: ticks };
  }, [chartData]);

  // Reusable Detail Card Component
  const MonthDetailCard = ({ data, hideShadow = false }: { data: any; hideShadow?: boolean }) => {
    const plan = data.plan || 0;
    const actual = data.actual || 0;
    const accPlan = data.accPlan || 0;
    const accActual = data.accActual || 0;

    const timeGap = accActual - accPlan;
    const percentGap = accPlan !== 0 ? ((timeGap / accPlan) * 100) : 0;

    return (
      <div className={`bg-white dark:bg-slate-900 p-3 border border-slate-300 dark:border-slate-700 rounded-lg min-w-[200px] ${hideShadow ? '' : 'shadow-lg'}`}>
        <p className="font-semibold text-slate-800 dark:text-slate-100 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">
          {data.name}
        </p>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.plan.color }}></div>
              <span className="text-slate-700 dark:text-slate-400">{t('tracker.planShort')}:</span>
            </div>
            <span className="font-medium text-slate-900 dark:text-slate-100">{plan.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.actual.color }}></div>
              <span className="text-slate-700 dark:text-slate-400">{t('tracker.actualShort')}:</span>
            </div>
            <span className="font-medium text-slate-900 dark:text-slate-100">{actual.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded border-2" style={{ borderColor: chartColors.accPlan.color }}></div>
              <span className="text-slate-700 dark:text-slate-400">{t('dashboard.chart.accPlan')}:</span>
            </div>
            <span className="font-medium text-slate-900 dark:text-slate-100">{accPlan.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded border-2" style={{ borderColor: chartColors.accActual.color }}></div>
              <span className="text-slate-700 dark:text-slate-400">{t('dashboard.chart.accActual')}:</span>
            </div>
            <span className="font-medium text-slate-900 dark:text-slate-100">{accActual.toLocaleString()}</span>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-700 dark:text-slate-400 font-medium">時間 GAP:</span>
              <span className={`font-semibold ${timeGap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {timeGap >= 0 ? '+' : ''}{timeGap.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-700 dark:text-slate-400 font-medium">% GAP:</span>
              <span className={`font-semibold ${percentGap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {percentGap >= 0 ? '+' : ''}{percentGap.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Custom Tooltip Wrapper
  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;
    return <MonthDetailCard data={data} />;
  };

  // Custom bar to capture coordinates
  const TrackingBar = (props: any) => {
    const { fill, x, y, width, height, payload, fillOpacity } = props;
    if (payload?.month) {
      columnCoordsRef.current[payload.month] = x + width / 2;
    }
    const r = 4;
    const path = `M${x},${y+height} L${x},${y+r} A${r},${r} 0 0,1 ${x+r},${y} L${x+width-r},${y} A${r},${r} 0 0,1 ${x+width},${y+r} L${x+width},${y+height} Z`;
    const d = height < r ? `M${x},${y} L${x+width},${y} L${x+width},${y+height} L${x},${y+height} Z` : path;
    return <path d={d} stroke="none" fill={fill} fillOpacity={fillOpacity} />;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-hidden">

      {/* 1. Chart Section - Full Page */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-md font-bold text-slate-700 dark:text-slate-100 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
            {t('totalView.chartTitle')} - {currentYear}
          </h3>
          <div className="flex gap-2 flex-wrap items-center">
            <select
              className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 outline-none"
              value={pinnedMonth ?? ""}
              onChange={(e) => {
                const month = e.target.value ? Number(e.target.value) : null;
                setPinnedMonth(month);
              }}
            >
              <option value="">{t('tracker.selectMonth', '月を選択...')}</option>
              {chartData.map((d) => (
                <option key={d.month} value={d.month}>
                  {d.name}
                </option>
              ))}
            </select>
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
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Customize Chart Colors
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {([
                { key: 'plan', label: t('tracker.planShort') },
                { key: 'actual', label: t('tracker.actualShort') },
                { key: 'accPlan', label: t('dashboard.chart.accPlan') },
                { key: 'accActual', label: t('dashboard.chart.accActual') },
              ] as const).map(({ key, label }) => {
                const style = chartColors[key];
                return (
                  <div key={key} className="flex flex-col gap-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{label}</label>

                    {/* Color Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-8">Color</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="color" value={style.color} onChange={(e) => updateColor(key, 'color', e.target.value)} className="w-6 h-6 rounded cursor-pointer p-0 border-0" />
                        <input type="text" value={style.color} onChange={(e) => updateColor(key, 'color', e.target.value)} className="flex-1 w-full px-1 py-0.5 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded" />
                      </div>
                    </div>

                    {/* Opacity Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-8">Alpha</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="range" min="0" max="1" step="0.1" value={style.opacity} onChange={(e) => updateColor(key, 'opacity', parseFloat(e.target.value))} className="w-full h-1 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer" />
                        <span className="text-[10px] w-5 text-right font-medium dark:text-slate-300">{Math.round(style.opacity * 100)}%</span>
                      </div>
                    </div>

                    {/* Label Color Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-8">Text</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="color" value={style.labelColor} onChange={(e) => updateColor(key, 'labelColor', e.target.value)} className="w-6 h-6 rounded cursor-pointer p-0 border-0" />
                        <input type="text" value={style.labelColor} onChange={(e) => updateColor(key, 'labelColor', e.target.value)} className="flex-1 w-full px-1 py-0.5 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded" />
                      </div>
                    </div>

                    {/* Font Size Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-8">Size</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="range" min="8" max="20" step="1" value={style.fontSize} onChange={(e) => updateColor(key, 'fontSize', parseInt(e.target.value))} className="w-full h-1 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer" />
                        <span className="text-[10px] w-5 text-right font-medium dark:text-slate-300">{style.fontSize}</span>
                      </div>
                    </div>

                    {/* Bold + Stroke Row */}
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={style.bold} onChange={(e) => updateColor(key, 'bold', e.target.checked)} className="w-3 h-3" />
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">Bold</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={style.stroke} onChange={(e) => updateColor(key, 'stroke', e.target.checked)} className="w-3 h-3" />
                        <span className="text-[10px] text-slate-600 dark:text-slate-400">Outline</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Global: Highlight Current Month */}
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showCurrentMonth} onChange={(e) => setShowCurrentMonth(e.target.checked)} className="w-4 h-4 accent-orange-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">🗓️ Highlight current month</span>
              </label>
            </div>
          </div>
        )}
        <div id="total-view-chart" className="flex-1 min-h-0 relative">
          
          {/* Pinned Detail Card Overlay */}
          {pinnedMonth !== null && (() => {
            const pinnedData = chartData.find((d) => d.month === pinnedMonth);
            if (!pinnedData) return null;
            
            const isCardOnLeft = pinnedMonth > 8;
            const targetX = columnCoordsRef.current[pinnedMonth] || 100;
            const cardX = isCardOnLeft ? targetX - 230 : targetX + 40;

            return (
              <div 
                className="absolute z-10 pointer-events-none transition-all duration-200 ease-in-out drop-shadow-md"
                style={{ 
                  left: cardX, 
                  top: '40%',
                  transform: 'translateY(-50%)'
                }}
              >
                <div 
                  className={`absolute top-1/2 -translate-y-1/2 w-[14px] h-[14px] bg-white dark:bg-slate-900 transform rotate-45 pointer-events-none ${
                    isCardOnLeft 
                      ? '-right-[7px] border-t border-r border-slate-300 dark:border-slate-700' 
                      : '-left-[7px] border-b border-l border-slate-300 dark:border-slate-700'
                  }`}
                  style={{ zIndex: 0 }}
                />
                <div className="relative z-10">
                  <MonthDetailCard data={pinnedData} hideShadow={true} />
                </div>
              </div>
            );
          })()}

          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              data={chartData} 
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              onClick={(state) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const clickedMonth = state.activePayload[0].payload.month;
                  setPinnedMonth(prev => prev === clickedMonth ? null : clickedMonth);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis yAxisId="left" orientation="left" fontSize={11} domain={[0, yAxisMax]} ticks={yAxisTicks} label={{ value: t('totalView.axis.accumulated'), angle: -90, position: 'insideLeft' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {/* Current Month Highlight */}
              {showCurrentMonth && currentMonth !== null && (() => {
                const monthName = chartData.find(d => {
                  const m = language === 'ja' ? `${currentMonth}月` : new Date(currentYear, currentMonth - 1).toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US', { month: 'short' });
                  return d.name === m;
                })?.name;
                return monthName ? (
                  <>
                    <ReferenceArea yAxisId="left" x1={monthName} x2={monthName} fill="rgba(251,146,60,0.12)" />
                    <ReferenceLine yAxisId="left" x={monthName} stroke="#f97316" strokeWidth={2} strokeDasharray="6 3" label={{ value: '今月', position: 'top', fontSize: 10, fill: '#f97316', fontWeight: 'bold' }} />
                  </>
                ) : null;
              })()}
              <Bar yAxisId="left" dataKey="accPlan" name={t('dashboard.chart.accPlan')} fill={chartColors.accPlan.color} fillOpacity={chartColors.accPlan.opacity} shape={<TrackingBar />}>
                <LabelList dataKey="accPlan" position="top" content={<OutlinedLabel dataKey="accPlan" />} />
              </Bar>
              <Bar yAxisId="left" dataKey="accActual" name={t('dashboard.chart.accActual')} fill={chartColors.accActual.color} fillOpacity={chartColors.accActual.opacity} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="accActual" position="top" content={<OutlinedLabel dataKey="accActual" />} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Table Section Removed - check YearlyDataView.tsx */}
    </div>
  );
};
