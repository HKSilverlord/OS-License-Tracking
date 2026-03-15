import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, TrendingUp, Palette } from 'lucide-react';
import { ChartExportMenu } from './ChartExportMenu';
import { useLanguage } from '../contexts/LanguageContext';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipProps, Cell, LabelList, ReferenceLine, ReferenceArea } from 'recharts';
import { dbService } from '../services/dbService';

// Monthly plan-actual data interface
interface MonthlyPlanActualData {
  month: number;
  monthLabel: string;
  capacityLine: number;        // 能力線
  workingHoursPlan: number;    // 稼働計画
  workingHoursActual: number;  // 稼働実績
  salesPlan: number;           // 売上計画 (万円)
  salesActual: number;         // 売上実績 (万円)
}

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

interface MonthlyPlanActualViewProps {
  currentYear: number;
}

export const MonthlyPlanActualView: React.FC<MonthlyPlanActualViewProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyPlanActualData[]>([]);
  const [pinnedCard, setPinnedCard] = useState<{ month: number; x: number; y: number } | null>(null);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [chartColors, setChartColors] = useState<MonthlyChartColors>(() => {
    const saved = localStorage.getItem('monthly_chartColors');
    const defaults: MonthlyChartColors = {
      capacityLine: { color: '#808080', opacity: 1, labelColor: '#808080', fontSize: 10, bold: false, stroke: false },
      workingHoursPlan: { color: '#FFB3B3', opacity: 1, labelColor: '#5c0000', fontSize: 10, bold: true, stroke: false, barSize: 60 },
      salesPlan: { color: '#00BFFF', opacity: 1, labelColor: '#006080', fontSize: 10, bold: false, stroke: false },
      salesActual: { color: '#000080', opacity: 1, labelColor: '#000080', fontSize: 11, bold: true, stroke: true, barSize: 40 },
      workingHoursActual: { color: '#CC0000', opacity: 1, labelColor: '#ffffff', fontSize: 10, bold: true, stroke: false, barSize: 30 },
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration check: if the saved value is a string, convert to SeriesStyle
        if (typeof parsed.capacityLine === 'string') {
          return {
            capacityLine: { ...defaults.capacityLine, color: parsed.capacityLine },
            workingHoursPlan: { ...defaults.workingHoursPlan, color: parsed.workingHoursPlan },
            salesPlan: { ...defaults.salesPlan, color: parsed.salesPlan },
            salesActual: { ...defaults.salesActual, color: parsed.salesActual },
            workingHoursActual: { ...defaults.workingHoursActual, color: parsed.workingHoursActual },
          };
        }
        return {
          capacityLine: { ...defaults.capacityLine, ...parsed.capacityLine },
          workingHoursPlan: { ...defaults.workingHoursPlan, ...parsed.workingHoursPlan },
          salesPlan: { ...defaults.salesPlan, ...parsed.salesPlan },
          salesActual: { ...defaults.salesActual, ...parsed.salesActual },
          workingHoursActual: { ...defaults.workingHoursActual, ...parsed.workingHoursActual },
        };
      } catch (e) { /* ignore */ }
    }
    return defaults;
  });

  const updateColor = (key: keyof MonthlyChartColors, field: keyof SeriesStyle, value: any) => {
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

  useEffect(() => {
    localStorage.setItem('monthly_chartColors', JSON.stringify(chartColors));
  }, [chartColors]);

  // Fetch real data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [aggregatedData, capacityData] = await Promise.all([
          dbService.getMonthlyAggregatedData(currentYear),
          dbService.getCapacityLine(currentYear)
        ]);

        const locale = language === 'ja' ? 'ja-JP' : language === 'vn' ? 'vi-VN' : 'en-US';

        // Combine data
        const combined = aggregatedData.map(data => {
          const capacity = capacityData.find(c => c.month === data.month)?.capacity || 0;
          const monthLabel = new Date(currentYear, data.month - 1).toLocaleString(locale, { month: 'short' });

          return {
            month: data.month,
            monthLabel: language === 'ja' ? `${data.month}月` : monthLabel,
            capacityLine: capacity,
            workingHoursPlan: data.workingHoursPlan,
            workingHoursActual: data.workingHoursActual,
            salesPlan: data.salesPlan,
            salesActual: data.salesActual
          };
        });

        setMonthlyData(combined);
      } catch (error) {
        console.error('Failed to load monthly plan-actual data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentYear, language]);

  // Calculate Y-axis ranges
  const maxSales = useMemo(() => {
    const max = Math.max(...monthlyData.map(d => Math.max(d.salesPlan, d.salesActual)));
    return Math.ceil(max * 1.1); // +10%
  }, [monthlyData]);

  const maxWorkingHours = useMemo(() => {
    const max = Math.max(...monthlyData.map(d => Math.max(d.capacityLine, d.workingHoursPlan, d.workingHoursActual)));
    return Math.ceil(max * 1.1); // +10%
  }, [monthlyData]);

  // Reusable Detail Card Component
  const MonthDetailCard = ({ data }: { data: MonthlyPlanActualData }) => {
    return (
      <div className="bg-white p-3 border border-slate-300 rounded-lg shadow-lg min-w-[200px]">
        <p className="font-semibold text-slate-800 mb-2 border-b border-slate-200 pb-1">
          {data.monthLabel}
        </p>
        <div className="space-y-1.5 text-sm">
          {/* Working Hours Section */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.capacityLine.color, opacity: chartColors.capacityLine.opacity, borderStyle: 'dashed' }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.capacityLine', '能力線')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.capacityLine.toLocaleString()} {t('monthlyPlanActual.unit.hours', '時間')}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.workingHoursPlan.color, opacity: chartColors.workingHoursPlan.opacity }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.workingPlan', '稼働計画')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.workingHoursPlan.toLocaleString()} {t('monthlyPlanActual.unit.hours', '時間')}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.workingHoursActual.color, opacity: chartColors.workingHoursActual.opacity }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.workingActual', '稼働実績')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.workingHoursActual.toLocaleString()} {t('monthlyPlanActual.unit.hours', '時間')}</span>
          </div>

          {/* Sales Section */}
          <div className="border-t border-slate-200 pt-2 mt-2"></div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.salesPlan.color, opacity: chartColors.salesPlan.opacity }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.salesPlan', '売上計画')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.salesPlan.toLocaleString()} {t('monthlyPlanActual.unit.sales', '万円')}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.salesActual.color, opacity: chartColors.salesActual.opacity }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.salesActual', '売上実績')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.salesActual.toLocaleString()} {t('monthlyPlanActual.unit.sales', '万円')}</span>
          </div>
        </div>
      </div>
    );
  };

  // Custom Tooltip Component (wraps Detail Card)
  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload as MonthlyPlanActualData;
    return <MonthDetailCard data={data} />;
  };

  // Custom zero label renderer for the Actual Sales bar
  const renderZeroLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (value === 0) {
      return (
        <g>
          <rect x={x + width / 2 - 8} y={y - 22} width={16} height={20} fill="rgba(255,255,255,0.7)" rx={4} />
          <text x={x + width / 2} y={y - 8} fill={chartColors.workingHoursActual.labelColor} fontSize={14} fontWeight="bold" textAnchor="middle">0</text>
        </g>
      );
    }
    return null;
  };

  // Generic custom label with semi-transparent background pill + optional outline
  const CustomLabel = (props: any) => {
    const { x, y, value, width, dataKey, offset = 10, position = 'top' } = props;
    if (value === 0 || !value) return null;

    const formatted = typeof value === 'number' && value > 1000 ? value.toLocaleString() : value;
    const style = (chartColors as any)[dataKey] as SeriesStyle;
    const color = style?.labelColor || '#333';
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

  // Custom Bar for Working Hours Actual with Gap Connector (Idea E)
  const WorkingHoursActualBar = (props: any) => {
    const { fill, x, y, width, height, payload } = props;
    const planValue = payload.workingHoursPlan || 0;
    const actualValue = payload.workingHoursActual || 0;

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

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 p-4 md:p-6 overflow-hidden">
      {/* Chart Section - Full Page */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div>
            <h3 className="text-md font-bold text-pink-600 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              {currentYear}{t('monthlyPlanActual.title', '年 OS事業受託状況予実')}
            </h3>
            <p className="text-xs text-slate-500 mt-1">{t('monthlyPlanActual.subtitle', '月次計画と実績の比較')}</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {/* Month Selector */}
            <select
              className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-700 bg-white hover:border-slate-400 outline-none"
              value={pinnedCard?.month ?? ""}
              onChange={(e) => {
                const month = e.target.value ? Number(e.target.value) : null;
                // If selected manually via dropdown, just show it in the top left or center 
                // because we don't have click coordinates. Default to a reasonable position.
                setPinnedCard(month ? { month, x: 100, y: 50 } : null);
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
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              title="Customize chart colors"
            >
              <Palette className="w-4 h-4" />
              Colors
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
          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Customize Chart Colors
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Render Color Options Helper */}
              {([
                { key: 'salesPlan', label: t('monthlyPlanActual.legend.salesPlan', '売上計画') },
                { key: 'salesActual', label: t('monthlyPlanActual.legend.salesActual', '売上実績') },
                { key: 'workingHoursPlan', label: t('monthlyPlanActual.legend.workingPlan', '稼働計画') },
                { key: 'workingHoursActual', label: t('monthlyPlanActual.legend.workingActual', '稼働実績') },
                { key: 'capacityLine', label: t('monthlyPlanActual.legend.capacityLine', '能力線') },
              ] as const).map(({ key, label }) => {
                const style = chartColors[key];
                return (
                  <div key={key} className="flex flex-col gap-2 p-2 bg-white rounded border border-slate-100 shadow-sm">
                    <label className="text-xs font-bold text-slate-700 truncate">{label}</label>

                    {/* Color Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 w-8">Color</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="color" value={style.color} onChange={(e) => updateColor(key, 'color', e.target.value)} className="w-6 h-6 rounded cursor-pointer p-0 border-0" />
                        <input type="text" value={style.color} onChange={(e) => updateColor(key, 'color', e.target.value)} className="flex-1 w-full px-1 py-0.5 text-xs border border-slate-300 rounded" />
                      </div>
                    </div>

                    {/* Opacity Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 w-8">Alpha</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="range" min="0" max="1" step="0.1" value={style.opacity} onChange={(e) => updateColor(key, 'opacity', parseFloat(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                        <span className="text-[10px] w-5 text-right font-medium">{Math.round(style.opacity * 100)}%</span>
                      </div>
                    </div>

                    {/* Label Color Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 w-8">Text</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="color" value={style.labelColor} onChange={(e) => updateColor(key, 'labelColor', e.target.value)} className="w-6 h-6 rounded cursor-pointer p-0 border-0" />
                        <input type="text" value={style.labelColor} onChange={(e) => updateColor(key, 'labelColor', e.target.value)} className="flex-1 w-full px-1 py-0.5 text-xs border border-slate-300 rounded" />
                      </div>
                    </div>

                    {/* Font Size Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 w-8">Size</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="range" min="8" max="20" step="1" value={style.fontSize ?? 10} onChange={(e) => updateColor(key, 'fontSize', parseInt(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                        <span className="text-[10px] w-5 text-right font-medium">{style.fontSize ?? 10}</span>
                      </div>
                    </div>

                    {/* Bar Width Row (only for bar series) */}
                    {style.barSize !== undefined && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500 w-8">Width</span>
                        <div className="flex items-center gap-1 flex-1">
                          <input type="range" min="10" max="100" step="5" value={style.barSize} onChange={(e) => updateColor(key, 'barSize', parseInt(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                          <span className="text-[10px] w-7 text-right font-medium">{style.barSize}px</span>
                        </div>
                      </div>
                    )}

                    {/* Bold + Stroke Row */}
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={style.bold ?? true} onChange={(e) => updateColor(key, 'bold', e.target.checked)} className="w-3 h-3" />
                        <span className="text-[10px] text-slate-600 font-bold">Bold</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={style.stroke ?? false} onChange={(e) => updateColor(key, 'stroke', e.target.checked)} className="w-3 h-3" />
                        <span className="text-[10px] text-slate-600">Outline</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Global: Highlight Current Month */}
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showCurrentMonth} onChange={(e) => setShowCurrentMonth(e.target.checked)} className="w-4 h-4 accent-orange-500" />
                <span className="text-xs font-semibold text-slate-700">🗓️ Highlight current month</span>
              </label>
            </div>
          </div>
        )}

        {/* Chart Container */}
        <div id="monthly-plan-actual-chart" className="flex-1 min-h-0 relative">
          
          {/* Pinned Detail Card Overlay */}
          {pinnedCard !== null && (() => {
            const pinnedData = monthlyData.find((d) => d.month === pinnedCard.month);
            if (!pinnedData) return null;
            
            // Adjust to appear in the vertical middle of the chart, to the right of the column.
            // If the column is in the later months, show the card to the left instead to avoid off-screen overflow.
            const cardX = pinnedCard.month > 8 ? pinnedCard.x - 240 : pinnedCard.x + 30;

            return (
              <div 
                className="absolute z-10 pointer-events-none transition-all duration-200 ease-in-out"
                style={{ 
                  left: cardX, 
                  top: '50%',
                  transform: 'translateY(-50%)'
                }}
              >
                <MonthDetailCard data={pinnedData} />
              </div>
            );
          })()}

          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={monthlyData}
              margin={{ top: 20, right: 60, left: 20, bottom: 20 }}
              onClick={(state) => {
                if (state && state.activePayload && state.activePayload.length > 0 && state.activeCoordinate) {
                  const clickedMonth = state.activePayload[0].payload.month;
                  const { x, y } = state.activeCoordinate;
                  
                  // Toggle off if clicking the same month, otherwise set the month and coords
                  setPinnedCard(prev => 
                    prev?.month === clickedMonth ? null : { month: clickedMonth, x, y }
                  );
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />

              {/* Current Month Highlight */}
              {showCurrentMonth && currentMonth !== null && (() => {
                const monthEntry = monthlyData.find(d => d.month === currentMonth);
                const monthLabel = monthEntry?.monthLabel;
                return monthLabel ? (
                  <>
                    <ReferenceArea yAxisId="left" xAxisId="main" x1={monthLabel} x2={monthLabel} fill="rgba(251,146,60,0.12)" />
                    <ReferenceLine yAxisId="left" xAxisId="main" x={monthLabel} stroke="#f97316" strokeWidth={2} strokeDasharray="6 3" label={{ value: '今月', position: 'top', fontSize: 10, fill: '#f97316', fontWeight: 'bold' }} />
                  </>
                ) : null;
              })()}

              {/* X-Axis: Months */}
              <XAxis
                xAxisId="main"
                dataKey="monthLabel"
                fontSize={12}
              />
              {/* Hidden X-Axis for Bullet Chart Overlay */}
              <XAxis
                xAxisId="actualLayer"
                dataKey="monthLabel"
                hide={true}
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
                  style: { fill: '#0066CC' }
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
                  style: { fill: '#CC0000' }
                }}
              />

              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{ paddingBottom: '10px' }}
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
                <LabelList dataKey="capacityLine" position="left" content={<CustomLabel position="left" dataKey="capacityLine" />} />
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
                <LabelList dataKey="workingHoursPlan" position="insideTop" content={<CustomLabel position="insideTop" dataKey="workingHoursPlan" />} />
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
                <LabelList dataKey="salesPlan" position="top" content={<CustomLabel position="top" dataKey="salesPlan" />} />
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
                <LabelList dataKey="salesActual" position="top" content={<CustomLabel position="top" dataKey="salesActual" />} />
                <LabelList content={renderZeroLabel} />
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
                shape={<WorkingHoursActualBar />}
              >
                <LabelList dataKey="workingHoursActual" position="insideTop" content={<CustomLabel position="insideTop" dataKey="workingHoursActual" />} />
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
