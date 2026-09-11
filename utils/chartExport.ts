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
import { toast } from '../contexts/ToastContext';
import { createLogger } from './logger';
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
/**
 * Resolve `var(--x[, fallback])` against the live document root.
 *
 * A canvas has no element to resolve custom properties against, so ANY token
 * containing `var()` is unparseable there. Tailwind v4 writes every `/opacity`
 * utility as `color-mix(in oklab, var(--color-blue-50) 60%, transparent)`, so
 * without this the whole palette was unresolvable — see `toRgbaViaCanvas`.
 */
const resolveCssVars = (value: string, depth = 0): string => {
  if (depth > 4 || !value.includes('var(')) return value;

  const rootStyle = getComputedStyle(document.documentElement);
  let out = '';
  let i = 0;

  while (i < value.length) {
    const start = value.indexOf('var(', i);
    if (start === -1) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, start);

    // Match the closing paren of this var(), skipping nested ones.
    let parens = 0;
    let end = -1;
    for (let j = start + 3; j < value.length; j++) {
      if (value[j] === '(') parens++;
      else if (value[j] === ')') {
        parens--;
        if (parens === 0) { end = j; break; }
      }
    }
    if (end === -1) {
      out += value.slice(start);
      break;
    }

    const inner = value.slice(start + 4, end);
    const comma = inner.indexOf(',');
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma === -1 ? '' : inner.slice(comma + 1).trim();
    out += rootStyle.getPropertyValue(name).trim() || fallback;
    i = end + 1;
  }

  // A custom property can itself be defined in terms of another one.
  return resolveCssVars(out, depth + 1);
};

