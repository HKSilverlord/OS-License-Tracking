import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarRange, Check, ChevronsUpDown, Columns3, Eye, Plus, Search } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Project, MonthlyRecord, PeriodType } from '../types';
import { dbService } from '../services/dbService';
import { getCurrentPeriod, getMonthsForPeriod } from '../utils/helpers';
import { useLanguage } from '../contexts/LanguageContext';
import { useNumberFormat, localeTagFor } from '../hooks/useNumberFormat';
import { useUserRole } from '../contexts/UserRoleContext';
import { useToast, useConfirm } from '../contexts/ToastContext';
import { useYearControl } from '../contexts/YearContext';
import { setNavigationBlocker } from '../utils/navigationGuard';
import { resolvePrices } from '../services/pricing';
import { createLogger } from '../utils/logger';
import { describePeriod, halfMonths, type Half } from '../utils/period';
import { plural } from '../utils/plural';
import { EditProjectModal } from './EditProjectModal';
import { NewProjectModal } from './modals/NewProjectModal';
import { YearControl, YearExportButton } from './YearControl';
import { SortableRow, DragHandleCell, ProjectActionsMenu } from './tracking/SortableRow';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { buttonClasses } from './ui/buttonClasses';
import { cardClasses } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { Input } from './ui/Field';
import { Kbd } from './ui/Kbd';
import { Page } from './ui/Page';
import { SegmentedControl } from './ui/SegmentedControl';
import { Skeleton } from './ui/Skeleton';

const log = createLogger('TrackingView');

interface TrackingViewProps {
  currentYear: number;
}

type SortKey = 'display_order' | 'exclusion_mark' | 'name';
type SortConfig = { key: SortKey; direction: 'asc' | 'desc' };

const MANUAL_ORDER: SortConfig = { key: 'display_order', direction: 'asc' };

/**
 * Column widths in px. From `xl` the first three stay put while the months
 * scroll, so No. and Excl. leave room for their sort buttons and the longest
 * heading (Vietnamese): a cell wider than its width would slide under the next.
 */
const W = {
  no: 56,
  excl: 80,
  name: 224,
  notes: 200,
  software: 150,
  content: 200,
  rate: 92,
  kind: 80,
  month: 76,
  total: 84,
  actions: 52,
} as const;

/*
 * Frozen cells must stay opaque while the months slide under them, including
 * on hover, so the hover colour is a solid mix rather than a translucent tint.
 */
const SURFACE =
  'bg-white group-hover:bg-slate-50 dark:bg-slate-900 ' +
  'dark:group-hover:bg-[color-mix(in_oklab,var(--color-slate-900),var(--color-slate-800)_55%)]';

/* The project name and Plan/Actual are always frozen. No., Excl. and the
   actions column join them only from `xl`: below that, with the sidebar open,
   they would leave no room for a single month. The name is narrow until `lg`.
   The offsets are W.no, W.no + W.excl and the name's right edge; Tailwind
   needs them written out. */
const STICKY_NO = 'xl:sticky xl:left-0 xl:z-10';
const STICKY_EXCL = 'xl:sticky xl:left-[56px] xl:z-10';
const STICKY_NAME = 'sticky left-0 z-10 xl:left-[136px]';
const NAME_WIDTH = 'w-[128px] min-w-[128px] max-w-[128px] lg:w-[224px] lg:min-w-[224px] lg:max-w-[224px]';
/* Rate and any detail columns slide under it, so a row always says what it is. */
const STICKY_KIND = 'sticky left-[128px] z-10 lg:left-[224px] xl:left-[360px]';

const HEAD =
  'sticky top-0 z-20 h-10 border-b border-slate-200 bg-white px-2 text-[13px] font-medium text-slate-500 ' +
  'dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400';
/* Header cells frozen both ways sit above the rest. HEAD is already sticky
   to the top, so a left offset is all it takes to freeze one sideways. */
const HEAD_NO = 'xl:left-0 xl:z-30';
const HEAD_EXCL = 'xl:left-[56px] xl:z-30';
const HEAD_NAME = 'left-0 z-30! xl:left-[136px]';
const HEAD_KIND = 'left-[128px] z-30! lg:left-[224px] xl:left-[360px]';
/* Frozen on the right from `xl` up; below that its width goes to the months. */
const HEAD_ACTIONS = 'xl:right-0 z-30!';

/** Where the grid ends a project: a hairline under its Actual row. */
const ROW_END = 'border-b border-slate-100 dark:border-slate-800';

/** Editable cell text: a spreadsheet cell that shows it can be typed into on hover. */
const CELL_INPUT =
  'block w-full rounded-md border-0 bg-transparent px-2 text-sm text-slate-900 outline-none ' +
  'transition-[background-color,box-shadow] duration-100 placeholder:text-slate-300 ' +
  'hover:bg-slate-100/70 focus:bg-white focus:ring-2 focus:ring-blue-500/50 ' +
  'dark:text-slate-100 dark:placeholder:text-slate-600 dark:hover:bg-slate-800 dark:focus:bg-slate-950 dark:focus:ring-blue-400/50';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const SAVE_SHORTCUT = isMac ? '⌘S' : 'Ctrl S';

const readShowDetails = (): boolean => {
  try {
    return window.localStorage.getItem('tracking_showDetails') === '1';
  } catch {
    return false;
  }
};

/* ------------------------------------------------------------------ */

/** A column heading that sorts the table. */
const SortHeader: React.FC<{
  label: string;
  title?: string;
  sortKey: SortKey;
  sort: SortConfig;
  onSort: (key: SortKey) => void;
  align?: 'start' | 'center';
}> = ({ label, title, sortKey, sort, onSort, align = 'start' }) => {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      title={title}
      className={`group/sort -mx-1 inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-1 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white ${
        align === 'center' ? 'justify-center' : ''
      } ${active ? 'text-slate-900 dark:text-white' : ''}`}
    >
      {label}
      <Icon
        className={`h-3.5 w-3.5 ${active ? 'text-blue-600 dark:text-blue-400' : 'opacity-0 group-hover/sort:opacity-60'}`}
        aria-hidden="true"
      />
    </button>
  );
};

