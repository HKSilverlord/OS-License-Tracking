/**
 * CSV Export Utilities
 * Export table data to CSV with UTF-8 encoding (BOM) for Excel compatibility
 */

/**
 * Convert data array to CSV string
 * @param headers - Array of header column names
 * @param rows - Array of row data arrays
 */
export const convertToCSV = (headers: string[], rows: string[][]): string => {
  // Add UTF-8 BOM for Excel to properly recognize Japanese characters
  const BOM = '\uFEFF';

  // Escape fields that contain commas, quotes, or newlines
  const escapeField = (field: string): string => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  // Create CSV header
  const csvHeader = headers.map(escapeField).join(',');

  // Create CSV rows
  const csvRows = rows.map(row => row.map(escapeField).join(',')).join('\n');

  return `${BOM}${csvHeader}\n${csvRows}`;
};

/**
 * Download CSV file
 * @param csvContent - CSV string content
 * @param filename - Desired filename
 */
export const downloadCSV = (csvContent: string, filename: string): void => {
  // Create blob with UTF-8 encoding
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generate a filename with timestamp
 * @param prefix - Prefix for the filename
 */
export const generateCSVFilename = (prefix: string): string => {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  return `${prefix}_${timestamp}.csv`;
};

/**
 * Export table data to CSV file
 * @param headers - Array of header column names
 * @param rows - Array of row data arrays
 * @param filename - Desired filename (optional, will generate with timestamp if not provided)
 */
export const exportTableToCSV = (
  headers: string[],
  rows: string[][],
  filename?: string
): void => {
  const csvContent = convertToCSV(headers, rows);
  const finalFilename = filename || generateCSVFilename('table_export');
  downloadCSV(csvContent, finalFilename);
};
