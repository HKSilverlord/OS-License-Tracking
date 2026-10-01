import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { REPORT_COUNT_MAX } from '../../utils/reportModel';
import type { ReportContent, ReportStaffChange } from '../../utils/reportModel';
import { insetClasses } from '../ui/Card';
import { Meter } from '../ui/Metric';
import { useFieldName, useItemKeys } from './editing';
import { moveItem, removeAt, replaceAt } from './listOps';
import {
  AddButton,
  Bilingual,
  BilingualInput,
  CountInput,
  ItemControls,
  itemTitle,
  keyText,
  labelText,
  noteText,
  pointDot,
  PointsEditor,
  ReportSection,
  SubHeading,
  TextInput,
  wrapAnywhere,
} from './ReportParts';
import type { ReportEdit, ReportSectionProps } from './types';
import { useReportFormat } from './useReportFormat';

/** A count in the training box: trainees, seats. */
const countText = 'mt-0.5 text-[28px] font-semibold leading-9 tracking-tight tabular-nums text-slate-900 dark:text-white';

/** A bulleted list of bilingual points. */
const Points: React.FC<{ points: string[] }> = ({ points }) => (
  <ul className="space-y-2.5">
    {points.map((point, i) => (
      <li key={i} className="flex gap-2.5">
        <span className={pointDot} aria-hidden="true" />
        <Bilingual text={point} empty={null} />
      </li>
    ))}
  </ul>
);