const toRgbaViaCanvas = (colorStr: string): string => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return colorStr;

    const resolved = resolveCssVars(colorStr);

    // Per spec a canvas IGNORES a fillStyle it cannot parse and keeps whatever
    // was there — which defaults to #000. Returning that default painted every
    // unparseable token opaque black instead of leaving it alone, so probe with
    // two sentinels first: if neither sticks the value really is unparseable
    // (two of them, so a colour that genuinely equals one sentinel still reads
    // as parseable). Handing the token back unchanged makes html2canvas drop
    // the declaration, which is far better than a black plate over the export.
    const parses = (sentinel: string): boolean => {
      ctx.fillStyle = sentinel;
      ctx.fillStyle = resolved;
      return ctx.fillStyle !== sentinel;
    };
    if (!parses('#ff00ff') && !parses('#00ff00')) return colorStr;

    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = resolved;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${d[0]},${d[1]},${d[2]},${+(d[3] / 255).toFixed(3)})`;
  } catch {
    return colorStr;
  }
};

const replaceUnsupportedColors = (cssText: string): string => {
  const targets = ['oklch', 'color-mix', 'oklab', 'lch', 'lab'];
  let result = cssText;
  for (const fn of targets) {
    let start = 0;
    while ((start = result.indexOf(fn + '(', start)) !== -1) {
      // `lab(` also matches inside `oklab(`, and `lch(` inside `oklch(`. That is
      // harmless while every token gets rewritten, but a token we hand back
      // unchanged would be re-matched on a later pass and mangled into
      // `okrgba(…)`. Only accept a match that starts a CSS function name.
      const prev = start > 0 ? result[start - 1] : '';
      if (/[A-Za-z0-9_-]/.test(prev)) {
        start++;
        continue;
      }
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
  // 1. Read <link> stylesheets, patch oklch/color-mix, swap to inline <style>
  const linkEls = Array.from(
    clonedDoc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
  );

  /**
   * Read a linked stylesheet's text.
   *
   * The live, already-parsed sheet comes first on purpose. Re-fetching the href
   * looks equivalent but is not: Vite's dev server content-negotiates the same
   * URL, handing a `<link>` real CSS and a `fetch()` a JavaScript module — so the
   * fetch path replaced the whole stylesheet with JS source and every export
   * taken from `npm run dev` came out completely unstyled.
   */
  const readStylesheet = async (href: string): Promise<string | null> => {
    const live = Array.from(document.styleSheets).find(sheet => sheet.href === href);
    try {
      if (live?.cssRules) {
        return Array.from(live.cssRules).map(rule => rule.cssText).join('\n');
      }
    } catch {
      // Cross-origin sheet (Google Fonts): cssRules throws. Fetch is allowed to
      // read it because the response is CORS-enabled, so fall through.
    }

    try {
      const res = await fetch(href, { headers: { Accept: 'text/css,*/*;q=0.1' } });
      if (!res.ok) return null;
      if (!(res.headers.get('content-type') ?? '').includes('css')) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  await Promise.all(
    linkEls.map(async (link) => {
      const css = await readStylesheet(link.href);
      if (css === null) {
        // Leaving the <link> in place keeps the real styles: html2canvas will
        // drop the colours it cannot parse, which still beats dropping the
        // entire stylesheet and capturing unstyled text.
        log.warn('Could not read stylesheet for capture, leaving it linked:', link.href);
        return;
      }
      const style = clonedDoc.createElement('style');
      style.textContent = replaceUnsupportedColors(css);
      link.parentNode?.replaceChild(style, link);
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
 * Give one-line clipped text room for its descenders.
 *
 * html2canvas draws glyphs a couple of pixels lower than the browser does, so a
 * `white-space: nowrap; overflow: hidden` box exactly one line tall — Tailwind's
 * `truncate`, which every project name uses — shaved the bottom off every "g",
 * "j" and "y" in the exported table. An element's overflow is clipped at its
 * PADDING box, so padding the bottom out and cancelling it with an equal
 * negative margin widens the clip without moving a single pixel of layout.
 */
const DESCENDER_ROOM_PX = 6;

const unclipSingleLineText = (root: HTMLElement): void => {
  const view = root.ownerDocument.defaultView;
  if (!view) return;

  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    // SVG ignores padding, so charts are unaffected either way — skip them so the
    // walk stays cheap and obviously scoped to HTML text boxes.
    if (!(el instanceof view.HTMLElement)) continue;
    const styles = view.getComputedStyle(el);
    if (styles.overflow !== 'hidden' || styles.whiteSpace !== 'nowrap') continue;
    el.style.paddingBottom = `${parseFloat(styles.paddingBottom) + DESCENDER_ROOM_PX}px`;
    el.style.marginBottom = `${parseFloat(styles.marginBottom) - DESCENDER_ROOM_PX}px`;
  }
};

/**
 * Browsers cap how big a canvas may be. Chrome and Safari refuse anything over
 * ~268M device pixels (and 16384 px on either side); past the cap they hand back
 * a canvas that is blank or never paints, so the export "succeeds" with an empty
 * image. The yearly table is wide AND grows a row pair per project, so it is the
 * one capture that can realistically cross it — step the scale down instead of
 * shipping a blank PNG.
 */
const MAX_CANVAS_SIDE = 16384;
const MAX_CANVAS_AREA = 256 * 1024 * 1024; // 268M device px, Chrome/Safari's cap

const fitScale = (width: number, height: number, requested: number): number => {
  if (width <= 0 || height <= 0) return requested;

  const bySide = Math.min(MAX_CANVAS_SIDE / width, MAX_CANVAS_SIDE / height);
  const byArea = Math.sqrt(MAX_CANVAS_AREA / (width * height));
  const allowed = Math.min(bySide, byArea);
  if (requested <= allowed) return requested;

  const scale = Math.floor(allowed * 100) / 100;
  if (scale < 1) {
    // Even 1:1 is past the cap. Downscaling below CSS pixels would make the
    // table unreadable anyway, so capture at 1 and say plainly that the result
    // may come back blank rather than failing silently.
    log.error(
      `Element is ${width}x${height} CSS px — too large to rasterise (cap ${MAX_CANVAS_SIDE}px/side, ` +
      `${MAX_CANVAS_AREA} px total). Capturing at scale 1; the image may be incomplete.`
    );
    return 1;
  }
  log.warn(
    `Capture ${width}x${height} would exceed the canvas limit at scale ${requested}; using ${scale}`
  );
  return scale;
};

/**
 * The element's full painted size in CSS pixels.
 *
 * `scrollWidth`/`scrollHeight` are integers ROUNDED DOWN, so a table whose
 * layout width is 1439.39px reported 1439 and the capture lost the last
 * fraction of the rightmost column's border. Take the larger of the two
 * measurements and round up, so the canvas can only ever be too big.
 */
const capturedSize = (element: HTMLElement): { width: number; height: number } => {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.ceil(Math.max(element.scrollWidth, rect.width)),
    height: Math.ceil(Math.max(element.scrollHeight, rect.height)),
  };
};

/**
 * Shared html2canvas capture for every image export in the app.
 *
 * Centralised because three things must be true at EVERY call site and are easy
 * to forget at one of them: the background has to follow the theme (above),
 * Tailwind v4's `oklch()` / `color-mix()` colours have to be resolved to rgb()
 * first (html2canvas cannot parse them and silently drops the styles that use
 * them), and the requested scale has to fit inside the browser's canvas cap.
 */
export const captureElement = async (
  element: HTMLElement,
  options: { scale?: number } = {}
): Promise<HTMLCanvasElement> => {
  // Only image export needs html2canvas, and most sessions never trigger one.
  const { default: html2canvas } = await import('html2canvas');

  const { width, height } = capturedSize(element);

  if (width === 0 || height === 0) {
    throw new Error(`Nothing to capture: <${element.tagName.toLowerCase()}> measures ${width}x${height}`);
  }

  const scale = fitScale(width, height, options.scale ?? 3);

  const canvas = await html2canvas(element, {
    scale,
    backgroundColor: captureBackgroundColor(),
    logging: false,
    useCORS: true,
    width,
    height,
    onclone: async (clonedDoc: Document, clonedEl: HTMLElement) => {
      // The capture target usually lives inside a scroll box. html2canvas paints
      // whatever the CLONE's layout says, so un-clipping the clone's ancestors is
      // what makes the off-screen part of a table render at all — and it also
      // collapses `position: sticky` back to each cell's natural spot, which is
      // where a full-size image wants them.
      clonedEl.style.overflow = 'visible';
      let parent = clonedEl.parentElement;
      while (parent) {
        parent.style.overflow = 'visible';
        // `overflow` is not the only way an ancestor clips its children, and the
        // others survive setting it to visible. Any of them would crop the
        // capture back down to what was on screen.
        parent.style.clipPath = 'none';
        parent.style.contain = 'none';
        parent.style.maskImage = 'none';
        parent.scrollTop = 0;
        parent.scrollLeft = 0;
        parent = parent.parentElement;
      }
      await resolveOklchColors(clonedDoc);
      unclipSingleLineText(clonedEl);
    }
  });

  // A canvas the browser refused to allocate at the requested size comes back
  // smaller with no error, which reads as "the export cropped my table". Say so
  // in the console instead of leaving it to be guessed at from the image.
  const shortBy = {
    x: Math.round(width * scale) - canvas.width,
    y: Math.round(height * scale) - canvas.height,
  };
  if (shortBy.x > 1 || shortBy.y > 1) {
    log.error(
      `Capture came back cropped: asked for ${Math.round(width * scale)}x${Math.round(height * scale)} ` +
      `(${width}x${height} CSS px at scale ${scale}), got ${canvas.width}x${canvas.height}.`
    );
  }

  return canvas;
};
/** Capture straight to a PNG blob — the form both the copy and save paths want. */
export const captureElementToPngBlob = async (
  element: HTMLElement,
  options: { scale?: number } = {}
): Promise<Blob> => {
  const canvas = await captureElement(element, options);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
  if (!blob) throw new Error(`Canvas ${canvas.width}x${canvas.height} produced no PNG blob`);
  return blob;
};

const clipboardSupportsImages = (): boolean =>
  typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

/**
 * Copy an element to the clipboard as a PNG, with the two fallbacks that decide
 * whether the button is reliable in practice.
 *
 * 1. The ClipboardItem is built from the still-PENDING capture promise and
 *    handed to `write()` before the first `await`, so the call is still inside
 *    the click. Safari only honours a write issued from the gesture, and the
 *    capture takes far longer than the activation window.
 * 2. If that shape is rejected (older engines want a settled Blob) the awaited
 *    blob is retried, and if the clipboard is unusable altogether — a page
 *    served over plain HTTP has no `navigator.clipboard` at all — the PNG is
 *    downloaded instead so the user still walks away with the image.
 *
 * MUST be called synchronously from the click handler for step 1 to hold.
 */
export const copyElementToClipboard = async (
  element: HTMLElement,
  options: { scale?: number; fallbackFilename?: string } = {}
): Promise<boolean> => {
  const filename = options.fallbackFilename ?? 'capture.png';
  const blobPromise = captureElementToPngBlob(element, options);
  // A rejection here is reported through whichever branch below awaits it; keep
  // it from surfacing as an unhandled rejection in the meantime.
  blobPromise.catch(() => undefined);

  let clipboardError: unknown;

  if (clipboardSupportsImages()) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
      toast.success(translate('chartExport.copied', 'Copied to clipboard'));
      return true;
    } catch (error) {
      clipboardError = error;
    }
  }

  // Re-awaiting settles to the same result. If the CAPTURE is what failed this
  // rethrows the real cause, so a capture bug never gets reported as a
  // clipboard-permission problem.
  let blob: Blob;
  try {
    blob = await blobPromise;
  } catch (error) {
    log.error('Capture failed:', error);
    toast.error(`${translate('chartExport.copyFailed', 'Copy failed')}: ${(error as Error).message}`);
    return false;
  }

  if (clipboardSupportsImages()) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success(translate('chartExport.copied', 'Copied to clipboard'));
      return true;
    } catch (error) {
      clipboardError = error;
    }
  }

  log.error('Clipboard unavailable, downloading instead:', clipboardError);
  downloadFile(blob, filename, 'image/png');
  toast.warning(translate('chartExport.clipboardFallback', 'Clipboard unavailable — the image was downloaded instead'));
  // The user has the image, but nothing reached the clipboard — reporting true
  // here would light up a "Copied!" tick for a copy that did not happen.
  return false;
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
 * Copy chart as PNG image to clipboard.
 *
 * Returns whether the copy actually landed. Callers show a "Copied!" confirmation,
 * and this function reports its own failures through a toast — so without a return
 * value they showed a success tick and an error toast at the same time.
 *
 * Synchronous up to the `copyElementToClipboard` call so the clipboard write
 * still happens inside the click; see that function for why that matters.
 */
export const copyChartToClipboard = (elementId: string): Promise<boolean> => {
  const chartContainer = document.getElementById(elementId);

  if (!chartContainer) {
    toast.error(translate('chartExport.notFoundCopy', 'Chart not found, nothing was copied'));
    log.error('Clipboard copy: element not found', elementId);
    return Promise.resolve(false);
  }

  return copyElementToClipboard(chartContainer, {
    fallbackFilename: generateChartFilename(elementId, 'png')
  });
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
