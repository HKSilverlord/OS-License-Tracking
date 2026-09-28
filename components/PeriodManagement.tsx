import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarRange, ChevronRight, Plus, Search } from 'lucide-react';
import { dbService } from '../services/dbService';
import type { Project } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirm, useToast } from '../contexts/ToastContext';
import { useUserRole } from '../contexts/UserRoleContext';
import { createLogger } from '../utils/logger';
import { getCurrentPeriod } from '../utils/helpers';
import { describePeriod, halfMonths, nextPeriod, parsePeriod, periodLabel } from '../utils/period';
import type { Half } from '../utils/period';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { Field, Input } from './ui/Field';
import { Modal } from './ui/Modal';
import { Page } from './ui/Page';
import { SegmentedControl } from './ui/SegmentedControl';
import { Skeleton } from './ui/Skeleton';
import { plural } from '../utils/plural';

const log = createLogger('PeriodManagement');

/** Postgres unique-violation (duplicate period label). */
const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === '23505';

interface PeriodWithCount {
  label: string;
  year: number;
  half: Half;
  created_at: string;
  project_count: number;
}

type EditorState =
  | { mode: 'create'; year: number; half: Half; selected: string[] }
  | {
      mode: 'edit';
      period: PeriodWithCount;
      /** The projects in the period when the editor opened; null while loading. */
      initialIds: string[] | null;
      selected: string[];
    };

const HALVES: readonly Half[] = ['H1', 'H2'];
const MIN_YEAR = 2000;
const MAX_YEAR = 2099;

/** Periods arranged as the years they belong to, newest year first. */
const groupByYear = (periods: PeriodWithCount[]) => {
  const years = new Map<number, Partial<Record<Half, PeriodWithCount>>>();
  for (const period of periods) {
    const halves = years.get(period.year) ?? {};
    halves[period.half] = period;
    years.set(period.year, halves);
  }
  return [...years.entries()].sort(([a], [b]) => b - a);
};

/* ------------------------------------------------------------------------- */

