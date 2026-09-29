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
import { timestampedFilename } from './exportFilename';
import { exportsOnLightBackground, withExportTheme } from './exportPrefs';

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
 * The styles that decide how an SVG draws, with the value each starts from.
 *
 * Copying every computed property onto every node, as this used to, made a
 * chart of a few hundred nodes a 1.5–2 MB file of layout, animation and
 * scrolling properties no SVG reader looks at.
 */
const SVG_STYLES: Record<string, { initial: string; inherited: boolean }> = {
  fill: { initial: 'rgb(0, 0, 0)', inherited: true },
  'fill-opacity': { initial: '1', inherited: true },
  'fill-rule': { initial: 'nonzero', inherited: true },
  stroke: { initial: 'none', inherited: true },
  'stroke-width': { initial: '1px', inherited: true },
  'stroke-opacity': { initial: '1', inherited: true },
  'stroke-dasharray': { initial: 'none', inherited: true },
  'stroke-dashoffset': { initial: '0px', inherited: true },
  'stroke-linecap': { initial: 'butt', inherited: true },
  'stroke-linejoin': { initial: 'miter', inherited: true },
  'stroke-miterlimit': { initial: '4', inherited: true },
  'paint-order': { initial: 'normal', inherited: true },
  color: { initial: 'rgb(0, 0, 0)', inherited: true },
  // No initial value to match: the reader's default font is anyone's guess.
  'font-family': { initial: '', inherited: true },
  'font-size': { initial: '16px', inherited: true },
  'font-weight': { initial: '400', inherited: true },
  'font-style': { initial: 'normal', inherited: true },
  'font-variant-numeric': { initial: 'normal', inherited: true },
  'letter-spacing': { initial: 'normal', inherited: true },
  'text-anchor': { initial: 'start', inherited: true },
  'dominant-baseline': { initial: 'auto', inherited: true },
  visibility: { initial: 'visible', inherited: true },
  opacity: { initial: '1', inherited: false },
  'alignment-baseline': { initial: 'auto', inherited: false },
  'baseline-shift': { initial: '0px', inherited: false },
  'clip-path': { initial: 'none', inherited: false },
  mask: { initial: 'none', inherited: false },
  filter: { initial: 'none', inherited: false },
  transform: { initial: 'none', inherited: false },
  'stop-color': { initial: 'rgb(0, 0, 0)', inherited: false },
  'stop-opacity': { initial: '1', inherited: false },
};

/**
 * Copy the styles that matter onto the clone, so the file draws the same on
 * its own. An inherited style is written only where it changes from the parent,
 * the rest only where they leave their initial value, and colours the page
 * keeps as `oklch()` are written as rgb() for readers that predate it.
 */
