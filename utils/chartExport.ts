/**
 * Chart Export Utilities
 * Multiple export formats: SVG (primary), PNG, PDF, CSV
 * Library: Recharts
 */

/**
 * Recursively copy ALL computed styles to inline styles
 * This ensures the exported file renders correctly standalone
 */
const inlineAllStyles = (sourceNode: Element, targetNode: Element): void => {
  if (sourceNode.nodeType !== 1) return;

  const sourceElement = sourceNode as HTMLElement;
  const targetElement = targetNode as HTMLElement;
  const computedStyle = window.getComputedStyle(sourceElement);

  // Copy all computed CSS properties as inline styles
  for (let i = 0; i < computedStyle.length; i++) {
    const property = computedStyle[i];
    const value = computedStyle.getPropertyValue(property);

    try {
      targetElement.style.setProperty(property, value, computedStyle.getPropertyPriority(property));
    } catch (e) {
      // Some properties might not be settable, skip them
    }
  }

  // Recursively process all children
  const sourceChildren = Array.from(sourceNode.children);
  const targetChildren = Array.from(targetNode.children);

  for (let i = 0; i < sourceChildren.length; i++) {
    if (targetChildren[i]) {
      inlineAllStyles(sourceChildren[i], targetChildren[i]);
    }
  }
};

/**
 * Download a file with given content
 */
const downloadFile = (content: string | Blob, filename: string, mimeType: string): void => {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * PRIMARY: Export chart as SVG (vector format)
 * ✅ Perfect quality at any size
 * ✅ Transparent background
 * ✅ No canvas conversion issues
 * ✅ Smaller file size
 * ✅ Can be edited in design tools
 *
 * @param elementId - The ID of the chart container element
 * @param filename - The desired filename for the download
 */
export const exportChartToSVG = async (elementId: string, filename: string = 'chart.svg'): Promise<void> => {
  const chartContainer = document.getElementById(elementId);

  if (!chartContainer) {
    alert(`Chart element with id "${elementId}" not found`);
    return;
  }

  try {
    // Find the SVG element
    const svgElement = chartContainer.querySelector('svg');

    if (!svgElement) {
      alert('No SVG chart found to export');
      return;
    }

    console.log('📊 Exporting chart as SVG...');

    // Get container dimensions
    const containerRect = chartContainer.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    // Clone the SVG deeply
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;

    // Set proper SVG attributes for standalone use
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clonedSvg.setAttribute('width', width.toString());
    clonedSvg.setAttribute('height', height.toString());
    clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Copy all computed styles inline for standalone rendering
    console.log('🎨 Copying styles...');
    inlineAllStyles(svgElement, clonedSvg);

    // Serialize to string
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(clonedSvg);

    // Add XML declaration for proper SVG file
    svgString = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgString;

    console.log('✅ SVG created, size:', (svgString.length / 1024).toFixed(2), 'KB');

    // Download the SVG file
    downloadFile(svgString, filename, 'image/svg+xml;charset=utf-8');

    console.log('🎉 SVG export successful!');
  } catch (error) {
    console.error('❌ SVG export error:', error);
    alert('Failed to export SVG: ' + (error as Error).message);
  }
};

/**
 * Export chart as PNG (fallback option)
 * Note: SVG export is recommended for better quality
 *
 * @param elementId - The ID of the chart container element
 * @param filename - The desired filename for the download
 */
export const exportChartToPNG = async (elementId: string, filename: string = 'chart.png'): Promise<void> => {
  const chartContainer = document.getElementById(elementId);

  if (!chartContainer) {
    alert(`Chart element with id "${elementId}" not found`);
    return;
  }

  try {
    const svgElement = chartContainer.querySelector('svg');

    if (!svgElement) {
      alert('No SVG chart found to export');
      return;
    }

    console.log('📊 Exporting chart as PNG...');

    // Get container dimensions
    const containerRect = chartContainer.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    // Clone and prepare SVG
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('width', width.toString());
    clonedSvg.setAttribute('height', height.toString());
    clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Copy styles
    inlineAllStyles(svgElement, clonedSvg);

    // Serialize
    const svgString = new XMLSerializer().serializeToString(clonedSvg);

    // Create canvas
    const canvas = document.createElement('canvas');
    const scale = 3; // High quality
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.scale(scale, scale);

    // Convert SVG to image
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG as image'));
      };
      img.src = url;
    });

    // Convert to PNG and download
    canvas.toBlob((blob) => {
      if (!blob) {
        alert('Failed to create PNG image');
        return;
      }

      console.log('✅ PNG created, size:', (blob.size / 1024).toFixed(2), 'KB');
      downloadFile(blob, filename, 'image/png');
      console.log('🎉 PNG export successful!');
    }, 'image/png', 1.0);

  } catch (error) {
    console.error('❌ PNG export error:', error);
    alert('Failed to export PNG: ' + (error as Error).message);
  }
};

/**
 * Export chart data as CSV for analysis
 *
 * @param data - Array of data objects
 * @param filename - The desired filename for the download
 */
export const exportChartDataToCSV = (data: any[], filename: string = 'chart-data.csv'): void => {
  try {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    console.log('📊 Exporting chart data as CSV...');

    // Get headers from first data object
    const headers = Object.keys(data[0]);

    // Create CSV content
    const csvRows = [
      headers.join(','), // Header row
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          // Escape values that contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n'); // Add BOM for Excel

    console.log('✅ CSV created, rows:', data.length);

    // Download CSV
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8');

    console.log('🎉 CSV export successful!');
  } catch (error) {
    console.error('❌ CSV export error:', error);
    alert('Failed to export CSV: ' + (error as Error).message);
  }
};

/**
 * Generate a filename with timestamp
 * @param prefix - Prefix for the filename
 * @param extension - File extension (default: 'svg')
 */
export const generateChartFilename = (prefix: string, extension: string = 'svg'): string => {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  return `${prefix}_${timestamp}.${extension}`;
};
