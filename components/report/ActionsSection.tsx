import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { ReportAction } from '../../utils/reportModel';
import { insetClasses } from '../ui/Card';
import { circled, replaceAt } from './listOps';
import { Bilingual, BilingualInput, PointsEditor, ReportSection } from './ReportParts';
import type { ReportSectionProps } from './types';

/** Section 4 (今後の重点アクション): the three priority themes and the one management priority. */
export const ActionsSection: React.FC<Omit<ReportSectionProps, 'figures'>> = ({ content, onEdit }) => {
  const { t } = useLanguage();
  // The template has exactly three themes.
  const actions = content.actions.slice(0, 3);
  const setAction = (index: number, action: ReportAction) =>
    onEdit?.(c => ({ ...c, actions: replaceAt(c.actions, index, action) }));
  const themeLabel = (i: number) => t('report.actions.themeN', 'Theme {n}').replace('{n}', String(i + 1));

  return (
    <ReportSection
      id="report-actions"
      number={4}
      title={t('report.actions.title', 'Priority actions')}
      description={t('report.actions.desc', 'The three themes that close the gap to the annual target')}
    >
      {/* Read: three columns from tablet up. Edit: one theme a row until the
          screen is wide enough for three columns of fields. */}
      <div className={`grid grid-cols-1 gap-4 ${onEdit ? 'xl:grid-cols-3' : 'md:grid-cols-3'}`}>
        {actions.map((action, i) => (
          <div key={i} className={onEdit ? `${insetClasses} min-w-0 space-y-4 p-4` : 'min-w-0'}>
            {onEdit ? (
              <>
                <BilingualInput label={themeLabel(i)} value={action.title} onChange={title => setAction(i, { ...action, title })} />
                <PointsEditor
                  label={t('report.points', 'Points')}
                  context={themeLabel(i)}
                  points={action.points}
                  onChange={points => setAction(i, { ...action, points })}
                />
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <span className="text-[15px] font-semibold leading-6 text-slate-500 dark:text-slate-400" aria-hidden="true">{circled(i)}</span>
                  <Bilingual
                    text={action.title}
                    mainClassName="text-[15px] font-semibold leading-6 text-slate-900 dark:text-white"
                  />
                </div>
                {action.points.length > 0 && (
                  <ul className="mt-3 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {action.points.map((point, j) => (
                      <li key={j} className="flex gap-2.5">
                        <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" aria-hidden="true" />
                        <Bilingual text={point} empty={null} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        {onEdit ? (
          <BilingualInput
            label={t('report.actions.priority', 'Management priority')}
            value={content.priority}
            onChange={priority => onEdit(c => ({ ...c, priority }))}
          />
        ) : (
          <div className={`${insetClasses} p-4`}>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('report.actions.priority', 'Management priority')}</p>
            <Bilingual text={content.priority} className="mt-0.5" mainClassName="text-sm font-semibold leading-6 text-slate-900 dark:text-white" />
          </div>
        )}
      </div>
    </ReportSection>
  );
};
