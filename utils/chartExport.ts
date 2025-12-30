/**
 * Chart Export Utilities
 * Export Recharts charts to PNG with transparent background
 * Complete working solution for capturing full chart
 */

/**
 * Recursively copy ALL computed styles to inline styles
 * This ensures the SVG renders correctly when exported
 */
const inlineAllStyles = (sourceNode: Element, targetNode: Element): void => {
  if (sourceNode.nodeType !== 1) return; // Only process element nodes

  const sourceElement = sourceNode as HTMLElement;
  const targetElement = targetNode as HTMLElement;

  // Get all computed styles
  const computedStyle = window.getComputedStyle(sourceElement);

  // Copy ALL computed CSS properties as inline styles
  for (let i = 0; i < computedStyle.length; i++) {
    const property = computedStyle[i];
    const value = computedStyle.getPropertyValue(property);

    // Set the property on the target element
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
 * Export a chart container to PNG with transparent background
 * Library: Recharts
 *
 * @param elementId - The ID of the chart container element
 * @param filename - The desired filename for the download
 */
export const exportChartToPNG = async (elementId: string, filename: string = 'chart.png'): Promise<void> => {
  // Wait for chart to fully render
  await new Promise(resolve => setTimeout(resolve, 300));

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

    // CRITICAL FIX: Get dimensions from CONTAINER, not SVG
    // ResponsiveContainer makes SVG fill parent, so use parent dimensions
    const containerRect = chartContainer.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    console.log('📊 Exporting chart:', { width, height, containerRect });

    // Clone the SVG deeply
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;

    // Set proper SVG namespace and dimensions
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clonedSvg.setAttribute('width', width.toString());
    clonedSvg.setAttribute('height', height.toString());
    clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // CRITICAL: Copy ALL computed styles inline
    console.log('🎨 Copying styles...');
    inlineAllStyles(svgElement, clonedSvg);

    // Serialize to string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);
    console.log('✅ SVG serialized, length:', svgString.length);

    // Create high-resolution canvas with transparency
    const canvas = document.createElement('canvas');
    const scale = 4; // 4x for 2K quality
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d', {
      alpha: true,
      willReadFrequently: false
    });

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Ensure transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale context for high-res rendering
    ctx.scale(scale, scale);

    // Convert SVG to data URL
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Load and draw image
    const img = new Image();

    console.log('🖼️ Loading image...');

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        console.log('✅ Image loaded, drawing to canvas...');

        // Draw the image
        ctx.drawImage(img, 0, 0, width, height);

        // Clean up
        URL.revokeObjectURL(url);
        resolve();
      };

      img.onerror = (e) => {
        console.error('❌ Image load error:', e);
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG as image'));
      };

      img.src = url;
    });

    console.log('💾 Converting to PNG...');

    // Convert canvas to PNG and download
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('❌ Failed to create blob from canvas');
        alert('Failed to create PNG image');
        return;
      }

      console.log('✅ PNG created, size:', (blob.size / 1024).toFixed(2), 'KB');

      // Download the file
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      console.log('🎉 Export successful!');
    }, 'image/png', 1.0);

  } catch (error) {
    console.error('❌ Export error:', error);
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
