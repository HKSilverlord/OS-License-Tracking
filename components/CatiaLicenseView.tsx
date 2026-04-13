import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCatiaStore } from '../stores/useCatiaStore';
import { Monitor, Info, RotateCcw } from 'lucide-react';

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
  const { licenseCosts, licenseRevenues, updateCost, updateRevenue, getYearlyCost, resetToDefaults } = useCatiaStore();

  const totalCostForYear = getYearlyCost(currentYear);

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

  const renderCostCell = (id: number, idx: number, val: number | null, isCurrent: boolean) => {
    const displayVal = val !== null ? Math.round(val) : '';
    const bgClass = getCostBg(id, idx);
    const highlightClass = isCurrent ? 'ring-1 ring-inset ring-blue-400 dark:ring-blue-500/50 bg-blue-50/30 dark:bg-blue-900/30' : '';
    
    return (
      <td key={idx} className={`border border-slate-200 dark:border-slate-700 p-0 min-w-10 ${bgClass} ${highlightClass} relative group`}>
        <input
          type="number"
          step="1"
          value={displayVal}
          onChange={(e) => handleCostChange(id, idx, e.target.value)}
          className="w-full h-full text-center bg-transparent border-none p-1 text-[11px] text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 outline-none transition-colors"
          title={val !== null ? val.toString() : ''}
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
            value={displayVal}
            onChange={(e) => handleRevenueChange(id, y.year, e.target.value)}
            className={`w-16 text-center bg-transparent border-b border-transparent focus:border-blue-400 dark:focus:border-blue-500 p-0.5 text-xs outline-none ${rev ? (isCurrentYear ? 'text-blue-800 dark:text-blue-300' : 'text-amber-800 dark:text-amber-300') : 'text-slate-300 dark:text-slate-600'}`}
            placeholder="—"
          />
          {rev !== null && rev !== undefined && <span className="text-[10px] ml-0.5 text-slate-500 dark:text-slate-400">万</span>}
        </div>
      </td>
    );
  };

  // Convert array of licenses to 1..7
  const licenses = [1, 2, 3, 4, 5, 6, 7];

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
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">CATIA 生産性の管理表</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Interactive License ROI and Cost Tracking</p>
              </div>
            </div>
            <div className="text-right flex items-center gap-4">
              <button 
                onClick={resetToDefaults}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total {currentYear} License Cost</div>
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  ¥{totalCostForYear.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg p-3 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p>Bảng này đã được nâng cấp thành dạng tương tác. Bạn có thể <strong>click vào bất kỳ ô số nào để sửa giá trị</strong> hệt như trên Excel.</p>
              <p>Mọi thay đổi sẽ lập tức TỰ ĐỘNG tính lại Tổng Chi Phí năm <strong>{currentYear}</strong> và kết nối trực tiếp với các biểu đồ ở Dashboard.</p>
            </div>
          </div>
        </div>

        {/* The Excel-like Editable Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
          <table className="min-w-max w-full border-collapse text-xs select-none dark:text-slate-200">
            <thead>
              {/* Year Headers */}
              <tr>
                <th colSpan={2} className="border border-slate-200 dark:border-slate-700 p-2 bg-slate-100 dark:bg-slate-800 font-bold sticky left-0 z-20 shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155]">CATIA 生産性の管理表</th>
                {years.map(y => (
                  <th key={y.year} colSpan={y.months.length} className={`border border-slate-200 dark:border-slate-700 p-2 text-center font-bold ${y.year === currentYear ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300'}`}>
                    {y.year}年
                  </th>
                ))}
              </tr>
              {/* Month Headers */}
              <tr>
                <th colSpan={2} className="border border-slate-200 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-800/50 sticky left-0 z-20 shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155]">月 (Month)</th>
                {years.map(y => (
                  y.months.map(m => (
                    <th key={`${y.year}-${m}`} className={`border border-slate-200 dark:border-slate-700 p-1 text-center bg-slate-50 dark:bg-slate-800/50 w-10 ${y.year === currentYear ? 'border-b-2 border-b-blue-400 dark:border-b-blue-500 bg-blue-50/50 dark:bg-blue-900/30' : ''}`}>
                      {m}月
                    </th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Rows for each License */}
              {licenses.map(id => (
                <React.Fragment key={id}>
                  {/* Row 1: 使用料 (Cost) */}
                  <tr>
                    {(id === 1) && <td rowSpan={8} className="border border-slate-200 dark:border-slate-700 p-2 font-bold text-center bg-white dark:bg-slate-900 sticky left-0 z-10 w-12 shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155]">買取</td>}
                    {(id === 5) && <td rowSpan={6} className="border border-slate-200 dark:border-slate-700 p-2 font-bold text-center bg-white dark:bg-slate-900 sticky left-0 z-10 w-12 shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155]">リース</td>}
                    <td className="border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800 font-semibold sticky left-12 z-10 w-16 text-center shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155]">
                      <div className="text-[9px] text-slate-500 dark:text-slate-400">License {id}</div>
                      使用料
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
                  
                  {/* Row 2: 売上 (Revenue) - merged per year */}
                  <tr>
                    <td className="border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800 text-center sticky left-12 z-10 w-16 text-slate-500 dark:text-slate-400 shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155]">
                      売上
                    </td>
                    {years.map(y => renderRevenueCell(id, y))}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700">
            <div className="flex gap-4 text-xs items-center">
              <span className="font-bold flex items-center gap-1"><RotateCcw className="w-3 h-3"/> Mẹo:</span>
              <span>Di chuột vào ô số sẽ thấy tooltip hiện đầy đủ số thập phân không bị làm tròn.</span>
              <span>Thay vì phải sửa code, bạn có thể tự update công thức ngay tại đây qua các tháng.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
