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

interface MonthlyChartColors {
  capacityLine: string;
  workingHoursPlan: string;
  salesPlan: string;
  salesActual: string;
  workingHoursActual: string;
}

interface MonthlyPlanActualViewProps {
  currentYear: number;
}

export const MonthlyPlanActualView: React.FC<MonthlyPlanActualViewProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyPlanActualData[]>([]);

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
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.capacityLine, borderStyle: 'dashed' }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.capacityLine', '能力線')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.capacityLine.toLocaleString()} {t('monthlyPlanActual.unit.hours', '時間')}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.workingHoursPlan }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.workingPlan', '稼働計画')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.workingHoursPlan.toLocaleString()} {t('monthlyPlanActual.unit.hours', '時間')}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.workingHoursActual }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.workingActual', '稼働実績')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.workingHoursActual.toLocaleString()} {t('monthlyPlanActual.unit.hours', '時間')}</span>
          </div>

          {/* Sales Section */}
          <div className="border-t border-slate-200 pt-2 mt-2"></div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.salesPlan }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.salesPlan', '売上計画')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.salesPlan.toLocaleString()} {t('monthlyPlanActual.unit.sales', '万円')}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.salesActual }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.salesActual', '売上実績')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.salesActual.toLocaleString()} {t('monthlyPlanActual.unit.sales', '万円')}</span>
          </div>
        </div>
      </div>
    );
  };

  // Custom label for zero sales actual values
  const renderZeroLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (value === 0) {
      return (
        <text
          x={x + width / 2}
          y={y - 10}
          fill={chartColors.workingHoursActual}
          fontSize={24}
          fontWeight="bold"
          textAnchor="middle"
        >
          0
        </text>
      );
    }
    return null;
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
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600 truncate">{t('monthlyPlanActual.legend.salesPlan', '売上計画')}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={chartColors.salesPlan} onChange={(e) => setChartColors({ ...chartColors, salesPlan: e.target.value })} className="w-8 h-8 rounded border border-slate-300 cursor-pointer" />
                  <input type="text" value={chartColors.salesPlan} onChange={(e) => setChartColors({ ...chartColors, salesPlan: e.target.value })} className="flex-1 w-16 px-1 py-1 text-xs border border-slate-300 rounded" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600 truncate">{t('monthlyPlanActual.legend.salesActual', '売上実績')}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={chartColors.salesActual} onChange={(e) => setChartColors({ ...chartColors, salesActual: e.target.value })} className="w-8 h-8 rounded border border-slate-300 cursor-pointer" />
                  <input type="text" value={chartColors.salesActual} onChange={(e) => setChartColors({ ...chartColors, salesActual: e.target.value })} className="flex-1 w-16 px-1 py-1 text-xs border border-slate-300 rounded" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600 truncate">{t('monthlyPlanActual.legend.workingPlan', '稼働計画')}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={chartColors.workingHoursPlan} onChange={(e) => setChartColors({ ...chartColors, workingHoursPlan: e.target.value })} className="w-8 h-8 rounded border border-slate-300 cursor-pointer" />
                  <input type="text" value={chartColors.workingHoursPlan} onChange={(e) => setChartColors({ ...chartColors, workingHoursPlan: e.target.value })} className="flex-1 w-16 px-1 py-1 text-xs border border-slate-300 rounded" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600 truncate">{t('monthlyPlanActual.legend.workingActual', '稼働実績')}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={chartColors.workingHoursActual} onChange={(e) => setChartColors({ ...chartColors, workingHoursActual: e.target.value })} className="w-8 h-8 rounded border border-slate-300 cursor-pointer" />
                  <input type="text" value={chartColors.workingHoursActual} onChange={(e) => setChartColors({ ...chartColors, workingHoursActual: e.target.value })} className="flex-1 w-16 px-1 py-1 text-xs border border-slate-300 rounded" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600 truncate">{t('monthlyPlanActual.legend.capacityLine', '能力線')}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={chartColors.capacityLine} onChange={(e) => setChartColors({ ...chartColors, capacityLine: e.target.value })} className="w-8 h-8 rounded border border-slate-300 cursor-pointer" />
                  <input type="text" value={chartColors.capacityLine} onChange={(e) => setChartColors({ ...chartColors, capacityLine: e.target.value })} className="flex-1 w-16 px-1 py-1 text-xs border border-slate-300 rounded" />
                </div>
              </div>
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
                stroke={chartColors.capacityLine}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              >
                <LabelList dataKey="capacityLine" position="left" formatter={(val: number) => val + 'h'} fontSize={10} fill={chartColors.capacityLine} />
              </Line>

              {/* Series 2: Working Hours Plan - Pink Stacked Column (Y2) */}
              <Bar
                xAxisId="main"
                yAxisId="right"
                dataKey="workingHoursPlan"
                name={t('monthlyPlanActual.legend.workingPlan', '稼働計画')}
                fill={chartColors.workingHoursPlan}
                maxBarSize={60}
              >
                <LabelList dataKey="workingHoursPlan" position="insideTop" formatter={(val: number) => val > 0 ? val : ''} fontSize={10} fill="#5c0000" />
              </Bar>

              {/* Series 4: Sales Plan - Cyan Line with Markers and Data Labels (Y1) */}
              <Line
                xAxisId="main"
                yAxisId="left"
                type="monotone"
                dataKey="salesPlan"
                name={t('monthlyPlanActual.legend.salesPlan', '売上計画')}
                stroke={chartColors.salesPlan}
                strokeWidth={3}
                dot={{ fill: chartColors.salesPlan, r: 5 }}
              >
                <LabelList dataKey="salesPlan" position="top" fontSize={10} formatter={(val: number) => val.toLocaleString()} fill={chartColors.salesPlan} />
              </Line>

              {/* Series 5: Sales Actual - Navy Column (Y1) */}
              <Bar
                xAxisId="main"
                yAxisId="left"
                dataKey="salesActual"
                name={t('monthlyPlanActual.legend.salesActual', '売上実績')}
                fill={chartColors.salesActual}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              >
                <LabelList dataKey="salesActual" position="top" formatter={(val: number) => val > 0 ? val.toLocaleString() : ''} fontSize={11} fill={chartColors.salesActual} fontWeight="bold" />
                <LabelList content={renderZeroLabel} />
              </Bar>

              {/* === BULLET CHART ACTUAL LAYER === */}
              {/* Series 3: Working Hours Actual - Red Column inside Plan Column */}
              <Bar
                xAxisId="actualLayer"
                yAxisId="right"
                dataKey="workingHoursActual"
                name={t('monthlyPlanActual.legend.workingActual', '稼働実績')}
                fill={chartColors.workingHoursActual}
                maxBarSize={30}
              >
                <LabelList dataKey="workingHoursActual" position="insideTop" formatter={(val: number) => val > 0 ? val : ''} fontSize={10} fill="#fff" fontWeight="bold" />
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
