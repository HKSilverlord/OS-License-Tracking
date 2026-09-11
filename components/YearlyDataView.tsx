import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Project, MonthlyRecord } from '../types';
import { dbService } from '../services/dbService';
import { buildPriceIndex, lookupPrices } from '../services/pricing';
import type { PriceIndex } from '../services/pricing';
import { formatCurrency } from '../utils/helpers';
import { TABLE_COLUMN_WIDTHS, STICKY_CLASSES } from '../utils/tableStyles';
import { exportTableToCSV, generateCSVFilename } from '../utils/csvExport';
import { Loader2, FileDown, Copy, Check, GripVertical, ListChecks } from 'lucide-react';
import { copyElementToClipboard, generateChartFilename } from '../utils/chartExport';
import { createLogger } from '../utils/logger';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { Skeleton } from './ui/Skeleton';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const log = createLogger('YearlyDataView');

interface YearlyDataViewProps {
  currentYear: number;
}

type SortableHandleProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>;

const SortableRowContext = React.createContext<SortableHandleProps | null>(null);

const SortableYearlyBody: React.FC<{
  project: Project;
  children: React.ReactNode;
}> = ({ project, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <tbody ref={setNodeRef} style={style} className={isDragging ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'bg-white dark:bg-slate-900'}>
      <SortableRowContext.Provider value={{ attributes, listeners }}>
        {children}
      </SortableRowContext.Provider>
    </tbody>
  );
};

const DragHandle = () => {
  const context = React.useContext(SortableRowContext);
  return (
    <td rowSpan={2} className="sticky left-0 z-50 bg-white dark:bg-slate-900 w-8 px-1 text-center cursor-grab active:cursor-grabbing border-b border-slate-200 dark:border-slate-700" {...context?.attributes} {...context?.listeners}>
      <GripVertical className="w-4 h-4 text-slate-400 dark:text-slate-500 mx-auto" />
    </td>
  );
};

/** Revenue of one project for the whole year, priced per (period, project). */
interface ProjectRevenue {
  plan: number;
  actual: number;
}

const EMPTY_PRICE_INDEX: PriceIndex = buildPriceIndex([], []);

