import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { splitBilingual } from './reportModel';
import type {
  ReportAction,
  ReportContent,
  ReportCustomerFigures,
  ReportFigures,
  ReportFocusProject,
  ReportModel,
  ReportStaffChange,
} from './reportModel';

/**
 * Builds the business status report as a PowerPoint deck in the team's
 * template (docs/business-report.md). Load this module with a dynamic
 * `import()`: pptxgenjs is large and only this export needs it.
 *
 * The deck reproduces the template's cover and its four numbered sections:
 * a light-blue header band with the logo, a grey "OS Design Team" footer with
 * the month and page number, Japanese headings with Vietnamese underneath,
 * and the template's cards and colours. Bars and icons are native shapes.
 *
 * Layout works in points on the template's 960 × 540 pt slide (LAYOUT_WIDE).
 * Text boxes are sized from an estimate of each string's width in the fonts
 * the deck names (Meiryo UI, and Segoe UI for Vietnamese), so written text of
 * any length shrinks, and at worst is cut with "…", instead of spilling out.
 */

export interface ReportPptxOptions {
  /** The header logo as a data URL; the deck is drawn without it when absent. */
  logoDataUrl?: string;
}

/** The logo in `public/report/`, converted from the template's own header logo. */
const LOGO_FILE = 'esutech-logo.png';

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

// ---------------------------------------------------------------------------
// Template tokens
// ---------------------------------------------------------------------------

/** Colours read from the template's slide XML (`srgbClr`, and scheme colours resolved). */
const C = {
  page: 'F6F8FB',
  header: 'B4C7E7',
  footer: 'AEAAAA',
  navy: '1B365D',
  blue: '2B6CB0',
  orange: 'E58A2B',
  teal: '0F8B8D',
  green: '2F855A',
  red: 'C75146',
  cyan: '00B0F0',
  ink: '1F2937',
  muted: '6B7280',
  /** Vietnamese lines are left at the theme's text colour in the template. */
  vi: '000000',
  white: 'FFFFFF',
  black: '000000',
  card: 'FFFFFF',
  cardLine: 'E0E6EE',
  statFill: 'F2F2F2',
  statLine: 'E3E8EF',
  kpiLine: '767171',
  rule: '767171',
  track: 'E7ECF2',
  barTrack: 'D0CECE',
  barTrackLine: 'E9EEF4',
  greyBar: '94A3B8',
  highlight: 'EAF2FB',
  highlightLine: 'CFE0F4',
  highlightTag: 'DDEBFA',
  rowAlt: 'F8FAFC',
  rowLine: 'E7ECF2',
  focus: 'FFF4E5',
  focusLine: 'F2D6A8',
  focusTag: 'FFE6BF',
  policyLine: 'F0C77B',
  stageFill: 'FFFF00',
  stageText: '0070C0',
  trainTag: 'DDF4F1',
  pointsBox: 'DEEBF7',
  pointsBoxLine: 'BDD7EE',
  seatsBox: 'EAF6EF',
  seatsBoxLine: 'CDE9D8',
  progressBox: 'E8F6F5',
  progressBoxLine: 'C9E9E6',
  staffTag: 'FBE5E3',
  issues: 'FDEDEC',
  issuesLine: 'F1C4C0',
  timeline: '3A2E35',
  rowBoxLine: 'A5A5A5',
  datePill: ['DEEBF7', 'BDD7EE', 'FBE5D6'],
  dots: ['0070C0', '00B0F0', 'E58A2B'],
  datePillLine: 'BDD7EE',
  pill: 'DAE3F3',
  /** Icon badges. */
  chartBg: 'FBE5D6',
  chartInk: 'C55A11',
  clockInk: '0070C0',
  trophyBg: 'D4F0EF',
  peopleBg: 'DBF0E7',
  capBg: 'DCEDFA',
} as const;

/** Customer bars on section 1, in the template's order. */
const BAR_COLORS = ['2B6CB0', '0F8B8D', '94A3B8', 'E58A2B', '2F855A', 'C75146', '6B7280', '8FAADC'];
/** The rounded caps of the customer rows on section 2. */
const ROW_CAPS = ['8FAADC', '92D050', '00B050', '0070C0', 'E58A2B', '0F8B8D', 'C75146', '94A3B8'];
/** The three priority themes: blue, red and teal, then green for a fourth. */
const THEMES = [
  { fill: 'EAF2FB', ink: C.blue },
  { fill: 'FDEDEC', ink: C.red },
  { fill: 'E8F6F5', ink: C.teal },
  { fill: 'EAF6EF', ink: C.green },
];

/** The template names Meiryo UI for its Japanese text and figures. */
const JA = 'Meiryo UI';
/** Meiryo UI lacks most Vietnamese letters (ơ, ư, ạ …); Segoe UI has them all. */
const VI = 'Segoe UI';
/** The footer's "OS Design Team". */
const FOOTER_FONT = 'Arial Black';

const MASTER = 'REPORT';
/** PowerPoint's single line spacing is 1.2 × the font size, for every font here. */
const LINE = 1.2;
/** Headroom on estimated widths, for kerning and rounding. */
const WIDTH_SLACK = 1.04;

const SECTIONS = [
  { ja: '1. 経営実績と案件状況', vi: 'Kết quả kinh doanh và tình hình dự án' },
  { ja: '2. 顧客別単価と現在の重点案件', vi: 'Đơn giá khách hàng và dự án trọng điểm hiện tại' },
  { ja: '3. 人材育成と人員状況', vi: 'Đào tạo nhân lực và tình hình nhân sự' },
  { ja: '4. 今後の重点アクション', vi: 'Các hành động trọng tâm trong thời gian tới' },
] as const;

// ---------------------------------------------------------------------------
// Numbers (Japanese formatting)
// ---------------------------------------------------------------------------

const DASH = '—';
/** U+3000, the full-width space the template puts after ① and before side notes. */
const IDEO_SPACE = '\u3000';

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

const group = (n: number): string => {
  const [int, frac] = Math.abs(n).toString().split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
};

/** `4,644` */
const fmtInt = (v: number | null | undefined): string => (isNum(v) ? group(Math.round(v)) : DASH);
/** `4,644h` */
const fmtHours = (v: number | null | undefined): string => (isNum(v) ? `${group(Math.round(v))}h` : DASH);
/** JPY to 万円 with one decimal, without the unit: `1,154.7` */
const fmtMan = (yen: number | null | undefined): string => {
  if (!isNum(yen)) return DASH;
  const tenths = Math.round(yen / 1000);
  const sign = tenths < 0 ? '-' : '';
  const abs = Math.abs(tenths);
  return `${sign}${group(Math.floor(abs / 10))}.${abs % 10}`;
};
/** `1,154.7万円` */
const fmtManYen = (yen: number | null | undefined): string => (isNum(yen) ? `${fmtMan(yen)}万円` : DASH);
/** A 0–1 rate as a whole percentage: `34` */
const pctNum = (rate: number | null | undefined): string => (isNum(rate) ? String(Math.round(rate * 100)) : DASH);
/** `約34%` */
const fmtPct = (rate: number | null | undefined): string => (isNum(rate) ? `約${pctNum(rate)}%` : DASH);
/** `2,650 円/h` */
const fmtRate = (rate: number | null | undefined): string => (isNum(rate) ? `${group(Math.round(rate))} 円/h` : DASH);

const parseDate = (iso: string): { y: number; m: number; d: number } | null => {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(iso ?? '');
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return m >= 1 && m <= 12 && d >= 1 && d <= 31 ? { y, m, d } : null;
};

// ---------------------------------------------------------------------------
// Text measurement
// ---------------------------------------------------------------------------

/* Advance widths (1/1000 em) of U+0020–U+007E, read from the installed fonts. */
const W_MEIRYO = [
  340, 379, 449, 804, 621, 1032, 727, 259, 439, 439, 621, 804, 349, 439, 349, 449, 621, 621, 621, 621, 621, 621, 621,
  621, 621, 621, 430, 430, 804, 804, 804, 531, 1020, 678, 673, 672, 749, 618, 571, 728, 743, 403, 444, 661, 557, 831,
  741, 762, 596, 762, 683, 635, 636, 729, 683, 1001, 669, 631, 651, 439, 621, 439, 804, 621, 621, 580, 608, 507, 608,
  577, 335, 607, 618, 254, 329, 551, 254, 959, 618, 594, 608, 608, 413, 498, 379, 618, 566, 833, 556, 566, 506, 600,
  439, 600, 804,
];
const W_MEIRYO_B = [
  332, 385, 537, 833, 677, 1141, 828, 296, 492, 492, 677, 833, 347, 468, 347, 594, 677, 677, 677, 677, 677, 677, 677,
  677, 677, 677, 404, 404, 833, 833, 833, 582, 1003, 740, 731, 688, 790, 653, 616, 775, 806, 509, 507, 743, 603, 908,
  810, 801, 687, 801, 750, 674, 661, 783, 729, 1051, 729, 702, 673, 492, 677, 492, 833, 677, 677, 630, 666, 547, 666,
  620, 391, 666, 680, 305, 374, 625, 305, 1026, 680, 649, 666, 666, 470, 550, 426, 680, 609, 895, 641, 609, 567, 652,
  500, 652, 833,
];
const W_SEGOE = [
  274, 284, 392, 591, 539, 818, 800, 230, 302, 302, 417, 684, 217, 400, 217, 390, 539, 539, 539, 539, 539, 539, 539,
  539, 539, 539, 217, 217, 684, 684, 684, 448, 955, 645, 573, 619, 701, 506, 488, 686, 710, 266, 357, 580, 471, 898,
  748, 754, 560, 754, 598, 531, 524, 687, 621, 934, 590, 553, 570, 302, 379, 302, 684, 415, 268, 509, 588, 462, 589,
  523, 313, 589, 566, 242, 242, 497, 242, 861, 566, 586, 588, 589, 348, 424, 339, 566, 479, 723, 459, 484, 452, 302,
  239, 302, 684,
];
const W_SEGOE_B = [
  276, 327, 493, 592, 575, 867, 850, 293, 369, 369, 455, 707, 271, 404, 271, 443, 575, 575, 575, 575, 575, 575, 575,
  575, 575, 575, 271, 271, 707, 707, 707, 438, 954, 703, 641, 624, 737, 532, 520, 711, 766, 317, 445, 649, 511, 957,
  790, 758, 614, 758, 653, 561, 586, 723, 667, 1005, 655, 607, 607, 369, 436, 369, 707, 415, 314, 538, 620, 480, 619,
  541, 383, 619, 602, 284, 284, 559, 284, 916, 605, 611, 620, 619, 398, 440, 389, 605, 542, 797, 552, 538, 479, 369,
  326, 369, 707,
];

/** Characters drawn in the Japanese font whatever the paragraph's language. */
const isJaChar = (cp: number): boolean =>
  (cp >= 0x3000 && cp <= 0x30ff) ||
  (cp >= 0x3400 && cp <= 0x9fff) ||
  (cp >= 0xf900 && cp <= 0xfaff) ||
  (cp >= 0xff00 && cp <= 0xffef) ||
  (cp >= 0x2460 && cp <= 0x24ff) ||
  (cp >= 0x2e80 && cp <= 0x2fff) ||
  (cp >= 0x31f0 && cp <= 0x31ff) ||
  cp === 0x203b || // ※
  cp === 0x25cf || // ●
  cp === 0x21d2; // ⇒

/** Letters only Vietnamese uses; Meiryo UI has none of them. */
const VI_LETTERS = /[\u0102\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]/;

const jaEm = (cp: number, bold: boolean): number => {
  if (cp === 0x3001 || cp === 0x3002) return 0.664; // 、。
  if (cp >= 0x300c && cp <= 0x300f) return 0.5; // 「」『』
  if (cp === 0x30fb) return 0.52; // ・
  if ((cp >= 0x3041 && cp <= 0x30ff) || (cp >= 0x31f0 && cp <= 0x31ff)) return bold ? 0.9 : 0.85; // kana are proportional in Meiryo UI
  if (cp >= 0xff61 && cp <= 0xff9f) return 0.5;
  return 1;
};

