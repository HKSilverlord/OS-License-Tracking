/**
 * Shared table styling constants and utilities
 * Used by TrackingView and TotalView for consistent sticky table behavior
 */

export const TABLE_COLUMN_WIDTHS = {
  // TrackingView specific
  select: 64,
  code: 112,
  name: 192,
  price: 96,
  totalHrs: 96,
  totalRev: 112,

  // TotalView specific (slightly different widths)
  codeReadOnly: 100,
  nameReadOnly: 200,
  type: 64,
  month: 80,
  total: 96,
} as const;

export const STICKY_CLASSES = {
  // Left sticky cells
  leftCell: "sticky left-0 bg-white z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
  leftHeader: "sticky left-0 bg-gray-50 z-30 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",

  // Right sticky cells
  rightCell: "sticky right-0 bg-white z-20 border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]",
  rightHeader: "sticky right-0 bg-gray-50 z-30 border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]",

  // Z-index layers
  header: "z-40",
  corner: "z-50",
} as const;

/**
 * Calculate cumulative left position for sticky columns
 */
export const calculateLeftPosition = (...widths: number[]): number => {
  return widths.reduce((sum, width) => sum + width, 0);
};

/**
 * Calculate cumulative right position for sticky columns
 */
export const calculateRightPosition = (...widths: number[]): number => {
  return widths.reduce((sum, width) => sum + width, 0);
};
