import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, Download, Copy, Image } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipProps, Cell, LabelList } from 'recharts';
import { exportChartToSVG, exportChartToPNG, exportChartDataToCSV, generateChartFilename, copyChartToClipboard } from '../utils/chartExport';
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
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#808080', borderStyle: 'dashed' }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.capacityLine', '能力線')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.capacityLine.toLocaleString()} {t('monthlyPlanActual.unit.hours', '時間')}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#FFB3B3' }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.workingPlan', '稼働計画')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.workingHoursPlan.toLocaleString()} {t('monthlyPlanActual.unit.hours', '時間')}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#CC0000' }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.workingActual', '稼働実績')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.workingHoursActual.toLocaleString()} {t('monthlyPlanActual.unit.hours', '時間')}</span>
          </div>

          {/* Sales Section */}
          <div className="border-t border-slate-200 pt-2 mt-2"></div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#00BFFF' }}></div>
              <span className="text-slate-700">{t('monthlyPlanActual.salesPlan', '売上計画')}:</span>
            </div>
            <span className="font-medium text-slate-900">{data.salesPlan.toLocaleString()} {t('monthlyPlanActual.unit.sales', '万円')}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#000080' }}></div>
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
          fill="#FF0000"
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
              <Calendar className="w-4 h-4 mr-2" />
              {currentYear}{t('monthlyPlanActual.title', '年 OS事業受託状況予実')}
            </h3>
            <p className="text-xs text-slate-500 mt-1">{t('monthlyPlanActual.subtitle', '月次計画と実績の比較')}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => copyChartToClipboard('monthly-plan-actual-chart')}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              title={t('monthlyPlanActual.copyToClipboard', 'Copy chart to clipboard')}
            >
              <Copy className="w-4 h-4" />
              {t('buttons.copy', 'Copy')}
            </button>
            <button
              onClick={() => exportChartToPNG('monthly-plan-actual-chart', generateChartFilename(`monthly_plan_actual_${currentYear}`, 'png'))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
              title={t('monthlyPlanActual.exportPNG', 'Export as PNG image')}
            >
              <Image className="w-4 h-4" />
              PNG
            </button>
            <button
              onClick={() => exportChartToSVG('monthly-plan-actual-chart', generateChartFilename(`monthly_plan_actual_${currentYear}`, 'svg'))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              title={t('monthlyPlanActual.exportSVG', 'Export as SVG (vector, best quality)')}
            >
              <Download className="w-4 h-4" />
              SVG
            </button>
            <button
              onClick={() => exportChartDataToCSV(monthlyData, generateChartFilename(`monthly_plan_actual_data_${currentYear}`, 'csv'))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title={t('monthlyPlanActual.exportData', 'Export chart data as CSV')}
            >
              <Download className="w-4 h-4" />
              Data
            </button>
          </div>
        </div>

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
                dataKey="monthLabel"
                fontSize={12}
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
                yAxisId="right"
                type="monotone"
                dataKey="capacityLine"
                name={t('monthlyPlanActual.legend.capacityLine', '能力線')}
                stroke="#808080"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />

              {/* Series 2: Working Hours Plan - Pink Stacked Column (Y2) */}
              <Bar
                yAxisId="right"
                dataKey="workingHoursPlan"
                name={t('monthlyPlanActual.legend.workingPlan', '稼働計画')}
                fill="#FFB3B3"
                stackId="working"
                maxBarSize={60}
              />

              {/* Series 3: Working Hours Actual - Red Stacked Column (Y2) */}
              <Bar
                yAxisId="right"
                dataKey="workingHoursActual"
                name={t('monthlyPlanActual.legend.workingActual', '稼働実績')}
                fill="#CC0000"
                stackId="working"
                maxBarSize={60}
              />

              {/* Series 4: Sales Plan - Cyan Line with Markers and Data Labels (Y1) */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="salesPlan"
                name={t('monthlyPlanActual.legend.salesPlan', '売上計画')}
                stroke="#00BFFF"
                strokeWidth={3}
                dot={{ fill: '#00BFFF', r: 5 }}
              >
                <LabelList dataKey="salesPlan" position="top" fontSize={10} formatter={(val: number) => val.toLocaleString()} />
              </Line>

              {/* Series 5: Sales Actual - Navy Column (Y1) */}
              <Bar
                yAxisId="left"
                dataKey="salesActual"
                name={t('monthlyPlanActual.legend.salesActual', '売上実績')}
                fill="#000080"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              >
                <LabelList content={renderZeroLabel} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
