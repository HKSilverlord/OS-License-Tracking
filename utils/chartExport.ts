/**
 * Chart Export Utilities
 * Export Recharts charts to PNG with white background
 */

/**
 * Get all CSS styles as a string to embed in SVG
 */
const getCSSStyles = (element: Element): string => {
  const sheets = document.styleSheets;
  let cssText = '';

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    try {
      const rules = sheet.cssRules || sheet.rules;
      if (rules) {
        for (let j = 0; j < rules.length; j++) {
          cssText += rules[j].cssText + '\n';
        }
      }
    } catch (e) {
      // Skip sheets that can't be accessed due to CORS
      console.warn('Cannot access stylesheet:', e);
    }
  }

  return cssText;
};

/**
 * Export a chart container to PNG with white background
 * @param elementId - The ID of the chart container element
 * @param filename - The desired filename for the download
 */
export const exportChartToPNG = async (elementId: string, filename: string = 'chart.png'): Promise<void> => {
  const chartContainer = document.getElementById(elementId);

  if (!chartContainer) {
    console.error(`Element with id "${elementId}" not found`);
    return;
  }

  try {
    // Find the SVG element within the container
    const svgElement = chartContainer.querySelector('svg');

    if (!svgElement) {
      console.error('No SVG element found in chart container');
      return;
    }

    // Get SVG dimensions
    const bbox = svgElement.getBoundingClientRect();
    const width = bbox.width;
    const height = bbox.height;

    // Clone the SVG
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;

    // Set proper SVG attributes
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clonedSvg.setAttribute('width', width.toString());
    clonedSvg.setAttribute('height', height.toString());

    // Add white background rectangle as first child
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', 'white');
    clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

    // Get all CSS styles and add them to SVG
    const cssText = getCSSStyles(clonedSvg);
    const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleElement.textContent = cssText;
    clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);

    // Serialize to string
    const svgString = new XMLSerializer().serializeToString(clonedSvg);

    // Create canvas
    const canvas = document.createElement('canvas');
    const scale = 2; // Higher resolution
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Scale for better quality
    ctx.scale(scale, scale);

    // Create image from SVG
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Wait for image to load and draw
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });

    // Convert to blob and download
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Failed to create blob from canvas');
        return;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    }, 'image/png');

  } catch (error) {
    console.error('Error exporting chart to PNG:', error);
    alert('Failed to export chart. Please try again.');
  }
};

/**
 * Generate a filename with timestamp
 * @param prefix - Prefix for the filename
 * @param extension - File extension (default: 'png')
 */
export const generateChartFilename = (prefix: string, extension: string = 'png'): string => {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  return `${prefix}_${timestamp}.${extension}`;
};