interface ProjectPickerProps {
  projects: Project[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  /** Offered beside "Select all": filling the list from another period. */
  extraAction?: React.ReactNode;
}

/** A searchable checklist of every project. Select all and Clear act on what the search shows. */
const ProjectPicker: React.FC<ProjectPickerProps> = ({ projects, selected, onChange, loading = false, extraAction }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(project =>
      [project.name, project.code, project.type, project.software].some(value => value?.toLowerCase().includes(q)),
    );
  }, [projects, query]);

  const toggle = (id: string) =>
    onChange(selectedSet.has(id) ? selected.filter(value => value !== id) : [...selected, id]);

  const selectVisible = () => onChange(Array.from(new Set([...selected, ...visible.map(project => project.id)])));

  const clearVisible = () => {
    const hidden = new Set(visible.map(project => project.id));
    onChange(selected.filter(id => !hidden.has(id)));
  };

  if (projects.length === 0 && !loading) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm leading-6 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
        {t('periodManagement.noProjects', 'No projects yet. After creating this period, add them in Project Tracking.')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          // Inside the editor's form: Enter here would save the period mid-search.
          onKeyDown={event => {
            if (event.key === 'Enter') event.preventDefault();
          }}
          placeholder={t('searchPlaceholder', 'Search by name, code or type')}
          aria-label={t('searchProjects', 'Search projects')}
          className="pl-9"
          disabled={loading}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[13px] text-slate-500 tabular-nums dark:text-slate-400" aria-live="polite">
          {t('periodManagement.selectedCount', '{count} of {total} selected')
            .replace('{count}', String(selected.length))
            .replace('{total}', String(projects.length))}
        </p>
        <div className="-mr-2 flex flex-wrap items-center">
          {extraAction}
          <Button variant="ghost" size="sm" onClick={selectVisible} disabled={loading || visible.length === 0}>
            {t('selectAll', 'Select all')}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearVisible} disabled={loading || selected.length === 0}>
            {t('periodManagement.clear', 'Clear')}
          </Button>
        </div>
      </div>

      <div className="max-h-[min(22rem,42dvh)] overflow-y-auto rounded-xl border border-slate-200 custom-scrollbar dark:border-slate-800">
        {loading ? (
          <div className="space-y-3 p-3" aria-busy="true">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('periodManagement.noMatch', 'No projects match “{query}”.').replace('{query}', query.trim())}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {visible.map(project => {
              const detail = [project.type, project.software?.replace(/\s*[\n,、]\s*/g, ', ')]
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={project.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(project.id)}
                      onChange={() => toggle(project.id)}
                      className="h-4 w-4 shrink-0 cursor-pointer rounded accent-blue-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{project.name}</span>
                        <span className="shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-400">{project.code}</span>
                      </span>
                      {detail && (
                        <span className="block truncate text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------- */

interface PeriodEditorProps {
  editor: EditorState;
  projects: Project[];
  existingLabels: ReadonlySet<string>;
  /** The newest period, offered as a starting selection for a new one. */
  latestLabel: string | null;
  submitting: boolean;
  /** Updates are functions of the latest state: a fetch may finish after further edits. */
  onChange: (update: (prev: EditorState) => EditorState) => void;
  onClose: () => void;
  onSubmit: () => void;
  onDelete: () => void;
}

const PeriodEditor: React.FC<PeriodEditorProps> = ({
  editor,
  projects,
  existingLabels,
  latestLabel,
  submitting,
  onChange,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const { t } = useLanguage();
  const toast = useToast();
  const formId = useId();
  const [copying, setCopying] = useState(false);

  const isCreate = editor.mode === 'create';
  const loading = editor.mode === 'edit' && editor.initialIds === null;

  const yearValid = !isCreate || (editor.year >= MIN_YEAR && editor.year <= MAX_YEAR);
  const targetLabel = isCreate ? periodLabel(editor) : editor.period.label;
  const alreadyExists = isCreate && yearValid && existingLabels.has(targetLabel);

  // A first period may start empty (there may be no projects to pick yet);
  // otherwise a period with nothing in it is almost certainly a slip.
  const needsSelection = projects.length > 0 && editor.selected.length === 0;
  const removedCount =
    editor.mode === 'edit' && editor.initialIds
      ? editor.initialIds.filter(id => !editor.selected.includes(id)).length
      : 0;

  const canSubmit = !loading && yearValid && !alreadyExists && !needsSelection;

  const setSelected = (selected: string[]) => onChange(prev => ({ ...prev, selected }));
  const setYear = (year: number) => onChange(prev => (prev.mode === 'create' ? { ...prev, year } : prev));
  const setHalf = (half: Half) => onChange(prev => (prev.mode === 'create' ? { ...prev, half } : prev));

  const copyFromLatest = async () => {
    if (!latestLabel || editor.mode !== 'create') return;
    setCopying(true);
    try {
      const inLatest = await dbService.getProjectsForPeriod(latestLabel);
      setSelected(inLatest.map(project => project.id));
    } catch (error) {
      log.error('Failed to load the latest period', error);
      toast.error(t('alerts.projectsLoadFailed', 'Failed to load projects'));
    } finally {
      setCopying(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (canSubmit) onSubmit();
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      dismissible={!submitting}
      title={isCreate ? t('createNewPeriod', 'New period') : describePeriod(editor.period.label, t)}
      description={
        isCreate
          ? t('periodManagement.createDescription', 'Pick the half-year, then the projects to track in it.')
          : t('periodManagement.editDescription', 'Choose the projects tracked in this half-year.')
      }
      footer={
        <>
          {editor.mode === 'edit' && (
            <Button variant="danger-quiet" onClick={onDelete} disabled={submitting} className="sm:mr-auto">
              {t('periodManagement.deletePeriod', 'Delete period')}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" form={formId} isLoading={submitting} disabled={!canSubmit}>
            {isCreate ? t('createPeriod', 'Create period') : t('common.save', 'Save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5">
        {editor.mode === 'create' && (
          <div>
            <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-end gap-3">
              <Field label={t('year', 'Year')}>
                {id => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={MIN_YEAR}
                    max={MAX_YEAR}
                    className="tabular-nums no-spinner"
                    aria-invalid={!yearValid || alreadyExists || undefined}
                    value={Number.isNaN(editor.year) ? '' : editor.year}
                    onChange={event => setYear(Number.parseInt(event.target.value, 10))}
                  />
                )}
              </Field>
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-300">{t('half', 'Half')}</p>
                <SegmentedControl<Half>
                  size="lg"
                  fullWidth
                  ariaLabel={t('half', 'Half')}
                  value={editor.half}
                  onChange={setHalf}
                  options={HALVES.map(half => ({
                    value: half,
                    label: (
                      <>
                        {half}
                        <span className="hidden font-normal text-slate-500 min-[400px]:inline dark:text-slate-400">
                          {halfMonths(half, t)}
                        </span>
                      </>
                    ),
                  }))}
                />
              </div>
            </div>
            {(!yearValid || alreadyExists) && (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400" role="alert">
                {!yearValid
                  ? t('periodManagement.yearRange', 'Enter a year from {min} to {max}.')
                      .replace('{min}', String(MIN_YEAR))
                      .replace('{max}', String(MAX_YEAR))
                  : t('periodManagement.exists', '{period} already exists.').replace('{period}', describePeriod(targetLabel, t))}
              </p>
            )}
          </div>
        )}

        <ProjectPicker
          projects={projects}
          selected={editor.selected}
          loading={loading}
          onChange={setSelected}
          extraAction={
            editor.mode === 'create' && latestLabel && projects.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={copyFromLatest} isLoading={copying}>
                {t('periodManagement.copyFrom', 'Same as {period}').replace('{period}', latestLabel.replace('-', ' '))}
              </Button>
            ) : undefined
          }
        />

        {removedCount > 0 && (
          <p className="text-[13px] leading-5 text-amber-700 dark:text-amber-400">
            {plural(t, 'periodManagement.willRemove', removedCount, '{count} projects will be removed from this period, with the prices set for it.')}
          </p>
        )}
      </form>
    </Modal>
  );
};

/* ------------------------------------------------------------------------- */

interface HalfRowProps {
  year: number;
  half: Half;
  period?: PeriodWithCount;
  isAdmin: boolean;
  onEdit: (period: PeriodWithCount) => void;
  onCreate: (year: number, half: Half) => void;
}

const HalfRow: React.FC<HalfRowProps> = ({ year, half, period, isAdmin, onEdit, onCreate }) => {
  const { t } = useLanguage();

  const name = (
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-slate-900 dark:text-white">{half}</span>
      <span className="block text-[13px] text-slate-500 dark:text-slate-400">{halfMonths(half, t)}</span>
    </span>
  );

  if (!period) {
    return (
      <li className="flex min-h-[64px] items-center gap-3 px-4 py-3 sm:px-5">
        {name}
        <span className="text-[13px] text-slate-500 dark:text-slate-400">
          {t('periodManagement.notCreated', 'Not set up')}
        </span>
        {isAdmin && (
          <Button variant="secondary" size="sm" onClick={() => onCreate(year, half)}>
            {t('periodManagement.create', 'Set up')}
          </Button>
        )}
      </li>
    );
  }

  const count = (
    <span className="text-[13px] text-slate-600 tabular-nums dark:text-slate-300">
      {plural(t, 'periodManagement.projectCount', period.project_count, '{count} projects')}
    </span>
  );

  if (!isAdmin) {
    return (
      <li className="flex min-h-[64px] items-center gap-3 px-4 py-3 sm:px-5">
        {name}
        {count}
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onEdit(period)}
        className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 sm:px-5 dark:hover:bg-slate-800/50"
        aria-label={`${describePeriod(period.label, t)} — ${t('periodManagement.editProjects', 'Edit projects')}`}
      >
        {name}
        {count}
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
      </button>
    </li>
  );
};

/* ------------------------------------------------------------------------- */

export const PeriodManagement: React.FC = () => {
  const { t } = useLanguage();
  const toast = useToast();
  const confirm = useConfirm();
  const { isAdmin } = useUserRole();

  const [periods, setPeriods] = useState<PeriodWithCount[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // `t` is memoised per language. Making it a dependency of the fetch would
  // refetch on every language switch, so the ref keeps the error toast localised
  // without tying data loading to the language.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const loadedRef = useRef(false);
  const loadData = useCallback(async () => {
    try {
      const [periodsData, projectsData] = await Promise.all([
        dbService.getPeriodsWithProjectCount(),
        dbService.getAllProjectsForPeriodManagement(),
      ]);
      setPeriods(periodsData as PeriodWithCount[]);
      setAllProjects(projectsData);
      loadedRef.current = true;
      setStatus('ready');
    } catch (error) {
      log.error('Error loading data:', error);
      // A failed refresh keeps the list on screen; a failed first load explains itself.
      if (loadedRef.current) toast.error(tRef.current('toast.loadFailed', 'Failed to load data'));
      else setStatus('error');
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const retry = () => {
    setStatus('loading');
    void loadData();
  };

  const years = useMemo(() => groupByYear(periods), [periods]);
  const existingLabels = useMemo(() => new Set(periods.map(period => period.label)), [periods]);
  // Newest first from the service: year, then half, descending.
  const latestLabel = periods[0]?.label ?? null;

  const openCreate = (year?: number, half?: Half) => {
    if (year !== undefined && half !== undefined) {
      setEditor({ mode: 'create', year, half, selected: [] });
      return;
    }
    const latest = latestLabel ? parsePeriod(latestLabel) : null;
    const target = latest ? nextPeriod(latest) : { year: getCurrentPeriod().year, half: getCurrentPeriod().type as Half };
    setEditor({ mode: 'create', ...target, selected: [] });
  };

  // Stale answers (the editor was closed, or another period opened) are dropped.
  const editRequestRef = useRef(0);
  const openEdit = async (period: PeriodWithCount) => {
    const request = ++editRequestRef.current;
    setEditor({ mode: 'edit', period, initialIds: null, selected: [] });
    try {
      const inPeriod = await dbService.getProjectsForPeriod(period.label);
      if (editRequestRef.current !== request) return;
      const ids = inPeriod.map(project => project.id);
      setEditor({ mode: 'edit', period, initialIds: ids, selected: ids });
    } catch (error) {
      if (editRequestRef.current !== request) return;
      log.error('Error loading period projects:', error);
      toast.error(t('alerts.projectsLoadFailed', 'Failed to load projects'));
      setEditor(null);
    }
  };

  const closeEditor = () => {
    editRequestRef.current += 1;
    setEditor(null);
  };

  const handleSubmit = async () => {
    if (!editor) return;
    setSubmitting(true);
    try {
      if (editor.mode === 'create') {
        await dbService.createPeriodWithProjects(editor.year, editor.half, editor.selected);
        // Tells the shell's year catalogue, which then switches to the new period's year.
        window.dispatchEvent(new CustomEvent('periodCreated', { detail: { periodLabel: periodLabel(editor) } }));
        toast.success(t('alerts.periodCreated', 'Period created'));
      } else {
        await dbService.updatePeriodProjects(editor.period.label, editor.selected);
        window.dispatchEvent(new CustomEvent('dataUpdated'));
        toast.success(t('periodManagement.updated', 'Period updated'));
      }
      closeEditor();
      await loadData();
    } catch (error) {
      log.error('Error saving period:', error);
      if (editor.mode === 'create') {
        toast.error(isDuplicateKeyError(error)
          ? t('alerts.duplicatePeriod', 'This period already exists')
          : t('alerts.periodCreateFailed', 'Failed to create period'));
      } else {
        toast.error(t('periodManagement.updateFailed', 'Failed to update period'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editor || editor.mode !== 'edit') return;
    const { period } = editor;
    const name = describePeriod(period.label, t);
    const confirmed = await confirm({
      title: t('periodManagement.confirmDeleteTitle', 'Delete {period}?').replace('{period}', name),
      message: t(
        'periodManagement.confirmDelete',
        'Its project assignments go too, including prices set for this period. The projects and their recorded hours are kept.',
      ),
      confirmLabel: t('delete', 'Delete'),
      cancelLabel: t('common.cancel', 'Cancel'),
      danger: true,
    });
    if (!confirmed) return;

    setSubmitting(true);
    try {
      await dbService.deletePeriod(period.label);
      toast.success(t('periodManagement.deleted', 'Period deleted'));
      closeEditor();
      window.dispatchEvent(new CustomEvent('periodsChanged'));
      window.dispatchEvent(new CustomEvent('dataUpdated'));
      await loadData();
    } catch (error) {
      log.error('Error deleting period:', error);
      toast.error(t('periodManagement.deleteFailed', 'Failed to delete period'));
    } finally {
      setSubmitting(false);
    }
  };

  const newPeriodButton = isAdmin && status === 'ready' && (
    <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => openCreate()}>
      {t('createNewPeriod', 'New period')}
    </Button>
  );

  let content: React.ReactNode;
  if (status === 'loading') {
    content = (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label={t('common.loading', 'Loading…')}>
        {[0, 1].map(index => (
          <Card key={index} padding="none">
            <div className="px-5 py-4"><Skeleton className="h-5 w-16" /></div>
            <div className="space-y-4 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </Card>
        ))}
      </div>
    );
  } else if (status === 'error') {
    content = (
      <Card>
        <EmptyState
          tone="error"
          title={t('periodManagement.loadFailedTitle', 'Could not load the periods')}
          description={t('empty.loadFailedHint', 'The request did not come back. Check the connection and try again.')}
          actions={<Button variant="secondary" onClick={retry}>{t('buttons.retry', 'Try again')}</Button>}
        />
      </Card>
    );
  } else if (years.length === 0) {
    content = (
      <Card>
        <EmptyState
          icon={CalendarRange}
          title={t('periodManagement.emptyTitle', 'No periods yet')}
          description={
            isAdmin
              ? t('periodManagement.emptyHint', 'A period is a half-year — H1 is January to June, H2 July to December — with the projects whose hours you track in it. Create the first one to start.')
              : t('periodManagement.emptyHintViewer', 'A period is a half-year with the projects whose hours are tracked in it. An administrator sets them up.')
          }
          actions={newPeriodButton}
        />
      </Card>
    );
  } else {
    content = (
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {years.map(([year, halves]) => (
          <Card key={year} padding="none" className="overflow-hidden">
            <h2 className="px-4 pb-2 pt-4 text-[15px] font-semibold tabular-nums text-slate-900 sm:px-5 dark:text-white">
              {year}
            </h2>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {HALVES.map(half => (
                <HalfRow
                  key={half}
                  year={year}
                  half={half}
                  period={halves[half]}
                  isAdmin={isAdmin}
                  onEdit={period => { void openEdit(period); }}
                  onCreate={openCreate}
                />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Page
      title={t('periodManagement', 'Periods')}
      description={t('managePeriods', 'Half-years, and the projects tracked in each')}
      actions={years.length > 0 ? newPeriodButton : undefined}
    >
      {content}

      {editor && (
        <PeriodEditor
          editor={editor}
          projects={allProjects}
          existingLabels={existingLabels}
          latestLabel={latestLabel}
          submitting={submitting}
          onChange={update => setEditor(prev => (prev ? update(prev) : prev))}
          onClose={closeEditor}
          onSubmit={() => { void handleSubmit(); }}
          onDelete={() => { void handleDelete(); }}
        />
      )}
    </Page>
  );
};

export default PeriodManagement;