const latinEm = (ch: string, font: string, bold: boolean): number => {
  const vi = font === VI;
  const table = vi ? (bold ? W_SEGOE_B : W_SEGOE) : bold ? W_MEIRYO_B : W_MEIRYO;
  const at = (c: string): number | null => {
    const cp = c.codePointAt(0) ?? 0;
    return cp >= 0x20 && cp <= 0x7e ? table[cp - 0x20] / 1000 : null;
  };
  const direct = at(ch);
  if (direct !== null) return direct;
  if (ch === 'đ') return at('d') ?? 0.6;
  if (ch === 'Đ') return (at('D') ?? 0.7) + 0.02;
  const base = ch.normalize('NFD').charAt(0);
  const fromBase = base !== ch ? at(base) : null;
  // ơ and ư (with any tone) carry a horn that sticks out to the right.
  if (fromBase !== null) return fromBase + (ch.normalize('NFD').includes('\u031B') ? 0.06 : 0);
  switch (ch) {
    case '×':
      return vi ? 0.7 : 0.83;
    case '–':
      return vi ? 0.5 : 0.68;
    case '→':
      return vi ? 0.87 : 1;
    case '…':
      return vi ? 0.92 : 1;
    case '·':
      return 0.35;
    default:
      return vi ? 0.7 : 1;
  }
};

/** A paragraph's parts: runs of one style. */
interface Run {
  text: string;
  bold?: boolean;
  color?: string;
  /** Overrides the paragraph's size. */
  size?: number;
  /** Forces the Japanese font (bullets, circled numbers). */
  ja?: boolean;
}

interface Para {
  runs: Run[];
  /** Base size in pt, before a block's scale. */
  size: number;
  /** 'vi' draws Latin letters in Segoe UI; 'ja' in Meiryo UI unless the text is Vietnamese. */
  lang: 'ja' | 'vi';
  bold?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Space above the paragraph, in pt before scale. */
  before?: number;
}

/** A font size after a block's scale, on the half-point grid PowerPoint shows. */
const sized = (size: number, scale: number): number => Math.max(6, Math.floor(size * scale * 2) / 2);

const latinFontOf = (p: Para): string =>
  p.lang === 'vi' || VI_LETTERS.test(p.runs.map(r => r.text).join('')) ? VI : JA;

interface Seg {
  text: string;
  font: string;
  size: number;
  bold: boolean;
  color: string;
}

/** Splits a paragraph into runs of one font: Japanese characters always take Meiryo UI. */
const segmentsOf = (p: Para, scale: number): Seg[] => {
  const latin = latinFontOf(p);
  const out: Seg[] = [];
  for (const r of p.runs) {
    const size = sized(r.size ?? p.size, scale);
    const bold = r.bold ?? p.bold ?? false;
    const color = r.color ?? p.color ?? C.ink;
    let cur: Seg | null = null;
    for (const ch of Array.from(r.text)) {
      const cp = ch.codePointAt(0) ?? 0;
      const font: string = r.ja || isJaChar(cp) ? JA : ch === ' ' && cur ? cur.font : latin;
      if (cur && cur.font === font) cur.text += ch;
      else {
        cur = { text: ch, font, size, bold, color };
        out.push(cur);
      }
    }
  }
  return out;
};

interface Glyph {
  w: number;
  space: boolean;
  ja: boolean;
  /** No line break before this glyph (closing punctuation, small kana). */
  noBreakBefore: boolean;
  /** No line break after this glyph (opening brackets). */
  noBreakAfter: boolean;
}

const NO_BREAK_BEFORE = new Set(Array.from('、。，．・：；？！）」』】〕｝〉》ー々ゝゞぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ％）'));
const NO_BREAK_AFTER = new Set(Array.from('（「『【〔｛〈《'));

const glyphsOf = (p: Para, scale: number): Glyph[] => {
  const out: Glyph[] = [];
  for (const seg of segmentsOf(p, scale)) {
    for (const ch of Array.from(seg.text)) {
      const cp = ch.codePointAt(0) ?? 0;
      const ja = isJaChar(cp);
      const em = ja ? jaEm(cp, seg.bold) : latinEm(ch, seg.font, seg.bold);
      out.push({
        w: em * seg.size * WIDTH_SLACK,
        space: ch === ' ' || ch === '\u3000',
        ja,
        noBreakBefore: NO_BREAK_BEFORE.has(ch),
        noBreakAfter: NO_BREAK_AFTER.has(ch),
      });
    }
  }
  return out;
};

/** Lines a paragraph takes at `width`, breaking like PowerPoint: between words, and between Japanese characters. */
const lineCount = (p: Para, width: number, scale: number): number => {
  const glyphs = glyphsOf(p, scale);
  if (!glyphs.length) return 1;
  // Unbreakable atoms: a Latin word with its trailing spaces, or one Japanese character.
  interface Atom {
    w: number;
    trail: number;
    parts: number[];
  }
  const atoms: Atom[] = [];
  let cur: Atom | null = null;
  let prev: Glyph | null = null;
  for (const g of glyphs) {
    if (g.space) {
      if (cur) cur.trail += g.w;
      else atoms.push((cur = { w: 0, trail: g.w, parts: [] }));
      prev = g;
      continue;
    }
    const joinsPrev =
      cur !== null &&
      cur.trail === 0 &&
      prev !== null &&
      (g.noBreakBefore || prev.noBreakAfter || (!g.ja && !prev.ja && !prev.space));
    if (joinsPrev && cur) {
      cur.w += g.w;
      cur.parts.push(g.w);
    } else {
      cur = { w: g.w, trail: 0, parts: [g.w] };
      atoms.push(cur);
    }
    prev = g;
  }
  let lines = 1;
  let x = 0;
  for (const a of atoms) {
    if (x > 0 && x + a.w > width) {
      lines += 1;
      x = 0;
    }
    if (a.w > width) {
      for (const w of a.parts) {
        if (x > 0 && x + w > width) {
          lines += 1;
          x = 0;
        }
        x += w;
      }
      x += a.trail;
      continue;
    }
    x += a.w + a.trail;
  }
  return lines;
};

const paraLineHeight = (p: Para, scale: number): number =>
  Math.max(...p.runs.map(r => sized(r.size ?? p.size, scale))) * LINE;

/** Space above a paragraph, in whole points: PowerPoint rounds fractions up when it lays text out. */
const spaceBefore = (p: Para, scale: number): number => Math.ceil((p.before ?? 0) * scale);

const parasHeight = (paras: Para[], width: number, scale: number): number =>
  paras.reduce(
    (h, p, i) => h + (i > 0 ? spaceBefore(p, scale) : 0) + lineCount(p, width, scale) * paraLineHeight(p, scale),
    0,
  );

/** One line's width, for boxes that must not wrap. */
const lineWidth = (p: Para, scale = 1): number => glyphsOf(p, scale).reduce((w, g) => w + g.w, 0);

const paraText = (p: Para): string => p.runs.map(r => r.text).join('');

/** The first `n` characters of a paragraph, ending in "…". */
const cutPara = (p: Para, n: number): Para => {
  const runs: Run[] = [];
  let left = n;
  for (const r of p.runs) {
    if (left <= 0) break;
    const chars = Array.from(r.text);
    runs.push({ ...r, text: chars.slice(0, left).join('') });
    left -= chars.length;
  }
  const last = runs[runs.length - 1];
  if (last) last.text = `${last.text.replace(/[\s、。，,./・]+$/u, '')}…`;
  return { ...p, runs };
};

interface Fitted {
  paras: Para[];
  scale: number;
}

/**
 * The largest scale (down to `minScale`) at which the paragraphs fit the box.
 * Below that, the last paragraphs are cut, with "…", and dropped if need be.
 */
const fitParas = (paras: Para[], w: number, h: number, minScale = 0.6, maxScale = 1): Fitted | null => {
  const live = paras.filter(p => paraText(p).trim() !== '');
  if (!live.length || w <= 0 || h <= 0) return null;
  for (let s = maxScale; s >= minScale - 1e-6; s = Math.round((s - 0.025) * 1000) / 1000) {
    if (parasHeight(live, w, s) <= h) return { paras: live, scale: s };
  }
  const s = minScale;
  let ps = live;
  while (ps.length) {
    if (parasHeight(ps, w, s) <= h) return { paras: ps, scale: s };
    const head = ps.slice(0, -1);
    const last = ps[ps.length - 1];
    const len = Array.from(paraText(last)).length;
    let lo = 1;
    let hi = len - 1;
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (parasHeight([...head, cutPara(last, mid)], w, s) <= h) {
        best = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (best > 0) return { paras: [...head, cutPara(last, best)], scale: s };
    ps = head;
    if (ps.length) {
      const prev = ps[ps.length - 1];
      if (!paraText(prev).endsWith('…')) ps = [...ps.slice(0, -1), cutPara(prev, Array.from(paraText(prev)).length)];
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Bilingual text
// ---------------------------------------------------------------------------

/**
 * Drops what an XML 1.0 part cannot hold, so pasted text cannot corrupt the
 * file: C0 and C1 control codes, U+FFFE, U+FFFF and lone surrogates. The
 * breaks Word and PowerPoint paste (U+000B, U+000C, U+0085, U+2028, U+2029)
 * become line breaks. Tab, line feed and carriage return are kept for `clean`.
 */
const sanitize = (text: string): string => {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c === 0x09 || c === 0x0a || c === 0x0d) out += text[i];
    else if (c === 0x0b || c === 0x0c || c === 0x85 || c === 0x2028 || c === 0x2029) out += '\n';
    else if (c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0xfffe || c === 0xffff) continue;
    else if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += text[i] + text[i + 1];
        i += 1;
      }
    } else if (c >= 0xdc00 && c <= 0xdfff) continue;
    else out += text[i];
  }
  return out;
};

/** Text from the report or the database, safe to write and with one kind of line break. */
const clean = (text: string | null | undefined): string =>
  sanitize(text ?? '').normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');

/** A name from the database on one line. */
const flat = (text: string | null | undefined): string => clean(text).replace(/\s*\n\s*/g, ' ').trim();

const customerName = (cu: ReportCustomerFigures): string => flat(cu.name) || flat(cu.code) || DASH;

interface Bi {
  main: string;
  /** Further lines, each drawn as its own paragraph. */
  sub: string[];
}

const bi = (text: string | null | undefined): Bi => {
  const { main, sub } = splitBilingual(clean(text));
  return {
    main,
    sub: sub
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean),
  };
};

const biEmpty = (b: Bi): boolean => !b.main && !b.sub.length;

interface BiStyle {
  size: number;
  subSize: number;
  bold?: boolean;
  color?: string;
  subColor?: string;
  subBold?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Runs put before the main line (a bullet, a number, a label). */
  lead?: Run[];
  /** Runs put before the first translation line. */
  subLead?: Run[];
  gap?: number;
}

/**
 * The template's bilingual convention, as the page reads it: the first line is
 * the main text, in the heading or body style; every further line is its
 * translation, underneath and smaller.
 */
const biParas = (b: Bi, st: BiStyle): Para[] => {
  const out: Para[] = [];
  if (b.main || st.lead)
    out.push({ runs: [...(st.lead ?? []), { text: b.main }], size: st.size, lang: 'ja', bold: st.bold, color: st.color ?? C.ink, align: st.align });
  let firstSub = true;
  for (const line of b.sub) {
    out.push({
      runs: [...(firstSub ? (st.subLead ?? []) : []), { text: line }],
      size: st.subSize,
      lang: 'vi',
      bold: st.subBold,
      color: st.subColor ?? C.vi,
      align: st.align,
      before: firstSub ? st.gap : undefined,
    });
    firstSub = false;
  }
  return out;
};

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

