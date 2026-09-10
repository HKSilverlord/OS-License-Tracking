import React, { useCallback, useState, useRef } from 'react';
import { TrendingUp, Palette } from 'lucide-react';
import { ChartExportMenu } from './ChartExportMenu';
import { useLanguage } from '../contexts/LanguageContext';
import type { TranslateFn } from '../contexts/LanguageContext';
import { useChartPref, CHART_PALETTE } from '../utils/chartColorPrefs';
import { Skeleton } from './ui/Skeleton';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipContentProps, LabelList, ReferenceLine, ReferenceArea } from 'recharts';
import { useMonthlyPlanActualData } from '../hooks/useMonthlyPlanActualData';
import type { MonthlyPlanActualData } from '../hooks/useMonthlyPlanActualData';

interface SeriesStyle {
  color: string;
  opacity: number;
  labelColor: string;
  fontSize: number;
  bold: boolean;
  stroke: boolean;
  barSize?: number;
}

interface MonthlyChartColors {
  capacityLine: SeriesStyle;
  workingHoursPlan: SeriesStyle;
  salesPlan: SeriesStyle;
  salesActual: SeriesStyle;
  workingHoursActual: SeriesStyle;
}

/**
 * Theme-safe defaults (U8). The four hard-coded values that broke dark-mode contrast
 * (#5c0000, #000080, #006080, #808080) are now CHART_PALETTE.plan / plan2 / actual / neutral.
 */
const DEFAULT_CHART_COLORS: MonthlyChartColors = {
  capacityLine: { color: CHART_PALETTE.neutral, opacity: 1, labelColor: CHART_PALETTE.neutral, fontSize: 10, bold: false, stroke: false },
  workingHoursPlan: { color: '#FFB3B3', opacity: 1, labelColor: CHART_PALETTE.plan, fontSize: 10, bold: true, stroke: false, barSize: 60 },
  salesPlan: { color: '#00BFFF', opacity: 1, labelColor: CHART_PALETTE.actual, fontSize: 10, bold: false, stroke: false },
  salesActual: { color: CHART_PALETTE.plan2, opacity: 1, labelColor: CHART_PALETTE.plan2, fontSize: 11, bold: true, stroke: true, barSize: 40 },
  workingHoursActual: { color: '#CC0000', opacity: 1, labelColor: '#ffffff', fontSize: 10, bold: true, stroke: false, barSize: 30 },
};

const SERIES_KEYS = ['salesPlan', 'salesActual', 'workingHoursPlan', 'workingHoursActual', 'capacityLine'] as const;

/**
 * Migration for the stored `monthly_chartColors` preference:
 *  - the oldest format stored a bare colour string per series,
 *  - later formats stored a partial SeriesStyle, merged over the defaults so fields added
 *    since the preference was written are picked up.
 */
const migrateChartColors = (raw: unknown): MonthlyChartColors | null => {
  if (raw === null || typeof raw !== 'object') return null;
  const parsed = raw as Partial<Record<keyof MonthlyChartColors, unknown>>;

  const mergeSeries = (key: keyof MonthlyChartColors): SeriesStyle => {
    const value = parsed[key];
    if (typeof value === 'string') return { ...DEFAULT_CHART_COLORS[key], color: value };
    if (value !== null && typeof value === 'object') {
      return { ...DEFAULT_CHART_COLORS[key], ...(value as Partial<SeriesStyle>) };
    }
    return DEFAULT_CHART_COLORS[key];
  };

  return {
    capacityLine: mergeSeries('capacityLine'),
    workingHoursPlan: mergeSeries('workingHoursPlan'),
    salesPlan: mergeSeries('salesPlan'),
    salesActual: mergeSeries('salesActual'),
    workingHoursActual: mergeSeries('workingHoursActual'),
  };
};

interface MonthlyPlanActualViewProps {
  currentYear: number;
}

/* --------------------------------------------------------------------------
 * Chart renderers
 *
 * Module scope on purpose: a component declared inside the view is a new type
 * on every render, so React discards the subtree — the pinned card and the bar
 * animations reset. Recharts injects x/y/value/payload into the element given
 * to content= / shape=, so view state is threaded in as explicit props.
 * ------------------------------------------------------------------------ */

