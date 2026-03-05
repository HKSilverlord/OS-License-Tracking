import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, TrendingUp, Palette } from 'lucide-react';
import { ChartExportMenu } from './ChartExportMenu';
import { useLanguage } from '../contexts/LanguageContext';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipProps, Cell, LabelList, ReferenceLine } from 'recharts';
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

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [chartColors, setChartColors] = useState<MonthlyChartColors>(() => {
    const saved = localStorage.getItem('monthly_chartColors');
    const defaults: MonthlyChartColors = {
      capacityLine: { color: '#808080', opacity: 1, labelColor: '#808080' },
      workingHoursPlan: { color: '#FFB3B3', opacity: 1, labelColor: '#5c0000' },
      salesPlan: { color: '#00BFFF', opacity: 1, labelColor: '#00BFFF' },
      salesActual: { color: '#000080', opacity: 1, labelColor: '#000080' },
      workingHoursActual: { color: '#CC0000', opacity: 1, labelColor: '#ffffff' },
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
        return { ...defaults, ...parsed };
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

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-white p-3 border border-slate-300 rounded-lg shadow-lg">
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

  // Generic custom label with semi-transparent background pill
  const CustomLabel = (props: any) => {
    const { x, y, value, width, index, dataKey, offset = 10, position = 'top' } = props;
    if (value === 0 || !value) return null;

    const formatted = typeof value === 'number' && value > 1000 ? value.toLocaleString() : value;
    const color = (chartColors as any)[dataKey]?.labelColor || '#333';

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
        <rect
          x={textX - 16}
          y={textY - 12}
          width={32}
          height={16}
          fill="rgba(255,255,255,0.7)"
          rx={3}
        />
        <text
          x={textX}
          y={textY}
          fill={color}
          fontSize={10}
          fontWeight="bold"
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
          <div className="flex gap-2 flex-wrap">
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
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Chart Container */}
        <div id="monthly-plan-actual-chart" className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={monthlyData}
              margin={{ top: 20, right: 60, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />

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
                maxBarSize={60}
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
                maxBarSize={40}
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
                maxBarSize={30}
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