type Slide = PptxGenJS.Slide;
type ShapeName = PptxGenJS.SHAPE_NAME;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const inch = (pt: number): number => Math.round((pt / 72) * 10000) / 10000;

interface ShapeStyle {
  fill?: string;
  fillAlpha?: number;
  line?: string;
  lineW?: number;
  lineAlpha?: number;
  dash?: 'solid' | 'sysDot' | 'dash';
  /** Corner radius in pt, for roundRect. */
  radius?: number;
  rotate?: number;
  flipH?: boolean;
  flipV?: boolean;
  angles?: [number, number];
}

const shape = (slide: Slide, kind: ShapeName, b: Box, st: ShapeStyle): void => {
  const opts: PptxGenJS.ShapeProps = {
    x: inch(b.x),
    y: inch(b.y),
    w: inch(Math.max(0, b.w)),
    h: inch(Math.max(0, b.h)),
  };
  if (st.fill) opts.fill = { color: st.fill, ...(st.fillAlpha ? { transparency: st.fillAlpha } : {}) };
  if (st.line)
    opts.line = {
      color: st.line,
      width: st.lineW ?? 1,
      ...(st.lineAlpha ? { transparency: st.lineAlpha } : {}),
      ...(st.dash ? { dashType: st.dash } : {}),
    };
  if (kind === 'roundRect') {
    const r = Math.min(st.radius ?? 4, b.w / 2, b.h / 2);
    if (r > 0) opts.rectRadius = inch(r);
  }
  if (st.rotate) opts.rotate = st.rotate;
  if (st.flipH) opts.flipH = true;
  if (st.flipV) opts.flipV = true;
  if (st.angles) opts.angleRange = st.angles;
  slide.addShape(kind, opts);
};

const rect = (slide: Slide, b: Box, st: ShapeStyle): void => shape(slide, 'rect', b, st);
const round = (slide: Slide, b: Box, st: ShapeStyle): void => shape(slide, 'roundRect', b, st);

/** A straight line between two points. */
const line = (
  slide: Slide,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  st: { color: string; w?: number; alpha?: number; dash?: 'solid' | 'sysDot' | 'dash' },
): void => {
  shape(slide, 'line', { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }, {
    line: st.color,
    lineW: st.w ?? 1,
    lineAlpha: st.alpha,
    dash: st.dash,
    flipH: x2 < x1 !== y2 < y1 && x2 < x1 ? true : undefined,
    flipV: x2 < x1 !== y2 < y1 && !(x2 < x1) ? true : undefined,
  });
};

/** The template's thin grey rule under a figure. */
const rule = (slide: Slide, x1: number, x2: number, y: number): void =>
  line(slide, x1, y, x2, y, { color: C.rule, w: 1.5, alpha: 40 });

interface TextOpts {
  valign?: 'top' | 'middle' | 'bottom';
  minScale?: number;
  maxScale?: number;
}

/**
 * Draws fitted paragraphs as one text box; draws nothing for an empty or
 * degenerate box. Every string on a slide passes through here, so this is
 * where text is made safe to write: each run is sanitised, and a line break
 * left inside a run becomes a space (paragraphs are separate already).
 */
const drawFitted = (slide: Slide, fitted: Fitted, b: Box, valign: 'top' | 'middle' | 'bottom' = 'middle'): void => {
  if (!(b.w > 0) || !(b.h > 0)) return;
  const props: PptxGenJS.TextProps[] = [];
  fitted.paras.forEach((p, pi) => {
    const segs = segmentsOf(p, fitted.scale);
    segs.forEach((s, si) => {
      const options: PptxGenJS.TextPropsOptions = {
        fontFace: s.font,
        fontSize: s.size,
        color: s.color,
        lang: s.font === JA ? 'ja-JP' : 'vi-VN',
        align: p.align ?? 'left',
      };
      if (s.bold) options.bold = true;
      if (si === segs.length - 1 && pi < fitted.paras.length - 1) options.breakLine = true;
      if (si === 0 && pi > 0 && spaceBefore(p, fitted.scale)) options.paraSpaceBefore = spaceBefore(p, fitted.scale);
      props.push({ text: sanitize(s.text).replace(/[\r\n\t]/g, ' '), options });
    });
  });
  if (!props.length) return;
  slide.addText(props, {
    x: inch(b.x),
    y: inch(b.y),
    w: inch(b.w),
    h: inch(b.h),
    margin: 0,
    valign,
    fit: 'shrink',
    isTextBox: true,
  });
};

/** Fits paragraphs into a box and draws them. Returns the text's height (0 when nothing was drawn). */
const text = (slide: Slide, paras: Para[], b: Box, o: TextOpts = {}): number => {
  if (!(b.w > 1) || !(b.h > 0)) return 0;
  const fitted = fitParas(paras, b.w, b.h, o.minScale ?? 0.6, o.maxScale ?? 1);
  if (!fitted) return 0;
  drawFitted(slide, fitted, b, o.valign ?? 'middle');
  return parasHeight(fitted.paras, b.w, fitted.scale);
};