const ariaSort = (sort: SortConfig, key: SortKey): React.AriaAttributes['aria-sort'] =>
  sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined;

/**
 * Below `xl` No., Excl. and Rate are not frozen, and would fill the table
 * before the first month. The table opens with the Plan/Actual column against
 * the name instead; from `xl` up everything fits from the left edge.
 */
const openAtKindColumn = (table: HTMLTableElement | null) => {
  if (!table || window.matchMedia('(min-width: 1280px)').matches) return;
  // Measured once the web font is in: the columns before it size to their text.
  void document.fonts.ready.then(() => {
    const scroller = table.parentElement;
    const name = table.querySelector<HTMLElement>('[data-col="name"]');
    const kind = table.querySelector<HTMLElement>('[data-col="kind"]');
    if (!table.isConnected || !scroller || !name || !kind) return;
    // In content coordinates: the name only sticks once the table has scrolled.
    const contentLeft = scroller.getBoundingClientRect().left + scroller.clientLeft - scroller.scrollLeft;
    scroller.scrollLeft = kind.getBoundingClientRect().left - contentLeft - name.offsetWidth;
  });
};

/** One month's hours. An input for an admin; the figure for everyone else. */
const HourCell: React.FC<{
  value: number;
  editable: boolean;
  kind: 'plan' | 'actual';
  cellKey: string;
  label: string;
  pending: boolean;
  saving: boolean;
  format: (value: number) => string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}> = ({ value, editable, kind, cellKey, label, pending, saving, format, onChange, onKeyDown }) => {
  const tone = kind === 'actual' ? 'font-medium' : 'text-slate-500! dark:text-slate-400!';
  if (!editable) {
    return (
      <span className={`block px-2 text-right text-sm tabular-nums text-slate-900 dark:text-slate-100 ${tone}`}>
        {value === 0 ? <span className="text-slate-300 dark:text-slate-600">–</span> : format(value)}
      </span>
    );
  }
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      data-hour-cell={cellKey}
      aria-label={label}
      className={`${CELL_INPUT} no-spinner h-8 text-right tabular-nums ${tone} ${
        pending ? 'bg-amber-50! dark:bg-amber-500/10!' : ''
      } ${saving ? 'animate-pulse' : ''}`}
      value={value === 0 ? '' : value}
      placeholder="–"
      onChange={event => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      onWheel={event => event.currentTarget.blur()}
    />
  );
};

/** A free-text project field: notes, software, business content. */
const TextCell: React.FC<{
  value: string;
  editable: boolean;
  label: string;
  placeholder?: string;
  onChange: (value: string) => void;
}> = ({ value, editable, label, placeholder, onChange }) =>
  editable ? (
    <textarea
      aria-label={label}
      className={`${CELL_INPUT} min-h-[4.25rem] resize-none py-1.5 leading-5 custom-scrollbar`}
      value={value}
      placeholder={placeholder}
      onChange={event => onChange(event.target.value)}
    />
  ) : (
    <p className="whitespace-pre-line px-2 py-1.5 text-sm leading-5 text-slate-600 dark:text-slate-300">
      {value || <span className="text-slate-300 dark:text-slate-600">–</span>}
    </p>
  );

const GridSkeleton: React.FC = () => (
  <div className="p-4" aria-hidden="true">
    <Skeleton.Table rows={8} cols={9} />
  </div>
);

/* ------------------------------------------------------------------ */

