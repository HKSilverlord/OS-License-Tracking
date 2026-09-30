import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { REPORT_COUNT_MAX } from '../../utils/reportModel';
import type { ReportCustomerFigures, ReportCustomerNote, ReportFocusProject } from '../../utils/reportModel';
import { Badge } from '../ui/Badge';
import { insetClasses } from '../ui/Card';
import { Textarea } from '../ui/Field';
import { cleanInput, useFieldName, useItemKeys } from './editing';
import { circled, moveItem, removeAt, replaceAt } from './listOps';
import {
  AddButton,
  Bilingual,
  BilingualInput,
  CountField,
  CountInput,
  ItemControls,
  PointsEditor,
  ReportSection,
  growClasses,
  SubHeading,
  TextInput,
  wrapAnywhere,
} from './ReportParts';
import type { ReportEdit, ReportSectionProps } from './types';
import { useReportFormat } from './useReportFormat';

const EMPTY_NOTE: ReportCustomerNote = { status: '', parts: null };

const emptyFocusProject = (): ReportFocusProject => ({ name: '', isNew: false, stage: '', parts: null, points: [] });

/** Each customer's rate, hours and the status an admin keeps for it. */
const CustomerTable: React.FC<{
  customers: ReportCustomerFigures[];
  notes: Record<string, ReportCustomerNote>;
  onEdit?: ReportEdit;
  /** False: rates and hours only, no status or parts columns. */
  written: boolean;
}> = ({ customers, notes, onEdit, written }) => {
  const { t } = useLanguage();
  const f = useReportFormat();
  const perHour = t('unit.yenPerHour', 'JPY/h');
  const rate = (c: ReportCustomerFigures) => (c.rate === null ? '—' : `${f.count(c.rate)} ${perHour}`);
  const parts = (n: number | null) =>
    n === null ? '—' : t('report.customers.partsCount', '{count} parts').replace('{count}', f.count(n));

  const setNote = (projectId: string, patch: Partial<ReportCustomerNote>) =>
    onEdit?.(c => ({
      ...c,
      customers: { ...c.customers, [projectId]: { ...(c.customers[projectId] ?? EMPTY_NOTE), ...patch } },
    }));

  const statusField = (c: ReportCustomerFigures, note: ReportCustomerNote) => (
    <Textarea
      value={note.status}
      rows={2}
      aria-label={`${t('report.customers.status', 'Status')}: ${c.name}`}
      placeholder={t('report.edit.placeholder', 'Main text\nTranslation (optional)')}
      onChange={event => setNote(c.projectId, { status: cleanInput(event) })}
      className={growClasses}
    />
  );
  const partsField = (c: ReportCustomerFigures, note: ReportCustomerNote) => (
    <CountField
      controlSize="sm"
      value={note.parts}
      max={REPORT_COUNT_MAX.parts}
      ariaLabel={`${t('report.customers.parts', 'Parts')}: ${c.name}`}
      onChange={parts => setNote(c.projectId, { parts })}
    />
  );

  // Read, the table fits from a small tablet up. Edited, each row also holds a
  // status field, which needs the room of a wide card: until then, the list.
  return (
    <div className="@container">
      {/* Desktop: a table, read across. */}
      <div className={onEdit ? 'hidden @3xl:block' : 'hidden sm:block'}>
        <table className="w-full text-sm" data-report="customers">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th scope="col" className="w-[24%] py-2 pr-4 font-medium">{t('report.customers.customer', 'Customer')}</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">{t('report.customers.rate', 'Hourly rate')}</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">{t('report.results.hours', 'Hours')}</th>
              {written && <th scope="col" className="py-2 pr-4 font-medium">{t('report.customers.status', 'Status')}</th>}
              {written && <th scope="col" className="w-24 py-2 text-right font-medium">{t('report.customers.parts', 'Parts')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {customers.map(c => {
              const note = notes[c.projectId] ?? EMPTY_NOTE;
              return (
                <tr key={c.projectId} data-project={c.projectId} className="align-top">
                  <th scope="row" className="py-3 pr-4 text-left font-medium text-slate-900 dark:text-white">
                    <span className={`block ${wrapAnywhere}`}>{c.name}</span>
                  </th>
                  <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-200" data-rate={c.rate ?? ''}>
                    {rate(c)}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-200">
                    {c.hoursActual > 0 ? f.hours(c.hoursActual) : '—'}
                  </td>
                  {written && (
                    <td className="py-3 pr-4">
                      {onEdit ? statusField(c, note) : <Bilingual text={note.status} empty={<span className="text-slate-400">—</span>} />}
                    </td>
                  )}
                  {written && (
                    <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">
                      {onEdit ? partsField(c, note) : parts(note.parts)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phone: one block per customer, read down. */}
      <ul className={`divide-y divide-slate-100 dark:divide-slate-800 ${onEdit ? '@3xl:hidden' : 'sm:hidden'}`}>
        {customers.map(c => {
          const note = notes[c.projectId] ?? EMPTY_NOTE;
          return (
            <li key={c.projectId} className="py-3 first:pt-0" data-project={c.projectId}>
              <div className="flex items-baseline justify-between gap-3">
                <p className={`min-w-0 font-medium text-slate-900 dark:text-white ${wrapAnywhere}`}>{c.name}</p>
                <p className="shrink-0 text-sm tabular-nums text-slate-700 dark:text-slate-200">{rate(c)}</p>
              </div>
              <p className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {c.hoursActual > 0 ? f.hours(c.hoursActual) : '—'}
                {written && !onEdit && note.parts !== null && <> · {parts(note.parts)}</>}
              </p>
              {onEdit ? (
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
                  <div className="min-w-0">
                    <p className="mb-1 text-xs text-slate-500 dark:text-slate-400" aria-hidden="true">{t('report.customers.status', 'Status')}</p>
                    {statusField(c, note)}
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-slate-500 dark:text-slate-400" aria-hidden="true">{t('report.customers.parts', 'Parts')}</p>
                    {partsField(c, note)}
                  </div>
                </div>
              ) : written && (
                <Bilingual text={note.status} className="mt-1.5" empty={null} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/** One focus project, as read. */
const FocusProjectCard: React.FC<{ project: ReportFocusProject; index: number }> = ({ project, index }) => {
  const { t } = useLanguage();
  const f = useReportFormat();
  return (
    <div className={`${insetClasses} min-w-0 p-4`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className={`min-w-0 text-[15px] font-semibold text-slate-900 dark:text-white ${wrapAnywhere}`}>
          <span className="mr-1.5 tabular-nums text-slate-500 dark:text-slate-400">{index + 1}.</span>
          {project.name || t('report.customers.unnamed', 'Untitled project')}
        </p>
        {project.isNew && <Badge tone="neutral">{t('report.customers.newCustomer', 'New customer')}</Badge>}
        {project.stage && (
          <Badge tone="neutral" className="max-w-full" title={project.stage}>
            <span className="min-w-0 truncate">{project.stage}</span>
          </Badge>
        )}
      </div>
      {project.parts !== null && (
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
          {t('report.customers.scope', 'Current scope')}{' '}
          <span className="text-[15px] font-semibold tabular-nums text-slate-900 dark:text-white">
            {t('report.customers.partsCount', '{count} parts').replace('{count}', f.count(project.parts))}
          </span>
        </p>
      )}
      {project.points.length > 0 && (
        <ol className="mt-3 space-y-2">
          {project.points.map((point, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-px shrink-0 text-sm text-slate-500 dark:text-slate-400" aria-hidden="true">{circled(i)}</span>
              <Bilingual text={point} empty={null} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

/** One focus project, as edited. */
const FocusProjectEditor: React.FC<{
  project: ReportFocusProject;
  index: number;
  length: number;
  onChange: (project: ReportFocusProject) => void;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
}> = ({ project, index, length, onChange, onMove, onRemove }) => {
  const { t } = useLanguage();
  const fieldName = useFieldName();
  // "Focus project 2" names its fields; with a name typed, the controls say which one.
  const item = t('report.customers.focusN', 'Focus project {n}').replace('{n}', String(index + 1));
  const name = project.name.trim();
  const label = name
    ? t('report.edit.itemNamed', '{item} ({name})').replace('{item}', item).replace('{name}', name)
    : item;
  const nameLabel = t('report.customers.name', 'Name');
  const stageLabel = t('report.customers.stage', 'Stage');
  const partsLabel = t('report.customers.parts', 'Parts');
  const newLabel = t('report.customers.newCustomer', 'New customer');
  return (
    <div className={`${insetClasses} space-y-4 p-4`}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] font-semibold text-slate-900 dark:text-white" title={name || undefined}>
          <span className="mr-1.5 tabular-nums text-slate-500 dark:text-slate-400">{index + 1}.</span>
          {name || item}
        </p>
        <ItemControls index={index} length={length} itemLabel={label} onMove={onMove} onRemove={onRemove} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label={nameLabel} ariaLabel={fieldName(item, nameLabel)} value={project.name} onChange={next => onChange({ ...project, name: next })} />
        <TextInput label={stageLabel} ariaLabel={fieldName(item, stageLabel)} value={project.stage} placeholder={t('report.customers.stageHint', 'e.g. In progress')} onChange={stage => onChange({ ...project, stage })} />
        <CountInput label={partsLabel} ariaLabel={fieldName(item, partsLabel)} value={project.parts} max={REPORT_COUNT_MAX.parts} onChange={parts => onChange({ ...project, parts })} />
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={project.isNew}
            aria-label={fieldName(item, newLabel)}
            onChange={event => onChange({ ...project, isNew: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900"
          />
          {newLabel}
        </label>
      </div>
      <PointsEditor label={t('report.points', 'Points')} context={item} points={project.points} onChange={points => onChange({ ...project, points })} />
    </div>
  );
};

/** Section 2 (顧客別単価と現在の重点案件): rates, status and the projects in focus. */
export const CustomersSection: React.FC<ReportSectionProps> = ({ figures, content, onEdit, written = true }) => {
  const { t } = useLanguage();

  // Reading: the customers with hours, and any other the report says something about.
  // Editing: every customer of the year, so a new one can be written up before its hours arrive.
  const customers = onEdit
    ? figures.customers
    : figures.customers.filter(c => {
      const note = content.customers[c.projectId];
      return c.hoursActual > 0 || (written && (Boolean(note?.status.trim()) || note?.parts != null));
    });

  const setFocus = (focusProjects: ReportFocusProject[]) => onEdit?.(c => ({ ...c, focusProjects }));
  const focusKeys = useItemKeys(content.focusProjects.length);

  return (
    <ReportSection
      id="report-customers"
      number={2}
      title={t('report.customers.title', 'Customer rates and focus projects')}
      description={t('report.customers.desc', 'Each customer’s hourly rate and status, and the projects the team is focused on')}
    >
      <SubHeading>{t('report.customers.ratesTitle', 'Customers and rates')}</SubHeading>
      {customers.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('report.results.noCustomerHours', 'No customer has actual hours in these months.')}</p>
      ) : (
        <CustomerTable customers={customers} notes={content.customers} onEdit={onEdit} written={written || Boolean(onEdit)} />
      )}

      {(onEdit || written) && <>
      <div className="mt-4">
        {onEdit ? (
          <BilingualInput
            label={t('report.customers.others', 'Other customers with results')}
            value={content.otherCustomers}
            onChange={otherCustomers => onEdit(c => ({ ...c, otherCustomers }))}
          />
        ) : (
          content.otherCustomers.trim() !== '' && <Bilingual text={content.otherCustomers} />
        )}
      </div>

      <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
        <SubHeading>{t('report.customers.focusTitle', 'Focus projects')}</SubHeading>
        {onEdit ? (
          <div className="space-y-3">
            {content.focusProjects.map((project, i, all) => (
              <FocusProjectEditor
                key={focusKeys.keys[i]}
                project={project}
                index={i}
                length={all.length}
                onChange={next => setFocus(replaceAt(all, i, next))}
                onMove={step => {
                  focusKeys.move(i, step);
                  setFocus(moveItem(all, i, step));
                }}
                onRemove={() => {
                  focusKeys.remove(i);
                  setFocus(removeAt(all, i));
                }}
              />
            ))}
            <AddButton onClick={() => setFocus([...content.focusProjects, emptyFocusProject()])}>
              {t('report.customers.addFocus', 'Add a focus project')}
            </AddButton>
          </div>
        ) : content.focusProjects.length === 0 ? (
          <Bilingual text="" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {content.focusProjects.map((project, i) => (
              <FocusProjectCard key={i} project={project} index={i} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        {onEdit ? (
          <BilingualInput
            label={t('report.customers.policy', 'Policy')}
            value={content.policy}
            onChange={policy => onEdit(c => ({ ...c, policy }))}
          />
        ) : (
          <div className="border-l-2 border-slate-300 pl-4 dark:border-slate-600">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('report.customers.policy', 'Policy')}</p>
            <Bilingual text={content.policy} className="mt-0.5" mainClassName="text-sm font-medium leading-6 text-slate-900 dark:text-white" />
          </div>
        )}
      </div>
      </>}
    </ReportSection>
  );
};