const Training: React.FC<{ content: ReportContent; onEdit?: ReportEdit }> = ({ content, onEdit }) => {
  const { t } = useLanguage();
  const f = useReportFormat();
  const { training } = content;
  const setTraining = (patch: Partial<ReportContent['training']>) =>
    onEdit?.(c => ({ ...c, training: { ...c.training, ...patch } }));

  if (onEdit) {
    return (
      <div className="space-y-4">
        <BilingualInput label={t('report.people.trainingTitle', 'Programme')} value={training.title} onChange={title => setTraining({ title })} />
        <PointsEditor
          label={t('report.points', 'Points')}
          context={t('report.people.training', 'Training')}
          points={training.points}
          onChange={points => setTraining({ points })}
        />
        <div className="grid grid-cols-2 gap-4">
          <CountInput label={t('report.people.trainees', 'Trainees')} value={training.trainees} max={REPORT_COUNT_MAX.trainees} onChange={trainees => setTraining({ trainees })} />
          <CountInput label={t('report.people.seats', 'Seats')} value={training.seats} max={REPORT_COUNT_MAX.seats} onChange={seats => setTraining({ seats })} />
        </div>
        <BilingualInput label={t('report.people.progress', 'Progress')} value={training.progress} onChange={progress => setTraining({ progress })} />
      </div>
    );
  }

  const nothing = !training.title && training.points.length === 0 && training.trainees === null
    && training.seats === null && !training.progress;
  if (nothing) return <Bilingual text="" />;

  return (
    <div>
      <Bilingual
        text={training.title}
        empty={null}
        mainClassName={itemTitle}
      />
      {training.points.length > 0 && <div className="mt-3"><Points points={training.points} /></div>}
      <dl className={`${insetClasses} mt-5 grid grid-cols-2 gap-x-4 gap-y-4 p-5`}>
        <div>
          <dt className={labelText}>{t('report.people.trainees', 'Trainees')}</dt>
          <dd className={countText}>
            {training.trainees === null ? '—' : f.count(training.trainees)}
          </dd>
        </div>
        <div>
          <dt className={labelText}>{t('report.people.seats', 'Seats')}</dt>
          <dd className={countText}>
            {training.seats === null ? '—' : f.count(training.seats)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className={labelText}>{t('report.people.progress', 'Progress')}</dt>
          <dd><Bilingual text={training.progress} empty={<span className="text-slate-400">—</span>} /></dd>
        </div>
      </dl>
    </div>
  );
};

const Staffing: React.FC<{ content: ReportContent; onEdit?: ReportEdit }> = ({ content, onEdit }) => {
  const { t } = useLanguage();
  const f = useReportFormat();
  const { staffing } = content;
  const setStaffing = (patch: Partial<ReportContent['staffing']>) =>
    onEdit?.(c => ({ ...c, staffing: { ...c.staffing, ...patch } }));
  const setChanges = (changes: ReportStaffChange[]) => setStaffing({ changes });
  const changeKeys = useItemKeys(staffing.changes.length);
  const fieldName = useFieldName();

  const fill = staffing.planned && staffing.planned > 0 && staffing.current !== null
    ? staffing.current / staffing.planned
    : null;
  const people = (n: number | null) => (n === null ? '—' : f.count(n));

  const headcount = onEdit ? (
    <div className="grid grid-cols-2 gap-4">
      <CountInput label={t('report.people.planned', 'Planned')} value={staffing.planned} max={REPORT_COUNT_MAX.headcount} onChange={planned => setStaffing({ planned })} />
      <CountInput label={t('report.people.current', 'Current')} value={staffing.current} max={REPORT_COUNT_MAX.headcount} onChange={current => setStaffing({ current })} />
    </div>
  ) : (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <p className="flex items-baseline gap-2.5 text-4xl font-semibold leading-[44px] tracking-tight tabular-nums text-slate-900 dark:text-white">
        <span title={t('report.people.planned', 'Planned')}>{people(staffing.planned)}</span>
        <ArrowRight className="h-6 w-6 self-center text-slate-400" aria-label={t('report.people.to', 'to')} />
        <span title={t('report.people.current', 'Current')}>{people(staffing.current)}</span>
        <span className="text-base font-normal tracking-normal text-slate-500 dark:text-slate-400">{t('report.people.unit', 'people')}</span>
      </p>
      <p className={labelText}>
        {t('report.people.plannedToCurrent', 'Planned → current')}
      </p>
    </div>
  );

  return (
    <div>
      {headcount}
      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3 text-[15px]">
          <span className="text-slate-500 dark:text-slate-400">{t('report.people.fillRate', 'Fill rate')}</span>
          <span className="tabular-nums text-slate-500 dark:text-slate-400">
            <span className="mr-2 text-lg font-semibold text-slate-900 dark:text-white" data-figure="fillRate">{fill === null ? '—' : f.percent(fill)}</span>
            {people(staffing.current)} / {people(staffing.planned)}
          </span>
        </div>
        <Meter value={fill ?? 0} label={t('report.people.fillRate', 'Fill rate')} className="mt-2 h-2.5" />
        {onEdit && <p className={`mt-1.5 ${noteText}`}>{t('report.people.fillHint', 'Worked out from the two numbers above.')}</p>}
      </div>

      <div className="mt-8">
        <SubHeading>{t('report.people.changes', 'Staffing changes this year')}</SubHeading>
        {onEdit ? (
          <div className="space-y-3">
            {staffing.changes.map((change, i, all) => {
              const item = t('report.people.changeN', 'Change {n}').replace('{n}', String(i + 1));
              const when = change.when.trim();
              const label = when
                ? t('report.edit.itemNamed', '{item} ({name})').replace('{item}', item).replace('{name}', when)
                : item;
              const whenLabel = t('report.people.when', 'When');
              const whatLabel = t('report.people.what', 'What changed');
              return (
                // The fields sit side by side only where the card is wide enough for both.
                <div key={changeKeys.keys[i]} className={`${insetClasses} @container p-3`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[15px] font-semibold text-slate-700 dark:text-slate-200">{item}</p>
                    <ItemControls
                      index={i}
                      length={all.length}
                      itemLabel={label}
                      onMove={step => {
                        changeKeys.move(i, step);
                        setChanges(moveItem(all, i, step));
                      }}
                      onRemove={() => {
                        changeKeys.remove(i);
                        setChanges(removeAt(all, i));
                      }}
                    />
                  </div>
                  <div className="grid gap-3 @md:grid-cols-[8rem_minmax(0,1fr)] @md:items-start">
                    <TextInput
                      label={whenLabel}
                      ariaLabel={fieldName(item, whenLabel)}
                      value={change.when}
                      placeholder={t('report.people.whenHint', 'e.g. April')}
                      onChange={next => setChanges(replaceAt(all, i, { ...change, when: next }))}
                    />
                    <BilingualInput
                      label={whatLabel}
                      ariaLabel={fieldName(item, whatLabel)}
                      value={change.text}
                      onChange={text => setChanges(replaceAt(all, i, { ...change, text }))}
                    />
                  </div>
                </div>
              );
            })}
            <AddButton onClick={() => setChanges([...staffing.changes, { when: '', text: '' }])}>
              {t('report.people.addChange', 'Add a change')}
            </AddButton>
          </div>
        ) : staffing.changes.length === 0 ? (
          <Bilingual text="" />
        ) : (
          <ol className="relative space-y-4 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
            {staffing.changes.map((change, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[23px] top-2 h-3 w-3 rounded-full border-2 border-white bg-slate-400 dark:border-slate-900 dark:bg-slate-500" aria-hidden="true" />
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 @sm:flex-nowrap">
                  <p className={`w-24 shrink-0 text-[15px] font-semibold leading-7 text-slate-700 dark:text-slate-200 ${wrapAnywhere}`}>{change.when || '—'}</p>
                  <Bilingual text={change.text} empty={null} className="min-w-0 flex-1" />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-8">
        {onEdit ? (
          <BilingualInput label={t('report.people.issues', 'Issues')} value={staffing.issues} onChange={issues => setStaffing({ issues })} />
        ) : (
          <div className="border-l-[3px] border-slate-300 pl-4 dark:border-slate-600">
            <p className={`font-medium ${labelText}`}>{t('report.people.issues', 'Issues')}</p>
            <Bilingual text={staffing.issues} className="mt-1" mainClassName={keyText} />
          </div>
        )}
      </div>
    </div>
  );
};

/** Section 3 (人材育成と人員状況): training, and the team's headcount. */
export const PeopleSection: React.FC<Omit<ReportSectionProps, 'figures'>> = ({ content, onEdit }) => {
  const { t } = useLanguage();
  return (
    <ReportSection
      id="report-people"
      number={3}
      title={t('report.people.title', 'Training and staffing')}
      description={t('report.people.desc', 'How the team is training new designers, and how many people it has')}
    >
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 @3xl:grid-cols-2">
        <div className="@container min-w-0">
          <SubHeading>{t('report.people.training', 'Training')}</SubHeading>
          <Training content={content} onEdit={onEdit} />
        </div>
        <div className="@container min-w-0 border-t border-slate-100 pt-6 @3xl:border-l @3xl:border-t-0 @3xl:pl-10 @3xl:pt-0 dark:border-slate-800">
          <SubHeading>{t('report.people.headcount', 'Headcount')}</SubHeading>
          <Staffing content={content} onEdit={onEdit} />
        </div>
      </div>
    </ReportSection>
  );
};
