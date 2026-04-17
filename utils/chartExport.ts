/**
 * Chart Export Utilities
 * Multiple export formats: SVG (primary), PNG, PDF, CSV
 * Library: Recharts
 */
import html2canvas from 'html2canvas';

/**
 * html2canvas doesn't support oklch() (used by Tailwind v4).
 * Walk the cloned document's <style> tags and inline [style] attributes,
 * resolve each oklch(...) token to rgb() via a temporary DOM element.
 */
const resolveOklchColors = (clonedDoc: Document): void => {
  const replaceUnsupportedColors = (cssText: string): string => {
    let result = cssText;
    const targets = ['oklch', 'color-mix', 'oklab', 'lch', 'lab'];
    
    for (const target of targets) {
      let startIndex = 0;
      while ((startIndex = result.indexOf(target + '(', startIndex)) !== -1) {
        let openCount = 0;
        let endIndex = -1;
        for (let i = startIndex + target.length; i < result.length; i++) {
          if (result[i] === '(') openCount++;
          else if (result[i] === ')') {
            openCount--;
            if (openCount === 0) {
              endIndex = i;
              break;
            }
          }
        }
        
        if (endIndex !== -1) {
          const colorStr = result.slice(startIndex, endIndex + 1);
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.clearRect(0, 0, 1, 1);
              ctx.fillStyle = colorStr;
              ctx.fillRect(0, 0, 1, 1);
              const data = ctx.getImageData(0, 0, 1, 1).data;
              const rgba = `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3] / 255})`;
              result = result.substring(0, startIndex) + rgba + result.substring(endIndex + 1);
              startIndex += rgba.length;
              continue;
            }
          } catch(e) {}
        }
        startIndex++;
      }
    }
    return result;
  };

  clonedDoc.querySelectorAll('style').forEach(style => {
    if (style.textContent) {
      style.textContent = replaceUnsupportedColors(style.textContent);
    }
  });

  clonedDoc.querySelectorAll<HTMLElement | SVGElement>('*').forEach(el => {
    const inlineStyle = el.getAttribute('style');
    if (inlineStyle) {
      el.setAttribute('style', replaceUnsupportedColors(inlineStyle));
    }
    const fill = el.getAttribute('fill');
    if (fill) el.setAttribute('fill', replaceUnsupportedColors(fill));
    
    const stroke = el.getAttribute('stroke');
    if (stroke) el.setAttribute('stroke', replaceUnsupportedColors(stroke));
  });
};

/**
 * Recursively copy ALL computed styles to inline styles
 * This ensures the exported file renders correctly standalone (SVG only)
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
 * Export chart as PNG using html2canvas
 * Captures the entire container including HTML legends
 */
export const exportChartToPNG = async (elementId: string, filename: string = 'chart.png'): Promise<void> => {
  const chartContainer = document.getElementById(elementId);

  if (!chartContainer) {
    alert(`Chart element with id "${elementId}" not found`);
    return;
  }

  try {
    console.log('📊 Exporting chart as PNG using html2canvas...');

    const canvas = await html2canvas(chartContainer, {
      scale: 3, // High quality
      backgroundColor: '#ffffff', // Ensure white background
      logging: false,
      useCORS: true, // Handle cross-origin images if any
      width: chartContainer.scrollWidth,
      height: chartContainer.scrollHeight,
      onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
        clonedEl.style.overflow = 'visible';
        let parent = clonedEl.parentElement;
        while (parent) {
          parent.style.overflow = 'visible';
          parent = parent.parentElement;
        }
        resolveOklchColors(clonedDoc);
      }
    });

    canvas.toBlob((blob) => {
      if (!blob) {
        alert('Failed to create PNG image');
        return;
      }
      console.log('✅ PNG created, size:', (blob.size / 1024).toFixed(2), 'KB');
      downloadFile(blob, filename, 'image/png');
    }, 'image/png', 1.0);

  } catch (error) {
    console.error('❌ PNG export error:', error);
    alert('Failed to export PNG: ' + (error as Error).message);
  }
};

/**
 * Export chart data as CSV for analysis
 */
export const exportChartDataToCSV = (data: any[], filename: string = 'chart-data.csv'): void => {
  try {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    console.log('📊 Exporting chart data as CSV...');

    const headers = Object.keys(data[0]);

    const csvRows = [
      headers.join(','), // Header row
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n'); // Add BOM for Excel

    console.log('✅ CSV created, rows:', data.length);
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8');
    console.log('🎉 CSV export successful!');
  } catch (error) {
    console.error('❌ CSV export error:', error);
    alert('Failed to export CSV: ' + (error as Error).message);
  }
};

/**
 * Copy chart as PNG image to clipboard using html2canvas
 */
export const copyChartToClipboard = async (elementId: string): Promise<void> => {
  const chartContainer = document.getElementById(elementId);

  if (!chartContainer) {
    alert(`Chart element with id "${elementId}" not found`);
    return;
  }

  try {
    console.log('📋 Copying chart to clipboard...');

    const canvas = await html2canvas(chartContainer, {
      scale: 3, // High quality
      backgroundColor: '#ffffff', // Ensure white background
      logging: false,
      useCORS: true,
      width: chartContainer.scrollWidth,
      height: chartContainer.scrollHeight,
      onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
        clonedEl.style.overflow = 'visible';
        let parent = clonedEl.parentElement;
        while (parent) {
          parent.style.overflow = 'visible';
          parent = parent.parentElement;
        }
        resolveOklchColors(clonedDoc);
      }
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create image blob'));
          return;
        }
        resolve(blob);
      }, 'image/png', 1.0);
    });

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob
      })
    ]);

    console.log('✅ Chart copied to clipboard!');

    // Show success message
    const message = document.createElement('div');
    message.textContent = '✅ Copied to clipboard!';
    message.style.cssText = 'position:fixed;top:20px;right:20px;background:#10b981;color:white;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;box-shadow:0 4px 6px rgba(0,0,0,0.1);z-index:9999;transition:opacity 0.3s ease-out;pointer-events:none;';
    document.body.appendChild(message);

    setTimeout(() => {
      message.style.opacity = '0';
      setTimeout(() => {
        if (message.parentNode) {
          document.body.removeChild(message);
        }
      }, 300);
    }, 2000);

  } catch (error) {
    console.error('❌ Copy to clipboard error:', error);
    alert('Failed to copy chart to clipboard: ' + (error as Error).message);
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
