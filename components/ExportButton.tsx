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

const PRIMARY_BASE =
  'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

const ITEM =
  'w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-3 transition-colors';

/**
 * The one export control in the app.
 *
 * Copying an image is what people actually do here — several times a day, to
 * paste a chart into a slide or a chat — so it is the button itself, one click,
 * in the same place on every view. The formats nobody reaches for daily (PNG,
 * SVG, CSV) and the export preferences live behind the chevron.
 *
 * Marked `data-html2canvas-ignore` so the control never photographs itself: on
 * the dashboard it sits inside the very section it captures.
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
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  // The 2s "Copied!" reset must not fire into an unmounted component: this sits
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
    setIsOpen(false);
  };

  const primaryTone = state === 'done'
    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800';

  return (
    <div
      ref={rootRef}
      data-html2canvas-ignore="true"
      className={`relative inline-flex ${className}`}
    >
      <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={handleCopy}
          disabled={disabled || state === 'busy'}
          title={t('export.copyAsImage', 'Copy to Clipboard')}
          className={`${PRIMARY_BASE} ${primaryTone}`}
        >
          {state === 'busy'
            ? <Loader2 className="w-4 h-4 animate-spin text-slate-500 dark:text-slate-400" />
            : state === 'done'
              ? <Check className="w-4 h-4" />
              : <Copy className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
          <span>
            {state === 'busy'
              ? t('export.capturing', 'Capturing…')
              : state === 'done'
                ? t('export.copied', 'Copied!')
                : t('buttons.copy', 'Copy')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setIsOpen(open => !open)}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={t('export.moreFormats', 'More export formats')}
          title={t('export.moreFormats', 'More export formats')}
          className="flex items-center px-1.5 border-l border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 origin-top-right bg-white dark:bg-slate-900 rounded-lg shadow-xl ring-1 ring-black/5 dark:ring-white/10 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="py-1" role="menu" aria-orientation="vertical">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              {t('export.options', 'Export Options')}
            </div>

            <button
              type="button"
              role="menuitem"
              className={ITEM}
              onClick={run(() => exportChartToPNG(targetId, generateChartFilename(filename, 'png')))}
            >
              <ImageIcon className="w-4 h-4" />
              <span>{t('export.savePNG', 'Save as PNG')}</span>
            </button>

            {allowSvg && (
              <button
                type="button"
                role="menuitem"
                className={ITEM}
                onClick={run(() => exportChartToSVG(targetId, generateChartFilename(filename, 'svg')))}
              >
                <Shapes className="w-4 h-4" />
                <span>{t('export.saveSVG', 'Save as SVG')}</span>
              </button>
            )}

            {(onExportCsv || data) && (
              <button
                type="button"
                role="menuitem"
                className={ITEM}
                onClick={run(() => {
                  if (onExportCsv) return onExportCsv();
                  if (data) exportChartDataToCSV(data, generateChartFilename(`${filename}_data`, 'csv'), csvColumns);
                })}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{t('export.downloadData', 'Download Excel/CSV')}</span>
              </button>
            )}

            <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

            <label className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-blue-600"
                checked={prefs.lightBackground}
                onChange={event => setPrefs({ lightBackground: event.target.checked })}
              />
              <span>{t('export.lightBackground', 'Light background')}</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
