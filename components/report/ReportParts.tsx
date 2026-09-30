import React, { useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { splitBilingual } from '../../utils/reportModel';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Field, Input, Textarea } from '../ui/Field';
import { cleanInput, useItemKeys } from './editing';
import { moveItem, removeAt, replaceAt } from './listOps';
import { useReportFormat } from './useReportFormat';

/**
 * Long unbroken text (a pasted URL, a name without spaces) wraps inside its
 * box instead of widening the page. `anywhere`, unlike `break-word`, also
 * lets a grid or table column shrink below the longest word.
 */
export const wrapAnywhere = '[overflow-wrap:anywhere]';

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

/** What an unwritten part shows: quiet, so an empty report does not shout. */
export const NotWritten: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useLanguage();
  return <p className={`text-sm text-slate-500 dark:text-slate-400 ${className}`}>{t('report.notWritten', 'Not written yet')}</p>;
};

/**
 * Bilingual text as the template draws it: the first line is the main text,
 * any further lines are its translation, smaller and quieter underneath.
 */
export const Bilingual: React.FC<{
  text: string;
  mainClassName?: string;
  subClassName?: string;
  className?: string;
  /** Shown when there is no text; defaults to "Not written yet". Pass null to show nothing. */
  empty?: React.ReactNode;
}> = ({
  text,
  mainClassName = 'text-sm leading-6 text-slate-800 dark:text-slate-100',
  subClassName = 'text-[13px] leading-5 text-slate-500 dark:text-slate-400',
  className = '',
  empty,
}) => {
  const { main, sub } = splitBilingual(text ?? '');
  if (!main && !sub) return empty === undefined ? <NotWritten className={className} /> : <>{empty}</>;
  return (
    <div className={`min-w-0 ${wrapAnywhere} ${className}`}>
      {main && <p className={mainClassName}>{main}</p>}
      {sub && <p className={`mt-0.5 whitespace-pre-line ${subClassName}`}>{sub}</p>}
    </div>
  );
};

/** One of the template's numbered sections, as a card. */
export const ReportSection: React.FC<{
  id: string;
  number?: number;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ id, number, title, description, actions, children, className = '' }) => (
  <Card id={id} padding="lg" className={`animate-fade-up ${className}`}>
    <CardHeader
      title={
        <>
          {number !== undefined && (
            <span className="mr-2 font-normal tabular-nums text-slate-500 dark:text-slate-400">{number}</span>
          )}
          {title}
        </>
      }
      description={description}
      actions={actions}
    />
    <div className="mt-5">{children}</div>
  </Card>
);

/** A heading inside a section. */
export const SubHeading: React.FC<{ children: React.ReactNode; aside?: React.ReactNode; className?: string }> = ({
  children,
  aside,
  className = '',
}) => (
  <div className={`mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 ${className}`}>
    <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white">{children}</h3>
    {aside && <span className="text-xs text-slate-500 dark:text-slate-400">{aside}</span>}
  </div>
);

/* ------------------------------------------------------------------ *
 * Editing
 * ------------------------------------------------------------------ */

const rowsFor = (value: string, min: number) => Math.min(8, Math.max(min, value.split('\n').length));

/**
 * Report text areas grow with what is typed, wrapped lines included, where the
 * browser can size a field to its content; elsewhere `rows` sets the height.
 */
export const growClasses = 'min-h-0 max-h-80 [field-sizing:content]';

/** A text area for bilingual text; its placeholder says how the lines are read. */
export const BilingualInput: React.FC<{
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  className?: string;
  hint?: React.ReactNode;
  /** The field's full name for screen readers, when the visible label needs context. */
  ariaLabel?: string;
}> = ({ label, value, onChange, minRows = 2, className = '', hint, ariaLabel }) => {
  const { t } = useLanguage();
  return (
    <Field label={label} hint={hint} className={className}>
      {id => (
        <Textarea
          id={id}
          value={value}
          rows={rowsFor(value, minRows)}
          aria-label={ariaLabel}
          onChange={event => onChange(cleanInput(event))}
          placeholder={t('report.edit.placeholder', 'Main text\nTranslation (optional)')}
          className={growClasses}
        />
      )}
    </Field>
  );
};

/** A one-line text field. */
export const TextInput: React.FC<{
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  type?: 'text' | 'date';
  ariaLabel?: string;
}> = ({ label, value, onChange, className = '', placeholder, type = 'text', ariaLabel }) => (
  <Field label={label} className={className}>
    {id => (
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={event => onChange(cleanInput(event))}
      />
    )}
  </Field>
);

/**
 * Reads what was typed in a count field: null for blank, a whole number from
 * 0 to `max`, or undefined for anything else. Full-width digits (typed with a
 * Japanese input method) and thousands commas are fine.
 */
const parseCount = (raw: string, max: number): number | null | undefined => {
  const text = raw.normalize('NFKC').replace(/[\s,]/g, '');
  if (text === '') return null;
  if (!/^\d+$/.test(text)) return undefined;
  const value = Number(text);
  return value <= max ? value : undefined;
};

/**
 * A count that may be left blank (null). Anything that is not a whole number
 * from 0 to `max` shows an error under the field and changes nothing: the last
 * good number stays in the report, and comes back when the field loses focus.
 */
