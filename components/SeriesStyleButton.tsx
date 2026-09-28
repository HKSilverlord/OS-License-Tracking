import React, { useId, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/Button';
import { Popover } from './ui/Popover';
import { ChartStyleTrigger, ColorInput } from './ChartColorButton';

/** How one series is drawn: its bars, and the value printed above each one. */
export interface SeriesStyle {
  color: string;
  opacity: number;
  labelColor: string;
  fontSize: number;
  bold: boolean;
  stroke: boolean;
  /** Bar width in px, for the series whose width can be changed. */
  barSize?: number;
}

export interface SeriesStyleEntry {
  key: string;
  label: string;
  style: SeriesStyle;
}

const Row: React.FC<{ label: string; htmlFor?: string; children: React.ReactNode }> = ({ label, htmlFor, children }) => (
  <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-3 py-1">
    {htmlFor ? (
      <label htmlFor={htmlFor} className="truncate text-[13px] text-slate-500 dark:text-slate-400">{label}</label>
    ) : (
      <span className="truncate text-[13px] text-slate-500 dark:text-slate-400">{label}</span>
    )}
    {children}
  </div>
);

const Slider: React.FC<{
  id: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  readout: string;
}> = ({ id, value, min, max, step, onChange, readout }) => (
  <div className="flex items-center gap-2.5">
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={event => onChange(Number(event.target.value))}
      className="h-1.5 min-w-0 flex-1 cursor-pointer accent-blue-600"
    />
    <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">{readout}</span>
  </div>
);

const Toggle: React.FC<{ pressed: boolean; onToggle: () => void; className?: string; children: React.ReactNode }> = ({
  pressed,
  onToggle,
  className = '',
  children,
}) => (
  <button
    type="button"
    aria-pressed={pressed}
    onClick={onToggle}
    className={`inline-flex h-7 items-center rounded-md border border-slate-200 px-2.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 aria-pressed:border-blue-500/40 aria-pressed:bg-blue-50 aria-pressed:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:aria-pressed:border-blue-400/40 dark:aria-pressed:bg-blue-500/15 dark:aria-pressed:text-blue-300 ${className}`}
  >
    {children}
  </button>
);

/**
 * How a chart's series look, for charts that get pasted into slides: each
 * series' color and opacity, and the size and weight of its value labels.
 *
 * One series is edited at a time. Every series' color stays visible in the
 * picker, so matching them up needs no clicking through.
 */
export const SeriesStyleButton: React.FC<{
  series: readonly SeriesStyleEntry[];
  onChange: (key: string, patch: Partial<SeriesStyle>) => void;
  onReset: () => void;
  /** Chart-wide options, under the series: marking this month. */
  extra?: React.ReactNode;
  /** Bounds for the bar width slider. */
  barSizeRange?: readonly [number, number];
}> = ({ series, onChange, onReset, extra, barSizeRange = [8, 64] }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(series[0]?.key);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const title = t('chart.style', 'Chart style');

  const active = series.find(entry => entry.key === activeKey) ?? series[0];
  if (!active) return null;
  const { style } = active;
  const set = (patch: Partial<SeriesStyle>) => onChange(active.key, patch);

  // One tab stop for the whole picker; the arrow keys move the choice.
  const onPickerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = series.findIndex(entry => entry.key === active.key);
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % series.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + series.length) % series.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = series.length - 1;
    else return;
    event.preventDefault();
    setActiveKey(series[next].key);
    pickerRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <>
      <ChartStyleTrigger ref={buttonRef} open={open} onClick={() => setOpen(prev => !prev)} title={title} />

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={buttonRef} label={title}>
        <div className="w-[19.5rem] max-w-[calc(100vw-2rem)] p-3">
          <p className="px-1 pb-2.5 text-[13px] font-semibold text-slate-900 dark:text-white">{title}</p>

          <div
            ref={pickerRef}
            role="radiogroup"
            aria-label={t('chart.series', 'Series')}
            onKeyDown={onPickerKeyDown}
            className="flex flex-wrap gap-1.5 px-1"
          >
            {series.map(entry => {
              const checked = entry.key === active.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  onClick={() => setActiveKey(entry.key)}
                  className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 aria-checked:border-slate-900 aria-checked:bg-slate-900 aria-checked:text-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:aria-checked:border-white dark:aria-checked:bg-white dark:aria-checked:text-slate-900"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                    style={{ backgroundColor: entry.style.color }}
                  />
                  <span className="truncate">{entry.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-slate-100 px-1 pt-2 dark:border-slate-800">
            <Row label={t('chart.field.color', 'Color')}>
              <ColorInput label={`${active.label}: ${t('chart.field.color', 'Color')}`} value={style.color} onChange={color => set({ color })} />
            </Row>
            <Row label={t('chart.field.alpha', 'Opacity')} htmlFor={`${id}-opacity`}>
              <Slider
                id={`${id}-opacity`}
                value={style.opacity}
                min={0}
                max={1}
                step={0.05}
                onChange={opacity => set({ opacity })}
                readout={`${Math.round(style.opacity * 100)}%`}
              />
            </Row>
            {style.barSize !== undefined && (
              <Row label={t('chart.field.width', 'Width')} htmlFor={`${id}-width`}>
                <Slider
                  id={`${id}-width`}
                  value={style.barSize}
                  min={barSizeRange[0]}
                  max={barSizeRange[1]}
                  step={1}
                  onChange={barSize => set({ barSize })}
                  readout={String(style.barSize)}
                />
              </Row>
            )}

            <p className="pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('chart.valueLabels', 'Value labels')}
            </p>
            <Row label={t('chart.field.color', 'Color')}>
              <ColorInput
                label={`${active.label}: ${t('chart.valueLabels', 'Value labels')}`}
                value={style.labelColor}
                onChange={labelColor => set({ labelColor })}
              />
            </Row>
            <Row label={t('chart.field.size', 'Size')} htmlFor={`${id}-size`}>
              <Slider
                id={`${id}-size`}
                value={style.fontSize}
                min={8}
                max={20}
                step={1}
                onChange={fontSize => set({ fontSize })}
                readout={String(style.fontSize)}
              />
            </Row>
            <Row label={t('chart.field.style', 'Style')}>
              <div className="flex gap-1.5">
                <Toggle pressed={style.bold} onToggle={() => set({ bold: !style.bold })} className="font-bold">
                  {t('chart.field.bold', 'Bold')}
                </Toggle>
                <Toggle pressed={style.stroke} onToggle={() => set({ stroke: !style.stroke })} className="font-medium">
                  {t('chart.field.outline', 'Outline')}
                </Toggle>
              </div>
            </Row>
          </div>

          {extra && <div className="mt-2 border-t border-slate-100 px-1 pt-2 dark:border-slate-800">{extra}</div>}

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

/** A chart-wide on/off option for the `extra` slot. */
export const SeriesStyleCheck: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}> = ({ checked, onChange, children }) => (
  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 text-[13px] text-slate-700 dark:text-slate-200">
    <input
      type="checkbox"
      checked={checked}
      onChange={event => onChange(event.target.checked)}
      className="h-4 w-4 shrink-0 cursor-pointer rounded accent-blue-600"
    />
    {children}
  </label>
);
