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
      return 6_990_000; // Lic 1-2 at 50k(12m). Lic 3-4 at 320k(5m)+50k(7m)=1950k. Lic 5-7 at 210k(3m). Total 6,990,000
    case 2027:
      return 2_400_000; // Lic 1-4 at 50k(12m). Lic 5-7 ending pay=0. Total 2,400,000
    default:
      if (year < 2023) return 0;
      return 2_400_000; // Assume ongoing rate after 2027
  }
};

export const CATIA_YEARS = [2023, 2024, 2025, 2026, 2027];