export const TrackingView: React.FC<TrackingViewProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const { format: nf } = useNumberFormat();
  const { isAdmin } = useUserRole();
  const toast = useToast();
  const confirm = useConfirm();
  const yearControl = useYearControl();

  // Seeded from today's half-year: opening this view in October on H1 meant six
  // empty columns and a tab click before anyone could type anything.
  const [activeTerm, setActiveTerm] = useState<Half>(() => {
    const current = getCurrentPeriod();
    return current.year === currentYear ? (current.type as Half) : 'H1';
  });
  const currentPeriodLabel = `${currentYear}-${activeTerm}`;
  const periodName = describePeriod(currentPeriodLabel, t);
  // Outside the shell (the chart harness) there is no catalog; assume it exists.
  const periodExists = yearControl ? yearControl.periods.includes(currentPeriodLabel) : true;

  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<Record<string, MonthlyRecord[]>>({}); // Key: ProjectId
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({}); // Key: `${projectId}-${month}-${field}`
  const [pendingChanges, setPendingChanges] = useState<Record<string, MonthlyRecord>>({}); // Key: `${projectId}-${month}`
  const [isSaving, setIsSaving] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDetails, setShowDetails] = useState(readShowDetails);

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectCode, setNewProjectCode] = useState('');
  const [openingNewProject, setOpeningNewProject] = useState(false);
  /** A project just created: scrolled into view and focused once it renders. */
  const [revealId, setRevealId] = useState<string | null>(null);

  const [localFilter, setLocalFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>(MANUAL_ORDER);
  // Dragging and Move up/down rearrange the manual order, so they only make
  // sense while the table is showing it.
  const inManualOrder = sortConfig.key === 'display_order' && sortConfig.direction === 'asc';
  const canReorder = isAdmin && inManualOrder;

  const pendingCount = Object.keys(pendingChanges).length;
  const hasPendingChanges = pendingCount > 0;

  useEffect(() => {
    try {
      window.localStorage.setItem('tracking_showDetails', showDetails ? '1' : '0');
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
  }, [showDetails]);

  /**
   * Text fields save themselves 500ms after the last keystroke; this is the
   * brief "Saved" that says the edit landed.
   */
  const [autosaved, setAutosaved] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markAutosaved = useCallback(() => {
    setAutosaved(true);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => setAutosaved(false), 2000);
  }, []);
  useEffect(() => () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
  }, []);

  // Latest pending edits, readable from effects without re-running them.
  const pendingChangesRef = useRef(pendingChanges);
  useEffect(() => {
    pendingChangesRef.current = pendingChanges;
  }, [pendingChanges]);

  // U3 bookkeeping: the period the view is currently showing, and whether the
  // shell has just asked the user to confirm leaving with unsaved edits.
  const periodRef = useRef(currentPeriodLabel);
  const leaveConfirmedRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setProjects(items => {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);

      // Optimistic: display_order follows the new array position (1-based).
      const updatedItems = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
        ...item,
        display_order: index + 1,
      }));

      const updates = updatedItems.map(p => ({ id: p.id, display_order: p.display_order || 0 }));
      log.debug('Saving new order for', updates.length, 'items');
      dbService.updateProjectDisplayOrders(updates)
        .then(() => log.debug('Order saved successfully'))
        .catch(err => {
          log.error('Failed to update order', err);
          toast.error(t('tracker.reorderFailed', 'Could not save the new order. Please refresh.'));
        });

      return updatedItems;
    });
  };

  /** Debounced project-field saves by key: the timer, and the save it will run. */
  const debouncedSaves = useRef<Record<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const year = currentYear;
  const periodType = activeTerm as PeriodType;
  const months = useMemo(() => getMonthsForPeriod(periodType), [periodType]);

  /**
   * Runs every debounced project-field save now instead of waiting. The screen
   * already shows those edits as made, so leaving the page or the period within
   * the debounce must not drop them; each save keeps the period it was typed in.
   */
  const flushDebouncedSaves = useCallback(() => {
    const saves = Object.values(debouncedSaves.current);
    debouncedSaves.current = {};
    saves.forEach(({ timer, run }) => {
      clearTimeout(timer);
      run();
    });
  }, []);

  /**
   * The single place that throws pending edits away. Every caller has already
   * obtained the user's consent — nothing else may clear `pendingChanges`.
   */
  const discardPendingChanges = useCallback(() => {
    flushDebouncedSaves();
    leaveConfirmedRef.current = false;
    setPendingChanges({});
  }, [flushDebouncedSaves]);

  /** Asks before losing edits. Resolves true when it is safe to continue. */
  const confirmDiscardPending = useCallback(async (): Promise<boolean> => {
    if (Object.keys(pendingChangesRef.current).length === 0) return true;
    return confirm({
      title: t('tracker.unsavedTitle', 'Unsaved changes'),
      message: t('tracker.unsavedLeaveConfirm', 'You have unsaved changes. Leave without saving?'),
      confirmLabel: t('common.leave', 'Leave'),
      cancelLabel: t('common.stay', 'Stay'),
      danger: true,
    });
  }, [confirm, t]);

  const handleTermChange = useCallback(async (term: Half) => {
    if (term === activeTerm) return;
    if (!(await confirmDiscardPending())) return; // user chose to stay — abort the switch
    discardPendingChanges();
    setActiveTerm(term);
  }, [activeTerm, confirmDiscardPending, discardPendingChanges]);

  const formatMonthLabel = useCallback((month: number) => {
    if (language === 'ja') return `${month}月`;
    if (language === 'vn') return `Tháng ${month}`;
    return new Date(2000, month - 1).toLocaleString(localeTagFor(language), { month: 'short' });
  }, [language]);

  const handleSort = (key: SortKey) => {
    const next: SortConfig = {
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    };
    setSortConfig(next);
    if (next.key !== 'display_order' || next.direction !== 'asc') setIsEditMode(false);
  };

  const handleMoveProject = async (projectId: string, direction: 'up' | 'down') => {
    const currentIndex = projects.findIndex(p => p.id === projectId);
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === projects.length - 1) return;

    // Optimistic: swap the two rows and their display_order.
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const current = projects[currentIndex];
    const target = projects[targetIndex];
    const next = [...projects];
    next[currentIndex] = { ...target, display_order: current.display_order };
    next[targetIndex] = { ...current, display_order: target.display_order };
    setProjects(next);

    try {
      if (direction === 'up') {
        await dbService.moveProjectUp(projectId, currentPeriodLabel);
      } else {
        await dbService.moveProjectDown(projectId, currentPeriodLabel);
      }
    } catch (error) {
      log.error('Failed to move project', error);
      toast.error(t('tracker.moveFailed', 'Could not move the project. Please refresh.'));
    }
  };

  const query = localFilter.trim().toLowerCase();

  const filteredAndSortedProjects = useMemo(() => {
    let result = projects;

    if (query) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        (p.type ?? '').toLowerCase().includes(query)
      );
    }

    return [...result].sort((a, b) => {
      const aValue = a[sortConfig.key] ?? '';
      const bValue = b[sortConfig.key] ?? '';
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [projects, query, sortConfig]);

  // `t` is memoised per language. Making it a dependency of the fetch would
  // refetch on every language switch, so the ref keeps the error toast localised
  // without tying data loading to the language.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Switching periods quickly must not let an older response land last.
  const loadSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const [projectsData, recordsData] = await Promise.all([
        dbService.getProjects(currentPeriodLabel),
        dbService.getRecords(currentPeriodLabel)
      ]);
      if (seq !== loadSeqRef.current) return;

      setProjects(projectsData);

      const groupedRecords: Record<string, MonthlyRecord[]> = {};
      recordsData.forEach(r => {
        if (!groupedRecords[r.project_id]) groupedRecords[r.project_id] = [];
        groupedRecords[r.project_id].push(r);
      });
      setRecords(groupedRecords);
    } catch (error) {
      if (seq !== loadSeqRef.current) return;
      log.error('Failed to load data', error);
      setLoadError(true);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [currentPeriodLabel]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Leaving the page saves what is still waiting on its debounce.
  useEffect(() => flushDebouncedSaves, [flushDebouncedSaves]);

  /* ---------------------------------------------------------------- *
   * New project
   * ---------------------------------------------------------------- */

  const handleOpenNewProject = async () => {
    setOpeningNewProject(true);
    try {
      setNewProjectCode(await dbService.getNextProjectCode(currentPeriodLabel));
    } catch (error) {
      // Never swallowed: the dialog still opens, with an empty code the user can type.
      log.error('Failed to generate project code', error);
      setNewProjectCode('');
      toast.error(t('toast.codeFailed', 'Could not generate a project code'));
    } finally {
      setOpeningNewProject(false);
      setNewProjectOpen(true);
    }
  };

  /**
   * Only the project list is refetched: reloading the hours as well would put
   * the saved values back over any edits that are still pending.
   */
  const handleProjectCreated = async (created: Project) => {
    try {
      const projectsData = await dbService.getProjects(currentPeriodLabel);
      setProjects(projectsData);
      setLocalFilter('');
      setRevealId(created.id);
    } catch (error) {
      log.error('Failed to refresh projects', error);
    }
  };

  // Once the new project has rendered: bring it into view, ready for hours.
  useEffect(() => {
    if (!revealId) return;
    const row = scrollContainerRef.current?.querySelector<HTMLElement>(`[data-project="${revealId}"]`);
    if (!row) return;
    row.scrollIntoView({ block: 'center' });
    row.querySelector<HTMLInputElement>('input[data-hour-cell]')?.focus({ preventScroll: true });
    setRevealId(null);
  }, [revealId, filteredAndSortedProjects]);

  /* ---------------------------------------------------------------- *
   * U3 — unsaved-changes guard
   * ---------------------------------------------------------------- */

  // (a) Navigation: while hours are unsaved, the shell calls confirmNavigation()
  // before every route/year change it controls, and so does browser Back or
  // Forward; each only proceeds when this resolves true.
  useEffect(() => {
    if (!hasPendingChanges) return;
    return setNavigationBlocker(async () => {
      const hadEdits = Object.keys(pendingChangesRef.current).length > 0;
      const leave = await confirmDiscardPending();
      if (leave && hadEdits) leaveConfirmedRef.current = true;
      return leave;
    });
  }, [hasPendingChanges, confirmDiscardPending]);

  // (b) Refresh / tab close.
  useEffect(() => {
    if (pendingCount === 0) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingCount]);

  // (c) The period changed. Edits are only thrown away once the user has agreed:
  // H1/H2 clears them in handleTermChange, and a year change from the shell
  // passes through the blocker above. If neither happened the edits are kept
  // (each pending record carries its own period_label, so Save still writes
  // them to the period they were typed in) and the user is told.
  useEffect(() => {
    if (periodRef.current === currentPeriodLabel) return;
    periodRef.current = currentPeriodLabel;

    // Debounced project-field saves belong to the period being left: save them now.
    flushDebouncedSaves();

    if (Object.keys(pendingChangesRef.current).length === 0) return;

    if (leaveConfirmedRef.current) {
      leaveConfirmedRef.current = false;
      setPendingChanges({});
      return;
    }

    toast.warning(
      t('tracker.unsavedKept', 'Your unsaved changes were kept. Press Save to store them.')
    );
  }, [currentPeriodLabel, flushDebouncedSaves, toast, t]);

  /** Cell keys the per-cell save indicator watches for one record. */
  const savingKeysFor = (record: MonthlyRecord): string[] => [
    `${record.project_id}-${record.month}-planned_hours`,
    `${record.project_id}-${record.month}-actual_hours`,
  ];

  const handleSaveAll = async () => {
    const snapshot = pendingChanges;
    const changesToSave: MonthlyRecord[] = Object.values(snapshot);
    if (changesToSave.length === 0) {
      toast.info(t('toast.nothingToSave', 'No changes to save'));
      return;
    }

    setIsSaving(true);
    const inFlight: Record<string, boolean> = {};
    changesToSave.forEach(record => savingKeysFor(record).forEach(key => { inFlight[key] = true; }));
    setSavingStatus(inFlight);

    try {
      for (const record of changesToSave) {
        await dbService.upsertRecord({
          project_id: record.project_id,
          period_label: record.period_label,
          year: record.year,
          month: record.month,
          planned_hours: record.planned_hours || 0,
          actual_hours: record.actual_hours || 0
        });
        setSavingStatus(prev => {
          const next = { ...prev };
          savingKeysFor(record).forEach(key => { delete next[key]; });
          return next;
        });
      }

      // Only what was saved: a cell typed into while the requests were out is
      // a new object under its key, and stays pending.
      setPendingChanges(prev => {
        const next = { ...prev };
        for (const [key, record] of Object.entries(snapshot)) {
          if (next[key] === record) delete next[key];
        }
        return next;
      });
      leaveConfirmedRef.current = false;
      // Dashboard, TotalView and YearlyDataView refetch on this event — keep it.
      window.dispatchEvent(new CustomEvent('dataUpdated'));
      toast.success(plural(t, 'tracker.saved', changesToSave.length, 'Saved {count} changes'));
    } catch (err) {
      log.error('Batch save failed:', err);
      toast.error(t('toast.saveFailed', 'Save failed'));
    } finally {
      setSavingStatus({});
      setIsSaving(false);
    }
  };

  /**
   * Ctrl/Cmd+S saves the hours.
   *
   * Hours are held until Save is pressed, and the reflex for keeping work is
   * Ctrl+S - which, unhandled, opened the browser's Save Page dialog over a
   * table of unsaved edits.
   */
  const canSaveRef = useRef(false);
  canSaveRef.current = isAdmin && hasPendingChanges && !isSaving;
  const saveAllRef = useRef(handleSaveAll);
  saveAllRef.current = handleSaveAll;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (!canSaveRef.current) return;
      void saveAllRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /**
   * Enter walks down a month's column, Shift+Enter back up.
   *
   * Hours are entered a month at a time, down the list of projects; without
   * this that means a mouse click per cell, or Tab across a row nobody is
   * filling in that order.
   */
  const handleHourKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const cell = event.currentTarget.dataset.hourCell;
    if (!cell) return;
    const column = Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[data-hour-cell="${cell}"]`)
    );
    const next = column[column.indexOf(event.currentTarget) + (event.shiftKey ? -1 : 1)];
    next?.focus();
    next?.select();
  };

  const handleValueChange = (
    projectId: string,
    month: number,
    field: 'planned_hours' | 'actual_hours',
    value: string
  ) => {
    if (!isAdmin) return;
    const numValue = value === '' ? 0 : parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

    // A fresh edit invalidates any earlier "leave without saving" prompt.
    leaveConfirmedRef.current = false;

    const currentRecord = records[projectId]?.find(r => r.month === month);
    const otherField = field === 'planned_hours' ? 'actual_hours' : 'planned_hours';
    const otherFieldValue = currentRecord?.[otherField] || 0;

    setRecords(prev => {
      const projectRecords = prev[projectId] ? [...prev[projectId]] : [];
      const existingIndex = projectRecords.findIndex(r => r.month === month);

      if (existingIndex >= 0) {
        projectRecords[existingIndex] = { ...projectRecords[existingIndex], [field]: numValue };
      } else {
        projectRecords.push({
          project_id: projectId,
          period_label: currentPeriodLabel,
          year,
          month,
          planned_hours: field === 'planned_hours' ? numValue : otherFieldValue,
          actual_hours: field === 'actual_hours' ? numValue : otherFieldValue
        });
      }
      return { ...prev, [projectId]: projectRecords };
    });

    const changeKey = `${projectId}-${month}`;
    setPendingChanges(prev => {
      const existingChange = prev[changeKey];
      if (existingChange) {
        return {
          ...prev,
          [changeKey]: { ...existingChange, [field]: numValue }
        };
      }
      return {
        ...prev,
        [changeKey]: {
          project_id: projectId,
          period_label: currentPeriodLabel,
          year,
          month,
          planned_hours: field === 'planned_hours' ? numValue : otherFieldValue,
          actual_hours: field === 'actual_hours' ? numValue : otherFieldValue
        }
      };
    });
  };

  const handleDeleteProject = async (project: Project) => {
    if (!isAdmin) return;

    const accepted = await confirm({
      title: t('tracker.confirmDeleteTitle', 'Delete {name}?').replace('{name}', project.name),
      message: t(
        'tracker.confirmDeleteProject',
        'It is removed from every period, together with all its recorded hours. To stop tracking it in {period} only, remove it from the period in Periods instead.'
      ).replace('{period}', periodName),
      confirmLabel: t('common.delete', 'Delete'),
      cancelLabel: t('common.cancel', 'Cancel'),
      danger: true,
    });
    if (!accepted) return;

    try {
      await dbService.deleteProjects([project.id]);
      setProjects(prev => prev.filter(p => p.id !== project.id));
      setRecords(prev => {
        const updated = { ...prev };
        delete updated[project.id];
        return updated;
      });
      // Its unsaved hours would otherwise be written back for a project that is gone.
      setPendingChanges(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key].project_id === project.id) delete next[key];
        }
        return next;
      });
      window.dispatchEvent(new CustomEvent('dataUpdated'));
      toast.success(t('toast.deleted', 'Deleted'));
    } catch (error) {
      log.error('Failed to delete projects', error);
      toast.error(t('toast.deleteFailed', 'Delete failed'));
    }
  };

  const handleUpdateProject = async (id: string, updates: Partial<Project>, debounceMs = 0) => {
    if (!isAdmin) return;
    try {
      // 1. Optimistic update (Immediate UI change)
      setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));

      // 2. Prepare logic for API call
      // Throws: the debounced path reports its own failure, the edit dialog reports the other.
      const performSave = async () => {
        // Separate price updates from other updates
        const priceUpdates: { plan_price?: number; actual_price?: number } = {};
        const otherUpdates: Partial<Project> = { ...updates };

        let hasPriceUpdates = false;
        if ('plan_price' in updates) {
          priceUpdates.plan_price = updates.plan_price;
          delete otherUpdates.plan_price;
          hasPriceUpdates = true;
        }
        if ('actual_price' in updates) {
          priceUpdates.actual_price = updates.actual_price;
          delete otherUpdates.actual_price;
          hasPriceUpdates = true;
        }

        // Prices are set for every period of the year at once.
        if (hasPriceUpdates) {
          const priceYear = parseInt(currentPeriodLabel.split('-')[0]);
          if (!isNaN(priceYear)) {
            await dbService.updateProjectPriceForYear(id, priceYear, priceUpdates);
          } else {
            await dbService.updateProjectPriceForPeriod(id, currentPeriodLabel, priceUpdates);
          }
        }

        // Everything else lives on the project itself.
        if (Object.keys(otherUpdates).length > 0) {
          await dbService.updateProject(id, otherUpdates);
        }

        window.dispatchEvent(new CustomEvent('dataUpdated'));
        markAutosaved();
      };

      // 3. Execute with debounce logic
      if (debounceMs > 0) {
        // One timer per project and set of fields, so typing in two cells saves both.
        const key = `proj-${id}-${Object.keys(updates).sort().join('-')}`;
        const run = () => {
          delete debouncedSaves.current[key];
          performSave().catch(error => {
            log.error('Failed to save project update', error);
            toast.error(t('toast.saveFailed', 'Save failed'));
          });
        };
        const waiting = debouncedSaves.current[key];
        if (waiting) clearTimeout(waiting.timer);
        debouncedSaves.current[key] = { timer: setTimeout(run, debounceMs), run };
      } else {
        await performSave();
      }
    } catch (error) {
      log.error('Failed to update project', error);
      throw error;
    }
  };

  const handleProjectFieldChange = (id: string, field: keyof Project, value: string) => {
    // Use 500ms debounce for text fields to balance responsiveness and API load
    void handleUpdateProject(id, { [field]: value }, 500);
  };

  /* ---------------------------------------------------------------- *
   * Layout
   * ---------------------------------------------------------------- */

  const planLabel = t('tracker.planShort', 'Plan');
  const actualLabel = t('tracker.actualShort', 'Actual');
  const reorderHint = inManualOrder ? undefined : t('tracker.sortDisabled', 'Sort by No. to reorder');
  const today = new Date();
  const thisMonth = today.getFullYear() === currentYear ? today.getMonth() + 1 : null;
  const listIsEmpty = !loading && !loadError && projects.length === 0;

  const cellLabel = (kind: string, month: number, name: string) =>
    t('tracker.cellLabel', '{kind} hours, {month}, {name}')
      .replace('{kind}', kind)
      .replace('{month}', formatMonthLabel(month))
      .replace('{name}', name);

  const newProjectButton = (variant: 'primary' | 'secondary') => (
    <Button
      variant={variant}
      onClick={() => { void handleOpenNewProject(); }}
      isLoading={openingNewProject}
      disabled={loading}
      icon={<Plus className="h-4 w-4" aria-hidden="true" />}
    >
      {t('modals.project.title', 'New project')}
    </Button>
  );

  const header = {
    title: t('nav.tracking', 'Project tracking'),
    description: t('tracker.desc', 'Planned and actual hours for each project, month by month'),
    actions: (
      <>
        <YearControl />
        <YearExportButton />
        {isAdmin && periodExists && !listIsEmpty && newProjectButton('secondary')}
      </>
    ),
  };

  const halfOptions = (['H1', 'H2'] as const).map(half => ({
    value: half,
    label: (
      <>
        {half}
        <span className="ml-1.5 hidden font-normal text-slate-600 sm:inline dark:text-slate-400">{halfMonths(half, t)}</span>
      </>
    ),
    title: `${half} (${halfMonths(half, t)})`,
  }));

  let body: React.ReactNode;
  if (loading) {
    body = <GridSkeleton />;
  } else if (loadError) {
    body = (
      <EmptyState
        tone="error"
        title={t('tracker.loadFailedTitle', 'Could not load the projects')}
        description={t('empty.loadFailedHint', 'The request did not come back. Check the connection and try again.')}
        actions={<Button variant="secondary" onClick={() => { void fetchData(); }}>{t('buttons.retry', 'Try again')}</Button>}
      />
    );
  } else if (!periodExists && projects.length === 0) {
    body = (
      <EmptyState
        icon={CalendarRange}
        title={t('tracker.periodMissingTitle', '{period} isn’t set up yet').replace('{period}', periodName)}
        description={
          isAdmin
            ? t('tracker.periodMissingAdmin', 'Set it up in Periods, with the projects to track in it.')
            : t('tracker.periodMissingViewer', 'An administrator sets up periods.')
        }
        actions={
          isAdmin && (
            <Link to="/period-management" className={buttonClasses('secondary')}>
              {t('tracker.goToPeriods', 'Go to Periods')}
            </Link>
          )
        }
      />
    );
  } else if (projects.length === 0) {
    body = (
      <EmptyState
        title={t('tracker.emptyTitle', 'No projects in {period}').replace('{period}', periodName)}
        description={
          isAdmin
            ? t('tracker.emptyAdmin', 'Add the first project to start recording hours.')
            : t('tracker.emptyViewer', 'Projects appear here once an administrator adds them.')
        }
        actions={isAdmin && newProjectButton('primary')}
      />
    );
  } else if (filteredAndSortedProjects.length === 0) {
    body = (
      <EmptyState
        icon={Search}
        title={t('periodManagement.noMatch', 'No projects match “{query}”.').replace('{query}', localFilter.trim())}
        actions={<Button variant="secondary" onClick={() => setLocalFilter('')}>{t('tracker.clearSearch', 'Clear search')}</Button>}
      />
    );
  } else {
    // The scroll padding keeps a focused cell out from under the frozen header and columns.
    body = (
      <div ref={scrollContainerRef} className="min-h-0 flex-1 scroll-pt-10 scroll-pl-[200px] overflow-auto custom-scrollbar lg:scroll-pl-[296px] xl:scroll-pl-[432px] xl:scroll-pr-[52px]">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table key={currentPeriodLabel} ref={openAtKindColumn} className="w-full min-w-max border-separate border-spacing-0">
            <thead>
              <tr>
                <th scope="col" aria-sort={ariaSort(sortConfig, 'display_order')} style={{ width: W.no, minWidth: W.no }} className={`${HEAD} ${HEAD_NO} text-center`}>
                  <SortHeader label={t('tracker.no', 'No.')} sortKey="display_order" sort={sortConfig} onSort={handleSort} align="center" />
                </th>
                <th scope="col" aria-sort={ariaSort(sortConfig, 'exclusion_mark')} style={{ width: W.excl, minWidth: W.excl }} className={`${HEAD} ${HEAD_EXCL} text-center`}>
                  <SortHeader
                    label={t('tracker.exclusion', 'Excl.')}
                    title={t('tracker.exclusionMark', 'Exclusion mark')}
                    sortKey="exclusion_mark"
                    sort={sortConfig}
                    onSort={handleSort}
                    align="center"
                  />
                </th>
                <th scope="col" data-col="name" aria-sort={ariaSort(sortConfig, 'name')} className={`${HEAD} ${HEAD_NAME} ${NAME_WIDTH} border-r text-left`}>
                  <SortHeader label={t('tracker.projectName', 'Company name')} sortKey="name" sort={sortConfig} onSort={handleSort} />
                </th>
                {showDetails && (
                  <>
                    <th scope="col" style={{ width: W.notes, minWidth: W.notes }} className={`${HEAD} text-left`}>{t('tracker.notes', 'Notes')}</th>
                    <th scope="col" style={{ width: W.software, minWidth: W.software }} className={`${HEAD} text-left`}>{t('tracker.software', 'Software')}</th>
                    <th scope="col" style={{ width: W.content, minWidth: W.content }} className={`${HEAD} border-r text-left`}>{t('tracker.businessContent', 'Business content')}</th>
                  </>
                )}
                <th scope="col" style={{ width: W.rate, minWidth: W.rate }} className={`${HEAD} text-right`}>
                  {t('tracker.rate', 'Rate')}
                  <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{t('unit.yenPerHour', 'JPY/h')}</span>
                </th>
                <th scope="col" data-col="kind" style={{ width: W.kind, minWidth: W.kind }} className={`${HEAD} ${HEAD_KIND} border-r`}>
                  <span className="sr-only">{t('tracker.rowKind', 'Plan or actual')}</span>
                </th>
                {months.map(m => (
                  <th
                    key={m}
                    scope="col"
                    style={{ width: W.month, minWidth: W.month }}
                    aria-current={m === thisMonth ? 'date' : undefined}
                    title={m === thisMonth ? t('tracker.thisMonth', 'This month') : undefined}
                    className={`${HEAD} whitespace-nowrap text-right ${m === thisMonth ? 'text-orange-600! dark:text-orange-400!' : ''}`}
                  >
                    {m === thisMonth && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" aria-hidden="true" />}
                    {formatMonthLabel(m)}
                  </th>
                ))}
                <th scope="col" style={{ width: W.total, minWidth: W.total }} className={`${HEAD} border-l text-right`}>
                  {t('tracker.total', 'Total')}
                </th>
                {isAdmin && (
                  <th scope="col" style={{ width: W.actions, minWidth: W.actions }} className={`${HEAD} ${HEAD_ACTIONS} border-l`}>
                    <span className="sr-only">{t('tracker.actions', 'Actions')}</span>
                  </th>
                )}
              </tr>
            </thead>

            <SortableContext items={filteredAndSortedProjects.map(p => p.id)} strategy={verticalListSortingStrategy}>
              {filteredAndSortedProjects.map((project, index) => {
                const projRecords = records[project.id] || [];
                // getProjects(period) already merged the period_projects prices into
                // the project, so the period tier is empty here; resolvePrices keeps
                // the plan/actual/unit_price fall-through in one place (C1).
                const prices = resolvePrices(null, project);
                const valueFor = (m: number, field: 'planned_hours' | 'actual_hours') =>
                  projRecords.find(r => r.month === m)?.[field] ?? 0;
                const planTotal = months.reduce((sum, m) => sum + valueFor(m, 'planned_hours'), 0);
                const actualTotal = months.reduce((sum, m) => sum + valueFor(m, 'actual_hours'), 0);
                const globalIndex = projects.findIndex(p => p.id === project.id);

                const hourCell = (m: number, field: 'planned_hours' | 'actual_hours') => (
                  <td key={`${field}-${m}`} className={`${SURFACE} px-0.5 py-1 ${field === 'actual_hours' ? ROW_END : ''}`}>
                    <HourCell
                      value={valueFor(m, field)}
                      editable={isAdmin}
                      kind={field === 'planned_hours' ? 'plan' : 'actual'}
                      cellKey={`${field}-${m}`}
                      label={cellLabel(field === 'planned_hours' ? planLabel : actualLabel, m, project.name)}
                      pending={Boolean(pendingChanges[`${project.id}-${m}`])}
                      saving={Boolean(savingStatus[`${project.id}-${m}-${field}`])}
                      format={nf}
                      onChange={value => handleValueChange(project.id, m, field, value)}
                      onKeyDown={handleHourKeyDown}
                    />
                  </td>
                );

                return (
                  <SortableRow key={project.id} id={project.id} disabled={!isEditMode || !canReorder} className="group">
                    {/* Plan */}
                    <tr data-project={project.id}>
                      <td rowSpan={2} style={{ width: W.no, minWidth: W.no }} className={`${SURFACE} ${STICKY_NO} ${ROW_END} px-1 py-2 text-center align-top text-sm tabular-nums text-slate-500 dark:text-slate-400`}>
                        {isEditMode && canReorder
                          ? <DragHandleCell label={t('tracker.dragToReorder', 'Drag to reorder')} />
                          : <span className="inline-block pt-1.5">{index + 1}</span>}
                      </td>
                      <td rowSpan={2} style={{ width: W.excl, minWidth: W.excl }} className={`${SURFACE} ${STICKY_EXCL} ${ROW_END} px-1 py-1 align-top`}>
                        {isAdmin ? (
                          <input
                            type="text"
                            aria-label={`${t('tracker.exclusionMark', 'Exclusion mark')}, ${project.name}`}
                            className={`${CELL_INPUT} h-8 text-center`}
                            value={project.exclusion_mark || ''}
                            onChange={event => handleProjectFieldChange(project.id, 'exclusion_mark', event.target.value)}
                            placeholder="–"
                          />
                        ) : (
                          <span className="block pt-1.5 text-center text-sm text-slate-600 dark:text-slate-300">
                            {project.exclusion_mark || <span className="text-slate-300 dark:text-slate-600">–</span>}
                          </span>
                        )}
                      </td>
                      <th scope="rowgroup" rowSpan={2} className={`${SURFACE} ${STICKY_NAME} ${NAME_WIDTH} ${ROW_END} border-r border-r-slate-200 px-3 py-2 text-left align-top font-normal dark:border-r-slate-800`}>
                        <span className="line-clamp-2 text-sm font-medium leading-5 text-slate-900 dark:text-white" title={project.name}>
                          {project.name}
                        </span>
                        <span className="mt-0.5 block font-mono text-xs text-slate-500 dark:text-slate-400">{project.code}</span>
                      </th>
                      {showDetails && (
                        <>
                          <td rowSpan={2} className={`${SURFACE} ${ROW_END} px-1 py-1 align-top`}>
                            <TextCell
                              value={project.notes || ''}
                              editable={isAdmin}
                              label={`${t('tracker.notes', 'Notes')}, ${project.name}`}
                              onChange={value => handleProjectFieldChange(project.id, 'notes', value)}
                            />
                          </td>
                          <td rowSpan={2} className={`${SURFACE} ${ROW_END} px-1 py-1 align-top`}>
                            <TextCell
                              value={project.software || ''}
                              editable={isAdmin}
                              label={`${t('tracker.software', 'Software')}, ${project.name}`}
                              placeholder="CAD"
                              onChange={value => handleProjectFieldChange(project.id, 'software', value)}
                            />
                          </td>
                          <td rowSpan={2} className={`${SURFACE} ${ROW_END} border-r border-r-slate-200 px-1 py-1 align-top dark:border-r-slate-800`}>
                            <TextCell
                              value={project.type || ''}
                              editable={isAdmin}
                              label={`${t('tracker.businessContent', 'Business content')}, ${project.name}`}
                              onChange={value => handleProjectFieldChange(project.id, 'type', value)}
                            />
                          </td>
                        </>
                      )}
                      <td className={`${SURFACE} px-2 py-1 text-right text-sm tabular-nums text-slate-500 dark:text-slate-400`}>
                        {nf(prices.plan)}
                      </td>
                      <td className={`${SURFACE} ${STICKY_KIND} whitespace-nowrap border-r border-slate-100 px-2 py-1 text-[13px] text-slate-500 dark:border-slate-800 dark:text-slate-400`}>
                        {planLabel}
                      </td>
                      {months.map(m => hourCell(m, 'planned_hours'))}
                      <td className={`${SURFACE} border-l border-slate-100 px-2 py-1 text-right text-sm tabular-nums text-slate-500 dark:border-slate-800 dark:text-slate-400`}>
                        {planTotal === 0 ? <span className="text-slate-300 dark:text-slate-600">–</span> : nf(planTotal)}
                      </td>
                      {isAdmin && (
                        <td rowSpan={2} style={{ width: W.actions, minWidth: W.actions }} className={`${SURFACE} ${ROW_END} xl:sticky xl:right-0 z-10 border-l border-slate-100 px-1 py-1.5 text-center align-top dark:border-slate-800`}>
                          <ProjectActionsMenu
                            projectName={project.name}
                            onEdit={() => setEditingProject(project)}
                            onDelete={() => { void handleDeleteProject(project); }}
                            onMoveUp={() => { void handleMoveProject(project.id, 'up'); }}
                            onMoveDown={() => { void handleMoveProject(project.id, 'down'); }}
                            canMoveUp={canReorder && globalIndex > 0}
                            canMoveDown={canReorder && globalIndex < projects.length - 1}
                            reorderHint={reorderHint}
                          />
                        </td>
                      )}
                    </tr>

                    {/* Actual */}
                    <tr>
                      <td className={`${SURFACE} ${ROW_END} px-2 py-1 text-right text-sm tabular-nums text-slate-600 dark:text-slate-300`}>
                        {nf(prices.actual)}
                      </td>
                      <td className={`${SURFACE} ${STICKY_KIND} ${ROW_END} whitespace-nowrap border-r border-r-slate-100 px-2 py-1 text-[13px] font-medium text-slate-900 dark:border-r-slate-800 dark:text-white`}>
                        {actualLabel}
                      </td>
                      {months.map(m => hourCell(m, 'actual_hours'))}
                      <td className={`${SURFACE} ${ROW_END} border-l border-l-slate-100 px-2 py-1 text-right text-sm font-semibold tabular-nums text-slate-900 dark:border-l-slate-800 dark:text-white`}>
                        {actualTotal === 0 ? <span className="font-normal text-slate-300 dark:text-slate-600">–</span> : nf(actualTotal)}
                      </td>
                    </tr>
                  </SortableRow>
                );
              })}
            </SortableContext>
          </table>
        </DndContext>
      </div>
    );
  }

  // Kept up while a period loads, so the toolbar does not jump on every H1/H2 switch.
  const showGridTools = !loadError && (loading || projects.length > 0);

  return (
    <Page {...header} layout="fill" maxWidth="full">
      <section className={`${cardClasses} flex min-h-0 flex-1 flex-col overflow-hidden`} aria-label={periodName}>
        {/* Toolbar: which half, find a project, how to show it, and saving. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 px-3 py-2.5 sm:px-4 dark:border-slate-800">
          <SegmentedControl
            options={halfOptions}
            value={activeTerm}
            onChange={term => { void handleTermChange(term); }}
            ariaLabel={t('half', 'Half')}
          />

          {showGridTools && (
            <div className="relative order-last w-full sm:order-none sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                type="search"
                controlSize="sm"
                value={localFilter}
                onChange={event => setLocalFilter(event.target.value)}
                placeholder={t('searchPlaceholder', 'Search by name, code or type')}
                aria-label={t('searchProjects', 'Search projects')}
                className="pl-8"
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <div aria-live="polite" className="flex items-center">
              {!isAdmin ? (
                <Badge tone="neutral">
                  <Eye className="h-3 w-3" aria-hidden="true" />
                  {t('common.viewOnly', 'View only')}
                </Badge>
              ) : hasPendingChanges ? (
                <Badge tone="amber">{plural(t, 'tracker.pendingCount', pendingCount, '{count} unsaved changes')}</Badge>
              ) : autosaved ? (
                <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 animate-fade-in dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('tracker.autosaved', 'Saved')}
                </span>
              ) : null}
            </div>

            {showGridTools && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(prev => !prev)}
                aria-pressed={showDetails}
                title={t('tracker.detailsHint', 'Show notes, software and business content')}
                icon={<Columns3 className="h-4 w-4" aria-hidden="true" />}
                className="aria-pressed:bg-slate-100 aria-pressed:text-slate-900 dark:aria-pressed:bg-slate-800 dark:aria-pressed:text-white"
              >
                <span className="sr-only md:not-sr-only">{t('tracker.details', 'Details')}</span>
              </Button>
            )}

            {isAdmin && showGridTools && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditMode(prev => !prev)}
                disabled={!canReorder}
                aria-pressed={isEditMode}
                title={reorderHint ?? t('tracker.reorderHint', 'Drag projects into a new order')}
                icon={isEditMode ? <Check className="h-4 w-4" aria-hidden="true" /> : <ArrowUpDown className="h-4 w-4" aria-hidden="true" />}
                className="aria-pressed:bg-blue-50 aria-pressed:text-blue-700 dark:aria-pressed:bg-blue-500/15 dark:aria-pressed:text-blue-300"
              >
                <span className="sr-only md:not-sr-only">{isEditMode ? t('tracker.done', 'Done') : t('tracker.reorder', 'Reorder')}</span>
              </Button>
            )}

            {isAdmin && (showGridTools || hasPendingChanges) && (
              <Button
                size="sm"
                onClick={() => { void handleSaveAll(); }}
                disabled={!hasPendingChanges}
                isLoading={isSaving}
                title={`${t('common.save', 'Save')} (${SAVE_SHORTCUT})`}
                className="ml-1"
                aria-keyshortcuts="Control+S"
              >
                {isSaving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                <Kbd className="hidden sm:inline-flex">{SAVE_SHORTCUT}</Kbd>
              </Button>
            )}
          </div>
        </div>

        {body}
      </section>

      {editingProject && (
        <EditProjectModal
          project={editingProject}
          isOpen={!!editingProject}
          onClose={() => setEditingProject(null)}
          onSave={handleUpdateProject}
        />
      )}

      {isAdmin && (
        <NewProjectModal
          isOpen={newProjectOpen}
          onClose={() => setNewProjectOpen(false)}
          onSuccess={created => { void handleProjectCreated(created); }}
          initialCode={newProjectCode}
          currentPeriod={currentPeriodLabel}
        />
      )}
    </Page>
  );
};
