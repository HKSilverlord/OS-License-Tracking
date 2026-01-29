import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, TrendingUp, Palette } from 'lucide-react';
import { ChartExportMenu } from './ChartExportMenu';
import { useLanguage } from '../contexts/LanguageContext';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipProps } from 'recharts';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipProps } from 'recharts';
import { dbService } from '../services/dbService';

// Long-term plan data interface
interface LongTermPlanData {
  year: number;
  salesPlan: number | null;      // 売上計画（万円）
  salesActual: number | null;    // 売上実績（万円）
  hourlyRatePlan: number | null; // 平均時給計画（千円/時）
  hourlyRateActual: number | null; // 平均時給実績（千円/時）
}

interface ChartColors {
  salesPlan: string;
  salesActual: string;
  hourlyRatePlan: string;
  hourlyRateActual: string;
}

export const LongTermPlanView: React.FC = () => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [longTermData, setLongTermData] = useState<LongTermPlanData[]>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Load initial colors from localStorage or default
  const [chartColors, setChartColors] = useState<ChartColors>(() => {
    const saved = localStorage.getItem('longTermPlan_chartColors');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved chart colors', e);
      }
    }
    return {
      salesPlan: '#87CEEB',
      salesActual: '#000080',
      hourlyRatePlan: '#32CD32',
      hourlyRateActual: '#006400'
    };
  });

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('longTermPlan_chartColors', JSON.stringify(chartColors));
  }, [chartColors]);

  // Fetch real data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const currentYear = new Date().getFullYear();
        const startYear = 2024;
        const endYear = 2030;

        const data = await dbService.getYearlyAggregatedData(startYear, endYear);
        setLongTermData(data);
      } catch (error) {
        console.error('Failed to load long-term plan data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Chart data preparation - convert nulls to undefined for Recharts
  const chartData = useMemo(() => {
    return longTermData.map(d => ({
      year: d.year.toString(),
      salesPlan: d.salesPlan ?? undefined,
      salesActual: d.salesActual ?? undefined,
      hourlyRatePlan: d.hourlyRatePlan ?? undefined,
      hourlyRateActual: d.hourlyRateActual ?? undefined,
    }));
  }, [longTermData]);

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-white p-3 border border-slate-300 rounded-lg shadow-lg">
        <p className="font-semibold text-slate-800 mb-2 border-b border-slate-200 pb-1">
          {t('longTermPlan.year', '年度')}: {data.year}
        </p>
        <div className="space-y-1.5 text-sm">
          {/* Sales Data */}
          {data.salesPlan !== undefined && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.salesPlan }}></div>
                <span className="text-slate-700">{t('longTermPlan.salesPlan', '売上計画')}:</span>
              </div>
              <span className="font-medium text-slate-900">{data.salesPlan.toLocaleString()} {t('longTermPlan.unit.sales', '万円')}</span>
            </div>
          )}

          {data.salesActual !== undefined && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.salesActual }}></div>
                <span className="text-slate-700">{t('longTermPlan.salesActual', '売上実績')}:</span>
              </div>
              <span className="font-medium text-slate-900">{data.salesActual.toLocaleString()} {t('longTermPlan.unit.sales', '万円')}</span>
            </div>
          )}

          {/* Hourly Rate Data */}
          {(data.hourlyRatePlan !== undefined || data.hourlyRateActual !== undefined) && (
            <div className="border-t border-slate-200 pt-2 mt-2"></div>
          )}

          {data.hourlyRatePlan !== undefined && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.hourlyRatePlan }}></div>
                <span className="text-slate-700">{t('longTermPlan.hourlyRatePlan', '平均時給計画')}:</span>
              </div>
              <span className="font-medium text-slate-900">{data.hourlyRatePlan.toLocaleString()} {t('longTermPlan.unit.hourlyRate', '千円/時')}</span>
            </div>
          )}

          {data.hourlyRateActual !== undefined && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.hourlyRateActual }}></div>
                <span className="text-slate-700">{t('longTermPlan.hourlyRateActual', '平均時給実績')}:</span>
              </div>
              <span className="font-medium text-slate-900">{data.hourlyRateActual.toLocaleString()} {t('longTermPlan.unit.hourlyRate', '千円/時')}</span>
            </div>
          )}
        </div>
      </div>
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
          <h3 className="text-md font-bold text-slate-700 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
            {t('longTermPlan.title', 'OS事業長期計画')}
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

            <ChartExportMenu
              chartId="long-term-plan-chart"
              filenameRequest="long_term_plan"
              data={chartData}
            />
          </div>
        </div>


        {/* Color Picker Section */}
        {
          showColorPicker && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Customize Chart Colors
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">{t('longTermPlan.salesPlan', '売上計画')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={chartColors.salesPlan}
                      onChange={(e) => setChartColors({ ...chartColors, salesPlan: e.target.value })}
                      className="w-10 h-8 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={chartColors.salesPlan}
                      onChange={(e) => setChartColors({ ...chartColors, salesPlan: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">{t('longTermPlan.salesActual', '売上実績')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={chartColors.salesActual}
                      onChange={(e) => setChartColors({ ...chartColors, salesActual: e.target.value })}
                      className="w-10 h-8 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={chartColors.salesActual}
                      onChange={(e) => setChartColors({ ...chartColors, salesActual: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">{t('longTermPlan.hourlyRatePlan', '平均時給計画')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={chartColors.hourlyRatePlan}
                      onChange={(e) => setChartColors({ ...chartColors, hourlyRatePlan: e.target.value })}
                      className="w-10 h-8 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={chartColors.hourlyRatePlan}
                      onChange={(e) => setChartColors({ ...chartColors, hourlyRatePlan: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">{t('longTermPlan.hourlyRateActual', '平均時給実績')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={chartColors.hourlyRateActual}
                      onChange={(e) => setChartColors({ ...chartColors, hourlyRateActual: e.target.value })}
                      className="w-10 h-8 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={chartColors.hourlyRateActual}
                      onChange={(e) => setChartColors({ ...chartColors, hourlyRateActual: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Chart Container */}
        <div id="long-term-plan-chart" className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 60, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />

              {/* X-Axis: Years */}
              <XAxis
                dataKey="year"
                fontSize={12}
                label={{ value: t('longTermPlan.axis.year', '年度'), position: 'insideBottom', offset: -10 }}
              />

              {/* Y1-Axis (Left): Sales in 万円 */}
              <YAxis
                yAxisId="left"
                orientation="left"
                fontSize={11}
                domain={[0, 8000]}
                ticks={[0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000]}
                label={{
                  value: t('longTermPlan.axis.sales', '売上額（万円）'),
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#000080' }
                }}
              />

              {/* Y2-Axis (Right): Hourly Rate in 千円/時 */}
              <YAxis
                yAxisId="right"
                orientation="right"
                fontSize={11}
                domain={[0, 4000]}
                ticks={[0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000]}
                label={{
                  value: t('longTermPlan.axis.hourlyRate', '平均時給（千円/時）'),
                  angle: 90,
                  position: 'insideRight',
                  style: { fill: '#32CD32' }
                }}
              />

              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{ paddingBottom: '10px' }}
              />

              {/* Series 1: Sales Plan - Column (Y1) */}
              <Bar
                yAxisId="left"
                dataKey="salesPlan"
                name={t('longTermPlan.legend.salesPlan', '売上計画（万円）')}
                fill={chartColors.salesPlan}
                radius={[4, 4, 0, 0]}
                maxBarSize={60}
              />

              {/* Series 2: Sales Actual - Column (Y1) */}
              <Bar
                yAxisId="left"
                dataKey="salesActual"
                name={t('longTermPlan.legend.salesActual', '売上実績（万円）')}
                fill={chartColors.salesActual}
                radius={[4, 4, 0, 0]}
                maxBarSize={60}
              />

              {/* Series 3: Hourly Rate Plan - Line (Y2) */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="hourlyRatePlan"
                name={t('longTermPlan.legend.hourlyRatePlan', '平均時給計画')}
                stroke={chartColors.hourlyRatePlan}
                strokeWidth={3}
                dot={{ fill: chartColors.hourlyRatePlan, r: 5 }}
                connectNulls={false}
              />

              {/* Series 4: Hourly Rate Actual - Line (Y2) */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="hourlyRateActual"
                name={t('longTermPlan.legend.hourlyRateActual', '平均時給実績')}
                stroke={chartColors.hourlyRateActual}
                strokeWidth={3}
                dot={{ fill: chartColors.hourlyRateActual, r: 5 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div >
    </div >
  );
};