const inlineSvgStyles = (source: Element, target: Element, parent: CSSStyleDeclaration | null = null): void => {
  const computed = window.getComputedStyle(source);
  const style = (target as SVGElement).style;
  if (computed.display === 'none') style.setProperty('display', 'none');
  for (const [property, { initial, inherited }] of Object.entries(SVG_STYLES)) {
    const value = computed.getPropertyValue(property);
    if (!value) continue;
    const from = inherited && parent ? parent.getPropertyValue(property) : initial;
    if (value === from) continue;
    style.setProperty(property, value.includes('(') ? replaceUnsupportedColors(value) : value);
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  sourceChildren.forEach((child, i) => {
    if (targetChildren[i]) inlineSvgStyles(child, targetChildren[i], computed);
  });
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
/** Device-pixel multiplier for every capture in the app. */
export const DEFAULT_CAPTURE_SCALE = 2;

const SVG_NS = 'http://www.w3.org/2000/svg';

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' + String.fromCharCode(10);

/** Room above the plot for the exported SVG's heading. */
const SVG_TITLE_BAND_PX = 40;

/** Readable against `captureBackgroundColor()`, for text we draw ourselves. */
export const captureForegroundColor = (): string =>
  document.documentElement.classList.contains('dark') && !exportsOnLightBackground()
    ? '#e2e8f0'
    : '#1e293b';

export const captureBackgroundColor = (): string =>
  document.documentElement.classList.contains('dark') && !exportsOnLightBackground()
    ? '#0f172a'
    : '#ffffff';

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

/**
 * Whether a node in the capture's clone is an HTML element. Not `instanceof`:
 * html2canvas copies the page's nodes into its iframe, and a copied node keeps
 * the page's prototypes, so `instanceof` the iframe's HTMLElement is false for
 * every one of them and the walks here silently changed nothing.
 */
const isHtmlElement = (el: Element): el is HTMLElement =>
  el.namespaceURI === 'http://www.w3.org/1999/xhtml';

const unclipSingleLineText = (root: HTMLElement): void => {
  const view = root.ownerDocument.defaultView;
  if (!view) return;

  for (const el of root.querySelectorAll('*')) {
    // SVG ignores padding, so charts are unaffected either way — skip them so the
    // walk stays cheap and obviously scoped to HTML text boxes.
    if (!isHtmlElement(el)) continue;
    const styles = view.getComputedStyle(el);
    if (styles.overflow !== 'hidden' || styles.whiteSpace !== 'nowrap') continue;
    el.style.paddingBottom = `${parseFloat(styles.paddingBottom) + DESCENDER_ROOM_PX}px`;
    el.style.marginBottom = `${parseFloat(styles.marginBottom) - DESCENDER_ROOM_PX}px`;
  }
};

/**
 * Text html2canvas would draw wrong, set the way it can draw it.
 *
 * - The canvas has no tabular figures. html2canvas puts each word where the
 *   browser laid it out with tabular digits, then draws it with proportional
 *   ones, which are narrower, so gaps opened inside figures: "- 19.7 %", and,
 *   in letter-spaced text, which it draws a character at a time, "¥7,064,1 67".
 *   The clone is laid out with proportional digits and no letter-spacing, the
 *   way the canvas will draw it.
 * - A line-clamped box (`display: -webkit-box`) it cuts through the middle of
 *   the text, so the clamp is released and the text wraps in full.
 */
const settleTextForCanvas = (root: HTMLElement): void => {
  const view = root.ownerDocument.defaultView;
  if (!view) return;

  for (const el of [root, ...root.querySelectorAll('*')]) {
    if (!isHtmlElement(el)) continue;
    const styles = view.getComputedStyle(el);
    if (styles.letterSpacing !== 'normal' && parseFloat(styles.letterSpacing) !== 0) {
      el.style.letterSpacing = 'normal';
    }
    if (styles.fontVariantNumeric !== 'normal') {
      el.style.fontVariantNumeric = 'normal';
    }
    if (styles.webkitLineClamp && styles.webkitLineClamp !== 'none') {
      el.style.webkitLineClamp = 'none';
      el.style.display = 'block';
      el.style.overflow = 'visible';
    }
  }
};

/** How long a capture waits for the web font before drawing in the fallback. */
const FONT_LOAD_TIMEOUT_MS = 3000;

/**
 * Load the web font in the clone before anything there is measured.
 *
 * `resolveOklchColors` swaps the Google Fonts `<link>` for a `<style>`, which
 * gives the clone fresh, unloaded copies of Inter. html2canvas then measured
 * each word in the fallback font, which is narrower, and drew it in Inter, so
 * now and then an image came out with its words run together: "Salesplan".
 * The wait is capped, so a font that never arrives costs a moment, not the
 * export.
 */
const loadCloneFonts = async (root: HTMLElement): Promise<void> => {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  if (!doc.fonts || !view) return;
  const family = view.getComputedStyle(root).fontFamily;
  const text = root.textContent ?? '';
  try {
    await Promise.race([
      Promise.all(['400', '600', '700'].map(weight => doc.fonts.load(`${weight} 16px ${family}`, text))),
      new Promise(resolve => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS)),
    ]);
  } catch (error) {
    log.warn('Web font did not load for capture, drawing in the fallback:', error);
  }
};

/**
 * Content that belongs in an exported image but not on screen, such as the
 * title and year over the annual table, which on screen sit in the page header
 * outside the table. It is marked `hidden data-export-only`. The capture shows
 * it in the clone it paints, and for the instant it measures the live element,
 * so the canvas is sized to include it and one pass is enough.
 */
const EXPORT_ONLY = '[data-export-only]';

/**
 * What the pointer leaves on a chart: the tooltip, the hover band and the
 * highlighted dot. The menu that starts an export closes with the pointer over
 * the chart, so they are usually showing. They have no place in the image, and
 * a tooltip near the edge also widened the measured size into a blank strip.
 */
const HOVER_ONLY = '.recharts-tooltip-wrapper, .recharts-tooltip-cursor, .recharts-active-dot';

/** Hides the hover-only parts of the live element for a measurement; returns the undo. */
const hideHoverOnly = (root: HTMLElement): (() => void) => {
  const nodes = Array.from(root.querySelectorAll<HTMLElement | SVGElement>(HOVER_ONLY));
  const previous = nodes.map(node => node.style.display);
  nodes.forEach(node => { node.style.display = 'none'; });
  return () => nodes.forEach((node, i) => { node.style.display = previous[i]; });
};

const revealExportOnly = (root: HTMLElement): HTMLElement[] => {
  const hidden = Array.from(root.querySelectorAll<HTMLElement>(EXPORT_ONLY)).filter(el => el.hidden);
  hidden.forEach(el => { el.hidden = false; });
  return hidden;
};

/**
 * Boxes inside the capture target that scroll sideways, such as a chart too
 * wide for a phone that scrolls inside its card. The image wants the whole
 * chart, not the part in view, so the capture widens the target by what they
 * hide and lets them spill.
 */
const sidewaysScrollers = (root: HTMLElement): HTMLElement[] => {
  const view = root.ownerDocument.defaultView;
  if (!view) return [];
  return Array.from(root.querySelectorAll('*')).filter((el): el is HTMLElement => {
    if (!isHtmlElement(el) || el.scrollWidth <= el.clientWidth + 1) return false;
    const { overflowX } = view.getComputedStyle(el);
    return overflowX === 'auto' || overflowX === 'scroll';
  });
};

/** How much wider the target is with every sideways scroller showing all of itself. */
const hiddenSideways = (root: HTMLElement): number =>
  Math.max(0, ...sidewaysScrollers(root).map(el => el.scrollWidth - el.clientWidth));

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
 * html2canvas finds where text sits on its line by putting a 1px image beside
 * a word in the PAGE (not the copy it paints) and reading the image's offset.
 * Tailwind's base styles make every <img> a block, which moved that image onto
 * a line of its own: the measurement came out most of a line too low, and every
 * word in every exported image was drawn several pixels below where the page
 * shows it, so legend dots sat above their labels and text sank in its pills.
 * For the length of a capture the measuring image is put back inline.
 */
const INLINE_MEASURING_IMAGE =
  'body > div[style*="visibility: hidden"][style*="white-space: nowrap"] > img { display: inline !important; }';

const withInlineMeasuringImage = (): (() => void) => {
  const style = document.createElement('style');
  style.textContent = INLINE_MEASURING_IMAGE;
  document.head.appendChild(style);
  return () => style.remove();
};

/** The top-left `width` x `height` of a canvas, as a canvas of that size. */
const trimCanvas = (canvas: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement => {
  if (width >= canvas.width && height >= canvas.height) return canvas;
  const trimmed = document.createElement('canvas');
  trimmed.width = Math.min(width, canvas.width);
  trimmed.height = Math.min(height, canvas.height);
  trimmed.getContext('2d')?.drawImage(canvas, 0, 0);
  return trimmed;
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
type CaptureSize = { width: number; height: number };

/**
 * One html2canvas pass.
 *
 * Also reports the size the CLONE laid out at. That number matters because
 * html2canvas sizes the canvas from the numbers we pass (measured on the LIVE
 * element) but paints from a copy of the page inside an iframe. Anything that
 * makes the copy lay out wider or taller — a web font that has to re-resolve in
 * the iframe, a scrollbar the iframe does not have, a sticky offset that
 * collapses — is painted past the edge of the canvas and reaches the user as
 * "the export cut the right-hand columns off".
 */
const capturePass = async (
  html2canvas: typeof import('html2canvas').default,
  element: HTMLElement,
  size: CaptureSize,
  scale: number,
  widen: boolean
): Promise<{ canvas: HTMLCanvasElement; cloneSize: CaptureSize | null }> => {
  let cloneSize: CaptureSize | null = null;

  const canvas = await html2canvas(element, {
    scale,
    backgroundColor: captureBackgroundColor(),
    logging: false,
    useCORS: true,
    width: size.width,
    height: size.height,
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
      // Drop dark mode from the CLONE, not the page, so every Tailwind `dark:`
      // colour resolves light for the capture and the user's screen never
      // flickers. Must happen BEFORE the oklch pass, which freezes whatever
      // colours are in force at the time.
      if (exportsOnLightBackground()) clonedDoc.documentElement.classList.remove('dark');
      revealExportOnly(clonedEl);
      clonedEl.querySelectorAll(HOVER_ONLY).forEach(node => node.remove());
      if (widen) {
        sidewaysScrollers(clonedEl).forEach(el => {
          el.scrollLeft = 0;
          el.style.overflowX = 'visible';
        });
        clonedEl.style.width = `${size.width}px`;
        clonedEl.style.maxWidth = 'none';
      }
      await resolveOklchColors(clonedDoc);
      await loadCloneFonts(clonedEl);
      settleTextForCanvas(clonedEl);
      unclipSingleLineText(clonedEl);
      // Last thing before html2canvas paints, so this is the layout it paints.
      cloneSize = capturedSize(clonedEl);
    }
  });

  return { canvas, cloneSize };
};

/**
 * Shared html2canvas capture for every image export in the app.
 *
 * Centralised because four things must be true at EVERY call site and are easy
 * to forget at one of them: the background has to follow the theme (above),
 * Tailwind v4's `oklch()` / `color-mix()` colours have to be resolved to rgb()
 * first (html2canvas cannot parse them and silently drops the styles that use
 * them), the requested scale has to fit inside the browser's canvas cap, and
 * the canvas has to be at least as big as the clone that gets painted into it.
 */
export const captureElement = (
  element: HTMLElement,
  options: { scale?: number } = {}
): Promise<HTMLCanvasElement> =>
  // Returns its promise synchronously so `copyElementToClipboard` can still
  // hand a pending ClipboardItem to write() from inside the click.
  withExportTheme(element, () => {
    const restoreMeasuring = withInlineMeasuringImage();
    return capture(element, options).finally(restoreMeasuring);
  });

const capture = async (
  element: HTMLElement,
  options: { scale?: number }
): Promise<HTMLCanvasElement> => {
  // Only image export needs html2canvas, and most sessions never trigger one.
  const { default: html2canvas } = await import('html2canvas');

  // 2x is the whole app's export resolution. A 1600px-wide chart lands at
  // 3200px, which is more than any slide or document needs, and the 3x this
  // used to default to made every capture ~2.2x slower and heavier for nothing.
  const requested = options.scale ?? DEFAULT_CAPTURE_SCALE;
  // Measured with the export-only content showing, then hidden again before the
  // browser can paint, so it never appears on screen.
  const revealed = revealExportOnly(element);
  const showHover = hideHoverOnly(element);
  let size = capturedSize(element);
  const sideways = hiddenSideways(element);
  showHover();
  revealed.forEach(el => { el.hidden = true; });
  size = { ...size, width: size.width + sideways };
  const widen = sideways > 0;

  if (size.width === 0 || size.height === 0) {
    throw new Error(
      `Nothing to capture: <${element.tagName.toLowerCase()}> measures ${size.width}x${size.height}`
    );
  }

  let scale = fitScale(size.width, size.height, requested);
  let pass = await capturePass(html2canvas, element, size, scale, widen);
  const cloneSize = pass.cloneSize;

  // If the clone laid out bigger than the live element did, the first pass has
  // already lost whatever fell outside. Redo it at the size that actually got
  // painted rather than hand back a cropped table; one retry is enough, because
  // the second pass asks for the clone's own measurement.
  if (cloneSize && (cloneSize.width > size.width + 1 || cloneSize.height > size.height + 1)) {
    log.warn(
      `Clone laid out at ${cloneSize.width}x${cloneSize.height} but the element measured ` +
      `${size.width}x${size.height}; recapturing at the larger size so nothing is cut off.`
    );
    size = {
      width: Math.max(size.width, cloneSize.width),
      height: Math.max(size.height, cloneSize.height),
    };
    scale = fitScale(size.width, size.height, requested);
    pass = await capturePass(html2canvas, element, size, scale, widen);
  }
  let { canvas } = pass;

  // If it laid out SMALLER, the canvas has a blank band where the difference
  // was. The export buttons are left out of the copy, and on a phone, where
  // they wrap onto a row of their own, that row came out as an empty strip
  // along the bottom of the image. Trim the canvas to what was painted.
  const painted = pass.cloneSize;
  if (painted && (painted.width < size.width - 1 || painted.height < size.height - 1)) {
    size = {
      width: Math.min(size.width, painted.width),
      height: Math.min(size.height, painted.height),
    };
    canvas = trimCanvas(canvas, Math.round(size.width * scale), Math.round(size.height * scale));
  }

  // A canvas the browser refused to allocate at the requested size comes back
  // smaller with no error, which reads as "the export cropped my table". Say so
  // in the console instead of leaving it to be guessed at from the image.
  const shortBy = {
    x: Math.round(size.width * scale) - canvas.width,
    y: Math.round(size.height * scale) - canvas.height,
  };
  if (shortBy.x > 1 || shortBy.y > 1) {
    log.error(
      `Capture came back cropped: asked for ${Math.round(size.width * scale)}x${Math.round(size.height * scale)} ` +
      `(${size.width}x${size.height} CSS px at scale ${scale}), got ${canvas.width}x${canvas.height}.`
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
 * Export the chart as a standalone SVG.
 *
 * Vector, so it scales without blurring and stays editable in design tools. It
 * carries the plot and its heading only: the legend and the detail card are
 * HTML siblings of the chart, and there is no cheap way to redraw them as SVG.
 * Reach for PNG or the clipboard when the whole panel is what you want.
 */
export const exportChartToSVG = async (elementId: string, filename: string = 'chart.svg'): Promise<void> => {
  const chartContainer = document.getElementById(elementId);

  if (!chartContainer) {
    toast.error(translate('chartExport.notFound', 'Chart not found, nothing was exported'));
    log.error('SVG export: element not found', elementId);
    return;
  }

  try {
    // Take the chart's own surface, the one directly inside the Recharts
    // wrapper, rather than the first <svg> in the container: a heading icon is
    // also an <svg>, and each legend dot is an `svg.recharts-surface` too, so the
    // first of either exported an 8px dot instead of the chart.
    const svgElement =
      chartContainer.querySelector('.recharts-wrapper > svg.recharts-surface') ??
      chartContainer.querySelector('svg.recharts-surface') ??
      chartContainer.querySelector('svg');

    if (!svgElement) {
      toast.error(translate('chartExport.noChart', 'No chart found to export'));
      return;
    }

    log.debug('Exporting chart as SVG...');

    // Same export theme as the raster paths: `inlineSvgStyles` copies the LIVE
    // computed styles, so the palette has to be switched before it reads them.
    const svgString = await withExportTheme(chartContainer, async () => {
      // Measure the PLOT, not the container. The container also holds the HTML
      // heading and legend, so sizing the surface by it left every exported file
      // with a blank strip along the bottom exactly that row's height tall.
      const surfaceRect = svgElement.getBoundingClientRect();
      // Grown to take in whatever is drawn past the surface's edge: on the page
      // the last month's name overhangs the right edge and simply shows, and in
      // the file it was cut through.
      const drawn = (svgElement as SVGSVGElement).getBBox();
      const left = Math.min(0, Math.floor(drawn.x));
      const top = Math.min(0, Math.floor(drawn.y));
      const width = Math.max(Math.round(surfaceRect.width), Math.ceil(drawn.x + drawn.width)) - left;
      const height = Math.max(Math.round(surfaceRect.height), Math.ceil(drawn.y + drawn.height)) - top;

      // Clone the SVG deeply
      const clonedSvg = svgElement.cloneNode(true) as SVGElement;

      // Copy all computed styles inline for standalone rendering
      log.debug('Copying styles...');
      inlineSvgStyles(svgElement, clonedSvg);
      // After the style walk, which pairs the two trees node for node.
      clonedSvg.querySelectorAll(HOVER_ONLY).forEach(node => node.remove());

      clonedSvg.setAttribute('width', width.toString());
      clonedSvg.setAttribute('height', height.toString());
      clonedSvg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);

      // The plot alone is a mystery once it leaves the app, so carry the heading
      // across as real text. It is the one piece of the HTML header worth the
      // handful of lines; the legend would mean redrawing swatches and layout.
      const title = chartContainer.querySelector('h1, h2, h3, h4')?.textContent?.trim() ?? '';
      const titleBand = title ? SVG_TITLE_BAND_PX : 0;

      const doc = chartContainer.ownerDocument;
      const root = doc.createElementNS(SVG_NS, 'svg');
      root.setAttribute('xmlns', SVG_NS);
      root.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      root.setAttribute('width', width.toString());
      root.setAttribute('height', (height + titleBand).toString());
      root.setAttribute('viewBox', `0 0 ${width} ${height + titleBand}`);

      // An SVG with no background is transparent, and in dark mode the axis text
      // is light — the file opened to near-invisible text on anything white.
      const background = doc.createElementNS(SVG_NS, 'rect');
      background.setAttribute('x', '0');
      background.setAttribute('y', '0');
      background.setAttribute('width', width.toString());
      background.setAttribute('height', (height + titleBand).toString());
      background.setAttribute('fill', captureBackgroundColor());
      root.appendChild(background);

      if (title) {
        const heading = doc.createElementNS(SVG_NS, 'text');
        heading.setAttribute('x', '16');
        heading.setAttribute('y', '26');
        heading.setAttribute('font-size', '16');
        heading.setAttribute('font-weight', '700');
        heading.setAttribute('font-family', getComputedStyle(chartContainer).fontFamily);
        heading.setAttribute('fill', captureForegroundColor());
        heading.textContent = title;
        root.appendChild(heading);
      }

      const plotGroup = doc.createElementNS(SVG_NS, 'g');
      plotGroup.setAttribute('transform', `translate(0, ${titleBand})`);
      plotGroup.appendChild(clonedSvg);
      root.appendChild(plotGroup);

      // Serialize to string, XML declaration first so the file stands alone.
      const serializer = new XMLSerializer();
      return XML_DECLARATION + serializer.serializeToString(root);
    });

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

/** One column of an exported CSV: the field to read, and the heading to print. */
export interface CsvColumn {
  /** Property name on each row. */
  key: string;
  /** Heading, already translated by the caller. */
  label: string;
}

const csvCell = (value: unknown): string => {
  // Quote on newline as well as comma/quote: an unquoted newline splits the
  // record and shifts every later column. Headings go through this too, since a
  // translated one is free to contain a comma.
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Export chart data as CSV for analysis.
 *
 * Pass `columns` to choose which fields go into the file and what they are
 * called. Without it the headings are the internal property names, so whoever
 * opened the file met `accPlannedRevenue` instead of "Accumulated Plan (JPY)",
 * with internal flags like `isFuture` along for the ride.
 */
export const exportChartDataToCSV = (
  data: readonly unknown[],
  filename: string = 'chart-data.csv',
  columns?: readonly CsvColumn[]
): void => {
  try {
    const rows = (data ?? []).filter(
      (row): row is Record<string, unknown> => typeof row === 'object' && row !== null
    );

    if (rows.length === 0) {
      toast.error(translate('chartExport.noData', 'There is no data to export'));
      return;
    }

    log.debug('Exporting chart data as CSV...');

    const fields: readonly CsvColumn[] = columns?.length
      ? columns
      : Object.keys(rows[0]).map(key => ({ key, label: key }));

    const csvRows = [
      fields.map(field => csvCell(field.label)).join(','),
      ...rows.map(row => fields.map(field => csvCell(row[field.key])).join(','))
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

/** Generate a filename stamped with the local date and time. */
export const generateChartFilename = (prefix: string, extension: string = 'svg'): string =>
  timestampedFilename(prefix, extension);
