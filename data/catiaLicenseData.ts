export const getYearlyLicenseCost = (year: number): number => {
  // Returns the total license cost in JPY (not man-yen) for a given year.
  // Verified against Excel formulas in CATIA LISENCE.xlsx (Row 21: X21, AJ21)
  // Unit in Excel = 万円, converted to JPY here (×10,000)
  switch (year) {
    case 2023:
      // Lic1: 20.83×4=83.3, Lic2: 83.3 → 166.67万
      return 1_666_667;
    case 2024:
      // Lic1: 20.83×8+31.5×4=292.7, Lic2: 292.7, Lic3: 20.83×7=145.8, Lic4: 145.8 → 877万
      return 8_770_000;
    case 2025:
      // Excel X21 = SUM(U5:AF5,...X17:AF17) = 1762.25万
      return 17_622_500;
    case 2026:
      // Excel AJ21 = SUM(AG5:AR5,...AG17:AR17) = 706.42万
      // Lic1-2: 5.33×12=64ea, Lic3-4: 31.5×5+5.33×7=194.8ea, Lic5-7: 20.97×3=62.9ea
      return 7_064_167;
    case 2027:
      // Lic1-4: 5.33×12=64ea → 256万, Lic5-7: 0
      return 2_560_000;
    default:
      if (year < 2023) return 0;
      return 2_560_000; // Ongoing rate after 2027
  }
};

export const CATIA_YEARS = [2023, 2024, 2025, 2026, 2027];
