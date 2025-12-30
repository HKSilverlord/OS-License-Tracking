/**
 * Chart Export Utilities
 * Export Recharts charts to PNG with transparent background
 */

/**
 * Export a chart container to PNG with transparent background
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
    const svgRect = svgElement.getBoundingClientRect();
    const width = svgRect.width;
    const height = svgRect.height;

    // Clone the SVG to avoid modifying the original
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;

    // Set explicit dimensions on the cloned SVG
    clonedSvg.setAttribute('width', width.toString());
    clonedSvg.setAttribute('height', height.toString());

    // Serialize the SVG to string
    const svgData = new XMLSerializer().serializeToString(clonedSvg);

    // Create a data URL from the SVG
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    // Create an image element
    const img = new Image();
    img.width = width;
    img.height = height;

    // Wait for image to load
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = svgUrl;
    });

    // Create a canvas with transparent background
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Draw the image on the canvas (with transparent background)
    ctx.drawImage(img, 0, 0, width, height);

    // Clean up the blob URL
    URL.revokeObjectURL(svgUrl);

    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Failed to create blob from canvas');
        return;
      }

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
