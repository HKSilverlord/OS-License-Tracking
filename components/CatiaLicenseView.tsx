import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { getYearlyLicenseCost } from '../data/catiaLicenseData';
import { Monitor, Info } from 'lucide-react';

interface CatiaLicenseViewProps {
  currentYear: number;
}

// Generate the 52 columns schema: 2023 (9-12), 2024-2027 (1-12)
const years = [
  { year: 2023, months: [9, 10, 11, 12] },
  { year: 2024, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { year: 2025, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { year: 2026, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { year: 2027, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
];

export const CatiaLicenseView: React.FC<CatiaLicenseViewProps> = ({ currentYear }) => {
  const { t } = useLanguage();

  const totalCostForYear = getYearlyLicenseCost(currentYear);

  // Revenue data per license per year (yearly totals from Excel formulas)
  // Values in 万円. null = no revenue data for that year.
  const revenueByLicense: Record<number, Record<number, number | null>> = {
    1: { 2023: 99.5, 2024: 490, 2025: 43.75, 2026: null, 2027: null },   // E6=199/2, I6=1076/2-48, U6=175/4
    2: { 2023: 99.5, 2024: 490, 2025: 43.75, 2026: null, 2027: null },   // Same as Lic1
    3: { 2023: null, 2024: 90, 2025: 43.75, 2026: null, 2027: null },     // N10=84/2+48, U10=175/4
    4: { 2023: null, 2024: 90, 2025: 43.75, 2026: null, 2027: null },     // Same as Lic3
    5: { 2023: null, 2024: null, 2025: 16.33, 2026: null, 2027: null },   // X14=49/3
    6: { 2023: null, 2024: null, 2025: 16.33, 2026: null, 2027: null },   // X16=X14
    7: { 2023: null, 2024: null, 2025: 16.33, 2026: null, 2027: null },   // X18=X16
  };

  // Helper config for cost rows only (simplified visualization based on Excel)
  const licenseData = [
    {
      id: 1, group: '買取', values: Array(52).fill({}).map((v, i) => {
        if (i < 28) return { cost: '21', costColor: 'bg-gray-200' };
        return { cost: '5', costColor: 'bg-green-300' };
      })
    },
    {
      id: 2, group: '買取', values: Array(52).fill({}).map((v, i) => {
        if (i < 28) return { cost: '21', costColor: 'bg-gray-200' };
        return { cost: '5', costColor: 'bg-green-300' };
      })
    },
    {
      id: 3, group: '買取', values: Array(52).fill({}).map((v, i) => {
        if (i < 8) return { cost: '', costColor: 'bg-gray-100' }; 
        if (i >= 8 && i <= 27) return { cost: '21', costColor: 'bg-gray-200' };
        if (i >= 28 && i <= 32) return { cost: '32', costColor: 'bg-yellow-100' };
        return { cost: '5', costColor: 'bg-green-300' };
      })
    },
    {
      id: 4, group: '買取', values: Array(52).fill({}).map((v, i) => {
        if (i < 8) return { cost: '', costColor: 'bg-gray-100' }; 
        if (i >= 8 && i <= 27) return { cost: '21', costColor: 'bg-gray-200' };
        if (i >= 28 && i <= 32) return { cost: '32', costColor: 'bg-yellow-100' };
        return { cost: '5', costColor: 'bg-green-300' };
      })
    },
    {
      id: 5, group: 'リース', values: Array(52).fill({}).map((v, i) => {
        if (i < 16) return { cost: '', costColor: 'bg-gray-100' }; 
        if (i >= 16 && i <= 30) return { cost: '21', costColor: 'bg-gray-200' };
        return { cost: '', costColor: 'bg-gray-100' };
      })
    },
    {
      id: 6, group: 'リース', values: Array(52).fill({}).map((v, i) => {
        if (i < 16) return { cost: '', costColor: 'bg-gray-100' }; 
        if (i >= 16 && i <= 30) return { cost: '21', costColor: 'bg-gray-200' };
        return { cost: '', costColor: 'bg-gray-100' };
      })
    },
    {
      id: 7, group: 'リース', values: Array(52).fill({}).map((v, i) => {
        if (i < 16) return { cost: '', costColor: 'bg-gray-100' }; 
        if (i >= 16 && i <= 30) return { cost: '21', costColor: 'bg-gray-200' };
        return { cost: '', costColor: 'bg-gray-100' };
      })
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-auto p-4 md:p-6">
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <Monitor size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">CATIA 生産性の管理表</h2>
                <p className="text-sm text-slate-500">License ROI and Cost Tracking for {currentYear}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-500 mb-1">Total {currentYear} License Cost</div>
              <div className="text-2xl font-bold text-slate-800">
                ¥{totalCostForYear.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p>Đây là giao diện sao chép dạng tĩnh từ hệ thống Excel CATIA LISENCE gốc.</p>
              <p>Tổng chi phí license được tính toán và đổ về Dashboard từ dữ liệu năm <strong>{currentYear}</strong> thay vì số cố định ~17 triệu yên như trước.</p>
            </div>
          </div>
        </div>

        {/* The Excel-like Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="min-w-max w-full border-collapse text-xs">
            <thead>
              {/* Year Headers */}
              <tr>
                <th colSpan={2} className="border p-2 bg-slate-100 font-bold sticky left-0 z-20">CATIA 生産性の管理表</th>
                {years.map(y => (
                  <th key={y.year} colSpan={y.months.length} className={`border p-2 text-center font-bold ${y.year === currentYear ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>
                    {y.year}年
                  </th>
                ))}
              </tr>
              {/* Month Headers */}
              <tr>
                <th colSpan={2} className="border p-2 bg-slate-50 sticky left-0 z-20">月 (Month)</th>
                {years.map(y => (
                  y.months.map(m => (
                    <th key={`${y.year}-${m}`} className={`border p-1 text-center bg-slate-50 w-8 ${y.year === currentYear ? 'border-b-2 border-b-blue-400' : ''}`}>
                      {m}月
                    </th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Rows for each License */}
              {licenseData.map(lic => (
                <React.Fragment key={lic.id}>
                  {/* Row 1: 使用料 (Cost) */}
                  <tr>
                    {lic.id === 1 && <td rowSpan={8} className="border p-2 font-bold text-center bg-white sticky left-0 z-10 w-16">買取</td>}
                    {lic.id === 5 && <td rowSpan={6} className="border p-2 font-bold text-center bg-white sticky left-0 z-10 w-16">リース</td>}
                    <td className="border p-1 bg-slate-50 font-semibold sticky left-16 z-10 w-16 text-center">
                      <div className="text-[10px] text-slate-500">License {lic.id}</div>
                      使用料
                    </td>
                    {lic.values.map((v, idx) => {
                      // Determine if this cell belongs to currentYear 
                      let isCurrentYearCell = false;
                      let colTracker = 0;
                      for(const y of years) {
                        if (idx >= colTracker && idx < colTracker + y.months.length) {
                          isCurrentYearCell = (y.year === currentYear);
                          break;
                        }
                        colTracker += y.months.length;
                      }

                      return (
                        <td key={idx} className={`border p-1 text-center ${v.costColor || 'bg-white'} ${isCurrentYearCell ? (v.costColor ? 'opacity-90' : 'bg-blue-50/30') : ''}`}>
                          {v.cost}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Row 2: 売上 (Revenue) - merged per year */}
                  <tr>
                    <td className="border p-1 bg-slate-50 text-center sticky left-16 z-10 w-16 text-slate-500">
                      売上
                    </td>
                    {years.map(y => {
                      const rev = revenueByLicense[lic.id]?.[y.year];
                      const isCurrentYear = y.year === currentYear;
                      return (
                        <td
                          key={y.year}
                          colSpan={y.months.length}
                          className={`border p-1 text-center font-semibold ${
                            rev !== null && rev !== undefined
                              ? isCurrentYear ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'
                              : 'bg-white text-slate-300'
                          }`}
                        >
                          {rev !== null && rev !== undefined ? `${rev}万` : '—'}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <div className="flex gap-4 text-xs items-center">
              <div className="flex items-center gap-1"><div className="w-4 h-4 bg-gray-200 border border-gray-300"></div> <span>通常コスト (Normal Cost)</span></div>
              <div className="flex items-center gap-1"><div className="w-4 h-4 bg-green-300 border border-green-400"></div> <span>回収後コスト (Recovered/Discounted Cost)</span></div>
              <div className="flex items-center gap-1"><div className="w-4 h-4 bg-yellow-200 border border-yellow-300"></div> <span>回収期間 (Recovery Period)</span></div>
              <div className="flex items-center gap-1"><div className="w-4 h-4 bg-green-100 border border-green-200"></div> <span>回収後 (Recovered)</span></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