/** One-line text that shrinks to fit its width. */
const oneLine = (
  slide: Slide,
  runs: Run[],
  b: Box,
  st: { size: number; lang?: 'ja' | 'vi'; bold?: boolean; color?: string; align?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle' | 'bottom'; minScale?: number },
): number => {
  const p: Para = { runs, size: st.size, lang: st.lang ?? 'ja', bold: st.bold, color: st.color, align: st.align };
  if (!paraText(p).trim() || !(b.w > 1) || !(b.h > 0)) return 0;
  const minScale = st.minScale ?? 0.5;
  let scale = 1;
  while (scale > minScale && lineWidth(p, scale) > b.w) scale = Math.round((scale - 0.025) * 1000) / 1000;
  let para = p;
  if (lineWidth(p, scale) > b.w) {
    const len = Array.from(paraText(p)).length;
    let n = len - 1;
    while (n > 1 && lineWidth(cutPara(p, n), scale) > b.w) n -= 1;
    para = cutPara(p, n);
  }
  // A box shorter than its line would let the text stick out: grow it around its anchor.
  const valign = st.valign ?? 'middle';
  const lh = paraLineHeight(para, scale) + 0.5;
  const box = { ...b };
  if (box.h < lh) {
    box.y = valign === 'top' ? b.y : valign === 'bottom' ? b.y + b.h - lh : b.y - (lh - b.h) / 2;
    box.h = lh;
  }
  drawFitted(slide, { paras: [para], scale }, box, valign);
  return lineWidth(para, scale);
};

/** The one scale, down to `floor`, at which every string fits `width`; longer ones are cut. */
const commonScale = (texts: string[], width: number, st: { size: number; bold?: boolean }, floor: number): number => {
  let scale = 1;
  for (const t of texts) {
    const w = lineWidth({ runs: [{ text: t }], size: st.size, lang: 'ja', bold: st.bold });
    if (w > width) scale = Math.min(scale, width / w);
  }
  return Math.max(floor, Math.floor(scale * 40) / 40);
};

/** Text of one style on one line, with no fitting: labels whose length is known. */
const label = (
  slide: Slide,
  s: string,
  b: Box,
  st: { size: number; bold?: boolean; color?: string; align?: 'left' | 'center' | 'right'; lang?: 'ja' | 'vi'; valign?: 'top' | 'middle' | 'bottom' },
): number => oneLine(slide, [{ text: s }], b, { ...st, minScale: 0.6 });

// ---------------------------------------------------------------------------
// Icons, drawn as shapes so they stay sharp and editable
// ---------------------------------------------------------------------------

type IconKind = 'clock' | 'chart' | 'trophy' | 'people' | 'cap';

const icon = (slide: Slide, kind: IconKind, x: number, y: number, d: number): void => {
  const cx = x + d / 2;
  const cy = y + d / 2;
  if (kind === 'clock') {
    const lw = Math.max(1.5, d * 0.08);
    shape(slide, 'ellipse', { x: x + lw / 2, y: y + lw / 2, w: d - lw, h: d - lw }, { line: C.clockInk, lineW: lw });
    line(slide, cx, cy, cx, y + d * 0.24, { color: C.clockInk, w: lw });
    line(slide, cx, cy, x + d * 0.7, y + d * 0.66, { color: C.clockInk, w: lw });
    return;
  }
  const bg = { chart: C.chartBg, trophy: C.trophyBg, people: C.peopleBg, cap: C.capBg }[kind];
  shape(slide, 'ellipse', { x, y, w: d, h: d }, { fill: bg });
  if (kind === 'chart') {
    const ink = C.chartInk;
    const base = y + d * 0.72;
    rect(slide, { x: x + d * 0.25, y: y + d * 0.26, w: d * 0.055, h: d * 0.5 }, { fill: ink });
    rect(slide, { x: x + d * 0.25, y: base - d * 0.02, w: d * 0.52, h: d * 0.055 }, { fill: ink });
    [0.16, 0.27, 0.4].forEach((h, i) =>
      rect(slide, { x: x + d * (0.36 + i * 0.13), y: base - d * 0.02 - d * h, w: d * 0.09, h: d * h }, { fill: ink }),
    );
  } else if (kind === 'trophy') {
    const ink = C.teal;
    shape(slide, 'pie', { x: cx - d * 0.2, y: y + d * 0.1, w: d * 0.4, h: d * 0.4 }, { fill: ink, angles: [0, 180] });
    rect(slide, { x: cx - d * 0.2, y: y + d * 0.27, w: d * 0.4, h: d * 0.03 }, { fill: ink });
    shape(slide, 'ellipse', { x: cx - d * 0.29, y: y + d * 0.26, w: d * 0.14, h: d * 0.14 }, { line: ink, lineW: Math.max(1, d * 0.04) });
    shape(slide, 'ellipse', { x: cx + d * 0.15, y: y + d * 0.26, w: d * 0.14, h: d * 0.14 }, { line: ink, lineW: Math.max(1, d * 0.04) });
    rect(slide, { x: cx - d * 0.035, y: y + d * 0.48, w: d * 0.07, h: d * 0.13 }, { fill: ink });
    round(slide, { x: cx - d * 0.14, y: y + d * 0.6, w: d * 0.28, h: d * 0.07 }, { fill: ink, radius: d * 0.02 });
  } else if (kind === 'people') {
    const ink = C.green;
    shape(slide, 'ellipse', { x: cx + d * 0.03, y: y + d * 0.24, w: d * 0.18, h: d * 0.18 }, { fill: ink });
    shape(slide, 'pie', { x: cx - d * 0.02, y: y + d * 0.47, w: d * 0.3, h: d * 0.3 }, { fill: ink, angles: [180, 360] });
    shape(slide, 'ellipse', { x: cx - d * 0.24, y: y + d * 0.2, w: d * 0.23, h: d * 0.23 }, { fill: ink, line: C.peopleBg, lineW: 1 });
    shape(slide, 'pie', { x: cx - d * 0.31, y: y + d * 0.44, w: d * 0.38, h: d * 0.38 }, { fill: ink, line: C.peopleBg, lineW: 1, angles: [180, 360] });
  } else {
    const ink = C.teal;
    shape(slide, 'pie', { x: cx - d * 0.18, y: y + d * 0.28, w: d * 0.36, h: d * 0.36 }, { fill: ink, angles: [0, 180] });
    shape(slide, 'diamond', { x: cx - d * 0.33, y: y + d * 0.22, w: d * 0.66, h: d * 0.3 }, { fill: ink, line: C.capBg, lineW: 1 });
    line(slide, cx + d * 0.26, y + d * 0.38, cx + d * 0.26, y + d * 0.6, { color: ink, w: Math.max(1, d * 0.04) });
  }
};

// ---------------------------------------------------------------------------
// Shared blocks
// ---------------------------------------------------------------------------

/** A progress bar: a rounded track and a rounded fill. */
const bar = (slide: Slide, b: Box, ratio: number | null, color: string, track: string = C.track, trackLine?: string): void => {
  round(slide, b, { fill: track, line: trackLine ?? track, lineW: 0.75, radius: b.h / 2 });
  if (!isNum(ratio) || ratio <= 0) return;
  const w = Math.max(b.h, Math.min(1, ratio) * b.w);
  round(slide, { ...b, w }, { fill: color, line: color, lineW: 0.75, radius: b.h / 2 });
};

/** A heading and its translation on one line: `顧客別 設計時間/Thời gian …`. */
const headingRuns = (ja: string, vi: string, st: { jaSize: number; viSize: number; color: string }): Run[] => [
  { text: `${ja}/`, bold: true, color: st.color, size: st.jaSize },
  { text: vi, color: C.vi, size: st.viSize },
];

const drawTitle = (slide: Slide, index: number): void => {
  const s = SECTIONS[index];
  const [num, ...rest] = s.ja.split(' ');
  oneLine(
    slide,
    [
      { text: `${num} ${rest.join(' ')}/`, bold: true, color: C.navy, size: 30 },
      { text: s.vi, color: C.vi, size: 18 },
    ],
    { x: 236, y: 4, w: 716, h: 42 },
    { size: 30, minScale: 0.6 },
  );
};

const emptyNote = (slide: Slide): void => {
  text(
    slide,
    [
      { runs: [{ text: '（未記入）' }], size: 16, lang: 'ja', color: C.muted, align: 'center' },
      { runs: [{ text: 'Chưa có nội dung' }], size: 13, lang: 'vi', color: C.muted, align: 'center' },
    ],
    { x: 180, y: 240, w: 600, h: 60 },
  );
};

// ---------------------------------------------------------------------------
// The deck
// ---------------------------------------------------------------------------

interface Ctx {
  pres: PptxGenJS;
  figures: ReportFigures;
  content: ReportContent;
}

const addSlide = (ctx: Ctx): Slide => ctx.pres.addSlide({ masterName: MASTER });

const defineMaster = (pres: PptxGenJS, figures: ReportFigures, logo: string | undefined): void => {
  const month = `${figures.year}年${figures.asOfMonth}月`;
  const objects: PptxGenJS.SlideMasterProps['objects'] = [
    { rect: { x: 0, y: 0, w: inch(960), h: inch(48.5), fill: { color: C.header }, line: { color: C.header, width: 1 } } },
    { rect: { x: 0, y: inch(508.5), w: inch(960), h: inch(31.5), fill: { color: C.footer } } },
    {
      text: {
        text: 'OS Design Team',
        options: {
          x: inch(280),
          y: inch(505),
          w: inch(372),
          h: inch(37),
          fontFace: FOOTER_FONT,
          fontSize: 28,
          color: C.black,
          align: 'center',
          valign: 'middle',
          margin: 0,
          lang: 'en-US',
        },
      },
    },
    {
      text: {
        text: month,
        options: {
          x: inch(820),
          y: inch(510.5),
          w: inch(95),
          h: inch(13),
          fontFace: JA,
          fontSize: 10,
          color: C.black,
          align: 'right',
          valign: 'middle',
          margin: 0,
          lang: 'ja-JP',
        },
      },
    },
  ];
  if (logo) objects.push({ image: { x: inch(15.9), y: inch(6.5), w: inch(181.2), h: inch(35.5), data: logo, altText: 'ESUTECH' } });
  pres.defineSlideMaster({
    title: MASTER,
    background: { color: C.page },
    objects,
    slideNumber: {
      x: inch(915),
      y: inch(510.5),
      w: inch(33),
      h: inch(13),
      fontFace: JA,
      fontSize: 10,
      color: C.black,
      align: 'right',
      valign: 'middle',
      margin: 0,
    },
  });
};

// --- Cover -----------------------------------------------------------------

/** A big figure, a dotted leader and its unit, as on the cover's cards. */
const figureLine = (
  slide: Slide,
  value: string,
  unit: string,
  x: number,
  y: number,
  right: number,
  st: { size: number; unitSize: number; h: number },
): void => {
  const valueW = oneLine(slide, [{ text: value }], { x, y, w: right - x - 60, h: st.h }, {
    size: st.size,
    bold: true,
    color: C.ink,
    minScale: 0.5,
  });
  const unitW = lineWidth({ runs: [{ text: unit }], size: st.unitSize, lang: 'ja' }) + 2;
  label(slide, unit, { x: right - unitW, y: y + st.h - st.unitSize * 1.6, w: unitW, h: st.unitSize * 1.4 }, {
    size: st.unitSize,
    color: C.muted,
    align: 'right',
  });
  const lx1 = x + valueW + 10;
  const lx2 = right - unitW - 4;
  if (lx2 - lx1 > 12) {
    const ly = y + st.h - st.unitSize * 0.55;
    line(slide, lx1, ly, lx2, ly, { color: C.muted, w: 1.25, dash: 'sysDot' });
  }
};

const cover = (ctx: Ctx): void => {
  const { figures: f, content: c } = ctx;
  const slide = addSlide(ctx);

  round(slide, { x: 54, y: 81, w: 886, h: 356 }, { fill: C.card, line: 'E1E7EF', lineW: 1, radius: 5.8 });
  rect(slide, { x: 54, y: 81, w: 8.6, h: 356 }, { fill: C.navy });
  round(slide, { x: 90, y: 95, w: 77.4, h: 10.4 }, { fill: C.cyan, radius: 5.2 });

  text(
    slide,
    [
      { runs: [{ text: 'OS設計チーム' }], size: 40, lang: 'ja', bold: true, color: C.navy },
      { runs: [{ text: '事業状況報告' }], size: 40, lang: 'ja', bold: true, color: C.navy },
      { runs: [{ text: 'Báo cáo tình hình kinh doanh của Nhóm Thiết kế OS' }], size: 22, lang: 'vi', color: C.vi },
    ],
    { x: 90, y: 106, w: 350, h: 126 },
    { valign: 'top' },
  );

  text(
    slide,
    SECTIONS.map(s => ({ runs: [{ text: s.ja }], size: 15, lang: 'ja' as const, color: C.muted })),
    { x: 124.8, y: 238, w: 320, h: 80 },
    { valign: 'top' },
  );

  const date = parseDate(c.reportDate);
  if (date) {
    const pillText = `${date.y}年${date.m}月${date.d}日：現時点`;
    const w = Math.max(215.7, lineWidth({ runs: [{ text: pillText }], size: 14, lang: 'ja', bold: true }) + 44);
    shape(slide, 'flowChartTerminator', { x: 105.4, y: 334, w, h: 22.4 }, { fill: C.pill, line: C.navy, lineW: 1 });
    label(slide, pillText, { x: 105.4, y: 334, w, h: 22.4 }, { size: 14, bold: true, color: C.teal, align: 'center' });
  }

  const focus = bi(c.focus);
  if (!biEmpty(focus)) {
    const paras = biParas(focus, {
      size: 14,
      subSize: 14,
      bold: true,
      color: C.ink,
      lead: [{ text: '重点：' }],
      subLead: [{ text: 'Trọng tâm: ' }],
    });
    const h = text(slide, paras, { x: 92, y: 380, w: 830, h: 52 }, { valign: 'top', minScale: 0.7 });
    if (h > 0) rect(slide, { x: 76.5, y: 380, w: 8.6, h: Math.min(25, h) }, { fill: C.blue });
  }

  // Design hours to date.
  const card1 = { x: 470, y: 92, w: 431, h: 139 };
  round(slide, card1, { fill: C.statFill, line: C.statLine, lineW: 1, radius: 7.6 });
  rect(slide, { x: card1.x, y: card1.y, w: 10, h: card1.h }, { fill: C.blue });
  icon(slide, 'clock', 491, 98, 29);
  oneLine(slide, headingRuns('現時点設計時間', 'Tổng thời gian thiết kế hiện tại', { jaSize: 16, viSize: 16, color: C.muted }), { x: 530, y: 100, w: 362, h: 26 }, { size: 16 });
  figureLine(slide, fmtInt(f.hoursActual), 'h', 497, 128, 795, { size: 40, unitSize: 12, h: 44 });
  rule(slide, 495, 795, 183);
  const target = f.hoursPlanYear > 0 ? fmtHours(f.hoursPlanYear) : DASH;
  text(
    slide,
    [
      { runs: [{ text: `目標 ${target} / 達成率 ${fmtPct(f.achievementRate)}` }], size: 12, lang: 'ja', color: C.muted },
      {
        runs: [
          { text: 'Mục tiêu năm: ' },
          { text: f.hoursPlanYear > 0 ? `${fmtInt(f.hoursPlanYear)} giờ` : DASH, bold: true },
          { text: ' / Tỷ lệ đạt mục tiêu: ' },
          { text: isNum(f.achievementRate) ? `khoảng ${pctNum(f.achievementRate)}%` : DASH, bold: true },
        ],
        size: 12,
        lang: 'vi',
        color: C.vi,
      },
    ],
    { x: 491, y: 190, w: 400, h: 36 },
  );

  // Actual revenue.
  const card2 = { x: 470, y: 248, w: 431, h: 130 };
  round(slide, card2, { fill: C.statFill, line: C.statLine, lineW: 1, radius: 7.6 });
  rect(slide, { x: card2.x, y: card2.y, w: 12, h: card2.h }, { fill: C.orange });
  icon(slide, 'chart', 488.6, 250, 39);
  oneLine(slide, headingRuns('売上実績', 'Doanh thu thực tế', { jaSize: 16, viSize: 16, color: C.muted }), { x: 537.7, y: 257, w: 350, h: 26 }, { size: 16 });
  figureLine(slide, fmtMan(f.revenueActual), '万円', 486, 283, 795, { size: 27, unitSize: 10, h: 34 });
  rule(slide, 495, 795, 320);
  const plan = f.revenuePlanYear > 0 ? fmtManYen(f.revenuePlanYear) : DASH;
  text(
    slide,
    [
      { runs: [{ text: `年間計画 ${plan} / 達成率 ${fmtPct(f.revenueRate)}` }], size: 12, lang: 'ja', color: C.muted },
      {
        runs: [
          { text: 'Kế hoạch doanh thu năm: ' },
          { text: f.revenuePlanYear > 0 ? `${fmtMan(f.revenuePlanYear)} vạn Yên` : DASH, bold: true },
          { text: ' / Tỷ lệ đạt: ' },
          { text: isNum(f.revenueRate) ? `khoảng ${pctNum(f.revenueRate)}%` : DASH, bold: true },
        ],
        size: 12,
        lang: 'vi',
        color: C.vi,
      },
    ],
    { x: 486, y: 326, w: 405, h: 40 },
  );
};

// --- Section 1 -------------------------------------------------------------

interface Kpi {
  icon: IconKind;
  color: string;
  ja: string;
  vi: string;
  value: string;
  prefix?: string;
  unit: string;
  sub: string;
}

const kpiCard = (slide: Slide, k: Kpi, x: number, w: number): void => {
  const y = 95;
  const h = 109.4;
  round(slide, { x, y, w, h }, { fill: C.card, line: C.kpiLine, lineW: 1, radius: 5.8 });
  rect(slide, { x, y, w: 5, h }, { fill: k.color });
  icon(slide, k.icon, x + 12, 102, 26);
  text(slide, [{ runs: headingRuns(k.ja, k.vi, { jaSize: 12, viSize: 12, color: C.muted }), size: 12, lang: 'ja', color: C.muted }], {
    x: x + 44,
    y: 99,
    w: w - 50,
    h: 31,
  });
  const unitW = k.unit ? lineWidth({ runs: [{ text: k.unit }], size: 12, lang: 'ja' }) + 2 : 0;
  const right = x + w - 14;
  oneLine(
    slide,
    [...(k.prefix ? [{ text: k.prefix, size: 14, bold: false, color: C.muted }] : []), { text: k.value }],
    { x: x + 16, y: 130, w: right - unitW - 8 - (x + 16), h: 38 },
    { size: 27, bold: true, color: C.ink, minScale: 0.45 },
  );
  if (k.unit) label(slide, k.unit, { x: right - unitW, y: 143, w: unitW, h: 17 }, { size: 12, color: C.muted, align: 'right' });
  rule(slide, x + 6, right, 172);
  oneLine(slide, [{ text: k.sub }], { x: x + 16, y: 176, w: w - 28, h: 22 }, { size: 12, color: C.muted });
};

/** Customers with hours, capped with a "+N more" line when they would not fit. */
const customerRows = (slide: Slide, f: ReportFigures, area: Box): void => {
  const all = f.customers.filter(cu => isNum(cu.hoursActual) && cu.hoursActual > 0);
  if (!all.length) return;
  const MAX = 8;
  const shown = all.length > MAX ? all.slice(0, MAX - 1) : all;
  const rest = all.length > MAX ? all.slice(MAX - 1) : [];
  const rows = shown.length + (rest.length ? 1 : 0);
  const pitch = Math.min(36, area.h / rows);
  const max = Math.max(...all.map(cu => cu.hoursActual));
  const roomy = pitch >= 28;
  const nameW = 98;
  const hoursW = 66;
  const hoursX = area.x + area.w - hoursW;
  const rateW = roomy ? 0 : 64;
  const barX = area.x + nameW + 4 + rateW;
  const barW = hoursX - 26 - barX;
  const barH = roomy ? 12 : Math.max(6, Math.min(11, pitch - 9));
  const size = roomy ? 10 : Math.max(7.5, Math.min(9.5, pitch * 0.42));
  const names = shown.map(customerName);
  const nameSize = size * commonScale(names, nameW, { size }, 0.8);

  shown.forEach((cu: ReportCustomerFigures, i) => {
    const top = area.y + i * pitch;
    const barY = roomy ? top + 16 : top + (pitch - barH) / 2;
    const mid = barY + barH / 2;
    const color = BAR_COLORS[i % BAR_COLORS.length];
    oneLine(slide, [{ text: names[i] }], { x: area.x, y: mid - 9, w: nameW, h: 18 }, { size: nameSize, color: C.ink, minScale: 1 });
    if (roomy)
      label(slide, fmtRate(cu.rate), { x: barX + barW / 2 - 60, y: top, w: 120, h: 15 }, { size: 10, color: C.navy, align: 'center' });
    else
      label(slide, fmtRate(cu.rate), { x: area.x + nameW + 2, y: mid - 8, w: rateW - 4, h: 16 }, { size: size - 0.5, color: C.navy, align: 'right' });
    bar(slide, { x: barX, y: barY, w: barW, h: barH }, cu.hoursActual / max, color, C.barTrack, C.barTrackLine);
    const hoursText = fmtHours(cu.hoursActual);
    const tw = label(slide, hoursText, { x: hoursX, y: mid - 9, w: hoursW, h: 18 }, { size: size - 0.5, bold: true, color: C.ink, align: 'right' });
    const lx1 = barX + barW + 5;
    const lx2 = hoursX + hoursW - tw - 4;
    if (lx2 - lx1 > 6) line(slide, lx1, mid + 2, lx2, mid + 2, { color: C.ink, w: 1, dash: 'sysDot' });
  });
  if (rest.length) {
    const top = area.y + shown.length * pitch;
    const total = rest.reduce((s, cu) => s + cu.hoursActual, 0);
    label(slide, `他${rest.length}社（計 ${fmtHours(total)}）`, { x: area.x, y: top + (pitch - 16) / 2, w: area.w, h: 16 }, { size: Math.min(size, 9.5), color: C.muted });
  }
};

/** 前年同期比: this year's hours and revenue against the two years before, same months. */
const pastYearsBlock = (slide: Slide, f: ReportFigures, x: number, y: number, w: number): void => {
  const past = f.pastYears.filter(p => isNum(p.hoursActual));
  if (!past.length) return;
  const m = f.asOfMonth;
  // 前年比 is against the year before, and only that year: none when it is missing.
  const prev = past.find(p => p.year === f.year - 1);
  const ratio = prev && prev.hoursActual > 0 ? f.hoursActual / prev.hoursActual : null;
  oneLine(
    slide,
    [
      { text: `前年同期比（1〜${m}月）/`, bold: true, color: C.navy, size: 12 },
      { text: `So với cùng kỳ năm trước (T1–T${m})`, color: C.vi, size: 11 },
      ...(ratio !== null ? [{ text: `${IDEO_SPACE}前年比 ${fmtPct(ratio)}`, bold: true, color: C.blue, size: 11, ja: true }] : []),
    ],
    { x, y, w, h: 18 },
    { size: 12 },
  );
  const rows = [...past.map(p => ({ year: p.year, hours: p.hoursActual, revenue: p.revenueActual, current: false })), { year: f.year, hours: f.hoursActual, revenue: f.revenueActual, current: true }];
  const max = Math.max(1, ...rows.map(r => r.hours));
  const labelW = 42;
  const valueW = 150;
  const barW = w - labelW - valueW - 12;
  rows.forEach((r, i) => {
    const top = y + 21 + i * 14.5;
    label(slide, `${r.year}年`, { x, y: top, w: labelW, h: 13 }, { size: 9.2, bold: r.current, color: C.ink });
    const bw = Math.max(3, (r.hours / max) * barW);
    round(slide, { x: x + labelW, y: top + 3, w: bw, h: 7.5 }, { fill: r.current ? C.blue : C.greyBar, radius: 3.75 });
    label(slide, `${fmtHours(r.hours)} ・ ${fmtManYen(r.revenue)}`, { x: x + w - valueW, y: top, w: valueW, h: 13 }, {
      size: 9.2,
      bold: r.current,
      color: r.current ? C.ink : C.muted,
      align: 'right',
    });
  });
};

const section1 = (ctx: Ctx): void => {
  const { figures: f, content: c } = ctx;
  const slide = addSlide(ctx);
  drawTitle(slide, 0);
  label(slide, '年間目標に対する進捗と主要顧客別の実績', { x: 44.6, y: 60, w: 600, h: 24 }, { size: 16, color: C.black });

  const kpis: Kpi[] = [
    {
      icon: 'clock',
      color: C.blue,
      ja: '設計時間 実績',
      vi: 'Thời gian thiết kế thực tế',
      value: fmtInt(f.hoursActual),
      unit: 'h',
      sub: `年間目標 ${f.hoursPlanYear > 0 ? fmtHours(f.hoursPlanYear) : DASH}`,
    },
    {
      icon: 'trophy',
      color: C.teal,
      ja: '目標達成率',
      vi: 'Tỷ lệ hoàn thành mục tiêu',
      value: pctNum(f.achievementRate),
      prefix: isNum(f.achievementRate) ? '約' : undefined,
      unit: isNum(f.achievementRate) ? '%' : '',
      sub: `${f.asOfMonth}月時点`,
    },
    {
      icon: 'chart',
      color: C.orange,
      ja: '売上実績',
      vi: 'Doanh thu thực tế',
      value: fmtMan(f.revenueActual),
      unit: '万円',
      sub: `計画 ${f.revenuePlanYear > 0 ? fmtManYen(f.revenuePlanYear) : DASH}`,
    },
    {
      icon: 'people',
      color: C.green,
      ja: '主要顧客',
      vi: 'Khách hàng',
      value: fmtInt(f.customersWithActuals),
      unit: '社',
      sub: '実績発生顧客',
    },
  ];
  const kx = 30.7;
  const kw = (946.7 - kx - 3 * 12) / 4;
  kpis.forEach((k, i) => kpiCard(slide, k, kx + i * (kw + 12), kw));

  const hasCustomers = f.customers.some(cu => isNum(cu.hoursActual) && cu.hoursActual > 0);
  const leftW = hasCustomers ? 384 : 866;

  // 年間進捗
  oneLine(slide, headingRuns('年間進捗', 'Tiến độ năm', { jaSize: 16, viSize: 14, color: C.navy }), { x: 46.8, y: 220, w: leftW, h: 24 }, { size: 16 });
  const progress = [
    {
      ja: '設計時間',
      vi: 'Giờ thiết kế',
      value: `${fmtInt(f.hoursActual)} / ${f.hoursPlanYear > 0 ? fmtHours(f.hoursPlanYear) : DASH}`,
      ratio: f.achievementRate,
      color: C.blue,
    },
    {
      ja: '売上',
      vi: 'Doanh thu',
      value: `${fmtMan(f.revenueActual)} / ${f.revenuePlanYear > 0 ? fmtManYen(f.revenuePlanYear) : DASH}`,
      ratio: f.revenueRate,
      color: C.orange,
    },
  ];
  progress.forEach((p, i) => {
    const top = 246 + i * 44;
    oneLine(slide, [{ text: `${p.ja} ` }, { text: p.vi, color: C.muted, size: 8.5 }], { x: 47.5, y: top, w: leftW / 2, h: 13 }, {
      size: 9.2,
      color: C.ink,
    });
    label(slide, p.value, { x: 46 + leftW / 2, y: top, w: leftW / 2, h: 13 }, { size: 9.2, color: C.muted, align: 'right' });
    bar(slide, { x: 46, y: top + 15, w: leftW, h: 14 }, p.ratio, p.color);
  });
  pastYearsBlock(slide, f, 46.8, 338, leftW);

  if (hasCustomers) {
    oneLine(
      slide,
      headingRuns('顧客別 設計時間', 'Thời gian thiết kế theo khách hàng', { jaSize: 16, viSize: 16, color: C.navy }),
      { x: 488.9, y: 220, w: 404, h: 24 },
      { size: 16 },
    );
    rule(slide, 486.7, 890.6, 246);
    customerRows(slide, f, { x: 486.7, y: 250, w: 406, h: 152 });
  }

  // The highlighted customer story.
  const title = bi(c.highlight.title);
  const body = bi(c.highlight.body);
  if (!biEmpty(title) || !biEmpty(body)) {
    const box = { x: 46.8, y: 408, w: 866, h: 96 };
    round(slide, box, { fill: C.highlight, line: C.highlightLine, lineW: 1, radius: 7.6 });
    let bodyX = box.x + 16;
    if (title.main) {
      const tagW = Math.min(200, Math.max(90, lineWidth({ runs: [{ text: title.main }], size: 16, lang: 'ja', bold: true }) + 22));
      round(slide, { x: 57.6, y: 420, w: tagW, h: 25 }, { fill: C.highlightTag, radius: 6 });
      oneLine(slide, [{ text: title.main }], { x: 60, y: 420, w: tagW - 5, h: 25 }, { size: 16, bold: true, color: C.blue, align: 'center', minScale: 0.6 });
      if (title.sub.length)
        text(slide, title.sub.map(s => ({ runs: [{ text: s }], size: 10, lang: 'vi' as const, color: C.vi })), { x: 57.6, y: 450, w: tagW, h: 48 }, { valign: 'top' });
      bodyX = 57.6 + Math.max(tagW, 120) + 30;
    }
    if (!biEmpty(body))
      text(slide, biParas(body, { size: 16, subSize: 14, color: C.ink, gap: 2 }), { x: bodyX, y: 412, w: box.x + box.w - 14 - bodyX, h: 88 }, { minScale: 0.55 });
  }
};

// --- Section 2 -------------------------------------------------------------

/** A customer is new when a new focus project carries exactly its name or code (trimmed, any case). */
const isNewCustomer = (cu: ReportCustomerFigures, projects: ReportFocusProject[]): boolean => {
  const keys = [flat(cu.name), flat(cu.code)].map(k => k.toLowerCase()).filter(Boolean);
  return projects.some(p => p.isNew && keys.includes(bi(p.name).main.toLowerCase()));
};

/** Section 2 lists what the page lists: customers with hours, and any other the report says something about. */
const listedCustomers = (ctx: Ctx): ReportCustomerFigures[] =>
  ctx.figures.customers.filter(cu => {
    const note = ctx.content.customers[cu.projectId];
    return (isNum(cu.hoursActual) && cu.hoursActual > 0) || clean(note?.status).trim() !== '' || note?.parts != null;
  });

const rateRowsCard = (slide: Slide, ctx: Ctx, card: Box): void => {
  const { content: c } = ctx;
  const list = listedCustomers(ctx);
  const other = bi(c.otherCustomers);
  round(slide, card, { fill: C.card, line: C.cardLine, lineW: 1, radius: 3.7 });
  oneLine(slide, headingRuns('主要顧客・単価', 'Khách hàng chính & đơn giá', { jaSize: 16, viSize: 12, color: C.navy }), { x: card.x + 19.4, y: card.y + 6, w: card.w - 40, h: 24 }, { size: 16 });

  const noteH = biEmpty(other) ? 0 : 48;
  const top = card.y + 31;
  const bottom = card.y + card.h - 10 - (noteH ? noteH + 6 : 0);
  const MAX = 8;
  const shown = list.length > MAX ? list.slice(0, MAX - 1) : list;
  const rest = list.length > MAX ? list.length - (MAX - 1) : 0;
  const slots = shown.length + (rest ? 1 : 0);
  const pitch = slots ? Math.min(52.5, (bottom - top) / slots) : 0;
  const rowH = pitch - 4;
  const rowX = card.x + 19.4;
  const rowW = card.w - 27;
  const scale = Math.min(1, Math.max(0.6, rowH / 48));
  const nameSize = 16 * scale;
  const names = shown.map(customerName);
  const nameRun = (n: string, size: number): Para => ({ runs: [{ text: n }], size, lang: 'ja', bold: true });
  const nameW = Math.min(card.w * 0.34, Math.max(46, ...names.map(n => lineWidth(nameRun(n, nameSize)))));
  const rateW = Math.max(...shown.map(cu => lineWidth({ runs: [{ text: fmtRate(cu.rate) }], size: nameSize, lang: 'ja', bold: true })), 40);
  const nameX = rowX + 11.6;
  const rateX = nameX + nameW + 8;
  const statusX = rateX + rateW + 10;
  const statusW = rowX + rowW - 8 - statusX;
  const statusSize = 15 * scale;
  const subSize = 11.5 * scale;

  // Names share one size, shrinking to 70 % to stay on one line. A name still
  // too long wraps to two lines over its whole row, at one size for every such
  // name, and is cut only if even that does not hold it.
  const nameFit = nameSize * commonScale(names, nameW, { size: nameSize, bold: true }, 0.7);
  const wraps = names.map(n => lineWidth(nameRun(n, nameFit)) > nameW);
  const nameBoxH = rowH - 2;
  const wrapFits = (n: string, s: number): boolean => {
    const p = nameRun(n, nameFit);
    return lineCount(p, nameW, s) <= 2 && parasHeight([p], nameW, s) <= nameBoxH;
  };
  let wrapScale = 1;
  for (const n of names.filter((_, i) => wraps[i])) {
    while (wrapScale > 0.6 && !wrapFits(n, wrapScale)) wrapScale = Math.round((wrapScale - 0.025) * 1000) / 1000;
  }

  shown.forEach((cu, i) => {
    const y = top + i * pitch;
    const note = c.customers[cu.projectId];
    round(slide, { x: rowX - 6.5, y, w: 18, h: rowH }, { fill: ROW_CAPS[i % ROW_CAPS.length], radius: 9 });
    rect(slide, { x: rowX, y, w: rowW, h: rowH }, { fill: i % 2 === 0 ? C.rowAlt : C.white, line: C.rowLine, lineW: 0.7 });
    const nameColor = isNewCustomer(cu, c.focusProjects) ? C.orange : C.ink;
    const status = bi(note?.status);
    const parts = note && isNum(note.parts) ? note.parts : null;
    // Name, rate and status on top; the part count and the status's translation underneath, as in the template.
    const topH = parts !== null || status.sub.length ? rowH * 0.54 : rowH;
    const bandY = y + topH - 1;
    const bandH = rowH - topH;
    if (wraps[i])
      text(slide, [{ ...nameRun(names[i], nameFit), color: nameColor }], { x: nameX, y: y + 1, w: nameW, h: nameBoxH }, { minScale: wrapScale, maxScale: wrapScale });
    else oneLine(slide, [{ text: names[i] }], { x: nameX, y, w: nameW, h: topH }, { size: nameFit, bold: true, color: nameColor, minScale: 1 });
    oneLine(slide, [{ text: fmtRate(cu.rate) }], { x: rateX, y, w: rateW + 2, h: topH }, { size: nameSize, bold: true, color: C.navy, minScale: 0.6 });
    if (status.main && statusW > 30)
      text(slide, [{ runs: [{ text: status.main }], size: statusSize, lang: 'ja', color: C.muted }], { x: statusX, y: y + 1, w: statusW, h: topH - 1 }, { minScale: 0.55 });
    // Under a two-line name there is no room for the part count: it moves under the rate.
    const partsX = wraps[i] ? rateX : nameX;
    let viX = rateX;
    if (parts !== null) {
      const partsRuns: Run[] = [{ text: `${fmtInt(parts)}部品 ` }, { text: `${fmtInt(parts)} chi tiết`, color: C.vi }];
      const w = oneLine(slide, partsRuns, { x: partsX, y: bandY, w: wraps[i] ? Math.max(rateW, statusW / 2) : rateX + rateW - nameX, h: bandH }, { size: Math.max(8, 10.5 * scale), color: C.muted });
      viX = Math.max(rateX, partsX + w + 12);
    }
    const viW = rowX + rowW - 8 - viX;
    if (status.sub.length && viW > 40)
      text(
        slide,
        status.sub.map(l => ({ runs: [{ text: l }], size: subSize, lang: 'vi' as const, color: C.vi })),
        { x: viX, y: bandY, w: viW, h: bandH },
        { minScale: 0.6 },
      );
  });
  if (rest) {
    const y = top + shown.length * pitch;
    label(slide, `他${rest}社`, { x: nameX, y, w: rowW - 20, h: Math.min(rowH, 20) }, { size: 11, color: C.muted });
  }
  if (noteH) {
    const y = slots ? top + slots * pitch + 4 : top + 4;
    text(slide, biParas(other, { size: 16, subSize: 12, color: C.muted }), { x: card.x + 30, y, w: card.w - 44, h: noteH }, { minScale: 0.55 });
  }
};

interface ProjectLayout {
  header: Para;
  sub: Para[];
  points: Para[];
}

const projectParas = (p: ReportFocusProject, i: number): ProjectLayout => {
  const name = bi(p.name);
  return {
    header: {
      runs: [{ text: `${i + 1}.${name.main || '（名称未記入）'}` }, ...(p.isNew ? [{ text: '（新規顧客）' }] : [])],
      size: 20,
      lang: 'ja',
      bold: true,
      color: C.navy,
    },
    sub: name.sub.map(s => ({ runs: [{ text: s }], size: 12, lang: 'vi' as const, color: C.vi })),
    points: p.points
      .map(pt => bi(pt))
      .filter(b => !biEmpty(b))
      .flatMap((b, k) =>
        biParas(b, {
          size: 15,
          subSize: 12,
          color: C.ink,
          lead: [{ text: `${String.fromCodePoint(0x2460 + Math.min(k, 19))}${IDEO_SPACE}`, bold: true, color: C.teal, ja: true }],
        }).map((para, j) => (j === 0 && k > 0 ? { ...para, before: 5 } : para)),
      ),
  };
};

const focusCard = (slide: Slide, ctx: Ctx, card: Box): void => {
  // Every project the page lists, numbered as the page numbers them.
  const all = ctx.content.focusProjects;
  const MAX = 3;
  const projects = all.slice(0, MAX);
  round(slide, card, { fill: C.focus, line: C.focusLine, lineW: 1, radius: 4 });
  round(slide, { x: card.x + 19.2, y: card.y + 1.2, w: 101.6, h: 26 }, { fill: C.focusTag, radius: 6.5 });
  label(slide, '重点案件', { x: card.x + 19.2, y: card.y + 1.2, w: 101.6, h: 26 }, { size: 15, bold: true, color: C.orange, align: 'center' });

  const innerX = card.x + 14;
  const innerW = card.w - 28;
  const top = card.y + 32;
  const bottom = card.y + card.h - 8 - (all.length > MAX ? 16 : 0);
  const partsW = 128;
  const layouts = projects.map(projectParas);

  // Each block: a header (name, stage and part count, with the name's translation), then its points.
  const headBlock = (l: ProjectLayout, p: ReportFocusProject, s: number): number => {
    const textW = innerW - (isNum(p.parts) ? partsW : 0);
    const headH = paraLineHeight(l.header, s) + 2;
    const subH = l.sub.length ? Math.min(parasHeight(l.sub, textW - 4, s), Math.max(16, 44 * s)) : 0;
    return Math.max(headH + subH, isNum(p.parts) ? 58 * s : 0) + 4;
  };
  const pointsBlock = (l: ProjectLayout, s: number): number => (l.points.length ? parasHeight(l.points, innerW - 2, s) + 11 : 0);
  const GAP = 8;
  const total = (s: number): number => layouts.reduce((h, l, i) => h + headBlock(l, projects[i], s) + pointsBlock(l, s) + GAP, 0);
  let s = 1;
  while (s > 0.6 && total(s) > bottom - top) s = Math.round((s - 0.025) * 1000) / 1000;
  const heads = layouts.map((l, i) => headBlock(l, projects[i], s));
  const needs = layouts.map(l => pointsBlock(l, s));

  let y = top;
  projects.forEach((p, i) => {
    const l = layouts[i];
    if (i > 0) line(slide, innerX, y - 4, innerX + innerW, y - 4, { color: C.rule, w: 1.5, alpha: 40 });
    const hasParts = isNum(p.parts);
    const textW = innerW - (hasParts ? partsW : 0);
    const headW = lineWidth(l.header, s);
    const stage = bi(p.stage).main;
    // The stage pill takes at most 45 % of the line and its label shrinks, then is cut; the name keeps at least 60 pt.
    const stageW = stage ? Math.min(lineWidth({ runs: [{ text: stage }], size: 13, lang: 'ja', bold: true }, s) + 14, textW * 0.45) : 0;
    const nameW = Math.max(60, Math.min(headW, textW - (stage ? stageW + 8 : 0)));
    const headH = paraLineHeight(l.header, s) + 2;
    oneLine(slide, l.header.runs, { x: innerX, y, w: nameW + 2, h: headH }, { size: 20 * s, bold: true, color: C.navy, minScale: 0.55 });
    if (stage) {
      const sx = innerX + nameW + 8;
      round(slide, { x: sx, y: y + headH / 2 - 10 * s, w: stageW, h: 20 * s }, { fill: C.stageFill, radius: 4 });
      label(slide, stage, { x: sx + 5, y: y + headH / 2 - 10 * s, w: stageW - 10, h: 20 * s }, { size: 13 * s, bold: true, color: C.stageText, align: 'center' });
    }
    if (l.sub.length) text(slide, l.sub, { x: innerX + 4, y: y + headH, w: textW - 4, h: heads[i] - 4 - headH }, { valign: 'top', minScale: 0.7, maxScale: s });
    if (hasParts) {
      const px = innerX + innerW - partsW;
      oneLine(slide, [{ text: '現在の対応範囲/', bold: true, color: C.muted }, { text: 'Phạm vi hiện tại', color: C.vi, size: 9 }], { x: px, y, w: partsW, h: 15 * s }, { size: 10.5 * s, align: 'right' });
      line(slide, px + 4, y + 16 * s, px + partsW, y + 16 * s, { color: C.rule, w: 1.25, alpha: 40 });
      oneLine(slide, [{ text: `${fmtInt(p.parts)}部品` }], { x: px, y: y + 17 * s, w: partsW, h: 40 * s }, { size: 34 * s, bold: true, color: C.orange, align: 'right', minScale: 0.5 });
    }
    y += heads[i];
    if (l.points.length) {
      // Share what is left among this block's points and the blocks still to come.
      const later = heads.slice(i + 1).reduce((a, b) => a + b + GAP, 0);
      const room = Math.max(0, bottom - y - later - GAP);
      const needLeft = needs.slice(i).reduce((a, b) => a + b, 0);
      const h = Math.min(needs[i], needLeft > 0 ? room * (needs[i] / needLeft) : 0);
      if (h > 14) {
        line(slide, innerX, y, innerX + innerW, y, { color: C.rule, w: 1.25, alpha: 40 });
        text(slide, l.points, { x: innerX + 2, y: y + 5, w: innerW - 2, h: h - 11 }, { valign: 'top', minScale: s, maxScale: s });
        y += h;
      }
    }
    y += GAP;
  });
  if (all.length > MAX)
    label(slide, `…他${all.length - MAX}件`, { x: innerX, y: card.y + card.h - 22, w: innerW, h: 14 }, { size: 10, color: C.muted, align: 'right' });
};

const section2 = (ctx: Ctx): void => {
  const { content: c } = ctx;
  const slide = addSlide(ctx);
  drawTitle(slide, 1);
  label(slide, '主要顧客の契約単価と重点案件の状況', { x: 44.6, y: 60, w: 600, h: 24 }, { size: 16, color: C.black });

  const policy = bi(c.policy);
  const hasRows = listedCustomers(ctx).length > 0;
  const hasOther = !biEmpty(bi(c.otherCustomers));
  const hasLeft = hasRows || hasOther;
  const hasFocus = c.focusProjects.length > 0;
  const bottom = biEmpty(policy) ? 500 : 428;
  const top = 99.4;
  if (hasLeft && hasFocus) {
    rateRowsCard(slide, ctx, { x: 46.8, y: top, w: 435.6, h: bottom - top });
    focusCard(slide, ctx, { x: 497.4, y: top, w: 453.8, h: bottom - top });
  } else if (hasLeft) rateRowsCard(slide, ctx, { x: 46.8, y: top, w: 866.4, h: bottom - top });
  else if (hasFocus) focusCard(slide, ctx, { x: 46.8, y: top, w: 866.4, h: bottom - top });

  if (!biEmpty(policy)) {
    const box = { x: 54.4, y: 434.5, w: 891.6, h: 66 };
    round(slide, box, { fill: C.card, line: C.policyLine, lineW: 1, radius: 4.9 });
    text(
      slide,
      biParas(policy, {
        size: 22,
        subSize: 14,
        bold: true,
        color: C.ink,
        align: 'center',
        lead: policy.main ? [{ text: '方針：' }] : undefined,
        subLead: [{ text: 'Phương châm: ' }],
        gap: 2,
      }),
      { x: box.x + 12, y: box.y + 3, w: box.w - 24, h: box.h - 6 },
      { minScale: 0.55 },
    );
  }
  if (!hasLeft && !hasFocus && biEmpty(policy)) emptyNote(slide);
};

// --- Section 3 -------------------------------------------------------------

const trainingCard = (slide: Slide, ctx: Ctx, card: Box): void => {
  const t = ctx.content.training;
  round(slide, card, { fill: C.card, line: C.cardLine, lineW: 1, radius: 4.6 });
  round(slide, { x: card.x + 18.9, y: card.y + 13.4, w: 209.4, h: 42.2 }, { fill: C.trainTag, radius: 10.5 });
  text(
    slide,
    [
      { runs: [{ text: '人材育成' }], size: 12, lang: 'ja', bold: true, color: C.teal, align: 'center' },
      { runs: [{ text: 'Đào tạo nhân lực' }], size: 12, lang: 'vi', color: C.vi, align: 'center' },
    ],
    { x: card.x + 18.9, y: card.y + 15, w: 209.4, h: 39 },
  );
  const inner = { x: card.x + 18.9, w: card.w - 37.8 };
  let y = card.y + 60;
  const title = bi(t.title);
  if (!biEmpty(title))
    y += text(slide, biParas(title, { size: 17, subSize: 12, bold: true, color: C.navy }), { x: inner.x + 2, y, w: inner.w, h: 44 }, { valign: 'top', minScale: 0.6 }) + 8;

  const progress = bi(t.progress);
  const hasSeats = isNum(t.trainees) || isNum(t.seats);
  const hasStatus = hasSeats || !biEmpty(progress);
  const statusH = hasStatus ? 24 + 44 + (progress.sub.length ? 22 : 0) : 0;
  const points = t.points.map(pt => bi(pt)).filter(b => !biEmpty(b));
  const pointsBottom = card.y + card.h - 12 - (hasStatus ? statusH + 8 : 0);
  if (points.length && pointsBottom - y > 50) {
    const box = { x: inner.x, y: y + 12, w: inner.w, h: pointsBottom - y - 12 };
    const paras = points.flatMap((b, k) =>
      biParas(b, { size: 12, subSize: 12, color: C.ink, lead: [{ text: '● ', bold: true, color: C.teal, ja: true }] }).map((p, j) =>
        j === 0 && k > 0 ? { ...p, before: 6 } : p,
      ),
    );
    const fitted = fitParas(paras, box.w - 20, box.h - 40, 0.6);
    if (fitted) {
      const used = parasHeight(fitted.paras, box.w - 20, fitted.scale);
      const h = Math.min(box.h, used + 42);
      round(slide, { ...box, h }, { fill: C.pointsBox, line: C.pointsBoxLine, lineW: 1, radius: 18 });
      icon(slide, 'cap', box.x + 10, box.y - 6, 34);
      drawFitted(slide, fitted, { x: box.x + 10, y: box.y + 32, w: box.w - 20, h: h - 38 }, 'top');
    }
  }

  if (hasStatus) {
    // At the card's foot, as in the template; right under the title when there are no points to fill the gap.
    const drewPoints = points.length > 0 && pointsBottom - y > 50;
    let sy = drewPoints ? card.y + card.h - 12 - statusH : Math.min(y + 14, card.y + card.h - 12 - statusH);
    oneLine(slide, headingRuns('実施状況', 'Tình hình thực hiện', { jaSize: 16, viSize: 16, color: C.muted }), { x: inner.x + 3, y: sy, w: inner.w, h: 24 }, { size: 16 });
    sy += 28;
    let x = inner.x + 4;
    if (hasSeats) {
      const lines: Para[] = [];
      if (isNum(t.trainees)) lines.push({ runs: [{ text: `受講者：${fmtInt(t.trainees)}人` }], size: 13, lang: 'ja', bold: true, color: C.green });
      if (isNum(t.seats)) lines.push({ runs: [{ text: `研修席：${fmtInt(t.seats)}台` }], size: 13, lang: 'ja', bold: true, color: C.green });
      const w = Math.max(...lines.map(l => lineWidth(l))) + 22;
      round(slide, { x, y: sy, w, h: 38 }, { fill: C.seatsBox, line: C.seatsBoxLine, lineW: 1, radius: 2.6 });
      text(slide, lines, { x: x + 10, y: sy + 1, w: w - 14, h: 36 });
      x += w + 16;
    }
    if (!biEmpty(progress)) {
      const w = inner.x + inner.w - x;
      if (progress.main) {
        const pw = Math.min(w, Math.max(170, lineWidth({ runs: [{ text: progress.main }], size: 12, lang: 'ja', bold: true }) + 24));
        round(slide, { x, y: sy, w: pw, h: 38 }, { fill: C.progressBox, line: C.progressBoxLine, lineW: 1, radius: 2.8 });
        text(slide, [{ runs: [{ text: progress.main }], size: 12, lang: 'ja', bold: true, color: C.teal, align: 'center' }], { x: x + 6, y: sy + 2, w: pw - 12, h: 34 }, { minScale: 0.6 });
      }
      if (progress.sub.length)
        text(slide, progress.sub.map(s => ({ runs: [{ text: s }], size: 12, lang: 'vi' as const, color: C.vi })), { x: x - 6, y: sy + 40, w: w + 6, h: 22 }, { valign: 'top', minScale: 0.6 });
    }
  }
};

const staffingCard = (slide: Slide, ctx: Ctx, card: Box): void => {
  const { figures: f, content: c } = ctx;
  const st = c.staffing;
  round(slide, card, { fill: C.card, line: C.cardLine, lineW: 1, radius: 4.6 });
  round(slide, { x: card.x + 21.6, y: card.y + 2.5, w: 132.3, h: 43.6 }, { fill: C.staffTag, radius: 10.9 });
  text(
    slide,
    [
      { runs: [{ text: '人員状況' }], size: 12, lang: 'ja', bold: true, color: C.red, align: 'center' },
      { runs: [{ text: 'Tình hình nhân sự' }], size: 12, lang: 'vi', color: C.vi, align: 'center' },
    ],
    { x: card.x + 21.6, y: card.y + 4, w: 132.3, h: 40 },
  );
  const x0 = card.x + 22;
  const w0 = card.w - 44;
  let y = card.y + 50;

  const hasHead = isNum(st.planned) || isNum(st.current);
  if (hasHead) {
    const planned = isNum(st.planned) ? `${fmtInt(st.planned)}名` : DASH;
    const current = isNum(st.current) ? `${fmtInt(st.current)}名` : DASH;
    const rate = isNum(st.planned) && st.planned > 0 && isNum(st.current) ? st.current / st.planned : null;
    const rateW = rate !== null ? 96 : 0;
    const headJa = isNum(st.planned) ? `現有人員 ${planned}⇒ ${current}` : `現有人員 ${current}`;
    const headVi = isNum(st.planned)
      ? `Nhân sự hiện tại: ${isNum(st.planned) ? fmtInt(st.planned) : DASH} người → ${isNum(st.current) ? fmtInt(st.current) : DASH} người`
      : `Nhân sự hiện tại: ${isNum(st.current) ? fmtInt(st.current) : DASH} người`;
    text(
      slide,
      [
        { runs: [{ text: headJa }], size: 21, lang: 'ja', bold: true, color: C.navy },
        { runs: [{ text: headVi }], size: 14, lang: 'vi', color: C.vi },
      ],
      { x: x0, y, w: w0 - rateW, h: 42 },
      { minScale: 0.6 },
    );
    if (rate !== null) {
      const barW = Math.min(340, w0 - 10);
      label(slide, fmtPct(rate), { x: x0 + barW - rateW, y: y + 4, w: rateW, h: 30 }, { size: 20, bold: true, color: C.red, align: 'right' });
      y += 44;
      oneLine(slide, [{ text: '人員充足率 ' }, { text: 'Tỷ lệ nhân sự', color: C.muted, size: 8.5 }], { x: x0 + 1, y, w: barW / 2, h: 13 }, { size: 9.2, color: C.ink });
      label(slide, `${fmtInt(st.current)} / ${fmtInt(st.planned)}名`, { x: x0 + barW / 2, y, w: barW / 2, h: 13 }, { size: 9.2, color: C.muted, align: 'right' });
      bar(slide, { x: x0 + 1, y: y + 15, w: barW, h: 13 }, rate, C.red);
      y += 38;
    } else y += 48;
  }

  const issues = bi(st.issues);
  const issuesH = biEmpty(issues) ? 0 : 69;
  const changes = st.changes.filter((ch: ReportStaffChange) => clean(ch.when).trim() || clean(ch.text).trim());
  if (changes.length) {
    oneLine(
      slide,
      [
        { text: `${f.year}年の主な変動/`, bold: true, color: C.muted },
        { text: `Biến động chính trong năm ${f.year}:`, color: C.vi },
      ],
      { x: x0, y: y + 2, w: w0, h: 18 },
      { size: 12 },
    );
    y += 24;
    const bottom = card.y + card.h - 8 - (issuesH ? issuesH + 8 : 0);
    const MAX = 6;
    const shown = changes.length > MAX ? changes.slice(0, MAX - 1) : changes;
    const rest = changes.length - shown.length;
    const slots = shown.length + (rest ? 1 : 0);
    const pitch = Math.min(42, (bottom - y) / slots);
    const rowH = pitch - Math.min(8, pitch * 0.2);
    const dotX = x0 + 2.5;
    const rowX = x0 + 18;
    const rowW = card.x + card.w - 10 - rowX;
    const dateW = 60.7;
    const s = Math.min(1, Math.max(0.6, rowH / 32));
    if (shown.length > 1)
      line(slide, dotX + 5, y + rowH / 2, dotX + 5, y + (shown.length - 1) * pitch + rowH / 2, { color: C.timeline, w: 4.5, alpha: 60 });
    shown.forEach((ch, i) => {
      const ry = y + i * pitch;
      const last = i === shown.length - 1 && shown.length > 1;
      const tone = last ? 2 : i % 2;
      round(slide, { x: rowX, y: ry, w: rowW, h: rowH }, { fill: C.white, line: C.rowBoxLine, lineW: 0.75, radius: Math.min(6, rowH * 0.2) });
      round(slide, { x: rowX, y: ry + 0.5, w: dateW, h: rowH - 1 }, { fill: C.datePill[tone], line: C.datePillLine, lineW: 0.75, radius: Math.min(6, rowH * 0.2) });
      oneLine(slide, [{ text: clean(ch.when).split('\n')[0].trim() || DASH }], { x: rowX + 3, y: ry, w: dateW - 6, h: rowH }, { size: 10 * Math.max(s, 0.8), bold: true, color: C.navy, align: 'center' });
      shape(slide, 'ellipse', { x: dotX, y: ry + rowH / 2 - 5, w: 10.1, h: 10.1 }, { fill: C.dots[tone], line: C.dots[tone], lineW: 0.75 });
      const body = bi(ch.text);
      if (!biEmpty(body))
        text(slide, biParas(body, { size: 13 * s, subSize: 11.5 * s, color: C.ink }), { x: rowX + dateW + 12, y: ry + 1.5, w: rowW - dateW - 20, h: rowH - 3 }, { minScale: 0.55 });
    });
    if (rest) label(slide, `…他${rest}件`, { x: rowX, y: y + shown.length * pitch, w: rowW, h: Math.min(16, rowH) }, { size: 10, color: C.muted });
    y = y + slots * pitch;
  }

  if (issuesH) {
    const iy = changes.length ? card.y + card.h - 8 - issuesH : Math.min(y + 6, card.y + card.h - 8 - issuesH);
    const box = { x: card.x + 29.6, y: iy, w: card.w - 37.4, h: issuesH };
    round(slide, box, { fill: C.issues, line: C.issuesLine, lineW: 1, radius: 5.3 });
    text(
      slide,
      biParas(issues, {
        size: 12,
        subSize: 12,
        bold: true,
        color: C.red,
        lead: issues.main ? [{ text: '課題：' }] : undefined,
        subLead: [{ text: 'Các vấn đề cần giải quyết: ' }],
        gap: 3,
      }),
      { x: box.x + 10, y: box.y + 4, w: box.w - 20, h: box.h - 8 },
      { minScale: 0.55 },
    );
  }
};

const section3 = (ctx: Ctx): void => {
  const { content: c } = ctx;
  const slide = addSlide(ctx);
  drawTitle(slide, 2);
  text(
    slide,
    [
      { runs: [{ text: '設計業務と並行して、人材育成と人員体制の安定化に取り組む' }], size: 16, lang: 'ja', bold: true, color: C.muted },
      { runs: [{ text: 'Song song với công việc thiết kế, nhóm OS tập trung đào tạo nhân lực và ổn định cơ cấu nhân sự.' }], size: 16, lang: 'vi', color: C.vi },
    ],
    { x: 23.1, y: 54, w: 922.7, h: 50 },
  );
  const t = c.training;
  const hasTraining =
    !biEmpty(bi(t.title)) || t.points.some(pt => clean(pt).trim()) || isNum(t.trainees) || isNum(t.seats) || !biEmpty(bi(t.progress));
  const st = c.staffing;
  const hasStaffing =
    isNum(st.planned) || isNum(st.current) || st.changes.some(ch => clean(ch.when).trim() || clean(ch.text).trim()) || !biEmpty(bi(st.issues));
  const top = 111.6;
  const h = 375;
  if (hasTraining && hasStaffing) {
    trainingCard(slide, ctx, { x: 18.4, y: top, w: 457.2, h });
    staffingCard(slide, ctx, { x: 505.4, y: top, w: 444.1, h });
  } else if (hasTraining) trainingCard(slide, ctx, { x: 18.4, y: top, w: 931.1, h });
  else if (hasStaffing) staffingCard(slide, ctx, { x: 18.4, y: top, w: 931.1, h });
  else emptyNote(slide);
};

// --- Section 4 -------------------------------------------------------------

const section4 = (ctx: Ctx): void => {
  const { content: c } = ctx;
  const slide = addSlide(ctx);
  drawTitle(slide, 3);
  // Exactly three themes, as in the template and on the page; one nobody wrote keeps its card, marked unwritten.
  const n = 3;
  const actions = Array.from({ length: n }, (_, i) => {
    const a: ReportAction | undefined = c.actions[i];
    return { title: bi(a?.title), points: (a?.points ?? []).map(pt => bi(pt)).filter(b => !biEmpty(b)) };
  });
  const priority = bi(c.priority);

  text(
    slide,
    [
      { runs: [{ text: `年間目標との差を縮めるための${n}つの優先テーマ` }], size: 16, lang: 'ja', color: C.black },
      {
        runs: [{ text: 'Để thu hẹp khoảng cách so với mục tiêu năm, nhóm OS xác định ' }, { text: `${n} nội dung ưu tiên`, bold: true }],
        size: 16,
        lang: 'vi',
        color: C.vi,
      },
    ],
    { x: 44.6, y: 60, w: 880, h: 46 },
  );

  const top = 111.6;
  const bottom = biEmpty(priority) ? 494 : 421.2;
  const x0 = 40.3;
  const span = 936.9 - x0;
  const gap = 16;
  const w = (span - gap * (n - 1)) / n;
  actions.forEach((a, i) => {
    const theme = THEMES[i];
    const x = x0 + i * (w + gap);
    round(slide, { x, y: top, w, h: bottom - top }, { fill: C.card, line: C.cardLine, lineW: 1, radius: 5.2 });
    const head = { x: x + 13, y: 128.2, w: w - 26, h: 50 };
    round(slide, head, { fill: theme.fill, radius: 3.6 });
    const num = String.fromCodePoint(0x2460 + i);
    const unwritten = biEmpty(a.title);
    text(
      slide,
      biParas(unwritten ? { main: '（未記入）', sub: ['Chưa có nội dung'] } : a.title, {
        size: 20,
        subSize: 15,
        bold: !unwritten,
        color: unwritten ? C.muted : theme.ink,
        subColor: unwritten ? C.muted : undefined,
        align: 'center',
        lead: [{ text: `${num} `, ja: true, bold: true, color: theme.ink }],
      }),
      { x: head.x + 6, y: head.y + 2, w: head.w - 12, h: head.h - 4 },
      { minScale: 0.55 },
    );
    if (!a.points.length) return;
    const area = { x: x + 14, y: head.y + head.h + 12, w: w - 26, h: bottom - (head.y + head.h + 12) - 12 };
    const build = (gapPt: number): Para[] =>
      a.points.flatMap((b, k) =>
        biParas(b, { size: 12, subSize: 12, color: C.ink, lead: [{ text: '● ', bold: true, color: theme.ink, ja: true }] }).map((p, j) =>
          j === 0 && k > 0 ? { ...p, before: gapPt } : p,
        ),
      );
    // Spread the points down the card, as in the template, up to a 22 pt gap between them.
    const tight = build(6);
    const fitted = fitParas(tight, area.w, area.h, 0.55);
    if (!fitted) return;
    let paras = fitted.paras;
    if (fitted.scale === 1 && a.points.length > 1) {
      const spare = area.h - parasHeight(tight, area.w, 1);
      const extra = Math.min(22, 6 + spare / (a.points.length - 1) / 2);
      paras = build(extra);
      if (parasHeight(paras, area.w, 1) > area.h) paras = tight;
    }
    drawFitted(slide, { paras, scale: fitted.scale }, area, 'top');
  });

  if (!biEmpty(priority)) {
    const box = { x: 23.2, y: 433, w: 915, h: 58 };
    round(slide, box, { fill: C.navy, line: C.navy, lineW: 1, radius: 3.5 });
    text(
      slide,
      biParas(priority, {
        size: 20,
        subSize: 14,
        bold: true,
        color: C.white,
        subColor: C.white,
        align: 'center',
        lead: priority.main ? [{ text: 'マネジメント上の最優先：' }] : undefined,
        gap: 2,
      }),
      { x: box.x + 10, y: box.y + 3, w: box.w - 20, h: box.h - 6 },
      { minScale: 0.55 },
    );
  }
};

// ---------------------------------------------------------------------------
// Package clean-up
// ---------------------------------------------------------------------------

/**
 * pptxgenjs 4.0.1 writes an `<a:pPr>` before every run of a paragraph. The
 * schema allows one, first; keep that one so the file is valid OOXML.
 */
const dedupeParagraphProps = (xml: string): string =>
  xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (whole, inner: string) => {
    let seen = false;
    const fixed = inner.replace(/<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g, (pPr: string) => {
      if (seen) return '';
      seen = true;
      return pPr;
    });
    return fixed === inner ? whole : `<a:p>${fixed}</a:p>`;
  });