// Reusable Detail Card Component
const MonthDetailCard = ({ data, chartColors, t, hideShadow = false }: {
  data: MonthlyPlanActualData;
  chartColors: MonthlyChartColors;
  t: TranslateFn;
  hideShadow?: boolean;
}) => {
  return (
    <div className={`bg-white dark:bg-slate-900 p-3 border border-slate-300 dark:border-slate-700 rounded-lg min-w-[200px] ${hideShadow ? '' : 'shadow-lg'}`}>
      <p className="font-semibold text-slate-800 dark:text-slate-100 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">
        {data.monthLabel}
      </p>
      <div className="space-y-1.5 text-sm">
        {/* Working Hours Section */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.capacityLine.color, opacity: chartColors.capacityLine.opacity, borderStyle: 'dashed' }}></div>
            <span className="text-slate-700 dark:text-slate-400">{t('monthlyPlanActual.capacityLine', '能力線')}:</span>
          </div>
          <span className="font-medium text-slate-900 dark:text-slate-100">{data.capacityLine.toLocaleString()} {t('monthlyPlanActual.unit.hours', '時間')}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.workingHoursPlan.color, opacity: chartColors.workingHoursPlan.opacity }}></div>
            <span className="text-slate-700 dark:text-slate-400">{t('monthlyPlanActual.workingPlan', '稼働計画')}:</span>
          </div>
          <span className="font-medium text-slate-900 dark:text-slate-100">{data.workingHoursPlan.toLocaleString()} {t('monthlyPlanActual.unit.hours', '時間')}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.workingHoursActual.color, opacity: chartColors.workingHoursActual.opacity }}></div>
            <span className="text-slate-700 dark:text-slate-400">{t('monthlyPlanActual.workingActual', '稼働実績')}:</span>
          </div>
          <span className="font-medium text-slate-900 dark:text-slate-100">{data.workingHoursActual.toLocaleString()} {t('monthlyPlanActual.unit.hours', '時間')}</span>
        </div>

        {/* Sales Section */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-2 mt-2"></div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.salesPlan.color, opacity: chartColors.salesPlan.opacity }}></div>
            <span className="text-slate-700 dark:text-slate-400">{t('monthlyPlanActual.salesPlan', '売上計画')}:</span>
          </div>
          <span className="font-medium text-slate-900 dark:text-slate-100">{data.salesPlan.toLocaleString()} {t('monthlyPlanActual.unit.sales', '万円')}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.salesActual.color, opacity: chartColors.salesActual.opacity }}></div>
            <span className="text-slate-700 dark:text-slate-400">{t('monthlyPlanActual.salesActual', '売上実績')}:</span>
          </div>
          <span className="font-medium text-slate-900 dark:text-slate-100">{data.salesActual.toLocaleString()} {t('monthlyPlanActual.unit.sales', '万円')}</span>
        </div>
      </div>
    </div>
  );
};

