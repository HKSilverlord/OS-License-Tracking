import React, { useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUserRole } from '../contexts/UserRoleContext';
import { useCatiaStore, computeYearlyCost } from '../stores/useCatiaStore';
import { Monitor, Info, RotateCcw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface CatiaLicenseViewProps {
  currentYear: number;
}

// 52 columns schema: 2023 (9-12), 2024-2027 (1-12)
const years = [
  { year: 2023, months: [9, 10, 11, 12] },
  { year: 2024, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { year: 2025, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { year: 2026, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { year: 2027, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
];

export const CatiaLicenseView: React.FC<CatiaLicenseViewProps> = ({ currentYear }) => {
  const { t } = useLanguage();
  const { isAdmin } = useUserRole();

  // Value-derived selectors (never select the stable `getYearlyCost` function —
  // that is what stops consumers re-rendering when CATIA data changes).
  const licenseCosts = useCatiaStore((s) => s.licenseCosts);
  const licenseRevenues = useCatiaStore((s) => s.licenseRevenues);
  const updateCost = useCatiaStore((s) => s.updateCost);
  const updateRevenue = useCatiaStore((s) => s.updateRevenue);
  const resetToDefaults = useCatiaStore((s) => s.resetToDefaults);
  const syncStatus = useCatiaStore((s) => s.syncStatus);
  const syncError = useCatiaStore((s) => s.syncError);

  const totalCostForYear = computeYearlyCost(licenseCosts, currentYear);

  // Pull the server copy on mount; make sure a debounced edit is not lost on unmount.
  useEffect(() => {
    void useCatiaStore.getState().hydrate();
    return () => {
      void useCatiaStore.getState().flush();
    };
  }, []);

  const viewOnlyTitle = t('common.viewOnly', 'View only');

  // Helper for background colors similar to Excel
  const getCostBg = (id: number, i: number) => {
    if (id === 1 || id === 2) return i < 28 ? 'bg-slate-100 dark:bg-slate-800/50' : 'bg-green-100 dark:bg-green-900/20';
    if (id === 3 || id === 4) return i >= 8 && i <= 32 ? 'bg-slate-100 dark:bg-slate-800/50' : (i < 8 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-green-100 dark:bg-green-900/20');
    if (id >= 5) return i >= 16 && i <= 30 ? 'bg-slate-100 dark:bg-slate-800/50' : 'bg-slate-50 dark:bg-slate-800';
    return 'bg-white dark:bg-slate-900';
  };

  const handleCostChange = (id: number, idx: number, val: string) => {
    const num = val === '' ? null : parseFloat(val);
    updateCost(id, idx, isNaN(num as number) ? null : num);
  };

  const handleRevenueChange = (id: number, year: number, val: string) => {
    const num = val === '' ? null : parseFloat(val);
    updateRevenue(id, year, isNaN(num as number) ? null : num);
  };

  const handleResetToDefaults = () => {
    const confirmed = window.confirm(
      t('catia.resetConfirm', 'Reset all CATIA license values to defaults?'),
    );
    if (confirmed) resetToDefaults();
  };

  const renderCostCell = (id: number, idx: number, val: number | null, isCurrent: boolean) => {
    const displayVal = val !== null ? Math.round(val) : '';
    const bgClass = getCostBg(id, idx);
    const highlightClass = isCurrent ? 'ring-1 ring-inset ring-blue-400 dark:ring-blue-500/50 bg-blue-50/30 dark:bg-blue-900/30' : '';

    return (
      <td key={idx} className={`border border-slate-200 dark:border-slate-700 p-0 min-w-10 ${bgClass} ${highlightClass} relative group`}>
        <input
          type="number"
          step="1"
          disabled={!isAdmin}
          value={displayVal}
          onChange={(e) => handleCostChange(id, idx, e.target.value)}
          className="w-full h-full text-center bg-transparent border-none p-1 text-[11px] text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 outline-none transition-colors disabled:cursor-not-allowed"
          title={!isAdmin ? viewOnlyTitle : (val !== null ? val.toString() : '')}
        />
      </td>
    );
  };

  const renderRevenueCell = (id: number, y: { year: number, months: number[] }) => {
    const rev = licenseRevenues[id]?.[y.year];
    const isCurrentYear = y.year === currentYear;
    const bgClass = rev !== null && rev !== undefined
      ? isCurrentYear ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20'
      : 'bg-white dark:bg-slate-900';

    const displayVal = rev !== null && rev !== undefined ? Math.round(rev) : '';

    return (
      <td
        key={y.year}
        colSpan={y.months.length}
        className={`border border-slate-200 dark:border-slate-700 p-0 text-center font-semibold ${bgClass} relative`}
      >
        <div className="flex items-center justify-center w-full h-full px-1">
          <input
            type="number"
            step="1"
            disabled={!isAdmin}
            value={displayVal}
            onChange={(e) => handleRevenueChange(id, y.year, e.target.value)}
            className={`w-16 text-center bg-transparent border-b border-transparent focus:border-blue-400 dark:focus:border-blue-500 p-0.5 text-xs outline-none disabled:cursor-not-allowed ${rev ? (isCurrentYear ? 'text-blue-800 dark:text-blue-300' : 'text-amber-800 dark:text-amber-300') : 'text-slate-300 dark:text-slate-600'}`}
            placeholder="—"
            title={!isAdmin ? viewOnlyTitle : undefined}
          />
          {rev !== null && rev !== undefined && (
            <span className="text-[10px] ml-0.5 text-slate-500 dark:text-slate-400">
              {t('catia.manYenUnit', '万')}
            </span>
          )}
        </div>
      </td>
    );
  };

  const renderSyncStatus = () => {
    if (syncStatus === 'loading' || syncStatus === 'saving') {
      return (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 dark:text-slate-500" />
          <span className="text-slate-500 dark:text-slate-400">{t('catia.syncing', 'Syncing…')}</span>
        </>
      );
    }
    if (syncStatus === 'error') {
      return (
        <>
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span className="text-amber-700 dark:text-amber-300" title={syncError ?? undefined}>
            {t('catia.syncError', 'Sync failed — showing local values')}
          </span>
        </>
      );
    }
    return (
      <>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
        <span className="text-slate-500 dark:text-slate-400">{t('catia.synced', 'Synced with server')}</span>
      </>
    );
  };

  // Convert array of licenses to 1..7
  const licenses = [1, 2, 3, 4, 5, 6, 7];

  const title = t('catia.title', 'CATIA License Management');

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <div className="flex-1 overflow-auto p-4 md:p-6">

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Monitor size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('catia.subtitle', 'Interactive License ROI and Cost Tracking')}
                </p>
              </div>
            </div>
            <div className="text-right flex items-center gap-4">
              <div
                className="flex items-center gap-1.5 text-[11px] font-medium"
                role="status"
                aria-live="polite"
              >
                {renderSyncStatus()}
              </div>
              {isAdmin && (
                <button
                  onClick={handleResetToDefaults}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('catia.resetDefaults', 'Reset to defaults')}
                </button>
              )}
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  {t('catia.totalCostForYear', 'Total {year} license cost').replace('{year}', String(currentYear))}
                </div>
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  ¥{totalCostForYear.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg p-3 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p>{t('catia.infoEditable', 'This table is interactive — click any number cell to edit it, just like in Excel.')}</p>
              <p>
                {t('catia.infoAutoRecalc', 'Every change is saved to the server and immediately recalculates the {year} total cost used by the Dashboard charts.').replace('{year}', String(currentYear))}
              </p>
            </div>
          </div>
        </div>

        {/* The Excel-like Editable Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
          <table className="min-w-max w-full border-collapse text-xs select-none dark:text-slate-200">
            <thead>
              {/* Year Headers */}
              <tr>
                <th colSpan={2} className="border border-slate-200 dark:border-slate-700 p-2 bg-slate-100 dark:bg-slate-800 font-bold sticky left-0 z-20 shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155]">{title}</th>
                {years.map(y => (
                  <th key={y.year} colSpan={y.months.length} className={`border border-slate-200 dark:border-slate-700 p-2 text-center font-bold ${y.year === currentYear ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300'}`}>
                    {y.year}
                  </th>
                ))}
              </tr>
              {/* Month Headers */}
              <tr>
                <th colSpan={2} className="border border-slate-200 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 sticky left-0 z-20 shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155]">{t('catia.month', 'Month')}</th>
                {years.map(y => (
                  y.months.map(m => (
                    <th key={`${y.year}-${m}`} className={`border border-slate-200 dark:border-slate-700 p-1 text-center bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 w-10 ${y.year === currentYear ? 'border-b-2 border-b-blue-400 dark:border-b-blue-500 bg-blue-50/50 dark:bg-blue-900/30' : ''}`}>
                      {m}
                    </th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Rows for each License */}
              {licenses.map(id => (
                <React.Fragment key={id}>
                  {/* Row 1: cost */}
                  <tr>
                    {(id === 1) && <td rowSpan={8} className="border border-slate-200 dark:border-slate-700 p-2 font-bold text-center bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 sticky left-0 z-10 w-12 shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155]">{t('catia.purchase', 'Purchase')}</td>}
                    {(id === 5) && <td rowSpan={6} className="border border-slate-200 dark:border-slate-700 p-2 font-bold text-center bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 sticky left-0 z-10 w-12 shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155]">{t('catia.lease', 'Lease')}</td>}
                    <td className="border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold sticky left-12 z-10 w-28 text-center leading-tight break-words shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155]">
                      <div className="text-[9px] text-slate-500 dark:text-slate-400">{t('catia.license', 'License')} {id}</div>
                      <div className="text-[10px]">{t('catia.costTab', 'License cost (10k JPY / month)')}</div>
                    </td>
                    {licenseCosts[id]?.map((val, idx) => {
                      let isCurrentYearCell = false;
                      let colTracker = 0;
                      for(const y of years) {
                        if (idx >= colTracker && idx < colTracker + y.months.length) {
                          isCurrentYearCell = (y.year === currentYear);
                          break;
                        }
                        colTracker += y.months.length;
                      }

                      return renderCostCell(id, idx, val, isCurrentYearCell);
                    })}
                  </tr>

                  {/* Row 2: revenue - merged per year */}
                  <tr>
                    <td className="border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800 text-center sticky left-12 z-10 w-28 text-[10px] leading-tight break-words text-slate-500 dark:text-slate-400 shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155]">
                      {t('catia.revenueTab', 'License revenue (10k JPY / year)')}
                    </td>
                    {years.map(y => renderRevenueCell(id, y))}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700">
            <div className="flex gap-4 text-xs items-center">
              <span className="font-bold flex items-center gap-1"><RotateCcw className="w-3 h-3"/> {t('catia.tipLabel', 'Tip')}</span>
              <span>{t('catia.tipTooltip', 'Hover a number cell to see the full, unrounded value in a tooltip.')}</span>
              <span>{t('catia.tipEditable', 'Values can be updated here month by month — no code change needed.')}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
