/**
 * Chart Export Utilities
 * Export Recharts charts to PNG with transparent background
 */

/**
 * Recursively apply inline styles from computed styles
 */
const applyInlineStyles = (sourceNode: Element, targetNode: Element): void => {
  const computedStyle = window.getComputedStyle(sourceNode);
  const targetElement = targetNode as HTMLElement;

  // Apply important presentation attributes
  const importantStyles = [
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap',
    'font-family', 'font-size', 'font-weight', 'text-anchor',
    'color', 'opacity', 'transform'
  ];

  importantStyles.forEach(prop => {
    const value = computedStyle.getPropertyValue(prop);
    if (value && value !== '' && value !== 'none') {
      targetElement.style.setProperty(prop, value);
    }
  });

  // Recursively apply to children
  const sourceChildren = Array.from(sourceNode.children);
  const targetChildren = Array.from(targetNode.children);

  sourceChildren.forEach((sourceChild, i) => {
    if (targetChildren[i]) {
      applyInlineStyles(sourceChild, targetChildren[i]);
    }
  });
};

/**
 * Export a chart container to PNG with transparent background
 * @param elementId - The ID of the chart container element
 * @param filename - The desired filename for the download
 */
export const exportChartToPNG = async (elementId: string, filename: string = 'chart.png'): Promise<void> => {
  const chartContainer = document.getElementById(elementId);

  if (!chartContainer) {
    console.error(`Element with id "${elementId}" not found`);
    alert(`Chart element with id "${elementId}" not found`);
    return;
  }

  try {
    // Find the SVG element within the container
    const svgElement = chartContainer.querySelector('svg');

    if (!svgElement) {
      console.error('No SVG element found in chart container');
      alert('No SVG chart found to export');
      return;
    }

    // Get SVG dimensions
    const bbox = svgElement.getBoundingClientRect();
    const width = bbox.width;
    const height = bbox.height;

    console.log('Exporting chart:', { width, height });

    // Clone the SVG
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;

    // Set proper SVG attributes
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('width', width.toString());
    clonedSvg.setAttribute('height', height.toString());

    // Apply inline styles from computed styles
    applyInlineStyles(svgElement, clonedSvg);

    // Serialize to string
    const svgString = new XMLSerializer().serializeToString(clonedSvg);
    console.log('SVG serialized, length:', svgString.length);

    // Create canvas with high resolution
    const canvas = document.createElement('canvas');
    const scale = 4; // 4x for 2K quality
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Clear canvas to transparent
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);

    // Create data URL from SVG
    const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

    // Create and load image
    const img = new Image();

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        console.log('Image loaded successfully');
        ctx.drawImage(img, 0, 0, width, height);
        resolve();
      };
      img.onerror = (e) => {
        console.error('Image load error:', e);
        reject(new Error('Failed to load SVG as image'));
      };
      img.src = svgDataUrl;
    });

    console.log('Drawing complete, converting to PNG...');

    // Convert to PNG blob and download
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Failed to create blob from canvas');
        alert('Failed to create PNG image');
        return;
      }

      console.log('PNG blob created, size:', blob.size);

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      console.log('Export successful!');
    }, 'image/png', 1.0);

  } catch (error) {
    console.error('Error exporting chart to PNG:', error);
    alert('Failed to export chart: ' + (error as Error).message);
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
