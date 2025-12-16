import React, { useEffect, useState } from 'react';
import { dbService } from '../services/dbService';
import { formatCurrency } from '../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Line } from 'recharts';
import { Loader2, TrendingUp, DollarSign, Clock, Calculator } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getAvailableYears, getYearHours } from '../utils/periodData';
import { DEFAULT_UNIT_PRICE } from '../constants';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any[]>([]);
  const [accumulatedStats, setAccumulatedStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState(172);
  const [licenseComputers, setLicenseComputers] = useState(7);
  const [licensePerComputer, setLicensePerComputer] = useState(2517143);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { t } = useLanguage();
  const planShort = t('tracker.planShort', 'Plan');
  const actualShort = t('tracker.actualShort', 'Actual');

  useEffect(() => {
    const years = getAvailableYears();
    setAvailableYears(years);
    if (years.length > 0) {
      setSelectedYear(years[0]);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedYear === null) return;
    const load = async () => {
      try {
        const settings = await dbService.getSettings();
        if (typeof settings.exchangeRate === 'number') setExchangeRate(settings.exchangeRate);
        if (typeof settings.licenseComputers === 'number') setLicenseComputers(settings.licenseComputers);
        if (typeof settings.licensePerComputer === 'number') setLicensePerComputer(settings.licensePerComputer);

        const { monthly } = getYearHours(selectedYear);
        const monthlyData = monthly.map((m, idx) => ({
          ...m,
          name: new Date(selectedYear, idx).toLocaleString('ja-JP', { month: 'short' }),
        }));
        setStats(monthlyData);

        let accPlan = 0;
        let accAct = 0;
        const accData = monthlyData.map(d => {
          accPlan += d.plannedRevenue;
          accAct += d.actualRevenue;
          return { month: d.name, accPlannedRevenue: accPlan, accActualRevenue: accAct };
        });
        setAccumulatedStats(accData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedYear]);

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setExchangeRate(val);
    dbService.saveSettings({ exchangeRate: val });
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

  if (availableYears.length === 0 || selectedYear === null) {
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

  const grossRevenuePlan = totalPlanHours * DEFAULT_UNIT_PRICE;
  const grossRevenueActual = totalActualHours * DEFAULT_UNIT_PRICE;
  const licenseTotal = licenseComputers * licensePerComputer;
  const netRevenuePlan = grossRevenuePlan - licenseTotal;
  const netRevenueActual = grossRevenueActual - licenseTotal;
  const achievementRate = totalPlanHours !== 0 ? (totalActualHours / totalPlanHours) * 100 : 0;
  const profitMarginPlan = grossRevenuePlan !== 0 ? (netRevenuePlan / grossRevenuePlan) * 100 : 0;
  const profitMarginActual = grossRevenueActual !== 0 ? (netRevenueActual / grossRevenueActual) * 100 : 0;
  const licenseCostPerHour = totalPlanHours !== 0 ? licenseTotal / totalPlanHours : 0;
  const netHourlyRate = DEFAULT_UNIT_PRICE - licenseCostPerHour;
  const breakEvenHours = DEFAULT_UNIT_PRICE !== 0 ? licenseTotal / DEFAULT_UNIT_PRICE : 0;
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
        
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
           <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-800">{`${t('header.dashboardTitle', 'Dashboard')} ${selectedYear}`}</h2>
                <select
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
                  <div className="text-sm font-semibold text-slate-900">{fmt(DEFAULT_UNIT_PRICE)}</div>
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

        {/* Row 1: Core KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border-l-4 border-sky-500 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-sky-600 uppercase tracking-wider">{t('dashboard.kpi.planHoursLabel', 'Planned Hours')}</div>
              <Clock className="w-5 h-5 text-sky-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{fmtHours(totalPlanHours)}</div>
            <div className="text-xs text-slate-500 mt-1">{t('dashboard.kpi.yearTotal', 'Year Total')}</div>
          </div>
          <div className="bg-white border-l-4 border-emerald-500 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">{t('dashboard.kpi.actualHoursLabel', 'Actual Hours')}</div>
              <Clock className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{fmtHours(totalActualHours)}</div>
            <div className="text-xs text-slate-500 mt-1">{achievementRate.toFixed(1)}% {t('dashboard.kpi.achievementLabel', 'Achievement')}</div>
          </div>
          <div className="bg-white border-l-4 border-teal-500 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-teal-600 uppercase tracking-wider">{t('dashboard.kpi.achievementLabel', 'Achievement')}</div>
              <TrendingUp className="w-5 h-5 text-teal-500" />
            </div>
            <div className={`mt-2 text-2xl font-bold ${rateColor}`}>{achievementRate.toFixed(1)}%</div>
            <div className="text-xs text-slate-500 mt-1">{t('dashboard.kpi.remainingLabel', 'Remaining Hours')} {fmtHours(remainingHours)}</div>
          </div>
          <div className="bg-white border-l-4 border-slate-500 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{t('dashboard.kpi.unitPriceLabel', 'Unit Rate')}</div>
              <DollarSign className="w-5 h-5 text-slate-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{fmt(DEFAULT_UNIT_PRICE)}</div>
            <div className="text-xs text-slate-500 mt-1">{toMan(DEFAULT_UNIT_PRICE)}{t('dashboard.perHour', ' / hour')}</div>
          </div>
        </div>

        {/* Row 2: License Card */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-500 text-white rounded-xl p-5 shadow-md">
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

        {/* Row 3: Gross Revenue */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="col-span-1 bg-gradient-to-r from-sky-500 to-sky-600 rounded-xl p-5 shadow-md text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-sky-100 font-semibold">{t('dashboard.gross.plan', 'Gross Revenue (Plan)')}</p>
                <p className="text-lg font-bold">{t('dashboard.gross.plan', 'Gross Revenue (Plan)')}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="mt-3 text-3xl font-bold">{fmt(grossRevenuePlan)}</div>
            <div className="text-sm text-sky-100">{toMan(grossRevenuePlan)}</div>
            <div className="mt-3 text-xs text-sky-100 border-t border-white/30 pt-2">
              {t('dashboard.kpi.planHoursLabel', 'Planned Hours')} {fmtHours(totalPlanHours)} × {t('dashboard.kpi.unitPriceLabel', 'Unit Rate')} {fmt(DEFAULT_UNIT_PRICE)}
            </div>
          </div>
          <div className="col-span-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-5 shadow-md text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">{t('dashboard.gross.actual', 'Gross Revenue (Actual)')}</p>
                <p className="text-lg font-bold">{t('dashboard.gross.actual', 'Gross Revenue (Actual)')}</p>
              </div>
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="mt-3 text-3xl font-bold">{fmt(grossRevenueActual)}</div>
            <div className="text-sm text-emerald-100">{toMan(grossRevenueActual)}</div>
            <div className="mt-3 text-xs text-emerald-100 border-t border-white/30 pt-2">
              {t('dashboard.kpi.actualHoursLabel', 'Actual Hours')} {fmtHours(totalActualHours)} × {t('dashboard.kpi.unitPriceLabel', 'Unit Rate')} {fmt(DEFAULT_UNIT_PRICE)}
            </div>
          </div>
        </div>

        {/* Row 4: Net Revenue */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-teal-100 col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-teal-600 font-semibold">{t('dashboard.net.plan', 'Net Revenue (Plan)')}</p>
                <p className="text-lg font-bold text-slate-900">{t('dashboard.net.plan', 'Net Revenue (Plan)')}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-teal-500" />
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">{fmtSigned(netRevenuePlan)}</div>
            <div className="text-sm text-teal-600">{toMan(netRevenuePlan)}</div>
            <div className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-2 space-y-1">
              <div className="flex justify-between"><span>{t('dashboard.gross.plan', 'Gross Revenue (Plan)')}</span><span>{fmt(grossRevenuePlan)}</span></div>
              <div className="flex justify-between text-red-600 font-semibold"><span>{t('dashboard.summary.license', 'License Cost')}</span><span>- {fmt(licenseTotal)}</span></div>
              <div className="flex justify-between font-semibold text-teal-700"><span>{t('dashboard.net.plan', 'Net Revenue (Plan)')}</span><span>{fmtSigned(netRevenuePlan)}</span></div>
              <div className="flex justify-between text-teal-600 font-semibold"><span>{t('dashboard.net.margin', 'Profit Margin')}</span><span>{profitMarginPlan.toFixed(1)}%</span></div>
            </div>
          </div>
          <div className={`bg-white rounded-xl p-5 shadow-sm border ${netActualTone} col-span-1`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-600 font-semibold">{t('dashboard.net.actual', 'Net Revenue (Actual)')}</p>
                <p className="text-lg font-bold text-slate-900">{t('dashboard.net.actual', 'Net Revenue (Actual)')}</p>
              </div>
              <DollarSign className="w-6 h-6" />
            </div>
            <div className={`mt-3 text-3xl font-bold ${netRevenueActual >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtSigned(netRevenueActual)}</div>
            <div className="text-sm text-slate-600">{toMan(netRevenueActual)}</div>
            <div className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-2 space-y-1">
              <div className="flex justify-between"><span>{t('dashboard.gross.actual', 'Gross Revenue (Actual)')}</span><span>{fmt(grossRevenueActual)}</span></div>
              <div className="flex justify-between text-red-600 font-semibold"><span>{t('dashboard.summary.license', 'License Cost')}</span><span>- {fmt(licenseTotal)}</span></div>
              <div className="flex justify-between font-semibold"><span>{t('dashboard.net.actual', 'Net Revenue (Actual)')}</span><span>{fmtSigned(netRevenueActual)}</span></div>
              <div className={`flex justify-between font-semibold ${netRevenueActual >= 0 ? 'text-emerald-700' : 'text-red-700'}`}><span>{t('dashboard.net.margin', 'Profit Margin')}</span><span>{profitMarginActual.toFixed(1)}%</span></div>
            </div>
          </div>
        </div>

        {/* Row 5: Cost Analysis */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-amber-100">
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
              <h3 className="text-md font-bold text-slate-700 mb-4 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-blue-500" />
                {t('dashboard.charts.monthly', 'Monthly Revenue (Plan vs Actual)')}
              </h3>
              <div className="h-72">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
                       <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                       <YAxis axisLine={false} tickLine={false} fontSize={11} tickFormatter={(val) => `${(val/10000).toFixed(1)}万`} />
                       <Tooltip formatter={(val: number) => fmt(val as number)} />
                       <Legend wrapperStyle={{fontSize: '12px'}} />
                       <Bar dataKey="plannedRevenue" name={planShort} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                       <Bar dataKey="actualRevenue" name={actualShort} fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>

           <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-md font-bold text-slate-700 mb-4 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
                {t('dashboard.charts.cumulative', 'Cumulative Revenue (Plan vs Actual)')}
              </h3>
              <div className="h-72">
                 <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={accumulatedStats}>
                       <defs>
                          <linearGradient id="colorAct" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                             <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
                       <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} />
                       <YAxis axisLine={false} tickLine={false} fontSize={11} tickFormatter={(val) => `${(val/10000).toFixed(1)}万`} />
                       <Tooltip formatter={(val: number) => fmt(val as number)} />
                       <Legend wrapperStyle={{fontSize: '12px'}} />
                       <Area type="monotone" dataKey="accActualRevenue" name={t('dashboard.chart.accActual', actualShort)} stroke="#10b981" fillOpacity={1} fill="url(#colorAct)" strokeWidth={2} />
                       <Line type="monotone" strokeDasharray="3 3" dataKey="accPlannedRevenue" name={t('dashboard.chart.accPlan', planShort)} stroke="#94a3b8" strokeWidth={2} dot={false} />
                    </ComposedChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-gradient-to-r from-slate-700 to-teal-600 text-white rounded-xl p-5 shadow-md">
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
