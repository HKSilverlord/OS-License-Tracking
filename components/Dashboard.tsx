import React, { useEffect, useState } from 'react';
import { dbService } from '../services/dbService';
import { formatCurrency } from '../utils/helpers';
import { exportChartToSVG, generateChartFilename } from '../utils/chartExport';
import { MonthlyStats, AccumulatedStats } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Line, LabelList } from 'recharts';
import { Loader2, TrendingUp, JapaneseYen, Clock, Calculator, Palette } from 'lucide-react';
import { ChartExportMenu } from './ChartExportMenu';
import { SectionExportMenu } from './SectionExportMenu';
import { useLanguage } from '../contexts/LanguageContext';
import { DEFAULT_UNIT_PRICE } from '../constants';

interface DashboardChartColors {
  planRevenue: string;
  actualRevenue: string;
  accPlan: string;
  accActual: string;
}

interface DashboardKpiColors {
  grossPlanFrom: string;
  grossPlanTo: string;
  grossActualFrom: string;
  grossActualTo: string;
  netPlanBorder: string;
  netActualBorder: string;
  licenseFrom: string;
  licenseTo: string;
  costAnalysisBorder: string;
  summaryFrom: string;
  summaryTo: string;
}

const DEFAULT_KPI_COLORS: DashboardKpiColors = {
  grossPlanFrom: '#0ea5e9', // sky-500
  grossPlanTo: '#0284c7', // sky-600
  grossActualFrom: '#10b981', // emerald-500
  grossActualTo: '#14b8a6', // teal-500
  netPlanBorder: '#ccfbf1', // teal-100
  netActualBorder: '#10b981', // emerald-500
  licenseFrom: '#0d9488', // teal-600
  licenseTo: '#10b981', // emerald-500
  costAnalysisBorder: '#fef3c7', // amber-100
  summaryFrom: '#334155', // slate-700
  summaryTo: '#0d9488', // teal-600
};

