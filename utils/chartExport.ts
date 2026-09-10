/**
 * Chart Export Utilities
 * Multiple export formats: SVG (primary), PNG, PDF, CSV
 * Library: Recharts
 *
 * i18n: this module is a plain utility, so the `t()` hook from LanguageContext
 * is not available here. It uses the module-level `translate()` instead, which
 * reads the same active language without subscribing to re-renders — correct
 * for one-shot toasts raised from an event handler.
 */
import html2canvas from 'html2canvas';
import { toast } from '../contexts/ToastContext';
import { createLogger } from '../src/core/logger';
import { translate } from '../contexts/LanguageContext';

const log = createLogger('chartExport');

/**
 * html2canvas doesn't support oklch() / color-mix() / oklab() (Tailwind v4).
 *
 * Uses a 1×1 canvas to pixel-render each unsupported color token → rgba(),
 * then patches:
 *   1. <link rel="stylesheet"> → fetched, patched, replaced with <style>
 *      (must be async; html2canvas v1.4.1 onclone supports Promise<void>)
 *   2. Inline <style> tags
 *   3. Inline [style] / fill / stroke attributes on every element
 */
const toRgbaViaCanvas = (colorStr: string): string => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return `rgba(${d[0]},${d[1]},${d[2]},${+(d[3] / 255).toFixed(3)})`;
    }
  } catch { /* ignore */ }
  return 'rgba(0,0,0,1)';
};

const replaceUnsupportedColors = (cssText: string): string => {
  const targets = ['oklch', 'color-mix', 'oklab', 'lch', 'lab'];
  let result = cssText;
  for (const fn of targets) {
    let start = 0;
    while ((start = result.indexOf(fn + '(', start)) !== -1) {
      let depth = 0;
      let end = -1;
      for (let i = start + fn.length; i < result.length; i++) {
        if (result[i] === '(') depth++;
        else if (result[i] === ')') {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      if (end !== -1) {
        const token = result.slice(start, end + 1);
        const rgba = toRgbaViaCanvas(token);
        result = result.slice(0, start) + rgba + result.slice(end + 1);
        start += rgba.length;
      } else {
        start++;
      }
    }
  }
  return result;
};

const resolveOklchColors = async (clonedDoc: Document): Promise<void> => {
  // 1. Fetch <link> stylesheets, patch oklch, swap to inline <style>
  const linkEls = Array.from(
    clonedDoc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
  );
  await Promise.all(
    linkEls.map(async (link) => {
      try {
        const res = await fetch(link.href);
        const css = replaceUnsupportedColors(await res.text());
        const style = clonedDoc.createElement('style');
        style.textContent = css;
        link.parentNode?.replaceChild(style, link);
      } catch {
        link.remove();
      }
    })
  );

  // 2. Patch inline <style> tags
  clonedDoc.querySelectorAll('style').forEach(style => {
    if (style.textContent) {
      style.textContent = replaceUnsupportedColors(style.textContent);
    }
  });

  // 3. Patch element-level attributes
  clonedDoc.querySelectorAll<HTMLElement | SVGElement>('*').forEach(el => {
    const inlineStyle = el.getAttribute('style');
    if (inlineStyle) el.setAttribute('style', replaceUnsupportedColors(inlineStyle));
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
 * The colour html2canvas paints behind a capture.
 *
 * It used to be hardcoded `#ffffff`. In dark mode the chart's own text, axes and
 * legends are light (slate-100/300/400), so a white plate rendered them as
 * near-invisible — every PNG and every clipboard copy taken in dark mode came out
 * unreadable. Follow the theme instead; `index.css` drives dark mode from the
 * `dark` class on <html>, so that is what we read.
 */
export const captureBackgroundColor = (): string =>
  document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff';

/**
 * Shared html2canvas capture for every image export in the app.
 *
 * Centralised because two things must be true at EVERY call site and are easy to
 * forget at one of them: the background has to follow the theme (above), and
 * Tailwind v4's `oklch()` colours have to be resolved to rgb() first, since
 * html2canvas cannot parse them and silently drops the styles that use them.
 */
export const captureElement = async (
  element: HTMLElement,
  options: { scale?: number } = {}
): Promise<HTMLCanvasElement> =>
  html2canvas(element, {
    scale: options.scale ?? 3,
    backgroundColor: captureBackgroundColor(),
    logging: false,
    useCORS: true,
    width: element.scrollWidth,
    height: element.scrollHeight,
    onclone: async (clonedDoc: Document, clonedEl: HTMLElement) => {
      clonedEl.style.overflow = 'visible';
      let parent = clonedEl.parentElement;
      while (parent) {
        parent.style.overflow = 'visible';
        parent = parent.parentElement;
      }
      await resolveOklchColors(clonedDoc);
    }
  });

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
    toast.error(translate('chartExport.notFound', 'Chart not found, nothing was exported'));
    log.error('SVG export: element not found', elementId);
    return;
  }

  try {
    // Find the SVG element
    const svgElement = chartContainer.querySelector('svg');

    if (!svgElement) {
      toast.error(translate('chartExport.noChart', 'No chart found to export'));
      return;
    }

    log.debug('Exporting chart as SVG...');

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
    log.debug('Copying styles...');
    inlineAllStyles(svgElement, clonedSvg);

    // Serialize to string
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(clonedSvg);

    // Add XML declaration for proper SVG file
    svgString = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgString;

    log.debug('SVG created, size:', (svgString.length / 1024).toFixed(2), 'KB');

    // Download the SVG file
    downloadFile(svgString, filename, 'image/svg+xml;charset=utf-8');

    log.debug('SVG export successful');
    toast.success(translate('chartExport.done', 'Export complete'));
  } catch (error) {
    log.error('SVG export error:', error);
    toast.error(`${translate('chartExport.failed', 'Export failed')}: ${(error as Error).message}`);
  }
};

/**
 * Export chart as PNG using html2canvas
 * Captures the entire container including HTML legends
 */
export const exportChartToPNG = async (elementId: string, filename: string = 'chart.png'): Promise<void> => {
  const chartContainer = document.getElementById(elementId);

  if (!chartContainer) {
    toast.error(translate('chartExport.notFound', 'Chart not found, nothing was exported'));
    log.error('PNG export: element not found', elementId);
    return;
  }

  try {
    log.debug('Exporting chart as PNG using html2canvas...');

    const canvas = await captureElement(chartContainer);

    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error(translate('chartExport.pngFailed', 'Export failed: could not create the PNG image'));
        return;
      }
      log.debug('PNG created, size:', (blob.size / 1024).toFixed(2), 'KB');
      downloadFile(blob, filename, 'image/png');
      toast.success(translate('chartExport.done', 'Export complete'));
    }, 'image/png', 1.0);

  } catch (error) {
    log.error('PNG export error:', error);
    toast.error(`${translate('chartExport.failed', 'Export failed')}: ${(error as Error).message}`);
  }
};