export const CountField: React.FC<{
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  max: number;
  /** For a field without a visible label of its own. */
  ariaLabel?: string;
  controlSize?: 'sm' | 'md';
}> = ({ id, value, onChange, max, ariaLabel, controlSize = 'md' }) => {
  const { t } = useLanguage();
  const f = useReportFormat();
  const errorId = useId();
  // What is in the box while it differs from the value: typing, or a typo.
  const [typed, setTyped] = useState<string | null>(null);
  const invalid = typed !== null && parseCount(typed, max) === undefined;
  return (
    <div className="min-w-0">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        controlSize={controlSize}
        value={typed ?? (value === null ? '' : String(value))}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onChange={event => {
          const raw = event.target.value;
          setTyped(raw);
          const next = parseCount(raw, max);
          if (next !== undefined && next !== value) onChange(next);
        }}
        onBlur={() => setTyped(null)}
        className={`text-right tabular-nums ${invalid ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15 dark:border-rose-500/70' : ''}`}
      />
      {invalid && (
        <p id={errorId} className="mt-1 text-xs leading-4 text-rose-600 dark:text-rose-400">
          {t('report.edit.countRange', 'Whole number, 0 to {max}').replace('{max}', f.count(max))}
        </p>
      )}
    </div>
  );
};

/** A labelled count that may be left blank (null). */
export const CountInput: React.FC<{
  label: React.ReactNode;
  value: number | null;
  onChange: (value: number | null) => void;
  max: number;
  className?: string;
  ariaLabel?: string;
}> = ({ label, value, onChange, max, className = '', ariaLabel }) => (
  <Field label={label} className={className}>
    {id => <CountField id={id} value={value} onChange={onChange} max={max} ariaLabel={ariaLabel} />}
  </Field>
);

/* ---------------- editable lists ---------------- */

/** Up, down and remove for one item of an editable list. */
export const ItemControls: React.FC<{
  index: number;
  length: number;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
  /** Names the item for screen readers, e.g. "Theme 2, point 1". */
  itemLabel: string;
}> = ({ index, length, onMove, onRemove, itemLabel }) => {
  const { t } = useLanguage();
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const up = `${t('common.moveUp', 'Move up')}: ${itemLabel}`;
  const down = `${t('common.moveDown', 'Move down')}: ${itemLabel}`;
  const remove = `${t('report.edit.remove', 'Remove')}: ${itemLabel}`;

  // The buttons move with their item; the focus goes with them. At the top or
  // bottom of the list the button pressed is disabled, so the other one takes it.
  const move = (step: -1 | 1) => {
    onMove(step);
    requestAnimationFrame(() => {
      const pressed = step < 0 ? upRef.current : downRef.current;
      const other = step < 0 ? downRef.current : upRef.current;
      (pressed && !pressed.disabled ? pressed : other)?.focus();
    });
  };

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button ref={upRef} variant="ghost" size="icon-sm" onClick={() => move(-1)} disabled={index === 0} aria-label={up} title={up}>
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button ref={downRef} variant="ghost" size="icon-sm" onClick={() => move(1)} disabled={index === length - 1} aria-label={down} title={down}>
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button variant="danger-quiet" size="icon-sm" onClick={onRemove} aria-label={remove} title={remove}>
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
};

/** "+ Add …" under an editable list. */
export const AddButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  /** The full name, when the list needs saying: "Add a point: Theme 2". */
  ariaLabel?: string;
}> = ({ onClick, children, ariaLabel }) => (
  <Button variant="ghost" size="sm" onClick={onClick} aria-label={ariaLabel} icon={<Plus className="h-4 w-4" aria-hidden="true" />} className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
    {children}
  </Button>
);

/** A list of bilingual points: add, remove, reorder. */
export const PointsEditor: React.FC<{
  label: string;
  /** What the points belong to, e.g. "Theme 2": each point is named "Theme 2, point 1". */
  context: string;
  points: string[];
  onChange: (points: string[]) => void;
}> = ({ label, context, points, onChange }) => {
  const { t } = useLanguage();
  const { keys, move, remove } = useItemKeys(points.length);
  const pointLabel = (i: number) =>
    t('report.edit.pointOf', '{context}, point {n}').replace('{context}', context).replace('{n}', String(i + 1));
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-300">{label}</legend>
      {/* The controls sit beside the text only where the list is wide enough
          for both; in a narrow column they go under it, so the text keeps the width. */}
      <ol className="@container space-y-2">
        {points.map((point, i) => (
          <li key={keys[i]} className="flex items-start gap-2">
            <span className="mt-2 w-5 shrink-0 text-right text-[13px] tabular-nums text-slate-500 dark:text-slate-400" aria-hidden="true">{i + 1}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1 @md:flex-row @md:items-start @md:gap-2">
              <Textarea
                value={point}
                rows={rowsFor(point, 2)}
                aria-label={pointLabel(i)}
                placeholder={t('report.edit.placeholder', 'Main text\nTranslation (optional)')}
                onChange={event => onChange(replaceAt(points, i, cleanInput(event)))}
                className={`${growClasses} @md:flex-1`}
              />
              <div className="flex justify-end @md:mt-1">
                <ItemControls
                  index={i}
                  length={points.length}
                  itemLabel={pointLabel(i)}
                  onMove={step => {
                    move(i, step);
                    onChange(moveItem(points, i, step));
                  }}
                  onRemove={() => {
                    remove(i);
                    onChange(removeAt(points, i));
                  }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className={points.length > 0 ? 'mt-2' : ''}>
        <AddButton onClick={() => onChange([...points, ''])} ariaLabel={`${t('report.edit.addPoint', 'Add a point')}: ${context}`}>
          {t('report.edit.addPoint', 'Add a point')}
        </AddButton>
      </div>
    </fieldset>
  );
};
