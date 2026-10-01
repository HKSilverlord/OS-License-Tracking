import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, FileSpreadsheet, Image as ImageIcon, Loader2, Shapes } from 'lucide-react';
import type { CsvColumn } from '../utils/chartExport';
import {
  copyChartToClipboard,
  exportChartDataToCSV,
  exportChartToPNG,
  exportChartToSVG,
  generateChartFilename,
} from '../utils/chartExport';
import { useExportPrefs } from '../utils/exportPrefs';
import { useLanguage } from '../contexts/LanguageContext';
import { Menu, MenuCheckItem, MenuItem, MenuLabel, MenuSeparator } from './ui/Menu';

interface ExportButtonProps {
  /** id of the element to capture — a chart panel, a section, a table. */
  targetId: string;
  /** Base filename, no extension. The timestamp is appended for you. */
  filename: string;
  /** Rows for the default CSV export. Omit to hide the CSV entry. */
  data?: readonly unknown[];
  /**
   * Which fields of `data` go into the CSV, and their translated headings.
   * Omit and the file carries the raw property names.
   */
  csvColumns?: readonly CsvColumn[];
  /** Replaces the default CSV export, for views that build their own columns. */
  onExportCsv?: () => void;
  /** SVG only makes sense for a Recharts panel; tables and sections set false. */
  allowSvg?: boolean;
  /** Nothing to export yet — an empty chart should not be copyable. */
  disabled?: boolean;
  /**
   * Ran immediately before a capture starts. TotalView uses it to settle the
   * bar animation, which hides the value labels while it plays.
   */
  onBeforeCapture?: () => void;
  className?: string;
}

const SEGMENT =
  'inline-flex h-8 items-center gap-1.5 text-sm font-medium transition-colors duration-150 ' +
  'disabled:pointer-events-none disabled:opacity-50';

/**
 * The one export control in the app.
 *
 * Copying an image is what people actually do here — several times a day, to
 * paste a chart into a slide or a chat — so it is the button itself, one click,
 * in the same place on every card. The formats nobody reaches for daily (PNG,
 * SVG, CSV) and the export preference live behind the chevron.
 *
 * Marked `data-html2canvas-ignore` so the control never photographs itself: it
 * sits inside the very card it captures.
 */
export const ExportButton: React.FC<ExportButtonProps> = ({
  targetId,
  filename,
  data,
  csvColumns,
  onExportCsv,
  allowSvg = true,
  disabled = false,
  onBeforeCapture,
  className = '',
}) => {
  const { t } = useLanguage();
  const [prefs, setPrefs] = useExportPrefs();
  const [menuOpen, setMenuOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const chevronRef = useRef<HTMLButtonElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The 2s "Copied" reset must not fire into an unmounted component: this sits
  // on views the user can navigate away from mid-countdown.
  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, []);

  const handleCopy = useCallback(() => {
    // A capture takes seconds; without this a second click queues another one.
    if (state === 'busy' || disabled) return;
    onBeforeCapture?.();
    setState('busy');
    // Deliberately not awaited before the call: copyChartToClipboard has to
    // reach the clipboard from inside this click.
    copyChartToClipboard(targetId).then(ok => {
      setState(ok ? 'done' : 'idle');
      if (!ok) return;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setState('idle'), 2000);
    });
  }, [disabled, onBeforeCapture, state, targetId]);

  const run = (action: () => void) => () => {
    onBeforeCapture?.();
    action();
  };

  const hasCsv = Boolean(onExportCsv || data);
  const copyLabel = state === 'busy'
    ? t('export.capturing', 'Capturing…')
    : state === 'done'
      ? t('export.copied', 'Copied')
      : t('buttons.copy', 'Copy');

  return (
    <div
      data-html2canvas-ignore="true"
      className={`inline-flex shrink-0 rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.04] dark:border-slate-700 dark:bg-slate-900 dark:shadow-none ${className}`}
    >
      <button
        type="button"
        onClick={handleCopy}
        disabled={disabled || state === 'busy'}
        title={t('export.copyAsImage', 'Copy as an image')}
        aria-live="polite"
        className={`${SEGMENT} rounded-l-[7px] px-2.5 ${
          state === 'done'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white'
        }`}
      >
        {state === 'busy'
          ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
          : state === 'done'
            ? <Check className="h-4 w-4" aria-hidden="true" />
            : <Copy className="h-4 w-4 text-slate-400" aria-hidden="true" />}
        <span>{copyLabel}</span>
      </button>

      <button
        ref={chevronRef}
        type="button"
        onClick={() => setMenuOpen(open => !open)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={t('export.moreFormats', 'More export formats')}
        title={t('export.moreFormats', 'More export formats')}
        className={`${SEGMENT} rounded-r-[7px] border-l border-slate-200 px-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200`}
      >
        <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={chevronRef}
        minWidth={224}
        label={t('export.options', 'Export')}
      >
        <MenuLabel>{t('export.options', 'Export')}</MenuLabel>
        <MenuItem
          icon={<ImageIcon />}
          onSelect={run(() => exportChartToPNG(targetId, generateChartFilename(filename, 'png')))}
        >
          {t('export.savePNG', 'Save as PNG')}
        </MenuItem>
        {allowSvg && (
          <MenuItem
            icon={<Shapes />}
            onSelect={run(() => exportChartToSVG(targetId, generateChartFilename(filename, 'svg')))}
          >
            {t('export.saveSVG', 'Save as SVG')}
          </MenuItem>
        )}
        {hasCsv && (
          <MenuItem
            icon={<FileSpreadsheet />}
            onSelect={() => {
              if (onExportCsv) return onExportCsv();
              if (data) exportChartDataToCSV(data, generateChartFilename(`${filename}_data`, 'csv'), csvColumns);
            }}
          >
            {t('export.downloadData', 'Download data (CSV)')}
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuCheckItem
          checked={prefs.lightBackground}
          onChange={lightBackground => setPrefs({ lightBackground })}
          closeOnSelect={false}
        >
          {t('export.lightBackground', 'Light background')}
        </MenuCheckItem>
      </Menu>
    </div>
  );
};
