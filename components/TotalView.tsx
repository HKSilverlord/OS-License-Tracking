import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MonthlyRecord } from '../types';
import { dbService } from '../services/dbService';
import { exportChartToSVG, exportChartToPNG, exportChartDataToCSV, generateChartFilename, copyChartToClipboard } from '../utils/chartExport';
import { TrendingUp, Download, Palette, Copy, Image } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type { TranslateFn } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useChartPref, CHART_PALETTE } from '../utils/chartColorPrefs';
import { Skeleton } from './ui/Skeleton';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, TooltipContentProps, ReferenceArea, ReferenceLine } from 'recharts';
import { createLogger } from '../utils/logger';

const log = createLogger('TotalView');

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

/** One point of the monthly chart. */
interface TotalChartRow {
  name: string;
  month: number;
  plan: number;
  actual: number;
  accPlan: number;
  accActual: number;
}

/** Theme-safe mid-tones (U8) — legible on both bg-white and bg-slate-900. */
const DEFAULT_CHART_COLORS: ChartColors = {
  plan: { color: CHART_PALETTE.neutral, opacity: 1, labelColor: CHART_PALETTE.labelNeutral, fontSize: 10, bold: true, stroke: false },
  actual: { color: CHART_PALETTE.plan, opacity: 1, labelColor: CHART_PALETTE.plan, fontSize: 10, bold: true, stroke: false },
  accPlan: { color: CHART_PALETTE.labelNeutral, opacity: 1, labelColor: CHART_PALETTE.labelNeutral, fontSize: 10, bold: false, stroke: false },
  accActual: { color: CHART_PALETTE.actual, opacity: 1, labelColor: CHART_PALETTE.actual, fontSize: 12, bold: true, stroke: true },
};

const SERIES_KEYS = ['plan', 'actual', 'accPlan', 'accActual'] as const;

/**
 * Migration for the stored `totalView_chartColors` preference:
 *  - the oldest format stored a bare colour string per series,
 *  - later formats stored a partial SeriesStyle, which is merged over the defaults so
 *    fields added since the preference was written are picked up.
 */
const migrateChartColors = (raw: unknown): ChartColors | null => {
  if (raw === null || typeof raw !== 'object') return null;
  const parsed = raw as Partial<Record<keyof ChartColors, unknown>>;

  const mergeSeries = (key: keyof ChartColors): SeriesStyle => {
    const value = parsed[key];
    if (typeof value === 'string') return { ...DEFAULT_CHART_COLORS[key], color: value };
    if (value !== null && typeof value === 'object') {
      return { ...DEFAULT_CHART_COLORS[key], ...(value as Partial<SeriesStyle>) };
    }
    return DEFAULT_CHART_COLORS[key];
  };

  return {
    plan: mergeSeries('plan'),
    actual: mergeSeries('actual'),
    accPlan: mergeSeries('accPlan'),
    accActual: mergeSeries('accActual'),
  };
};

/** Referentially stable so hooks that map over it can list it as a dependency. */
const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/* --------------------------------------------------------------------------
 * Chart renderers
 *
 * These live at module scope on purpose. Declared inside TotalView they would be
 * a NEW component type on every render, so React would throw away the subtree —
 * and with it the pinned-card position and the bars' animation state. Recharts
 * injects its own props (x/y/value, payload) into the element passed to
 * `content=` / `shape=`, so everything from the view is threaded in explicitly.
 * ------------------------------------------------------------------------ */

/** Outlined label renderer for a <LabelList content=…>. */
const OutlinedLabel = ({ x, y, value, dataKey, width = 0, chartColors }: {
  x?: number;
  y?: number;
  value?: number | string;
  dataKey: keyof ChartColors;
  width?: number;
  chartColors: ChartColors;
}) => {
  if (!value || value === 0) return null;
  const style = chartColors[dataKey];
  if (!style) return null;
  const tx = typeof x === 'number' && typeof width === 'number' ? x + width / 2 : x;
  const ty = typeof y === 'number' ? y - 4 : y;
  const formatted = typeof value === 'number' && value > 999 ? value.toLocaleString() : value;
  return (
    <g>
      {style.stroke && (
        <text x={tx} y={ty} textAnchor="middle" fontSize={style.fontSize} fontWeight="bold" stroke="white" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke">
          {formatted}
        </text>
      )}
      <text x={tx} y={ty} textAnchor="middle" fontSize={style.fontSize} fontWeight={style.bold ? 'bold' : 'normal'} fill={style.labelColor}>
        {formatted}
      </text>
    </g>
  );
};