// Custom Tooltip Component (wraps Detail Card) — recharts 3 passes `TooltipContentProps`
const CustomTooltip = ({ active, payload, chartColors, t }: Partial<TooltipContentProps<number, string>> & {
  chartColors: MonthlyChartColors;
  t: TranslateFn;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload as MonthlyPlanActualData | undefined;
  if (!data) return null;
  return <MonthDetailCard data={data} chartColors={chartColors} t={t} />;
};

// Custom zero label renderer for the Actual Sales bar
const ZeroLabel = ({ x = 0, y = 0, width = 0, value, chartColors }: {
  x?: number;
  y?: number;
  width?: number;
  value?: number | string;
  chartColors: MonthlyChartColors;
}) => {
  if (value !== 0) return null;
  return (
    <g>
      <rect x={x + width / 2 - 8} y={y - 22} width={16} height={20} fill="rgba(255,255,255,0.7)" rx={4} />
      <text x={x + width / 2} y={y - 8} fill={chartColors.workingHoursActual.labelColor} fontSize={14} fontWeight="bold" textAnchor="middle">0</text>
    </g>
  );
};

// Generic custom label with semi-transparent background pill + optional outline
const CustomLabel = ({ x = 0, y = 0, value, width = 0, dataKey, chartColors, offset = 10, position = 'top' }: {
  x?: number;
  y?: number;
  value?: number | string;
  width?: number;
  dataKey: keyof MonthlyChartColors;
  chartColors: MonthlyChartColors;
  offset?: number;
  position?: 'top' | 'insideTop' | 'left';
}) => {
  if (value === 0 || !value) return null;

  const formatted = typeof value === 'number' && value > 1000 ? value.toLocaleString() : value;
  const style = chartColors[dataKey];
  const color = style?.labelColor || CHART_PALETTE.labelNeutral;
  const fSize = style?.fontSize || 10;
  const isBold = style?.bold !== false;
  const hasStroke = style?.stroke === true;

  let textX = x;
  let textY = y;
  if (position === 'insideTop') {
    textX = x + width / 2;
    textY = y + 15;
  } else if (position === 'top') {
    textX = x + width / 2;
    textY = y - offset;
  } else if (position === 'left') {
    textX = x - offset;
    textY = y;
  }

  return (
    <g>
      {/* Background pill */}
      <rect
        x={textX - 16}
        y={textY - 12}
        width={32}
        height={16}
        fill="rgba(255,255,255,0.7)"
        rx={3}
      />
      {/* Stroke (outline) layer */}
      {hasStroke && (
        <text
          x={textX}
          y={textY}
          stroke="white"
          strokeWidth={3}
          strokeLinejoin="round"
          paintOrder="stroke"
          fontSize={fSize}
          fontWeight="bold"
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          {formatted}{dataKey === 'capacityLine' ? 'h' : ''}
        </text>
      )}
      {/* Actual label */}
      <text
        x={textX}
        y={textY}
        fill={color}
        fontSize={fSize}
        fontWeight={isBold ? 'bold' : 'normal'}
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        {formatted}{dataKey === 'capacityLine' ? 'h' : ''}
      </text>
    </g>
  );
};

/**
 * Custom Bar for Working Hours Actual with Gap Connector (Idea E).
 *
 * The column centre is reported through a callback, not by taking the ref:
 * Recharts 3 keeps chart props in an immer-backed store that DEEP-FREEZES what
 * it is handed, so a ref passed as a prop arrives with a frozen `.current` and
 * the first write throws.
 */
const WorkingHoursActualBar = ({ fill, x = 0, y = 0, width = 0, height = 0, payload, chartColors, onColumnCoord }: {
  fill?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: MonthlyPlanActualData;
  chartColors: MonthlyChartColors;
  onColumnCoord: (month: number, centerX: number) => void;
}) => {
  const planValue = payload?.workingHoursPlan || 0;
  const actualValue = payload?.workingHoursActual || 0;

  // Track the center X coordinate of the column for correct tooltip pinning
  if (payload?.month) {
    onColumnCoord(payload.month, x + width / 2);
  }

  // Estimate where the Plan bar top is physically (y-coordinate)
  const containerHeight = y + height;
  const zeroY = containerHeight;
  const pixelsPerUnit = height / actualValue;
  const planY = zeroY - (planValue * pixelsPerUnit);

  return (
    <g>
      {/* The actual red bar */}
      <path d={`M${x},${y} L${x + width},${y} L${x + width},${y + height} L${x},${y + height} Z`} stroke="none" fill={fill} fillOpacity={chartColors.workingHoursActual.opacity} />

      {/* Draw gap connector if plan > 0 */}
      {planValue > 0 && actualValue > 0 && (
        <g>
          {/* The dashed line connecting Actual top to Plan top */}
          <line
            x1={x + width / 2}
            y1={y}
            x2={x + width / 2}
            y2={planY}
            stroke={chartColors.workingHoursActual.color}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        </g>
      )}
    </g>
  );
};

export const MonthlyPlanActualView: React.FC<MonthlyPlanActualViewProps> = ({ currentYear }) => {
  const { t } = useLanguage();
  const { loading, monthlyData, maxSales, maxWorkingHours } = useMonthlyPlanActualData(currentYear);
  const [pinnedMonth, setPinnedMonth] = useState<number | null>(null);
  const columnCoordsRef = useRef<Record<number, number>>({});

  const [showColorPicker, setShowColorPicker] = useState(false);
  // Colours live behind the shared preference helper (U8): the localStorage key is unchanged
  // so existing user picks survive (see `migrateChartColors`), and every set() persists.
  const [chartColors, setChartColors] = useChartPref<MonthlyChartColors>(
    'monthly_chartColors',
    DEFAULT_CHART_COLORS,
    migrateChartColors,
  );

  const updateColor = <K extends keyof SeriesStyle>(seriesKey: keyof MonthlyChartColors, field: K, value: SeriesStyle[K]) => {
    setChartColors(prev => {
      const updated: SeriesStyle = { ...prev[seriesKey] };
      updated[field] = value;
      return { ...prev, [seriesKey]: updated };
    });
  };

  // See WorkingHoursActualBar: the ref cannot cross into Recharts, a callback can.
  const recordColumnCoord = useCallback((month: number, centerX: number) => {
    columnCoordsRef.current[month] = centerX;
  }, []);

  // Current month highlight
  const currentMonth = new Date().getFullYear() === currentYear ? new Date().getMonth() + 1 : null;
  const [showCurrentMonth, setShowCurrentMonth] = useState(true);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-auto">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex-1 flex flex-col gap-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="flex-1 min-h-[320px] w-full" />
          <span className="sr-only text-slate-500 dark:text-slate-400">{t('common.loading', 'Loading…')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-auto">
      {/* Chart Section - Full Page */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div>
            <h3 className="text-md font-bold text-pink-600 dark:text-pink-400 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              {currentYear}{t('monthlyPlanActual.title', '年 OS事業受託状況予実')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('monthlyPlanActual.subtitle', '月次計画と実績の比較')}</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {/* Month Selector */}
            <select
              className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 outline-none"
              value={pinnedMonth ?? ""}
              onChange={(e) => {
                const month = e.target.value ? Number(e.target.value) : null;
                setPinnedMonth(month);
              }}
            >
              <option value="">{t('tracker.selectMonth', '月を選択...')}</option>
              {monthlyData.map((d) => (
                <option key={d.month} value={d.month}>
                  {d.monthLabel}
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
            <ChartExportMenu
              chartId="monthly-plan-actual-chart"
              filenameRequest={`monthly_plan_actual_${currentYear}`}
              data={monthlyData}
            />
          </div>
        </div>

        {/* Color Picker Section */}
        {showColorPicker && (
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              {t('chart.customizeColors', 'Customize chart colors')}
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Render Color Options Helper */}
              {SERIES_KEYS.map((key) => {
                const label = key === 'salesPlan'
                  ? t('monthlyPlanActual.legend.salesPlan', '売上計画')
                  : key === 'salesActual'
                    ? t('monthlyPlanActual.legend.salesActual', '売上実績')
                    : key === 'workingHoursPlan'
                      ? t('monthlyPlanActual.legend.workingPlan', '稼働計画')
                      : key === 'workingHoursActual'
                        ? t('monthlyPlanActual.legend.workingActual', '稼働実績')
                        : t('monthlyPlanActual.legend.capacityLine', '能力線');
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
                        <input type="range" min="8" max="20" step="1" value={style.fontSize ?? 10} onChange={(e) => updateColor(key, 'fontSize', parseInt(e.target.value))} className="w-full h-1 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer" />
                        <span className="text-[10px] w-5 text-right font-medium text-slate-600 dark:text-slate-300">{style.fontSize ?? 10}</span>
                      </div>
                    </div>

                    {/* Bar Width Row (only for bar series) */}
                    {style.barSize !== undefined && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 w-8">{t('chart.field.width', 'Width')}</span>
                        <div className="flex items-center gap-1 flex-1">
                          <input type="range" min="10" max="100" step="5" value={style.barSize} onChange={(e) => updateColor(key, 'barSize', parseInt(e.target.value))} className="w-full h-1 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer" />
                          <span className="text-[10px] w-7 text-right font-medium text-slate-600 dark:text-slate-300">{style.barSize}px</span>
                        </div>
                      </div>
                    )}

                    {/* Bold + Stroke Row */}
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={style.bold ?? true} onChange={(e) => updateColor(key, 'bold', e.target.checked)} className="w-3 h-3" />
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">{t('chart.field.bold', 'Bold')}</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={style.stroke ?? false} onChange={(e) => updateColor(key, 'stroke', e.target.checked)} className="w-3 h-3" />
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

        {/* Chart Container */}
        <div id="monthly-plan-actual-chart" className="flex-1 min-h-[420px] w-full relative overflow-visible">

          {/* Pinned Detail Card Overlay */}
          {pinnedMonth !== null && (() => {
            const pinnedData = monthlyData.find((d) => d.month === pinnedMonth);
            if (!pinnedData) return null;

            const isCardOnLeft = pinnedMonth > 8;
            const targetX = columnCoordsRef.current[pinnedMonth] || 100;
            const cardX = isCardOnLeft ? targetX - 230 : targetX + 40;

            return (
              <div
                className="absolute z-10 pointer-events-none transition-all duration-200 ease-in-out drop-shadow-md"
                style={{
                  left: cardX,
                  top: '45%',
                  transform: 'translateY(-50%)'
                }}
              >
                {/* Connecting Arrow */}
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

          <ResponsiveContainer width="100%" height="100%" minHeight={420}>
            <ComposedChart
              data={monthlyData}
              margin={{ top: 20, right: 60, left: 20, bottom: 5 }}
              onClick={(state) => {
                // recharts 3 `MouseHandlerDataParam` has no `activePayload` — recover the
                // clicked datum from the active index instead.
                const rawIndex = state?.activeIndex;
                if (rawIndex === undefined || rawIndex === null) return;
                const index = Number(rawIndex);
                if (!Number.isInteger(index) || index < 0) return;
                const clicked = monthlyData[index];
                if (!clicked) return;

                // Toggle off if clicking the same month, otherwise set the month
                setPinnedMonth(prev => (prev === clicked.month ? null : clicked.month));
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_PALETTE.grid} />

              {/* Current Month Highlight */}
              {showCurrentMonth && currentMonth !== null && (() => {
                const monthEntry = monthlyData.find(d => d.month === currentMonth);
                const monthLabel = monthEntry?.monthLabel;
                return monthLabel ? (
                  <>
                    <ReferenceArea yAxisId="left" xAxisId="main" x1={monthLabel} x2={monthLabel} fill="rgba(251,146,60,0.12)" />
                    <ReferenceLine yAxisId="left" xAxisId="main" x={monthLabel} stroke="#f97316" strokeWidth={2} strokeDasharray="6 3" label={{ value: t('chart.thisMonth', '今月'), position: 'top', fontSize: 10, fill: '#f97316', fontWeight: 'bold' }} />
                  </>
                ) : null;
              })()}

              {/* X-Axis: Months */}
              <XAxis
                xAxisId="main"
                dataKey="monthLabel"
                fontSize={12}
                interval={0}
                tick={{ fontSize: 12 }}
                tickLine={false}
                height={24}
                padding={{ left: 0, right: 0 }}
              />
              {/* Hidden X-Axis for Bullet Chart Overlay */}
              <XAxis
                xAxisId="actualLayer"
                dataKey="monthLabel"
                hide={true}
                interval={0}
                height={0}
              />

              {/* Y1-Axis (Left): Sales in 万円 */}
              <YAxis
                yAxisId="left"
                orientation="left"
                fontSize={11}
                domain={[0, maxSales]}
                label={{
                  value: t('monthlyPlanActual.axis.sales', '売上（万円）'),
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: chartColors.salesActual.color }
                }}
              />

              {/* Y2-Axis (Right): Working Hours */}
              <YAxis
                yAxisId="right"
                orientation="right"
                fontSize={11}
                domain={[0, maxWorkingHours]}
                label={{
                  value: t('monthlyPlanActual.axis.workingHours', '月間稼働時間（時間）'),
                  angle: 90,
                  position: 'insideRight',
                  style: { fill: chartColors.workingHoursActual.color }
                }}
              />

              <Tooltip content={<CustomTooltip chartColors={chartColors} t={t} />} />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{ paddingBottom: '10px' }}
                content={({ payload }) => (
                  <div style={{ textAlign: 'center', padding: '4px 0' }}>
                    {payload?.filter((entry) => entry.value !== 'salesActual').map((entry, index) => {
                      const isDashed = entry.dataKey === 'capacityLine';
                      const isLine = entry.type === 'line' || entry.dataKey === 'salesPlan' || entry.dataKey === 'capacityLine';
                      return (
                        <div key={index} style={{ display: 'inline-flex', alignItems: 'center', margin: '4px 10px', verticalAlign: 'middle' }}>
                          {isLine ? (
                            <div style={{
                              width: 20,
                              height: 0,
                              marginRight: 6,
                              borderTop: `2px ${isDashed ? 'dashed' : 'solid'} ${entry.color}`,
                            }} />
                          ) : (
                            <div style={{
                              width: 12,
                              height: 12,
                              marginRight: 6,
                              backgroundColor: entry.color,
                              borderRadius: 2,
                            }} />
                          )}
                          {/* Mid-tone label so the legend stays legible in both themes */}
                          <span style={{ fontSize: 12, color: CHART_PALETTE.labelNeutral }}>{entry.value}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              />

              {/* Series 1: Capacity Line - Dashed Gray Line (Y2) */}
              <Line
                xAxisId="main"
                yAxisId="right"
                type="monotone"
                dataKey="capacityLine"
                name={t('monthlyPlanActual.legend.capacityLine', '能力線')}
                stroke={chartColors.capacityLine.color}
                strokeOpacity={chartColors.capacityLine.opacity}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              >
                <LabelList dataKey="capacityLine" position="left" content={<CustomLabel position="left" dataKey="capacityLine" chartColors={chartColors} />} />
              </Line>

              {/* Series 2: Working Hours Plan - Stacked Column (Y2) */}
              <Bar
                xAxisId="main"
                yAxisId="right"
                dataKey="workingHoursPlan"
                name={t('monthlyPlanActual.legend.workingPlan', '稼働計画')}
                fill={chartColors.workingHoursPlan.color}
                fillOpacity={chartColors.workingHoursPlan.opacity}
                maxBarSize={chartColors.workingHoursPlan.barSize ?? 60}
              >
                <LabelList dataKey="workingHoursPlan" position="insideTop" content={<CustomLabel position="insideTop" dataKey="workingHoursPlan" chartColors={chartColors} />} />
              </Bar>

              {/* Series 4: Sales Plan - Line with Markers and Data Labels (Y1) */}
              <Line
                xAxisId="main"
                yAxisId="left"
                type="monotone"
                dataKey="salesPlan"
                name={t('monthlyPlanActual.legend.salesPlan', '売上計画')}
                stroke={chartColors.salesPlan.color}
                strokeOpacity={chartColors.salesPlan.opacity}
                strokeWidth={3}
                dot={{ fill: chartColors.salesPlan.color, r: 5 }}
              >
                <LabelList dataKey="salesPlan" position="top" content={<CustomLabel position="top" dataKey="salesPlan" chartColors={chartColors} />} />
              </Line>

              {/* Series 5: Sales Actual - Column (Y1) */}
              <Bar
                xAxisId="main"
                yAxisId="left"
                dataKey="salesActual"
                name={t('monthlyPlanActual.legend.salesActual', '売上実績')}
                fill={chartColors.salesActual.color}
                fillOpacity={chartColors.salesActual.opacity}
                radius={[4, 4, 0, 0]}
                maxBarSize={chartColors.salesActual.barSize ?? 40}
              >
                <LabelList dataKey="salesActual" position="top" content={<CustomLabel position="top" dataKey="salesActual" chartColors={chartColors} />} />
                <LabelList content={<ZeroLabel chartColors={chartColors} />} />
              </Bar>

              {/* === BULLET CHART ACTUAL LAYER === */}
              {/* Series 3: Working Hours Actual - Column inside Plan Column with Gap Connector */}
              <Bar
                xAxisId="actualLayer"
                yAxisId="right"
                dataKey="workingHoursActual"
                name={t('monthlyPlanActual.legend.workingActual', '稼働実績')}
                fill={chartColors.workingHoursActual.color}
                fillOpacity={chartColors.workingHoursActual.opacity}
                maxBarSize={chartColors.workingHoursActual.barSize ?? 30}
                shape={<WorkingHoursActualBar chartColors={chartColors} onColumnCoord={recordColumnCoord} />}
              >
                <LabelList dataKey="workingHoursActual" position="insideTop" content={<CustomLabel position="insideTop" dataKey="workingHoursActual" chartColors={chartColors} />} />
              </Bar>

              {/* Invisible spacer to maintain layout mapping for actualLayer */}
              <Bar
                xAxisId="actualLayer"
                yAxisId="left"
                dataKey="salesActual"
                fill="transparent"
                legendType="none"
                tooltipType="none"
                style={{ pointerEvents: 'none' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div >
  );
};
