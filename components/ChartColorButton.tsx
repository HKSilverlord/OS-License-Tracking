import React, { useRef, useState } from 'react';
import { Palette } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/Button';
import { Popover } from './ui/Popover';

export interface ChartColorRow {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** A color as a swatch to pick from and the hex code to type or paste. */
export const ColorInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}> = ({ label, value, onChange, className = '' }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <input
      type="color"
      value={HEX.test(value) ? value : '#000000'}
      onChange={event => onChange(event.target.value)}
      aria-label={label}
      className="h-7 w-7 shrink-0 cursor-pointer appearance-none rounded-md border border-slate-200 bg-transparent p-0 dark:border-slate-700 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[5px] [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:rounded-[5px] [&::-moz-color-swatch]:border-none"
    />
    <input
      type="text"
      value={value}
      onChange={event => onChange(event.target.value)}
      spellCheck={false}
      aria-label={`${label} (hex)`}
      className="h-7 w-[5.5rem] rounded-md border border-slate-200 bg-white px-2 font-mono text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
    />
  </div>
);

/** The small palette button every chart header uses to open its style panel. */
export const ChartStyleTrigger = React.forwardRef<HTMLButtonElement, {
  open: boolean;
  onClick: () => void;
  title: string;
}>(({ open, onClick, title }, ref) => (
  <Button
    ref={ref}
    variant="ghost"
    size="icon-sm"
    onClick={onClick}
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-label={title}
    title={title}
    data-html2canvas-ignore="true"
    className="text-slate-400 aria-expanded:bg-slate-100 aria-expanded:text-slate-700 dark:aria-expanded:bg-slate-800 dark:aria-expanded:text-slate-200"
  >
    <Palette className="h-4 w-4" aria-hidden="true" />
  </Button>
));
ChartStyleTrigger.displayName = 'ChartStyleTrigger';

/**
 * A chart's series colors, behind a small button in the chart's header.
 *
 * The colors are a personal preference kept in this browser, so anyone may
 * change them; Reset puts back only this chart's defaults.
 */
export const ChartColorButton: React.FC<{
  rows: ChartColorRow[];
  onReset: () => void;
}> = ({ rows, onReset }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const title = t('chart.customizeColors', 'Chart colors');

  return (
    <>
      <ChartStyleTrigger ref={buttonRef} open={open} onClick={() => setOpen(prev => !prev)} title={title} />

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={buttonRef} label={title}>
        <div className="w-[17rem] p-3">
          <p className="px-1 pb-2 text-[13px] font-semibold text-slate-900 dark:text-white">{title}</p>
          <ul className="space-y-0.5">
            {rows.map(row => (
              <li key={row.label} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{row.label}</span>
                <ColorInput label={row.label} value={row.value} onChange={row.onChange} />
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-end border-t border-slate-100 pt-2 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={onReset}>
              {t('dashboard.colors.reset', 'Reset to defaults')}
            </Button>
          </div>
        </div>
      </Popover>
    </>
  );
};