/** The month breakdown, shown both in the tooltip and in the pinned card. */
const MonthDetailCard = ({ data, chartColors, t, hideShadow = false }: {
  data: TotalChartRow;
  chartColors: ChartColors;
  t: TranslateFn;
  hideShadow?: boolean;
}) => {
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
            <span className="text-slate-700 dark:text-slate-400 font-medium">{t('totalView.timeGap', '時間 GAP')}:</span>
            <span className={`font-semibold ${timeGap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {timeGap >= 0 ? '+' : ''}{timeGap.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-700 dark:text-slate-400 font-medium">{t('totalView.percentGap', '% GAP')}:</span>
            <span className={`font-semibold ${percentGap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {percentGap >= 0 ? '+' : ''}{percentGap.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Tooltip body. Recharts 3 fills in `active` / `payload` when it clones the
 * element, which is why they are optional here.
 */
const CustomTooltip = ({ active, payload, chartColors, t }: Partial<TooltipContentProps<number, string>> & {
  chartColors: ChartColors;
  t: TranslateFn;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload as TotalChartRow | undefined;
  if (!data) return null;
  return <MonthDetailCard data={data} chartColors={chartColors} t={t} />;
};

/**
  * Rounded bar that also reports each column's centre x, so the pinned card can
  * be positioned under the right month.
  *
  * It reports through a callback rather than taking the ref: Recharts 3 keeps
  * chart props in an immer-backed store that DEEP-FREEZES what it is handed, so
  * a ref passed as a prop arrives with a frozen `.current` and the first write
  * throws. A callback closes over the ref instead — only the function object is
  * frozen, which is harmless.
  */
const TrackingBar = (props: {
  fill?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fillOpacity?: number;
  payload?: TotalChartRow;
  onColumnCoord: (month: number, centerX: number) => void;
}) => {
  const { fill, x = 0, y = 0, width = 0, height = 0, payload, fillOpacity, onColumnCoord } = props;
  if (payload?.month) {
    onColumnCoord(payload.month, x + width / 2);
  }
  const r = 4;
  const path = `M${x},${y + height} L${x},${y + r} A${r},${r} 0 0,1 ${x + r},${y} L${x + width - r},${y} A${r},${r} 0 0,1 ${x + width},${y + r} L${x + width},${y + height} Z`;
  const d = height < r ? `M${x},${y} L${x + width},${y} L${x + width},${y + height} L${x},${y + height} Z` : path;
  return <path d={d} stroke="none" fill={fill} fillOpacity={fillOpacity} />;
};

export const TotalView: React.FC<TotalViewProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const [allRecords, setAllRecords] = useState<MonthlyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pinnedMonth, setPinnedMonth] = useState<number | null>(null);
  const columnCoordsRef = useRef<Record<number, number>>({});
  const loadSeqRef = useRef(0);

  // Colours live behind the shared preference helper (U8): the localStorage key is unchanged
  // so existing user picks survive (see `migrateChartColors`), and every set() persists.
  const [chartColors, setChartColors] = useChartPref<ChartColors>(
    'totalView_chartColors',
    DEFAULT_CHART_COLORS,
    migrateChartColors,
  );

  const updateColor = <K extends keyof SeriesStyle>(seriesKey: keyof ChartColors, field: K, value: SeriesStyle[K]) => {
    setChartColors(prev => {
      const updated: SeriesStyle = { ...prev[seriesKey] };
      updated[field] = value;
      return { ...prev, [seriesKey]: updated };
    });
  };

  // See TrackingBar: the ref cannot cross into Recharts, a callback can.
  const recordColumnCoord = useCallback((month: number, centerX: number) => {
    columnCoordsRef.current[month] = centerX;
  }, []);

  // Current month highlight
  const currentMonth = new Date().getFullYear() === currentYear ? new Date().getMonth() + 1 : null;
  const [showCurrentMonth, setShowCurrentMonth] = useState(true);

  // U1 routed every view's year through one shell control, so a user can change
  // year faster than a request completes. Without this guard an older response
  // lands after a newer one and the view shows the wrong year's numbers.
  // `t` is memoised per language, so making it a dependency of the fetch would
  // refetch the year's data on every language switch. The ref keeps the error
  // toast localised without tying data loading to the language.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchData = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const recordsData = await dbService.getAllRecords(currentYear);
      if (seq !== loadSeqRef.current) return;
      setAllRecords(recordsData);
    } catch (error) {
      if (seq !== loadSeqRef.current) return;
      log.error('Failed to load data for Total View', error);
      toast.error(tRef.current('toast.loadFailed', 'Failed to load data'));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [currentYear, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for data updates from other tabs
  useEffect(() => {
    const handleDataUpdated = () => {
      fetchData();
    };

    window.addEventListener('dataUpdated', handleDataUpdated);
    return () => window.removeEventListener('dataUpdated', handleDataUpdated);
  }, [fetchData]);

  // Chart Data Preparation
  const chartData = useMemo<TotalChartRow[]>(() => {
    const locale = language === 'ja' ? 'ja-JP' : language === 'vn' ? 'vi-VN' : 'en-US';
    const data: TotalChartRow[] = months.map(m => ({
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

    const ticks: number[] = [];
    const step = Math.ceil(maxLimit / 10 / 1000) * 1000 || 1000;
    for (let i = 0; i <= maxLimit; i += step) {
      ticks.push(i);
    }
    return { yAxisMax: maxLimit, yAxisTicks: ticks };
  }, [chartData]);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-hidden">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex-1 flex flex-col gap-4">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="flex-1 min-h-[240px] w-full" />
          <span className="sr-only text-slate-500 dark:text-slate-400">{t('common.loading', 'Loading…')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-hidden">

      {/* 1. Chart Section - Full Page */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-md font-bold text-slate-700 dark:text-slate-100 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
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
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 dark:bg-purple-700 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors"
              title={t('chart.customizeColors', 'Customize chart colors')}
            >
              <Palette className="w-4 h-4" />
              {t('chart.colors', 'Colors')}
            </button>
            <button
              onClick={() => copyChartToClipboard('total-view-chart')}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
              title={t('export.copyAsImage', 'Copy to Clipboard')}
            >
              <Copy className="w-4 h-4" />
              {t('buttons.copy', 'Copy')}
            </button>
            <button
              onClick={() => exportChartToPNG('total-view-chart', generateChartFilename(`yearly_overview_${currentYear}`, 'png'))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-rose-600 dark:bg-rose-700 text-white rounded-lg hover:bg-rose-700 dark:hover:bg-rose-600 transition-colors"
              title={t('export.savePNG', 'Save as PNG')}
            >
              <Image className="w-4 h-4" />
              PNG
            </button>
            <button
              onClick={() => exportChartToSVG('total-view-chart', generateChartFilename(`yearly_overview_${currentYear}`, 'svg'))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 dark:bg-emerald-700 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors"
              title={t('export.saveSVG', 'Save as SVG')}
            >
              <Download className="w-4 h-4" />
              SVG
            </button>
            <button
              onClick={() => exportChartDataToCSV(chartData, generateChartFilename(`yearly_data_${currentYear}`, 'csv'))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              title={t('export.downloadData', 'Download Data (Excel/CSV)')}
            >
              <Download className="w-4 h-4" />
              {t('chart.dataCsv', 'Data')}
            </button>
          </div>
        </div>

        {/* Color Picker Section */}
        {showColorPicker && (
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              {t('chart.customizeColors', 'Customize chart colors')}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {SERIES_KEYS.map((key) => {
                const label = key === 'plan'
                  ? t('tracker.planShort')
                  : key === 'actual'
                    ? t('tracker.actualShort')
                    : key === 'accPlan'
                      ? t('dashboard.chart.accPlan')
                      : t('dashboard.chart.accActual');
                const style = chartColors[key];
                return (
                  <div key={key} className="flex flex-col gap-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{label}</label>

                    {/* Color Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-8">{t('chart.field.color', 'Color')}</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="color" aria-label={label} value={style.color} onChange={(e) => updateColor(key, 'color', e.target.value)} className="w-6 h-6 rounded cursor-pointer p-0 border-0" />
                        <input type="text" aria-label={label} value={style.color} onChange={(e) => updateColor(key, 'color', e.target.value)} className="flex-1 w-full px-1 py-0.5 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded" />
                      </div>
                    </div>

                    {/* Opacity Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-8">{t('chart.field.alpha', 'Alpha')}</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="range" min="0" max="1" step="0.1" value={style.opacity} onChange={(e) => updateColor(key, 'opacity', parseFloat(e.target.value))} className="w-full h-1 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer" />
                        <span className="text-[10px] w-5 text-right font-medium text-slate-600 dark:text-slate-300">{Math.round(style.opacity * 100)}%</span>
                      </div>
                    </div>

                    {/* Label Color Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-8">{t('chart.field.text', 'Text')}</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="color" aria-label={label} value={style.labelColor} onChange={(e) => updateColor(key, 'labelColor', e.target.value)} className="w-6 h-6 rounded cursor-pointer p-0 border-0" />
                        <input type="text" aria-label={label} value={style.labelColor} onChange={(e) => updateColor(key, 'labelColor', e.target.value)} className="flex-1 w-full px-1 py-0.5 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded" />
                      </div>
                    </div>

                    {/* Font Size Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-8">{t('chart.field.size', 'Size')}</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="range" min="8" max="20" step="1" value={style.fontSize} onChange={(e) => updateColor(key, 'fontSize', parseInt(e.target.value))} className="w-full h-1 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer" />
                        <span className="text-[10px] w-5 text-right font-medium text-slate-600 dark:text-slate-300">{style.fontSize}</span>
                      </div>
                    </div>

                    {/* Bold + Stroke Row */}
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={style.bold} onChange={(e) => updateColor(key, 'bold', e.target.checked)} className="w-3 h-3" />
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">{t('chart.field.bold', 'Bold')}</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={style.stroke} onChange={(e) => updateColor(key, 'stroke', e.target.checked)} className="w-3 h-3" />
                        <span className="text-[10px] text-slate-600 dark:text-slate-400">{t('chart.field.outline', 'Outline')}</span>
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
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('chart.highlightCurrentMonth', 'Highlight current month')}</span>
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
                  <MonthDetailCard data={pinnedData} chartColors={chartColors} t={t} hideShadow={true} />
                </div>
              </div>
            );
          })()}

          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              onClick={(state) => {
                // recharts 3 `MouseHandlerDataParam` has no `activePayload` — recover the
                // clicked datum from the active index instead.
                const rawIndex = state?.activeIndex;
                if (rawIndex === undefined || rawIndex === null) return;
                const index = Number(rawIndex);
                if (!Number.isInteger(index) || index < 0) return;
                const clicked = chartData[index];
                if (!clicked) return;
                setPinnedMonth(prev => (prev === clicked.month ? null : clicked.month));
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_PALETTE.grid} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis yAxisId="left" orientation="left" fontSize={11} domain={[0, yAxisMax]} ticks={yAxisTicks} label={{ value: t('totalView.axis.accumulated'), angle: -90, position: 'insideLeft' }} />
              <Tooltip content={<CustomTooltip chartColors={chartColors} t={t} />} />
              <Legend />
              {/* Current Month Highlight */}
              {showCurrentMonth && currentMonth !== null && (() => {
                const monthName = chartData.find(d => d.month === currentMonth)?.name;
                return monthName ? (
                  <>
                    <ReferenceArea yAxisId="left" x1={monthName} x2={monthName} fill="rgba(251,146,60,0.12)" />
                    <ReferenceLine yAxisId="left" x={monthName} stroke="#f97316" strokeWidth={2} strokeDasharray="6 3" label={{ value: t('chart.thisMonth', '今月'), position: 'top', fontSize: 10, fill: '#f97316', fontWeight: 'bold' }} />
                  </>
                ) : null;
              })()}
              <Bar yAxisId="left" dataKey="accPlan" name={t('dashboard.chart.accPlan')} fill={chartColors.accPlan.color} fillOpacity={chartColors.accPlan.opacity} shape={<TrackingBar onColumnCoord={recordColumnCoord} />}>
                <LabelList dataKey="accPlan" position="top" content={<OutlinedLabel dataKey="accPlan" chartColors={chartColors} />} />
              </Bar>
              <Bar yAxisId="left" dataKey="accActual" name={t('dashboard.chart.accActual')} fill={chartColors.accActual.color} fillOpacity={chartColors.accActual.opacity} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="accActual" position="top" content={<OutlinedLabel dataKey="accActual" chartColors={chartColors} />} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Table Section Removed - check YearlyDataView.tsx */}
    </div>
  );
};