const DASHBOARD_EXPORT_SECTIONS = [
  { id: 'section-kpi-summary', labelKey: 'export.kpiSummary', defaultLabel: '業績ハイライト (KPI〜ライセンス)' },
  { id: 'section-cost-analysis', labelKey: 'export.costAnalysis', defaultLabel: 'コスト分析' },
  { id: 'section-financial-summary', labelKey: 'export.financialSummary', defaultLabel: '財務サマリー' },
];

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<MonthlyStats[]>([]);
  const [accumulatedStats, setAccumulatedStats] = useState<AccumulatedStats[]>([]);
  const [loading, setLoading] = useState(true);

  const [exchangeRate, setExchangeRate] = useState(172);
  const [unitPrice, setUnitPrice] = useState(DEFAULT_UNIT_PRICE);
  const [licenseComputers, setLicenseComputers] = useState(7);
  const [licensePerComputer, setLicensePerComputer] = useState(2517143);
  const [rawRecords, setRawRecords] = useState<any[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { t, language } = useLanguage();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [chartColors, setChartColors] = useState<DashboardChartColors>(() => {
    const saved = localStorage.getItem('dashboard_chartColors');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return { planRevenue: '#94a3b8', actualRevenue: '#2563eb', accPlan: '#94a3b8', accActual: '#10b981' };
  });

  const [showKpiColorPicker, setShowKpiColorPicker] = useState(false);
  const [dashboardColors, setDashboardColors] = useState<DashboardKpiColors>(() => {
    const saved = localStorage.getItem('dashboard_kpiColors');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return DEFAULT_KPI_COLORS;
  });

  useEffect(() => {
    localStorage.setItem('dashboard_chartColors', JSON.stringify(chartColors));
  }, [chartColors]);

  useEffect(() => {
    localStorage.setItem('dashboard_kpiColors', JSON.stringify(dashboardColors));
  }, [dashboardColors]);

  const planShort = t('tracker.planShort', 'Plan');
  const actualShort = t('tracker.actualShort', 'Actual');

  useEffect(() => {
    const loadYears = async () => {
      try {
        const years = await dbService.getRecordYears();
        setAvailableYears(years);
        if (years.length > 0) {
          const realYear = new Date().getFullYear();
          setSelectedYear(years.includes(realYear) ? realYear : years[0]);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load years', error);
        setLoading(false);
      }
    };
    loadYears();
  }, []);

  const [yearlyData, setYearlyData] = useState<{ salesPlan: number, salesActual: number | null }>({ salesPlan: 0, salesActual: 0 });
  // Price map from period_projects junction table (same source as YearlyDataView)
  const [projectPriceMap, setProjectPriceMap] = useState<Record<string, { planPrice: number, actPrice: number }>>({});

  useEffect(() => {
    if (selectedYear === null) return;
    const load = async () => {
      try {
        const settings = await dbService.getSettings();
        if (typeof settings.exchangeRate === 'number') setExchangeRate(settings.exchangeRate);
        if (typeof settings.licenseComputers === 'number') setLicenseComputers(settings.licenseComputers);
        if (typeof settings.licensePerComputer === 'number') setLicensePerComputer(settings.licensePerComputer);
        if (typeof settings.unitPrice === 'number') setUnitPrice(settings.unitPrice);

        const records = await dbService.getDashboardStats(selectedYear);
        setRawRecords(records);

        // Fetch projects via period_projects (exactly like YearlyDataView)
        // This is the ONLY way to get the correct plan_price/actual_price
        const periods = await dbService.getPeriods();
        const yearPeriods = periods.filter(p => p.startsWith(selectedYear.toString()));
        const projectPromises = yearPeriods.map(p => dbService.getProjects(p));
        const projectsArrays = await Promise.all(projectPromises);
        const allProjects = projectsArrays.flat();

        // Build price map from period_projects data (deduplicated by project ID)
        const priceMap: Record<string, { planPrice: number, actPrice: number }> = {};
        allProjects.forEach(p => {
          if (p && p.id) {
            priceMap[p.id] = {
              planPrice: p.plan_price || p.unit_price || 0,
              actPrice: p.actual_price || p.unit_price || 0
            };
          }
        });
        setProjectPriceMap(priceMap);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedYear]);

  useEffect(() => {
    if (!selectedYear) return;

    // Aggregate by month
    const locale = language === 'ja' ? 'ja-JP' : language === 'vn' ? 'vi-VN' : 'en-US';
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      name: new Date(selectedYear, i).toLocaleString(locale, { month: 'short' }),
      plannedHours: 0,
      actualHours: 0,
      plannedRevenue: 0,
      actualRevenue: 0,
    }));

    rawRecords.forEach((r: any) => {
      if (r.month >= 1 && r.month <= 12) {
        const target = monthlyData[r.month - 1];
        target.plannedHours += Number(r.planned_hours) || 0;
        target.actualHours += Number(r.actual_hours) || 0;
        // Use prices from period_projects (same source as YearlyDataView table)
        const prices = projectPriceMap[r.project_id];
        const planPrice = prices?.planPrice || 0;
        const actualPrice = prices?.actPrice || 0;
        target.plannedRevenue += (Number(r.planned_hours) || 0) * planPrice;
        target.actualRevenue += (Number(r.actual_hours) || 0) * actualPrice;
      }
    });

    setStats(monthlyData);

    let accPlan = 0;
    let accAct = 0;
    const accData = monthlyData.map(d => {
      accPlan += d.plannedRevenue;
      accAct += d.actualRevenue;
      return { month: d.name, accPlannedRevenue: accPlan, accActualRevenue: accAct };
    });
    setAccumulatedStats(accData);
  }, [rawRecords, unitPrice, language, selectedYear, projectPriceMap]);

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setExchangeRate(val);
    dbService.saveSettings({ exchangeRate: val });
  };

  const handleUnitPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setUnitPrice(val);
    dbService.saveSettings({ unitPrice: val });
  };

  const handleLicenseComputersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setLicenseComputers(val);
    dbService.saveSettings({ licenseComputers: val });
  };

  const handleLicensePerComputerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setLicensePerComputer(val);
    dbService.saveSettings({ licensePerComputer: val });
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" /></div>;
  }

  if (availableYears.length === 0 && !loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <p className="text-slate-600 text-sm">{t('dashboard.empty')}</p>
        </div>
      </div>
    );
  }

  const totalPlanHours = stats.reduce((acc, curr) => acc + curr.plannedHours, 0);
  const totalActualHours = stats.reduce((acc, curr) => acc + curr.actualHours, 0);

  // Replicate YearlyDataView logic exactly: group yearly hours by project, then multiply by price from period_projects
  const projectGrossList: Record<string, { planH: number, actH: number, planP: number, actP: number }> = {};
  rawRecords.forEach(r => {
    const pid = r.project_id;
    if (!projectGrossList[pid]) {
      const prices = projectPriceMap[pid];
      projectGrossList[pid] = {
        planH: 0, actH: 0,
        planP: prices?.planPrice || 0,
        actP: prices?.actPrice || 0
      };
    }
    projectGrossList[pid].planH += (Number(r.planned_hours) || 0);
    projectGrossList[pid].actH += (Number(r.actual_hours) || 0);
  });

  let exactGrossRevenuePlan = 0;
  let exactGrossRevenueActual = 0;
  Object.values(projectGrossList).forEach(p => {
    exactGrossRevenuePlan += p.planH * p.planP;
    exactGrossRevenueActual += p.actH * p.actP;
  });

  const grossRevenuePlan = exactGrossRevenuePlan;
  const grossRevenueActual = exactGrossRevenueActual;

  const licenseTotal = licenseComputers * licensePerComputer;
  const netRevenuePlan = grossRevenuePlan - licenseTotal;
  const netRevenueActual = grossRevenueActual - licenseTotal;
  const achievementRate = totalPlanHours !== 0 ? (totalActualHours / totalPlanHours) * 100 : 0;
  const profitMarginPlan = grossRevenuePlan !== 0 ? (netRevenuePlan / grossRevenuePlan) * 100 : 0;
  const profitMarginActual = grossRevenueActual !== 0 ? (netRevenueActual / grossRevenueActual) * 100 : 0;
  const licenseCostPerHour = totalPlanHours !== 0 ? licenseTotal / totalPlanHours : 0;
  const netHourlyRate = unitPrice - licenseCostPerHour;
  const breakEvenHours = unitPrice !== 0 ? licenseTotal / unitPrice : 0;
  const remainingHours = Math.max(0, totalPlanHours - totalActualHours);

  const toMan = (val: number) => `${(val / 10000).toFixed(1)}万`;
  const fmt = (val: number) => formatCurrency(val);
  const fmtSigned = (val: number) => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    return `${sign}${formatCurrency(abs)}`;
  };
  const fmtHours = (val: number) => `${Math.round(val).toLocaleString()}h`;
  const rateColor = achievementRate >= 100 ? 'text-emerald-600' : achievementRate >= 80 ? 'text-yellow-600' : 'text-red-600';
  const netActualTone = netRevenueActual >= 0 ? 'text-emerald-700 border-emerald-500' : 'text-red-700 border-red-500';

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Group KPI to License with Header for single export */}
        <div id="section-kpi-summary" className="space-y-6 relative">
          {/* Header & Controls */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800">{`${t('header.dashboardTitle', 'Dashboard')} ${selectedYear}`}</h2>
              <select
                data-html2canvas-ignore="true"
                value={selectedYear ?? ''}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <p className="text-sm text-slate-500">{t('dashboard.header.desc', 'Review progress and revenue by year')}</p>
          </div>

          <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
            <SectionExportMenu sections={DASHBOARD_EXPORT_SECTIONS} />
            <button
              data-html2canvas-ignore="true"
              onClick={() => setShowKpiColorPicker(!showKpiColorPicker)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              title="ダッシュボードの色をカスタマイズ"
            >
              <Palette className="w-4 h-4" />
              色変更
            </button>
            <div className="w-full lg:w-auto flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3 bg-sky-50 px-4 py-2 rounded-lg border border-sky-100">
                <Calculator className="w-5 h-5 text-blue-600" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">{t('dashboard.fx.label', 'Exchange Rate')}</span>
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-slate-800 mr-2">1 JPY = </span>
                    <input
                      type="number"
                      className="w-20 h-8 text-sm border-sky-200 rounded px-2 focus:ring-1 focus:ring-sky-500 text-right font-semibold text-slate-800 bg-white"
                      value={exchangeRate}
                      onChange={handleRateChange}
                    />
                    <span className="text-sm font-medium text-slate-800 ml-1">VND</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">{t('dashboard.fx.hourly', 'Hourly Rate (JPY)')}</span>
                  <input
                    type="number"
                    className="w-20 h-8 text-sm border-sky-200 rounded px-2 focus:ring-1 focus:ring-sky-500 text-right font-semibold text-slate-800 bg-white"
                    value={unitPrice}
                    onChange={handleUnitPriceChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-emerald-50 px-4 py-3 rounded-lg border border-emerald-200">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">{t('dashboard.license.count', 'License Seats')}</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full h-9 text-sm border-emerald-200 rounded px-2 focus:ring-1 focus:ring-emerald-500 text-right font-semibold text-emerald-900 bg-white"
                    value={licenseComputers}
                    onChange={handleLicenseComputersChange}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">{t('dashboard.license.perSeat', 'Fee per Seat (JPY)')}</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full h-9 text-sm border-emerald-200 rounded px-2 focus:ring-1 focus:ring-emerald-500 text-right font-semibold text-emerald-900 bg-white"
                    value={licensePerComputer}
                    onChange={handleLicensePerComputerChange}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">{t('dashboard.license.total', 'Annual License Cost')}</span>
                  <div className="mt-1 h-9 flex items-center justify-end text-sm font-bold text-emerald-900">
                    {fmt(licenseTotal)} / {toMan(licenseTotal)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard KPI Color Picker Panel */}
        {showKpiColorPicker && (
          <div data-html2canvas-ignore="true" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-600" />
                Customize Dashboard Colors
              </h4>
              <button
                onClick={() => setDashboardColors(DEFAULT_KPI_COLORS)}
                className="text-xs px-3 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
              >
                Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Gross Plan */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-xs font-bold text-slate-600 mb-2">{t('dashboard.gross.plan', 'Gross Revenue (Plan)')} (Gradient)</p>
                <div className="flex gap-4">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] uppercase text-slate-500">From</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={dashboardColors.grossPlanFrom} onChange={(e) => setDashboardColors({ ...dashboardColors, grossPlanFrom: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                      <input type="text" value={dashboardColors.grossPlanFrom} onChange={(e) => setDashboardColors({ ...dashboardColors, grossPlanFrom: e.target.value })} className="w-full px-2 py-1 text-xs border rounded" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] uppercase text-slate-500">To</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={dashboardColors.grossPlanTo} onChange={(e) => setDashboardColors({ ...dashboardColors, grossPlanTo: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                      <input type="text" value={dashboardColors.grossPlanTo} onChange={(e) => setDashboardColors({ ...dashboardColors, grossPlanTo: e.target.value })} className="w-full px-2 py-1 text-xs border rounded" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Gross Actual */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-xs font-bold text-slate-600 mb-2">{t('dashboard.gross.actual', 'Gross Revenue (Actual)')} (Gradient)</p>
                <div className="flex gap-4">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] uppercase text-slate-500">From</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={dashboardColors.grossActualFrom} onChange={(e) => setDashboardColors({ ...dashboardColors, grossActualFrom: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                      <input type="text" value={dashboardColors.grossActualFrom} onChange={(e) => setDashboardColors({ ...dashboardColors, grossActualFrom: e.target.value })} className="w-full px-2 py-1 text-xs border rounded" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] uppercase text-slate-500">To</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={dashboardColors.grossActualTo} onChange={(e) => setDashboardColors({ ...dashboardColors, grossActualTo: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                      <input type="text" value={dashboardColors.grossActualTo} onChange={(e) => setDashboardColors({ ...dashboardColors, grossActualTo: e.target.value })} className="w-full px-2 py-1 text-xs border rounded" />
                    </div>
                  </div>
                </div>
              </div>

              {/* License */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-xs font-bold text-slate-600 mb-2">{t('dashboard.license.card.subtitle', 'Annual License Fee')} (Gradient)</p>
                <div className="flex gap-4">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] uppercase text-slate-500">From</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={dashboardColors.licenseFrom} onChange={(e) => setDashboardColors({ ...dashboardColors, licenseFrom: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                      <input type="text" value={dashboardColors.licenseFrom} onChange={(e) => setDashboardColors({ ...dashboardColors, licenseFrom: e.target.value })} className="w-full px-2 py-1 text-xs border rounded" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] uppercase text-slate-500">To</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={dashboardColors.licenseTo} onChange={(e) => setDashboardColors({ ...dashboardColors, licenseTo: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                      <input type="text" value={dashboardColors.licenseTo} onChange={(e) => setDashboardColors({ ...dashboardColors, licenseTo: e.target.value })} className="w-full px-2 py-1 text-xs border rounded" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-xs font-bold text-slate-600 mb-2">Financial Summary (Gradient)</p>
                <div className="flex gap-4">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] uppercase text-slate-500">From</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={dashboardColors.summaryFrom} onChange={(e) => setDashboardColors({ ...dashboardColors, summaryFrom: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                      <input type="text" value={dashboardColors.summaryFrom} onChange={(e) => setDashboardColors({ ...dashboardColors, summaryFrom: e.target.value })} className="w-full px-2 py-1 text-xs border rounded" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] uppercase text-slate-500">To</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={dashboardColors.summaryTo} onChange={(e) => setDashboardColors({ ...dashboardColors, summaryTo: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                      <input type="text" value={dashboardColors.summaryTo} onChange={(e) => setDashboardColors({ ...dashboardColors, summaryTo: e.target.value })} className="w-full px-2 py-1 text-xs border rounded" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Solid Borders (Net Plan, Net Actual, Cost) */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 xl:col-span-2">
                <p className="text-xs font-bold text-slate-600 mb-2">Card Borders (Solid)</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase text-slate-500">{t('dashboard.net.plan', 'Net Plan')}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={dashboardColors.netPlanBorder} onChange={(e) => setDashboardColors({ ...dashboardColors, netPlanBorder: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                      <input type="text" value={dashboardColors.netPlanBorder} onChange={(e) => setDashboardColors({ ...dashboardColors, netPlanBorder: e.target.value })} className="w-full px-2 py-1 text-xs border rounded" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase text-slate-500">{t('dashboard.net.actual', 'Net Actual')}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={dashboardColors.netActualBorder} onChange={(e) => setDashboardColors({ ...dashboardColors, netActualBorder: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                      <input type="text" value={dashboardColors.netActualBorder} onChange={(e) => setDashboardColors({ ...dashboardColors, netActualBorder: e.target.value })} className="w-full px-2 py-1 text-xs border rounded" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase text-slate-500">{t('dashboard.costAnalysis.title', 'Cost')}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={dashboardColors.costAnalysisBorder} onChange={(e) => setDashboardColors({ ...dashboardColors, costAnalysisBorder: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                      <input type="text" value={dashboardColors.costAnalysisBorder} onChange={(e) => setDashboardColors({ ...dashboardColors, costAnalysisBorder: e.target.value })} className="w-full px-2 py-1 text-xs border rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI to License wrapper */}
        <div className="space-y-6">
          {/* Row 1: Core KPIs (Hours) */}
          <div id="section-core-kpis" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border-l-4 border-sky-500 rounded-lg p-4 shadow-sm flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-sky-600 uppercase tracking-wider">{t('dashboard.kpi.planHoursLabel', '計画工数')}</div>
              <Clock className="w-5 h-5 text-sky-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{fmtHours(totalPlanHours)}</div>
            <div className="text-xs text-slate-500 mt-1">{t('dashboard.kpi.yearTotal', '年度合計')}</div>
          </div>
          <div className="bg-white border-l-4 border-emerald-500 rounded-lg p-4 shadow-sm flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">{t('dashboard.kpi.actualHoursLabel', '実績工数')}</div>
              <Clock className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{fmtHours(totalActualHours)}</div>
            <div className="text-xs text-slate-500 mt-1">{t('dashboard.kpi.actualHoursDesc', '年間実績合計')}</div>
          </div>
          <div className={`bg-white border-l-4 rounded-lg p-4 shadow-sm flex flex-col justify-center ${totalActualHours - totalPlanHours >= 0 ? 'border-emerald-500' : 'border-rose-500 bg-rose-50'}`}>
            <div className="flex items-center justify-between">
              <div className={`text-xs font-semibold uppercase tracking-wider ${totalActualHours - totalPlanHours >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {t('dashboard.kpi.varianceLabel', '差異')}
              </div>
              <TrendingUp className={`w-5 h-5 ${totalActualHours - totalPlanHours >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
            </div>
            <div className={`mt-2 text-2xl font-bold flex items-center gap-1 ${totalActualHours - totalPlanHours >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {totalActualHours - totalPlanHours < 0 ? '▲' : '▼'} {fmtHours(Math.abs(totalActualHours - totalPlanHours))}
            </div>
            <div className={`text-xs mt-1 ${totalActualHours - totalPlanHours >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              実績 - 計画
            </div>
          </div>
          <div className="bg-white border-l-4 border-teal-500 rounded-lg p-4 shadow-sm flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-teal-600 uppercase tracking-wider">{t('dashboard.kpi.achievementLabel', '達成率')}</div>
              <TrendingUp className="w-5 h-5 text-teal-500" />
            </div>
            <div className={`mt-2 text-2xl font-bold ${rateColor}`}>{achievementRate.toFixed(1)}%</div>
            <div className="text-xs text-slate-500 mt-1">{t('dashboard.kpi.remainingLabel', '残工数')} {fmtHours(remainingHours)}</div>
          </div>
        </div>

        {/* Row 2: Gross Revenue */}
        <div id="section-gross-revenue" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className="col-span-1 rounded-xl p-5 shadow-sm text-white"
            style={{ background: `linear-gradient(to right, ${dashboardColors.grossPlanFrom}, ${dashboardColors.grossPlanTo})` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-sky-100 font-semibold">{t('dashboard.gross.plan', '総売上（計画）')}</p>
              </div>
              <JapaneseYen className="w-5 h-5 text-white/70" />
            </div>
            <div className="mt-3 text-3xl font-bold">{fmt(grossRevenuePlan)}</div>
            <div className="text-sm text-sky-100 mt-1">{toMan(grossRevenuePlan)}</div>
            <div className="mt-3 text-xs text-sky-100 border-t border-white/30 pt-2 opacity-80">
              {t('dashboard.kpi.calculatedPerProject', '期間別プロジェクト単価で算出')}
            </div>
          </div>
          <div
            className="col-span-1 rounded-xl p-5 shadow-sm text-white"
            style={{ background: `linear-gradient(to right, ${dashboardColors.grossActualFrom}, ${dashboardColors.grossActualTo})` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">{t('dashboard.gross.actual', '総売上（実績）')}</p>
              </div>
              <JapaneseYen className="w-5 h-5 text-white/70" />
            </div>
            <div className="mt-3 text-3xl font-bold">{fmt(grossRevenueActual)}</div>
            <div className="text-sm text-emerald-100 mt-1">{toMan(grossRevenueActual)}</div>
            <div className="mt-3 text-xs text-emerald-100 border-t border-white/30 pt-2 opacity-80">
              {t('dashboard.kpi.calculatedPerProject', '期間別プロジェクト単価で算出')}
            </div>
          </div>
          <div className={`col-span-1 rounded-xl p-5 shadow-sm border-2 flex flex-col justify-center ${grossRevenueActual - grossRevenuePlan >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs uppercase tracking-wider font-semibold ${grossRevenueActual - grossRevenuePlan >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {t('dashboard.kpi.varianceLabel', '差異')}
                </p>
              </div>
            </div>
            <div className={`mt-3 text-3xl font-bold pb-1 ${grossRevenueActual - grossRevenuePlan >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              <span className="mr-1 text-2xl">{grossRevenueActual - grossRevenuePlan < 0 ? '▲' : '▼'}</span>
              {fmt(Math.abs(grossRevenueActual - grossRevenuePlan))}
            </div>
            <div className={`text-sm mt-1 font-medium ${grossRevenueActual - grossRevenuePlan >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {toMan(Math.abs(grossRevenueActual - grossRevenuePlan))}
            </div>
          </div>
        </div>

        {/* Row 3: Net Revenue (Profit) */}
        <div id="section-net-revenue" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className="bg-white rounded-xl p-5 shadow-sm border-2 col-span-1 relative overflow-hidden"
            style={{ borderColor: dashboardColors.netPlanBorder }}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <JapaneseYen className="w-24 h-24" />
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-xs uppercase tracking-wider text-teal-600 font-semibold">{t('dashboard.net.plan', '利益 目標')}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">計画売上 - ライセンス</p>
              </div>
            </div>
            <div className="mt-4 text-3xl font-bold text-slate-900 relative z-10">{fmtSigned(netRevenuePlan)}</div>
            <div className="text-sm font-semibold text-teal-600 mt-1 relative z-10">{toMan(netRevenuePlan)}</div>

            <div className="mt-4 text-[11px] font-mono bg-slate-50 p-2 rounded border border-slate-100 text-slate-600 relative z-10">
              <div className="flex justify-between">
                <span>総額: {toMan(grossRevenuePlan)}</span>
                <span className="text-rose-500">- ライセンス: {toMan(licenseTotal)}</span>
              </div>
            </div>
          </div>

          <div
            className="bg-white rounded-xl p-5 shadow-sm border-2 col-span-1 relative overflow-hidden"
            style={{ borderColor: dashboardColors.netActualBorder }}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <JapaneseYen className="w-24 h-24" />
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-600 font-semibold">{t('dashboard.net.actual', '利益 実績')}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">実績売上 - ライセンス</p>
              </div>
            </div>
            <div className={`mt-4 text-3xl font-bold relative z-10 ${netRevenueActual >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {fmtSigned(netRevenueActual)}
            </div>
            <div className={`text-sm font-semibold mt-1 relative z-10 ${netRevenueActual >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {toMan(netRevenueActual)}
            </div>

            <div className="mt-4 text-[11px] font-mono bg-slate-50 p-2 rounded border border-slate-100 text-slate-600 relative z-10">
              <div className="flex justify-between">
                <span>総額: {toMan(grossRevenueActual)}</span>
                <span className="text-rose-500">- ライセンス: {toMan(licenseTotal)}</span>
              </div>
            </div>
          </div>

          <div className={`col-span-1 rounded-xl p-5 shadow-sm border-2 flex flex-col justify-center relative overflow-hidden ${netRevenueActual - netRevenuePlan >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className={`text-xs uppercase tracking-wider font-semibold ${netRevenueActual - netRevenuePlan >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {t('dashboard.kpi.varianceLabel', '差異')}
                </p>
              </div>
            </div>
            <div className={`mt-4 text-3xl font-bold relative z-10 pb-1 ${netRevenueActual - netRevenuePlan >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              <span className="mr-1 text-2xl">{netRevenueActual - netRevenuePlan < 0 ? '▲' : '▼'}</span>
              {fmt(Math.abs(netRevenueActual - netRevenuePlan))}
            </div>
            <div className={`text-sm mt-1 font-semibold relative z-10 ${netRevenueActual - netRevenuePlan >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {toMan(Math.abs(netRevenueActual - netRevenuePlan))}
            </div>

            <div className={`mt-4 text-[11px] font-mono p-2 rounded border relative z-10 ${netRevenueActual - netRevenuePlan >= 0 ? 'bg-emerald-100/50 border-emerald-200 text-emerald-800' : 'bg-rose-100/50 border-rose-200 text-rose-800'}`}>
              <div className="flex justify-between">
                <span>実績利益</span>
                <span>- 目標利益</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: License Card */}
        <div
          id="section-license-card"
          className="text-white rounded-xl p-5 shadow-md"
          style={{ background: `linear-gradient(to right, ${dashboardColors.licenseFrom}, ${dashboardColors.licenseTo})` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-teal-100 font-semibold">{t('dashboard.license.card.title', 'CAD License Management')}</p>
              <p className="text-lg font-bold">{t('dashboard.license.card.subtitle', 'Annual License Fee')}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{fmt(licenseTotal)}</div>
              <div className="text-sm text-teal-50">{toMan(licenseTotal)}</div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="bg-white/15 rounded-lg p-3 border border-white/20">
              <div className="text-xs text-teal-50 font-semibold">{t('dashboard.license.count', 'License Seats')}</div>
              <div className="text-xl font-bold">{licenseComputers.toLocaleString()} {t('dashboard.license.units', 'units')}</div>
              <div className="text-xs text-teal-50 mt-1">{t('dashboard.license.targetPc', 'Target PCs')}</div>
            </div>
            <div className="bg-white/15 rounded-lg p-3 border border-white/20">
              <div className="text-xs text-teal-50 font-semibold">{t('dashboard.license.perSeat', 'Fee per Seat (JPY)')}</div>
              <div className="text-xl font-bold">{fmt(licensePerComputer)}</div>
              <div className="text-xs text-teal-50 mt-1">{toMan(licensePerComputer)}</div>
            </div>
            <div className="bg-white/15 rounded-lg p-3 border border-white/20">
              <div className="text-xs text-teal-50 font-semibold">{t('dashboard.license.card.costPerHour', 'Cost per Hour (plan)')}</div>
              <div className="text-xl font-bold">{fmt(Math.max(0, licenseCostPerHour))}</div>
              <div className="text-xs text-teal-50 mt-1">{t('dashboard.costAnalysis.subtitle', 'Understand license impact')}</div>
            </div>
          </div>
        </div>
        </div> {/* End of inner wrapper */}
        </div> {/* End of section-kpi-summary */}

        {/* Row 5: Cost Analysis */}
        <div
          id="section-cost-analysis"
          className="bg-white rounded-xl p-5 shadow-sm border"
          style={{ borderColor: dashboardColors.costAnalysisBorder, borderWidth: '2px' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold">{t('dashboard.costAnalysis.title', 'Cost Analysis')}</p>
              <p className="text-lg font-bold text-slate-900">{t('dashboard.costAnalysis.subtitle', 'Understand license impact')}</p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-amber-100 bg-amber-50">
              <p className="text-xs font-semibold text-amber-800 uppercase">{t('dashboard.costAnalysis.licensePerHour', 'License / Hour')}</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">{fmt(licenseCostPerHour)}</p>
              <p className="text-xs text-amber-700 mt-1">{t('dashboard.notes.allocatePlan', 'Allocated over planned hours')}</p>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
              <p className="text-xs font-semibold text-slate-700 uppercase">{t('dashboard.costAnalysis.netRate', 'Net Hourly Rate')}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(netHourlyRate)}</p>
              <p className="text-xs text-slate-600 mt-1">{t('dashboard.notes.unitMinusLicense', 'Unit rate - license/hour')}</p>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
              <p className="text-xs font-semibold text-slate-700 uppercase">{t('dashboard.costAnalysis.breakEven', 'Break-even Hours')}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{Math.ceil(breakEvenHours).toLocaleString()} h</p>
              <p className="text-xs text-slate-600 mt-1">{t('dashboard.notes.breakEven', 'License cost ÷ unit rate')}</p>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-bold text-slate-700 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-blue-500" />
                {t('dashboard.chart.monthly', '月次売上：計画 vs 実績')}
              </h3>
              <div className="flex gap-2">
                <button
                  data-html2canvas-ignore="true"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  title="Customize chart colors"
                >
                  <Palette className="w-4 h-4" />
                  Colors
                </button>
                <ChartExportMenu
                  chartId="dashboard-monthly-chart"
                  filenameRequest={`monthly_revenue_${selectedYear}`}
                  data={stats}
                />
              </div>
            </div>
            {/* Color Picker Section */}
            {showColorPicker && (
              <div data-html2canvas-ignore="true" className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  チャートの色をカスタマイズ
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-600">売上（{planShort}）</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={chartColors.planRevenue} onChange={(e) => setChartColors({ ...chartColors, planRevenue: e.target.value })} className="w-10 h-8 rounded border border-slate-300 cursor-pointer" />
                      <input type="text" value={chartColors.planRevenue} onChange={(e) => setChartColors({ ...chartColors, planRevenue: e.target.value })} className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-600">売上（{actualShort}）</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={chartColors.actualRevenue} onChange={(e) => setChartColors({ ...chartColors, actualRevenue: e.target.value })} className="w-10 h-8 rounded border border-slate-300 cursor-pointer" />
                      <input type="text" value={chartColors.actualRevenue} onChange={(e) => setChartColors({ ...chartColors, actualRevenue: e.target.value })} className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-600">{t('dashboard.chart.accPlan', '累計（計画）')}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={chartColors.accPlan} onChange={(e) => setChartColors({ ...chartColors, accPlan: e.target.value })} className="w-10 h-8 rounded border border-slate-300 cursor-pointer" />
                      <input type="text" value={chartColors.accPlan} onChange={(e) => setChartColors({ ...chartColors, accPlan: e.target.value })} className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-600">{t('dashboard.chart.accActual', '累計（実績）')}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={chartColors.accActual} onChange={(e) => setChartColors({ ...chartColors, accActual: e.target.value })} className="w-10 h-8 rounded border border-slate-300 cursor-pointer" />
                      <input type="text" value={chartColors.accActual} onChange={(e) => setChartColors({ ...chartColors, accActual: e.target.value })} className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div id="dashboard-monthly-chart" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                  <YAxis axisLine={false} tickLine={false} fontSize={11} tickFormatter={(val) => `${(val / 10000).toFixed(1)}万`} />
                  <Tooltip formatter={(val: number) => fmt(val as number)} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="plannedRevenue" name={planShort} fill={chartColors.planRevenue} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="plannedRevenue" position="top" formatter={(val: number) => val > 0 ? (val / 10000).toFixed(0) : ''} fontSize={10} fill={chartColors.planRevenue} />
                  </Bar>
                  <Bar dataKey="actualRevenue" name={actualShort} fill={chartColors.actualRevenue} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="actualRevenue" position="top" formatter={(val: number) => val > 0 ? (val / 10000).toFixed(0) : ''} fontSize={10} fill={chartColors.actualRevenue} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-bold text-slate-700 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
                {t('dashboard.charts.cumulative', 'Cumulative Revenue (Plan vs Actual)')}
              </h3>
              <ChartExportMenu
                chartId="dashboard-cumulative-chart"
                filenameRequest={`cumulative_revenue_${selectedYear}`}
                data={accumulatedStats}
              />
            </div>
            <div id="dashboard-cumulative-chart" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={accumulatedStats}>
                  <defs>
                    <linearGradient id="colorAct" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.accActual} stopOpacity={0.1} />
                      <stop offset="95%" stopColor={chartColors.accActual} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} />
                  <YAxis axisLine={false} tickLine={false} fontSize={11} tickFormatter={(val) => `${(val / 10000).toFixed(1)}万`} />
                  <Tooltip formatter={(val: number) => fmt(val as number)} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="accActualRevenue" name={t('dashboard.chart.accActual', actualShort)} stroke={chartColors.accActual} fillOpacity={1} fill="url(#colorAct)" strokeWidth={2}>
                    <LabelList dataKey="accActualRevenue" position="top" formatter={(val: number) => val > 0 ? (val / 10000).toFixed(0) : ''} fontSize={10} fill={chartColors.accActual} fontWeight="bold" offset={10} />
                  </Area>
                  <Line type="monotone" strokeDasharray="3 3" dataKey="accPlannedRevenue" name={t('dashboard.chart.accPlan', planShort)} stroke={chartColors.accPlan} strokeWidth={2} dot={false}>
                    <LabelList dataKey="accPlannedRevenue" position="top" formatter={(val: number) => val > 0 ? (val / 10000).toFixed(0) : ''} fontSize={10} fill={chartColors.accPlan} offset={-10} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div
          id="section-financial-summary"
          className="text-white rounded-xl p-5 shadow-md flex-shrink-0"
          style={{ background: `linear-gradient(to right, ${dashboardColors.summaryFrom}, ${dashboardColors.summaryTo})` }}
        >
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-4 border border-white/15">
              <p className="text-xs font-semibold text-indigo-100 uppercase">{t('dashboard.summary.gross', 'Gross (Actual)')}</p>
              <p className="text-2xl font-bold mt-1">{fmt(grossRevenueActual)}</p>
              <p className="text-sm text-indigo-100">{toMan(grossRevenueActual)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 border border-white/15">
              <p className="text-xs font-semibold text-indigo-100 uppercase">{t('dashboard.summary.license', 'License Cost')}</p>
              <p className="text-2xl font-bold mt-1">{fmt(licenseTotal)}</p>
              <p className="text-sm text-indigo-100">{toMan(licenseTotal)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 border border-white/15">
              <p className="text-xs font-semibold text-indigo-100 uppercase">{t('dashboard.summary.net', 'Net (Actual)')}</p>
              <p className="text-2xl font-bold mt-1">{fmtSigned(netRevenueActual)}</p>
              <p className="text-sm text-indigo-100">{toMan(netRevenueActual)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 border border-white/15">
              <p className="text-xs font-semibold text-indigo-100 uppercase">{t('dashboard.summary.margin', 'Margin (Actual)')}</p>
              <p className="text-2xl font-bold mt-1">{profitMarginActual.toFixed(1)}%</p>
              <p className="text-sm text-indigo-100">Net / Gross</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
