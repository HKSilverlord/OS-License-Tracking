export const getYearlyLicenseCost = (year: number): number => {
  // Returns the total license cost in JPY (not man-yen) for a given year.
  // Based on the CATIA License Excel logic:
  switch (year) {
    case 2023:
      return 1_680_000; // 2 licenses * 4 months * ~210k
    case 2024:
      return 8_400_000; // Lic 1-2 full year, Lic 3-4 from May (8 months) at ~210k
    case 2025:
      return 17_620_000; // 7 licenses full year (matches previous settings)
    case 2026:
      return 9_960_000; // Lic 1-4 at 50k, Lic 5-7 at 210k
    case 2027:
      return 9_960_000; // Lic 1-4 at 50k, Lic 5-7 at 210k
    default:
      if (year < 2023) return 0;
      return 9_960_000; // Assume ongoing rate after 2027
  }
};

export const CATIA_YEARS = [2023, 2024, 2025, 2026, 2027];
