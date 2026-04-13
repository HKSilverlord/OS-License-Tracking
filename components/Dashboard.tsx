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
import { useCatiaStore } from '../stores/useCatiaStore';
import { Card } from '../src/ui/components/Card';
import { KpiCard } from '../src/ui/components/KpiCard';
import { PageHeader } from '../src/ui/components/PageHeader';
import { motion } from 'framer-motion';

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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

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

  const getYearlyCost = useCatiaStore(state => state.getYearlyCost);

  const [showKpiColorPicker, setShowKpiColorPicker] = useState(false);
  const [dashboardColors, setDashboardColors] = useState<DashboardKpiColors>(() => {
    const saved = localStorage.getItem('dashboard_kpiColors');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return DEFAULT_KPI_COLORS;
  });

  const [headingFontSize, setHeadingFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('dashboard_headingFontSize');
    if (saved) {
      try { return parseInt(saved, 10) || 18; } catch (e) { /* ignore */ }
    }
    return 18;
  });

  useEffect(() => {
    localStorage.setItem('dashboard_headingFontSize', headingFontSize.toString());
  }, [headingFontSize]);

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
        <div className="bg-white dark:bg-slate-900 shadow rounded-lg p-6 text-center">
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

  const licenseTotal = selectedYear ? getYearlyCost(selectedYear) : (licenseComputers * licensePerComputer);
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
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="h-full overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-200"
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Group KPI to License with Header for single export */}
        <div id="section-kpi-summary" className="space-y-6 relative">
          {/* Header & Controls */}
          <motion.div variants={itemVariants} className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-200">
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
              <div className="flex flex-wrap items-center gap-3 bg-sky-50 px-4 py-3 rounded-lg border border-sky-100">
                <Calculator className="w-5 h-5 text-blue-600" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider pb-1">{t('dashboard.fx.label', 'Exchange Rate')}</span>
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-slate-800 mr-2">1 JPY = </span>
                    <input
                      type="number"
                      className="w-20 h-8 text-sm border-sky-200 rounded px-2 focus:ring-1 focus:ring-sky-500 text-right font-semibold text-slate-800 bg-white dark:bg-slate-900"
                      value={exchangeRate}
                      onChange={handleRateChange}
                    />
                    <span className="text-sm font-medium text-slate-800 ml-1">VND</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider pb-1">{t('dashboard.fx.hourly', 'Hourly Rate (JPY)')}</span>
                  <input
                    type="number"
                    className="w-20 h-8 text-sm border-sky-200 rounded px-2 focus:ring-1 focus:ring-sky-500 text-right font-semibold text-slate-800 bg-white dark:bg-slate-900"
                    value={unitPrice}
                    onChange={handleUnitPriceChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-emerald-50 px-4 py-3 rounded-lg border border-emerald-200">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider pb-1">{t('dashboard.license.count', 'License Seats')}</span>
                  <input
                    type="number"
                    min={0}
                    className="w-full h-9 text-sm border-emerald-200 rounded px-2 focus:ring-1 focus:ring-emerald-500 text-right font-semibold text-emerald-900 bg-white dark:bg-slate-900"
                    value={licenseComputers}
                    onChange={handleLicenseComputersChange}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider pb-1">{t('dashboard.license.perSeat', 'Fee per Seat (JPY)')}</span>
                  <input
                    type="number"
                    min={0}
                    className="w-full h-9 text-sm border-emerald-200 rounded px-2 focus:ring-1 focus:ring-emerald-500 text-right font-semibold text-emerald-900 bg-white dark:bg-slate-900"
                    value={licensePerComputer}
                    onChange={handleLicensePerComputerChange}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider pb-1">
                    {t('dashboard.license.total', 'Annual License Cost')} (CATIA)
                  </span>
                  <div className="h-9 flex items-center justify-end text-sm font-bold text-emerald-900 bg-white dark:bg-slate-900 px-2 rounded border border-emerald-200" title="Dynamically calculated from CATIA License table">
                    {fmt(licenseTotal)} / {toMan(licenseTotal)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Dashboard KPI Color Picker Panel */}
        {showKpiColorPicker && (
          <div data-html2canvas-ignore="true" className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 mb-6 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-6 flex-wrap">
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-600" />
                  Customize Dashboard Colors
                </h4>
                <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <label className="text-xs font-semibold text-slate-600">Heading Size:</label>
                  <input 
                    type="range" 
                    min="10" 
                    max="22" 
                    step="1" 
                    value={headingFontSize} 
                    onChange={(e) => setHeadingFontSize(parseInt(e.target.value, 10))}
                    className="w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs font-bold w-10 text-right">{headingFontSize}px</span>
                </div>
              </div>
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
          <motion.div variants={itemVariants} id="section-core-kpis" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label={t('dashboard.kpi.planHoursLabel', '計画工数')}
              value={fmtHours(totalPlanHours)}
              subtitle={t('dashboard.kpi.yearTotal', '年度合計')}
              icon={Clock}
              accentColor="sky"
              headingSize={headingFontSize}
            />
            <KpiCard
              label={t('dashboard.kpi.actualHoursLabel', '実績工数')}
              value={fmtHours(totalActualHours)}
              subtitle={t('dashboard.kpi.actualHoursDesc', '年間実績合計')}
              icon={Clock}
              accentColor="emerald"
              headingSize={headingFontSize}
            />
            <KpiCard
              label={t('dashboard.kpi.varianceLabel', '差異')}
              value={`${fmtHours(Math.abs(totalActualHours - totalPlanHours))}`}
              subtitle="実績 - 計画"
              icon={TrendingUp}
              trend={{
                direction: totalActualHours >= totalPlanHours ? 'up' : 'down'
              }}
              headingSize={headingFontSize}
            />
            <KpiCard
              label={t('dashboard.kpi.achievementLabel', '達成率')}
              value={`${achievementRate.toFixed(1)}%`}
              subtitle={`${t('dashboard.kpi.remainingLabel', '残工数')} ${fmtHours(remainingHours)}`}
              icon={TrendingUp}
              accentColor="teal"
              headingSize={headingFontSize}
            />
          </motion.div>

        {/* Row 2: Gross Revenue */}
        <motion.div variants={itemVariants} id="section-gross-revenue" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            gradient
            gradientFrom={dashboardColors.grossPlanFrom}
            gradientTo={dashboardColors.grossPlanTo}
            label={t('dashboard.gross.plan', '総売上（計画）')}
            value={fmt(grossRevenuePlan)}
            subtitle={toMan(grossRevenuePlan)}
            icon={JapaneseYen}
            headingSize={headingFontSize}
          />
          <KpiCard
            gradient
            gradientFrom={dashboardColors.grossActualFrom}
            gradientTo={dashboardColors.grossActualTo}
            label={t('dashboard.gross.actual', '総売上（実績）')}
            value={fmt(grossRevenueActual)}
            subtitle={toMan(grossRevenueActual)}
            icon={JapaneseYen}
            headingSize={headingFontSize}
          />
          <Card className={`flex flex-col justify-center p-5 border-2 ${grossRevenueActual >= grossRevenuePlan ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800'}`}>
            <div className="flex items-center justify-between">
              <p className={`text-xs uppercase tracking-wider font-semibold ${grossRevenueActual >= grossRevenuePlan ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`} style={{ fontSize: `${headingFontSize}px` }}>
                {t('dashboard.kpi.varianceLabel', '差異')}
              </p>
            </div>
            <div className={`mt-3 text-3xl font-bold pb-1 ${grossRevenueActual >= grossRevenuePlan ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
              <span className="mr-1 text-2xl">{grossRevenueActual - grossRevenuePlan < 0 ? '▲' : '▼'}</span>
              {fmt(Math.abs(grossRevenueActual - grossRevenuePlan))}
            </div>
            <div className={`text-sm mt-1 font-medium ${grossRevenueActual >= grossRevenuePlan ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
              {toMan(Math.abs(grossRevenueActual - grossRevenuePlan))}
            </div>
          </Card>
        </motion.div>

        {/* Row 3: Net Revenue (Profit) */}
        {/* Row 3: Net Revenue (Profit) */}
        <motion.div variants={itemVariants} id="section-net-revenue" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 flex flex-col justify-center border-2 border-slate-200 dark:border-slate-800 relative overflow-hidden group hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
              <JapaneseYen className="w-32 h-32 text-slate-800 dark:text-white" />
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 font-semibold" style={{ fontSize: `${headingFontSize}px` }}>{t('dashboard.net.plan', '利益 目標')}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('dashboard.net.plan.subtitle', '計画売上 - ライセンス')}</p>
              </div>
            </div>
            <div className="mt-4 text-3xl font-bold text-slate-900 dark:text-white relative z-10">{fmtSigned(netRevenuePlan)}</div>
            <div className="text-sm font-semibold text-teal-600 dark:text-teal-400 mt-1 relative z-10">{toMan(netRevenuePlan)}</div>

            <div className="mt-4 text-[11px] font-mono bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 relative z-10">
              <div className="flex justify-between items-center">
                <span>総額: {toMan(grossRevenuePlan)}</span>
                <span className="text-rose-500 dark:text-rose-400">- ライセンス: {toMan(licenseTotal)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 flex flex-col justify-center border-2 border-slate-200 dark:border-slate-800 relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
              <JapaneseYen className="w-32 h-32 text-slate-800 dark:text-white" />
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold" style={{ fontSize: `${headingFontSize}px` }}>{t('dashboard.net.actual', '利益 実績')}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('dashboard.net.actual.subtitle', '実績売上 - ライセンス')}</p>
              </div>
            </div>
            <div className={`mt-4 text-3xl font-bold relative z-10 ${netRevenueActual >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
              {fmtSigned(netRevenueActual)}
            </div>
            <div className={`text-sm font-semibold mt-1 relative z-10 ${netRevenueActual >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
              {toMan(netRevenueActual)}
            </div>

            <div className="mt-4 text-[11px] font-mono bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 relative z-10">
              <div className="flex justify-between items-center">
                <span>総額: {toMan(grossRevenueActual)}</span>
                <span className="text-rose-500 dark:text-rose-400">- ライセンス: {toMan(licenseTotal)}</span>
              </div>
            </div>
          </Card>

          <Card className={`p-5 flex flex-col justify-center border-2 relative overflow-hidden ${netRevenueActual >= netRevenuePlan ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800'}`}>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className={`text-xs uppercase tracking-wider font-semibold ${netRevenueActual >= netRevenuePlan ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`} style={{ fontSize: `${headingFontSize}px` }}>
                  {t('dashboard.kpi.varianceLabel', '差異')}
                </p>
              </div>
            </div>
            <div className={`mt-4 text-3xl font-bold relative z-10 pb-1 ${netRevenueActual >= netRevenuePlan ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
              <span className="mr-1 text-2xl">{netRevenueActual < netRevenuePlan ? '▲' : '▼'}</span>
              {fmt(Math.abs(netRevenueActual - netRevenuePlan))}
            </div>
            <div className={`text-sm mt-1 font-semibold relative z-10 ${netRevenueActual >= netRevenuePlan ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
              {toMan(Math.abs(netRevenueActual - netRevenuePlan))}
            </div>

            <div className={`mt-4 text-[11px] font-mono p-2 rounded-lg border relative z-10 ${netRevenueActual >= netRevenuePlan ? 'bg-emerald-100/50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100/50 dark:bg-rose-900/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'}`}>
              <div className="flex justify-between items-center">
                <span>実績利益</span>
                <span>- 目標利益</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Row 4: License Card */}
        {/* Row 4: License Card */}
        <motion.div variants={itemVariants}>
          <Card
            id="section-license-card"
            gradient
            fromColor={dashboardColors.licenseFrom}
            toColor={dashboardColors.licenseTo}
          className="p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-teal-100 font-semibold" style={{ fontSize: `${headingFontSize}px` }}>{t('dashboard.license.card.title', 'CAD License Management')}</p>
              <p className="text-lg font-bold text-white">{t('dashboard.license.card.subtitle', 'Annual License Fee')}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{fmt(licenseTotal)}</div>
              <div className="text-sm text-teal-50">{toMan(licenseTotal)}</div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="bg-black/10 dark:bg-black/20 rounded-lg p-3 border border-white/10 backdrop-blur-sm">
              <div className="text-xs text-teal-50 font-semibold mb-1">{t('dashboard.license.count', 'License Seats')}</div>
              <div className="text-xl font-bold text-white">{licenseComputers.toLocaleString()} <span className="text-base font-medium opacity-80">{t('dashboard.license.units', 'units')}</span></div>
              <div className="text-xs text-teal-50/80 mt-1">{t('dashboard.license.targetPc', 'Target PCs')}</div>
            </div>
            <div className="bg-black/10 dark:bg-black/20 rounded-lg p-3 border border-white/10 backdrop-blur-sm">
              <div className="text-xs text-teal-50 font-semibold mb-1">{t('dashboard.license.perSeat', 'Fee per Seat (JPY)')}</div>
              <div className="text-xl font-bold text-white">{fmt(licensePerComputer)}</div>
              <div className="text-xs text-teal-50/80 mt-1">{toMan(licensePerComputer)}</div>
            </div>
            <div className="bg-black/10 dark:bg-black/20 rounded-lg p-3 border border-white/10 backdrop-blur-sm">
              <div className="text-xs text-teal-50 font-semibold mb-1">{t('dashboard.license.card.costPerHour', 'Cost per Hour (plan)')}</div>
              <div className="text-xl font-bold text-white">{fmt(Math.max(0, licenseCostPerHour))}</div>
              <div className="text-xs text-teal-50/80 mt-1">{t('dashboard.costAnalysis.subtitle', 'Understand license impact')}</div>
            </div>
          </div>
          </Card>
        </motion.div>
        </div> {/* End of inner wrapper */}
        </div> {/* End of section-kpi-summary */}

        {/* Row 5: Cost Analysis */}
        <motion.div variants={itemVariants}>
          <Card
          id="section-cost-analysis"
          className="p-5 border-2"
          style={{ borderColor: dashboardColors.costAnalysisBorder }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-500 font-semibold" style={{ fontSize: `${headingFontSize}px` }}>{t('dashboard.costAnalysis.title', 'Cost Analysis')}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{t('dashboard.costAnalysis.subtitle', 'Understand license impact')}</p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 transition-colors">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-500 uppercase">{t('dashboard.costAnalysis.licensePerHour', 'License / Hour')}</p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-400 mt-1">{fmt(licenseCostPerHour)}</p>
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-500/70 mt-1.5">{t('dashboard.notes.allocatePlan', 'Allocated over planned hours')}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 transition-colors">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase">{t('dashboard.costAnalysis.netRate', 'Net Hourly Rate')}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{fmt(netHourlyRate)}</p>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-500 mt-1.5">{t('dashboard.notes.unitMinusLicense', 'Unit rate - license/hour')}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 transition-colors">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase">{t('dashboard.costAnalysis.breakEven', 'Break-even Hours')}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{Math.ceil(breakEvenHours).toLocaleString()} h</p>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-500 mt-1.5">{t('dashboard.notes.breakEven', 'License cost ÷ unit rate')}</p>
            </div>
          </div>
          </Card>
        </motion.div>

        {/* Charts */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-md font-bold text-slate-700 dark:text-slate-200 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-blue-500" />
                {t('dashboard.chart.monthly', '月次売上：計画 vs 実績')}
              </h3>
              <div className="flex gap-2">
                <button
                  data-html2canvas-ignore="true"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors"
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <YAxis axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" className="text-slate-500 dark:text-slate-400" tickFormatter={(val) => `${(val / 10000).toFixed(1)}万`} />
                  <Tooltip formatter={(val: number) => fmt(val as number)} contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', borderRadius: '8px', border: 'none' }} itemStyle={{ color: '#fff' }} />
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
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-md font-bold text-slate-700 dark:text-slate-200 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-emerald-500" />
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <YAxis axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" className="text-slate-500 dark:text-slate-400" tickFormatter={(val) => `${(val / 10000).toFixed(1)}万`} />
                  <Tooltip formatter={(val: number) => fmt(val as number)} contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', borderRadius: '8px', border: 'none' }} itemStyle={{ color: '#fff' }} />
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
          </Card>
        </motion.div>

        {/* Financial Summary */}
        <motion.div variants={itemVariants}>
          <Card
            id="section-financial-summary"
            gradient
            fromColor={dashboardColors.summaryFrom}
            toColor={dashboardColors.summaryTo}
            className="p-5 flex-shrink-0"
          >
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-black/10 dark:bg-black/20 rounded-xl p-4 border border-white/10 backdrop-blur-sm">
                <p className="text-xs font-semibold text-slate-200 uppercase">{t('dashboard.summary.gross', 'Gross (Actual)')}</p>
                <p className="text-2xl font-bold mt-1 text-white">{fmt(grossRevenueActual)}</p>
                <p className="text-[11px] font-medium mt-1 text-slate-300">{toMan(grossRevenueActual)}</p>
              </div>
              <div className="bg-black/10 dark:bg-black/20 rounded-xl p-4 border border-white/10 backdrop-blur-sm">
                <p className="text-xs font-semibold text-slate-200 uppercase">{t('dashboard.summary.license', 'License Cost')}</p>
                <p className="text-2xl font-bold mt-1 text-white">{fmt(licenseTotal)}</p>
                <p className="text-[11px] font-medium mt-1 text-slate-300">{toMan(licenseTotal)}</p>
              </div>
              <div className="bg-black/10 dark:bg-black/20 rounded-xl p-4 border border-white/10 backdrop-blur-sm">
                <p className="text-xs font-semibold text-slate-200 uppercase">{t('dashboard.summary.net', 'Net (Actual)')}</p>
                <p className="text-2xl font-bold mt-1 text-white">{fmtSigned(netRevenueActual)}</p>
                <p className="text-[11px] font-medium mt-1 text-slate-300">{toMan(netRevenueActual)}</p>
              </div>
              <div className="bg-black/10 dark:bg-black/20 rounded-xl p-4 border border-white/10 backdrop-blur-sm">
                <p className="text-xs font-semibold text-slate-200 uppercase">{t('dashboard.summary.margin', 'Margin (Actual)')}</p>
                <p className="text-2xl font-bold mt-1 text-white">{profitMarginActual.toFixed(1)}%</p>
                <p className="text-[11px] font-medium mt-1 text-slate-300">Net / Gross</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};