const finish = async (pres: PptxGenJS): Promise<Blob> => {
  const raw = (await pres.write({ outputType: 'arraybuffer', compression: true })) as ArrayBuffer;
  const zip = await JSZip.loadAsync(raw);
  const parts = Object.keys(zip.files).filter(name => /^ppt\/(slides|slideLayouts|slideMasters)\/[^/]+\.xml$/.test(name));
  for (const name of parts) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async('string');
    const fixed = dedupeParagraphProps(xml);
    if (fixed !== xml) zip.file(name, fixed);
  }
  return zip.generateAsync({ type: 'blob', mimeType: PPTX_MIME, compression: 'DEFLATE' });
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export async function buildReportPptx(model: ReportModel, options: ReportPptxOptions = {}): Promise<Blob> {
  const { figures, content } = model;
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = 'OS Design Team';
  pres.title = `OS設計チーム 事業状況報告 ${figures.year}年${figures.asOfMonth}月`;
  pres.subject = '事業状況報告';
  pres.theme = { headFontFace: JA, bodyFontFace: JA };
  defineMaster(pres, figures, options.logoDataUrl);
  const ctx: Ctx = { pres, figures, content };
  cover(ctx);
  section1(ctx);
  section2(ctx);
  section3(ctx);
  section4(ctx);
  return finish(pres);
}

/** Fetches the header logo from `public/report/` as a data URL; undefined if it cannot be read. */
export async function loadReportLogo(): Promise<string | undefined> {
  try {
    const base = import.meta.env?.BASE_URL ?? '/';
    const res = await fetch(`${base.endsWith('/') ? base : `${base}/`}report/${LOGO_FILE}`);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return undefined;
    return await new Promise<string | undefined>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/** `OS設計チーム_事業状況報告_2026年9月28日.pptx`, from the report date. */
export function reportPptxFilename(model: ReportModel): string {
  const date = parseDate(model.content.reportDate);
  if (date) return `OS設計チーム_事業状況報告_${date.y}年${date.m}月${date.d}日.pptx`;
  return `OS設計チーム_事業状況報告_${model.figures.year}年${model.figures.asOfMonth}月.pptx`;
}