/**
 * Export chart data as CSV for analysis
 */
export const exportChartDataToCSV = (data: readonly unknown[], filename: string = 'chart-data.csv'): void => {
  try {
    const rows = (data ?? []).filter(
      (row): row is Record<string, unknown> => typeof row === 'object' && row !== null
    );

    if (rows.length === 0) {
      toast.error(translate('chartExport.noData', 'There is no data to export'));
      return;
    }

    log.debug('Exporting chart data as CSV...');

    const headers = Object.keys(rows[0]);

    const csvRows = [
      headers.join(','), // Header row
      ...rows.map(row =>
        headers.map(header => {
          const value = row[header];
          // Quote on newline as well as comma/quote — an unquoted newline splits
          // the record and shifts every later column.
          if (typeof value === 'string' && /[",\n\r]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n'); // Add BOM for Excel

    log.debug('CSV created, rows:', rows.length);
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8');
    log.debug('CSV export successful');
    toast.success(translate('chartExport.done', 'Export complete'));
  } catch (error) {
    log.error('CSV export error:', error);
    toast.error(`${translate('chartExport.failed', 'Export failed')}: ${(error as Error).message}`);
  }
};

/**
 * Copy chart as PNG image to clipboard using html2canvas.
 *
 * Returns whether the copy actually landed. Callers show a "Copied!" confirmation,
 * and this function reports its own failures through a toast — so without a return
 * value they showed a success tick and an error toast at the same time.
 */
export const copyChartToClipboard = async (elementId: string): Promise<boolean> => {
  const chartContainer = document.getElementById(elementId);

  if (!chartContainer) {
    toast.error(translate('chartExport.notFoundCopy', 'Chart not found, nothing was copied'));
    log.error('Clipboard copy: element not found', elementId);
    return false;
  }

  try {
    log.debug('Copying chart to clipboard...');

    const canvas = await captureElement(chartContainer);

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

    log.debug('Chart copied to clipboard');

    // The hand-rolled floating <div> that used to live here is replaced by the
    // shared toast stack so success and failure look the same everywhere.
    toast.success(translate('chartExport.copied', 'Copied to clipboard'));
    return true;
  } catch (error) {
    log.error('Copy to clipboard error:', error);
    toast.error(`${translate('chartExport.copyFailed', 'Copy failed')}: ${(error as Error).message}`);
    return false;
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
