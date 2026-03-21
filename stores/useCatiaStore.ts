import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CatiaState {
  licenseCosts: Record<number, (number | null)[]>;
  licenseRevenues: Record<number, Record<number, number | null>>;

  updateCost: (licenseId: number, monthIndex: number, value: number | null) => void;
  updateRevenue: (licenseId: number, year: number, value: number | null) => void;
  resetToDefaults: () => void;
  
  getYearlyCost: (year: number) => number;
}

// Helper to fill arrays easily
const fillArray = (startIdx: number, endIdx: number, value: number | null, prevArray?: (number | null)[]) => {
  const arr = prevArray ? [...prevArray] : Array(52).fill(null);
  for (let i = startIdx; i <= endIdx; i++) {
    arr[i] = value;
  }
  return arr;
};

// Exact initial state derived from CATIA_LISENCE.xlsx
const defaultLicenseCosts: Record<number, (number | null)[]> = {
  1: fillArray(24, 51, 5.333333333333333, fillArray(12, 23, 31.5, fillArray(0, 11, 20.833333333333332))),
  2: fillArray(24, 51, 5.333333333333333, fillArray(12, 23, 31.5, fillArray(0, 11, 20.833333333333332))),
  3: fillArray(33, 51, 5.333333333333333, fillArray(21, 32, 31.5, fillArray(9, 20, 20.833333333333332))),
  4: fillArray(33, 51, 5.333333333333333, fillArray(21, 32, 31.5, fillArray(9, 20, 20.833333333333332))),
  5: fillArray(19, 30, 20.97222222222222),
  6: fillArray(19, 30, 20.97222222222222),
  7: fillArray(19, 30, 20.97222222222222),
};

const defaultLicenseRevenues: Record<number, Record<number, number | null>> = {
  1: { 2023: 99.5, 2024: 490, 2025: 43.75, 2026: null, 2027: null },
  2: { 2023: 99.5, 2024: 490, 2025: 43.75, 2026: null, 2027: null },
  3: { 2023: null, 2024: 90, 2025: 43.75, 2026: null, 2027: null },
  4: { 2023: null, 2024: 90, 2025: 43.75, 2026: null, 2027: null },
  5: { 2023: null, 2024: null, 2025: 16.333333333333332, 2026: null, 2027: null },
  6: { 2023: null, 2024: null, 2025: 16.333333333333332, 2026: null, 2027: null },
  7: { 2023: null, 2024: null, 2025: 16.333333333333332, 2026: null, 2027: null },
};

// Map year to start and end indices of the 52-month array
const yearIndices: Record<number, [number, number]> = {
  2023: [0, 3],
  2024: [4, 15],
  2025: [16, 27],
  2026: [28, 39],
  2027: [40, 51],
};

export const useCatiaStore = create<CatiaState>()(
  persist(
    (set, get) => ({
      licenseCosts: JSON.parse(JSON.stringify(defaultLicenseCosts)),
      licenseRevenues: JSON.parse(JSON.stringify(defaultLicenseRevenues)),

      updateCost: (licenseId, monthIndex, value) => set((state) => {
        const next = { ...state.licenseCosts };
        next[licenseId] = [...next[licenseId]];
        next[licenseId][monthIndex] = value;
        return { licenseCosts: next };
      }),

      updateRevenue: (licenseId, year, value) => set((state) => {
        const next = { ...state.licenseRevenues };
        next[licenseId] = { ...next[licenseId] };
        next[licenseId][year] = value;
        return { licenseRevenues: next };
      }),

      resetToDefaults: () => set({
        licenseCosts: JSON.parse(JSON.stringify(defaultLicenseCosts)),
        licenseRevenues: JSON.parse(JSON.stringify(defaultLicenseRevenues))
      }),

      getYearlyCost: (year) => {
        const indices = yearIndices[year];
        if (!indices) return 0;
        const [startIdx, endIdx] = indices;
        
        const state = get();
        let totalManYen = 0;
        
        for (let licId = 1; licId <= 7; licId++) {
          for (let i = startIdx; i <= endIdx; i++) {
            totalManYen += state.licenseCosts[licId][i] || 0;
          }
        }
        
        // Convert to exact JPY (×10,000) and round to the nearest whole number to match Excel
        return Math.round(totalManYen * 10000);
      }
    }),
    {
      name: 'catia-license-storage',
    }
  )
);