/** Referentially stable so hooks that map over it can list it as a dependency. */
const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const YearlyDataView: React.FC<YearlyDataViewProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<Record<string, MonthlyRecord[]>>({});
  // Per-(period, project) prices for the whole year — fetched in ONE request (A5).
  const [priceIndex, setPriceIndex] = useState<PriceIndex>(EMPTY_PRICE_INDEX);
  const [periodLabels, setPeriodLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const dragOffset = isEditMode ? 32 : 0;

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = projects.findIndex(p => p.id === active.id);
    const newIndex = projects.findIndex(p => p.id === over.id);
    const reordered = arrayMove(projects, oldIndex, newIndex);

    setProjects(reordered);

    const updates = reordered.map((p, i) => ({ id: p.id, display_order: i + 1 }));
    try {
      await dbService.updateProjectDisplayOrders(updates);
    } catch (e) {
      log.error('Failed to save order:', e);
      toast.error(t('toast.saveFailed', 'Save failed'));
    }
  };

  // Use shared table styling constants
  const { no: LEFT_NO_WIDTH, nameReadOnly: LEFT_NAME_WIDTH } = TABLE_COLUMN_WIDTHS;
  const { leftCell: stickyLeftClass, leftHeader: stickyLeftHeaderClass, header: stickyHeaderZ, corner: stickyCornerZ } = STICKY_CLASSES;

  // U1 routed every view's year through one shell control, so a user can change
  // year faster than a request completes. Without this guard an older response
  // lands after a newer one and the view shows the wrong year's numbers.
  const loadSeqRef = useRef(0);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `t` is memoised per language, so making it a dependency of the fetch would
  // refetch the year's data on every language switch. The ref keeps the error
  // toast localised without tying data loading to the language.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchData = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      // A5: one year-scoped call replaces getPeriods() + getProjects(period) per period.
      // A1: `yearPrices.index` resolves the price of a (period_label, project_id) pair, so a
      // project priced differently in H1 and H2 keeps BOTH prices instead of the last one won.
      const [yearPrices, recordsData] = await Promise.all([
        dbService.getYearProjectPrices(currentYear),
        dbService.getAllRecords(currentYear)
      ]);

      const relevantProjects = [...yearPrices.projects];

      const groupedRecords: Record<string, MonthlyRecord[]> = {};
      recordsData.forEach(r => {
        if (!groupedRecords[r.project_id]) groupedRecords[r.project_id] = [];
        groupedRecords[r.project_id].push(r);
      });

      // Show projects with >0 hours first, then group by display_order
      relevantProjects.sort((a, b) => {
        const aTotal = Object.values(groupedRecords[a.id] ?? {})
          .reduce((s, r) => s + (r.planned_hours ?? 0) + (r.actual_hours ?? 0), 0);
        const bTotal = Object.values(groupedRecords[b.id] ?? {})
          .reduce((s, r) => s + (r.planned_hours ?? 0) + (r.actual_hours ?? 0), 0);
        if (aTotal > 0 && bTotal === 0) return -1;
        if (aTotal === 0 && bTotal > 0) return 1;
        return (a.display_order ?? 999) - (b.display_order ?? 999);
      });

      if (seq !== loadSeqRef.current) return; // superseded by a newer year
      setProjects(relevantProjects);
      setRecords(groupedRecords);
      setPriceIndex(yearPrices.index);
      setPeriodLabels(yearPrices.periodLabels);
    } catch (error) {
      if (seq !== loadSeqRef.current) return;
      log.error('Failed to load data for Yearly Data View', error);
      toast.error(tRef.current('toast.loadFailed', 'Failed to load data'));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [currentYear, toast]);

  // Don't let the 2s "Copied!" reset fire after the view unmounts.
  useEffect(() => () => {
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * A1/A2 — revenue is summed PER RECORD, priced with the (period_label, project_id) price.
   * A project at 2,500 JPY/h in 2025-H1 and 2,300 JPY/h in 2025-H2 yields
   * H1 hours x 2,500 + H2 hours x 2,300, which is what the Dashboard KPI and the Excel
   * TOTAL row compute from the same index.
   */
  const projectRevenues = useMemo(() => {
    const totals: Record<string, ProjectRevenue> = {};
    projects.forEach(project => {
      let plan = 0;
      let actual = 0;
      (records[project.id] || []).forEach(rec => {
        const prices = lookupPrices(priceIndex, rec.period_label, project.id);
        plan += (rec.planned_hours || 0) * prices.plan;
        actual += (rec.actual_hours || 0) * prices.actual;
      });
      totals[project.id] = { plan, actual };
    });
    return totals;
  }, [projects, records, priceIndex]);

  /**
   * Tooltip listing the per-period unit price of a project, but only when the periods of the
   * year disagree — that is exactly the case the old per-project price map used to flatten.
   */
  const priceBreakdown = (projectId: string, kind: 'plan' | 'actual'): string | undefined => {
    if (periodLabels.length < 2) return undefined;
    const entries = periodLabels.map(label => ({
      label,
      value: lookupPrices(priceIndex, label, projectId)[kind],
    }));
    const distinct = new Set(entries.map(e => e.value));
    if (distinct.size < 2) return undefined;
    return entries.map(e => `${e.label}: ${formatCurrency(e.value)}`).join(' / ');
  };

  // Compute monthly totals for all projects in this year
  const monthlyTotals = useMemo(() => {
    const totals = months.map(m => {
      let planSum = 0;
      let actualSum = 0;
      projects.forEach(project => {
        const projRecords = records[project.id] || [];
        const rec = projRecords.find(r => r.month === m);
        if (rec) {
          planSum += rec.planned_hours || 0;
          actualSum += rec.actual_hours || 0;
        }
      });
      return { month: m, plan: planSum, actual: actualSum };
    });
    return totals;
  }, [projects, records]);

  // Compute accumulated (running) totals from monthlyTotals
  const accumulatedTotals = useMemo(() => {
    let runningPlan = 0;
    let runningActual = 0;
    return monthlyTotals.map(mt => {
      runningPlan += mt.plan;
      runningActual += mt.actual;
      return { month: mt.month, accPlan: runningPlan, accActual: runningActual };
    });
  }, [monthlyTotals]);

  // Listen for data updates from other tabs
  useEffect(() => {
    const handleDataUpdated = () => {
      fetchData();
    };

    window.addEventListener('dataUpdated', handleDataUpdated);
    return () => window.removeEventListener('dataUpdated', handleDataUpdated);
  }, [fetchData]);

  // CSV Export Function
  const handleExportCSV = () => {
    const headers = [
      t('tracker.code'),
      t('tracker.projectName'),
      t('totalView.tableHeader.type'),
      ...months.map(m => m.toString()),
      t('totalView.tableHeader.total'),
      t('totalView.tableHeader.revenue')
    ];

    const rows: string[][] = [];

    // Use current state 'projects' which is already filtered correctly
    projects.forEach(project => {
      const projRecords = records[project.id] || [];
      const monthlyData = months.map(m => {
        const r = projRecords.find(rec => rec.month === m);
        return { plan: r?.planned_hours || 0, actual: r?.actual_hours || 0 };
      });

      const totalPlan = monthlyData.reduce((sum, d) => sum + d.plan, 0);
      const totalActual = monthlyData.reduce((sum, d) => sum + d.actual, 0);
      const revenue = projectRevenues[project.id] ?? { plan: 0, actual: 0 };

      // Plan row
      const planRow = [
        project.code,
        project.name,
        t('tracker.planShort'),
        ...monthlyData.map(d => d.plan > 0 ? d.plan.toString() : '-'),
        totalPlan > 0 ? totalPlan.toString() : '-',
        revenue.plan > 0 ? revenue.plan.toString() : '-'
      ];

      // Actual row
      const actualRow = [
        project.code,
        project.name,
        t('tracker.actualShort'),
        ...monthlyData.map(d => d.actual > 0 ? d.actual.toString() : '-'),
        totalActual > 0 ? totalActual.toString() : '-',
        revenue.actual > 0 ? revenue.actual.toString() : '-'
      ];

      rows.push(planRow);
      rows.push(actualRow);
    });

    exportTableToCSV(headers, rows, generateCSVFilename(`yearly_data_${currentYear}`));
  };

  // Deliberately NOT async: the shared helper has to issue the clipboard write
  // inside this click, so nothing may be awaited before it. The button state
  // rides on the returned promise instead.
  const handleCopyImage = () => {
    const tableElement = document.getElementById('yearly-data-table');
    if (!tableElement) {
      // Silently returning left the button looking like it had done nothing.
      log.error('Copy image: #yearly-data-table is not in the DOM');
      toast.error(t('toast.copyFailed', 'Copy failed'));
      return;
    }

    setIsCopying(true);
    setCopySuccess(false);

    // Un-clipping the scroll container is the CLONE's job (captureElement does
    // it in `onclone`). Doing it here too only reflowed the live page and threw
    // away the scroll position the user was reading at.
    copyElementToClipboard(tableElement, {
      scale: 2,
      fallbackFilename: generateChartFilename(`yearly_data_${currentYear}`, 'png')
    })
      .then(ok => {
        // copyElementToClipboard raises its own toast either way.
        if (!ok) return;
        setCopySuccess(true);
        if (copyResetRef.current) clearTimeout(copyResetRef.current);
        copyResetRef.current = setTimeout(() => setCopySuccess(false), 2000);
      })
      .finally(() => setIsCopying(false));
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-hidden">
        <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-4">
          <Skeleton.Table rows={8} cols={6} />
          <span className="sr-only text-slate-500 dark:text-slate-400">{t('common.loading', 'Loading…')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-hidden space-y-6">

      {/* Table Section */}
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <h3 className="text-md font-bold text-slate-700 dark:text-slate-100">
            {t('totalView.tableHeader.title', 'Yearly Data Table')} - {currentYear}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors shadow-sm border ${
                isEditMode
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900/60'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {isEditMode ? <Check className="w-4 h-4" /> : <ListChecks className="w-4 h-4" />}
              <span className="hidden sm:inline">{isEditMode ? t('tracker.done', '完了') : t('tracker.editOrder', '順序を編集')}</span>
            </button>
            <button
              onClick={handleCopyImage}
              disabled={isCopying}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors shadow-sm ${copySuccess
                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
            >
              {isCopying ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500 dark:text-slate-400" />
              ) : copySuccess ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              )}
              {isCopying ? t('common.loading', 'Loading…') : copySuccess ? t('export.copied', 'Copied!') : t('export.copyImage', 'Copy Image')}
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 dark:bg-emerald-700 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors shadow-sm"
              title={t('buttons.exportTable', 'Export Table')}
            >
              <FileDown className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto relative isolate custom-scrollbar">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
              <table id="yearly-data-table" className="w-full min-w-max border-separate border-spacing-0">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-40">
                  <tr>
                    {isEditMode && <th scope="col" style={{ left: 0, width: '32px' }} className={`px-1 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 ${stickyLeftHeaderClass} ${stickyCornerZ}`}></th>}
                    <th scope="col" style={{ left: dragOffset, width: `${LEFT_NO_WIDTH}px` }} className={`px-3 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                      {t('tracker.no')}
                    </th>
                    <th scope="col" style={{ left: dragOffset + LEFT_NO_WIDTH, width: `${LEFT_NAME_WIDTH}px` }} className={`px-3 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                      {t('tracker.projectName')}
                    </th>
                <th scope="col" className={`px-2 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800`}>
                  {t('totalView.tableHeader.type')}
                </th>

                {months.map(m => (
                  <th key={m} scope="col" className={`px-2 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-20 border-b border-r border-slate-200 dark:border-slate-700 ${stickyHeaderZ}`}>
                    {language === 'ja' ? `${m}月` : m}
                  </th>
                ))}
                <th scope="col" className={`px-2 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-l border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80`}>
                  {t('totalView.tableHeader.total')}
                </th>
                <th scope="col" className={`px-2 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-l border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20`}>
                  {t('totalView.tableHeader.revenue')}
                </th>
              </tr>

              {/* Summary Row: Plan Total */}
              <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700">
                {isEditMode && <td rowSpan={4} style={{ left: 0, width: '32px' }} className={`px-1 py-2 border-b border-slate-300 dark:border-slate-700 ${stickyLeftHeaderClass} ${stickyCornerZ} bg-slate-100 dark:bg-slate-800`}></td>}
                <td style={{ left: dragOffset, width: `${LEFT_NO_WIDTH}px` }} className={`px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 text-center border-b border-slate-300 dark:border-slate-700 ${stickyLeftHeaderClass} ${stickyCornerZ} bg-slate-100 dark:bg-slate-800`} rowSpan={4}>
                  Σ
                </td>
                <td style={{ left: dragOffset + LEFT_NO_WIDTH, width: `${LEFT_NAME_WIDTH}px` }} className={`px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 ${stickyLeftHeaderClass} ${stickyCornerZ} bg-slate-100 dark:bg-slate-800`} rowSpan={4}>
                  {t('totalView.tableHeader.total', 'TOTAL')}
                </td>
                <td className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center border-r border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                  {t('tracker.planShort')}
                </td>
                {monthlyTotals.map((d, idx) => (
                  <td key={`sp-${idx}`} className="px-1 py-2 text-xs font-bold text-right text-slate-600 dark:text-slate-300 border-r border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    {d.plan > 0 ? d.plan.toLocaleString() : '-'}
                  </td>
                ))}
                <td className="px-2 py-2 border-l border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"></td>
                <td className="px-2 py-2 border-l border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"></td>
              </tr>

              {/* Summary Row: Actual Total */}
              <tr className="bg-blue-50/60 dark:bg-blue-900/30 border-b-2 border-slate-300 dark:border-slate-700">
                <td className="px-2 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 text-center border-r border-b-2 border-slate-300 dark:border-slate-700 bg-blue-50/60 dark:bg-blue-900/30">
                  {t('tracker.actualShort')}
                </td>
                {monthlyTotals.map((d, idx) => (
                  <td key={`sa-${idx}`} className="px-1 py-2 text-xs font-bold text-right text-blue-700 dark:text-blue-300 border-r border-b-2 border-slate-300 dark:border-slate-700 bg-blue-50/60 dark:bg-blue-900/30">
                    {d.actual > 0 ? d.actual.toLocaleString() : '-'}
                  </td>
                ))}
                <td className="px-2 py-2 border-l border-b-2 border-slate-300 dark:border-slate-700 bg-blue-50/60 dark:bg-blue-900/30"></td>
                <td className="px-2 py-2 border-l border-b-2 border-slate-300 dark:border-slate-700 bg-blue-50/60 dark:bg-blue-900/30"></td>
              </tr>

              {/* Summary Row: Accumulated Plan Total */}
              <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700">
                <td className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center border-r border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                  {t('tracker.planShort')} (累計)
                </td>
                {accumulatedTotals.map((d, idx) => (
                  <td key={`sap-${idx}`} className="px-1 py-2 text-xs font-bold text-right text-slate-600 dark:text-slate-300 border-r border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    {d.accPlan > 0 ? d.accPlan.toLocaleString() : '-'}
                  </td>
                ))}
                <td className="px-2 py-2 border-l border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"></td>
                <td className="px-2 py-2 border-l border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"></td>
              </tr>

              {/* Summary Row: Accumulated Actual Total */}
              <tr className="bg-blue-50/60 dark:bg-blue-900/30 border-b-2 border-slate-400 dark:border-slate-600">
                <td className="px-2 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 text-center border-r border-b-2 border-slate-400 dark:border-slate-600 bg-blue-50/60 dark:bg-blue-900/30">
                  {t('tracker.actualShort')} (累計)
                </td>
                {accumulatedTotals.map((d, idx) => (
                  <td key={`saa-${idx}`} className="px-1 py-2 text-xs font-bold text-right text-blue-700 dark:text-blue-300 border-r border-b-2 border-slate-400 dark:border-slate-600 bg-blue-50/60 dark:bg-blue-900/30">
                    {d.accActual > 0 ? d.accActual.toLocaleString() : '-'}
                  </td>
                ))}
                <td className="px-2 py-2 border-l border-b-2 border-slate-400 dark:border-slate-600 bg-blue-50/60 dark:bg-blue-900/30"></td>
                <td className="px-2 py-2 border-l border-b-2 border-slate-400 dark:border-slate-600 bg-blue-50/60 dark:bg-blue-900/30"></td>
              </tr>
            </thead>
              {projects.map((project, index) => {
                const projRecords = records[project.id] || [];
                const monthlyData = months.map(m => {
                  const r = projRecords.find(rec => rec.month === m);
                  return { plan: r?.planned_hours || 0, actual: r?.actual_hours || 0 };
                });

                const totalPlan = monthlyData.reduce((sum, d) => sum + d.plan, 0);
                const totalActual = monthlyData.reduce((sum, d) => sum + d.actual, 0);

                // Per-record, per-period pricing (A1/A2) — never a single flattened price.
                const revenue = projectRevenues[project.id] ?? { plan: 0, actual: 0 };
                const planPriceNote = priceBreakdown(project.id, 'plan');
                const actualPriceNote = priceBreakdown(project.id, 'actual');

                return (
                  <SortableYearlyBody key={project.id} project={project}>
                    {/* Plan Row */}
                    <tr className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      {isEditMode && <DragHandle />}
                      <td rowSpan={2} style={{ left: dragOffset, width: `${LEFT_NO_WIDTH}px` }} className={`px-3 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 ${stickyLeftClass} align-top text-center`}>
                        {index + 1}
                      </td>
                      <td rowSpan={2} style={{ left: dragOffset + LEFT_NO_WIDTH, width: `${LEFT_NAME_WIDTH}px` }} className={`px-3 py-3 text-sm text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 ${stickyLeftClass} align-top`}>
                        <div className="truncate w-44" title={project.name}>{project.name}</div>
                      </td>
                      <td className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center border-r border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        {t('tracker.planShort')}
                      </td>
                      {monthlyData.map((d, idx) => (
                        <td key={`p-${idx}`} className="px-1 py-2 text-xs text-right text-slate-500 dark:text-slate-400 border-r border-b border-slate-200 dark:border-slate-700">
                          {d.plan > 0 ? d.plan.toLocaleString() : '-'}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-right border-l border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        {totalPlan > 0 ? totalPlan.toLocaleString() : '-'}
                      </td>
                      <td
                        className="px-2 py-2 text-xs font-bold text-amber-700 dark:text-amber-400 text-right border-l border-b border-slate-200 dark:border-slate-700 bg-amber-50/30 dark:bg-amber-900/20"
                        title={planPriceNote}
                      >
                        {revenue.plan > 0 ? formatCurrency(revenue.plan) : '-'}
                      </td>
                    </tr>

                    {/* Actual Row */}
                    <tr className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-2 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 text-center border-r border-b border-slate-200 dark:border-slate-700 bg-blue-50/30 dark:bg-blue-900/20">
                        {t('tracker.actualShort')}
                      </td>
                      {monthlyData.map((d, idx) => (
                        <td key={`a-${idx}`} className={`px-1 py-2 text-xs text-right border-r border-b border-slate-200 dark:border-slate-700 font-medium ${d.actual > 0 ? 'text-blue-700 dark:text-blue-400 bg-blue-50/10 dark:bg-blue-900/10' : 'text-slate-400 dark:text-slate-500'}`}>
                          {d.actual > 0 ? d.actual.toLocaleString() : '-'}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-xs font-bold text-blue-700 dark:text-blue-400 text-right border-l border-b border-slate-200 dark:border-slate-700 bg-blue-50/30 dark:bg-blue-900/20">
                        {totalActual > 0 ? totalActual.toLocaleString() : '-'}
                      </td>
                      <td
                        className="px-2 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 text-right border-l border-b border-slate-200 dark:border-slate-700 bg-emerald-50/30 dark:bg-emerald-900/20"
                        title={actualPriceNote}
                      >
                        {revenue.actual > 0 ? formatCurrency(revenue.actual) : '-'}
                      </td>
                    </tr>
                  </SortableYearlyBody>
                );
              })}
              </table>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
};
