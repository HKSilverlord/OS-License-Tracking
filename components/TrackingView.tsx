import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Project, MonthlyRecord, PeriodType } from '../types';
import { dbService } from '../services/dbService';
import { getMonthsForPeriod } from '../utils/helpers';
import { TABLE_COLUMN_WIDTHS, STICKY_CLASSES } from '../utils/tableStyles';
import { Save, Loader2, MoreVertical, Edit, Trash, Search, ArrowUpDown, ArrowUp, ArrowDown, GripVertical, Check, ListChecks } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ... imports ...
import { EditProjectModal } from './EditProjectModal';
import { DropdownMenu } from './DropdownMenu';
import { formatCurrency } from '../utils/helpers';

interface TrackingViewProps {
  currentPeriodLabel: string; // e.g. "2024-H1"
  searchQuery: string;
  refreshTrigger?: number; // Trigger to refresh data when project is created
}

// Draggable Row Wrapper
// Draggable Row Wrapper (tbody to hold multiple trs)
const SortableRow = ({ children, id, disabled, className }: { children: React.ReactNode, id: string, disabled?: boolean, className?: string }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: isDragging ? 'relative' as const : undefined,
  };

  return (
    <tbody
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'opacity-90 bg-blue-50 relative z-50' : className}
      {...attributes}
    >
      <SortableRowContext.Provider value={{ listeners }}>
        {children}
      </SortableRowContext.Provider>
    </tbody>
  );
};

const SortableRowContext = React.createContext<{ listeners: any } | null>(null);

const DragHandleCell = ({ disabled }: { disabled?: boolean }) => {
  const context = React.useContext(SortableRowContext);
  return (
    <div
      className={`touch-none flex items-center justify-center p-2 cursor-grab active:cursor-grabbing ${disabled ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-gray-600'}`}
      {...(disabled ? {} : context?.listeners)}
    >
      <GripVertical className="w-4 h-4" />
    </div>
  );
};

const ProjectActionsMenu: React.FC<{
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  t: (key: string, defaultVal?: string) => string;
  disableReorder?: boolean;
}> = ({ project, onEdit, onDelete, onMoveUp, onMoveDown, t, disableReorder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 hover:bg-gray-100 rounded"
      >
        <MoreVertical className="w-4 h-4 text-gray-600" />
      </button>

      <DropdownMenu
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
      >
        <div className="flex flex-col">
          <button
            type="button"
            disabled={disableReorder}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${disableReorder
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-50'
              }`}
            title={disableReorder ? t('tracker.sortDisabled', 'Sort by No. to reorder') : ''}
          >
            <ArrowUp className="w-4 h-4" />
            {t('common.moveUp', 'Move Up')}
          </button>
          <button
            type="button"
            disabled={disableReorder}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${disableReorder
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-50'
              }`}
            title={disableReorder ? t('tracker.sortDisabled', 'Sort by No. to reorder') : ''}
          >
            <ArrowDown className="w-4 h-4" />
            {t('common.moveDown', 'Move Down')}
          </button>
          <div className="border-t border-gray-100 my-1"></div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            {t('common.edit', 'Edit')}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash className="w-4 h-4" />
            {t('common.delete', 'Delete')}
          </button>
        </div>
      </DropdownMenu>
    </>
  );
};


export const TrackingView: React.FC<TrackingViewProps> = ({ currentPeriodLabel, searchQuery, refreshTrigger }) => {
  const { t, language } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<Record<string, MonthlyRecord[]>>({}); // Key: ProjectId
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({}); // Key: `${projectId}-${month}-${field}`
  const [deleting, setDeleting] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, MonthlyRecord>>({}); // Key: `${projectId}-${month}`
  const [isSaving, setIsSaving] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Local Filter & Sort State
  const [localFilter, setLocalFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Project | null; direction: 'asc' | 'desc' }>({ key: 'display_order', direction: 'asc' });

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setProjects((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Optimistic update of display_order
        // We re-assign display_order based on the new array index (1-based)
        const updatedItems = newItems.map((item, index) => ({
          ...item,
          display_order: index + 1
        }));

        // Trigger backend update
        // Trigger backend update
        const updates = updatedItems.map(p => ({ id: p.id, display_order: p.display_order || 0 }));

        console.log("Saving new order for", updates.length, "items");

        // Handle persistence
        dbService.updateProjectDisplayOrders(updates)
          .then(() => console.log("Order saved successfully"))
          .catch(err => {
            console.error("Failed to update order", err);
            alert("Failed to save new order. Please refresh.");
          });

        return updatedItems;
      });
    }
  };

  // Debounce refs
  const debounceTimers = useRef<Record<string, any>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [yearStr, typeStr] = currentPeriodLabel.split('-');
  const year = parseInt(yearStr);
  const periodType = typeStr as PeriodType;
  const months = useMemo(() => getMonthsForPeriod(year, periodType), [year, periodType]);

  const formatMonthLabel = useCallback((month: number) => {
    if (language === 'ja') return `${month}月`;
    if (language === 'vn') return `Tháng ${month}`;
    return new Date(2000, month - 1).toLocaleString('en-US', { month: 'short' });
  }, [language]);

  // Handle Sort
  const handleSort = (key: keyof Project) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Handle Reorder
  const handleMoveProject = async (projectId: string, direction: 'up' | 'down') => {
    // Optimistic Update
    const currentIndex = projects.findIndex(p => p.id === projectId);
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === projects.length - 1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newProjects = [...projects];

    // Swap
    [newProjects[currentIndex], newProjects[targetIndex]] = [newProjects[targetIndex], newProjects[currentIndex]];

    // Update display_order based on new index
    // Assuming backend sorts by display_order, we just need to swap the orders or re-assign
    const currentOrder = newProjects[currentIndex].display_order;
    const targetOrder = newProjects[targetIndex].display_order;

    // Swap display_order property as well to keep consistency
    newProjects[currentIndex].display_order = targetOrder;
    newProjects[targetIndex].display_order = currentOrder;

    setProjects(newProjects);

    try {
      // Call DB Service
      if (direction === 'up') {
        await dbService.moveProjectUp(projectId, currentPeriodLabel);
      } else {
        await dbService.moveProjectDown(projectId, currentPeriodLabel);
      }
    } catch (error) {
      console.error("Failed to move project", error);
      // Revert on error? For now, we assume success or user will refresh
      // fetchData(); // Prevent immediate reload to avoid race conditions/flicker
      alert("Failed to move project. Please refresh."); // Inform user instead
    }
  };


  const filteredAndSortedProjects = useMemo(() => {
    // 1. Filter
    let result = projects;

    // Global Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
      );
    }

    // Local Filter
    if (localFilter.trim()) {
      const q = localFilter.trim().toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
      );
    }

    // 2. Sort
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        const aValue = a[sortConfig.key!] ?? '';
        const bValue = b[sortConfig.key!] ?? '';

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default Sort by display_order
      result = [...result].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    }

    return result;
  }, [projects, searchQuery, localFilter, sortConfig]);

  // Close menu when clicking outside - Removed as DropdownMenu handles it locally
  /*
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);
  */

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsData, recordsData] = await Promise.all([
        dbService.getProjects(currentPeriodLabel),
        dbService.getRecords(currentPeriodLabel)
      ]);

      setProjects(projectsData);

      const groupedRecords: Record<string, MonthlyRecord[]> = {};
      recordsData.forEach(r => {
        if (!groupedRecords[r.project_id]) groupedRecords[r.project_id] = [];
        groupedRecords[r.project_id].push(r);
      });
      setRecords(groupedRecords);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  }, [currentPeriodLabel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh data when a new project is created
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchData().then(() => {
        // Scroll to bottom after data is loaded to show the new project
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
        }, 100);
      });
    }
  }, [refreshTrigger, fetchData]);

  // Cleanup debounce timers on unmount and period change
  useEffect(() => {
    return () => {
      // Clear all pending timers on unmount
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer as any));
      debounceTimers.current = {};
    };
  }, []);

  useEffect(() => {
    // Clear all pending timers and changes when period changes
    Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer as any));
    debounceTimers.current = {};
    setPendingChanges({});
  }, [currentPeriodLabel]);

  const handleSaveAll = async () => {
    const changesToSave: MonthlyRecord[] = Object.values(pendingChanges);
    if (changesToSave.length === 0) {
      alert(t('noChangesToSave', 'No changes to save'));
      return;
    }

    setIsSaving(true);
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
      }

      setPendingChanges({});
      window.dispatchEvent(new CustomEvent('dataUpdated'));
      alert(t('changesSavedSuccessfully', 'All changes saved successfully!'));
    } catch (err: any) {
      console.error('Batch save failed:', err);
      alert(t('saveFailed', 'Failed to save changes. Please try again.') + '\n\nError: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleValueChange = (
    projectId: string,
    month: number,
    field: 'planned_hours' | 'actual_hours',
    value: string
  ) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

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
      } else {
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
      }
    });
  };

  const handleDeleteProjects = async (ids: string[]) => {
    if (!ids.length) return;
    const targets = projects.filter(p => ids.includes(p.id));
    const confirmMessage = ids.length === 1
      ? t('tracker.confirmDeleteOne', 'Delete project "{name}"? This removes its records.').replace('{name}', targets[0]?.name || '')
      : t('tracker.confirmDeleteMany', 'Delete {count} projects and their records?').replace('{count}', `${ids.length}`);
    const nameList = targets.map(t => t.name).join(', ');
    const message = nameList ? `${confirmMessage}\n${nameList}` : confirmMessage;

    if (!window.confirm(message)) return;

    setDeleting(true);
    try {
      await dbService.deleteProjects(ids);
      setProjects(prev => prev.filter(p => !ids.includes(p.id)));
      setRecords(prev => {
        const updated = { ...prev };
        ids.forEach(id => { delete updated[id]; });
        return updated;
      });
    } catch (error) {
      console.error("Failed to delete projects", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateProject = async (id: string, updates: Partial<Project>, debounceMs = 0) => {
    try {
      // 1. Optimistic update (Immediate UI change)
      setProjects(prev => prev.map(p => {
        if (p.id !== id) return p;
        return { ...p, ...updates };
      }));

      // 2. Prepare logic for API call
      const performSave = async () => {
        try {
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

          // If updating prices, update in the junction table for the ALL PERIODS IN THE YEAR
          if (hasPriceUpdates) {
            const year = parseInt(currentPeriodLabel.split('-')[0]);
            if (!isNaN(year)) {
              await dbService.updateProjectPriceForYear(id, year, priceUpdates);
            } else {
              await dbService.updateProjectPriceForPeriod(id, currentPeriodLabel, priceUpdates);
            }
          }

          // If updating other fields, update global project
          if (Object.keys(otherUpdates).length > 0) {
            await dbService.updateProject(id, otherUpdates);
          }

          // Dispatch event only after successful save
          window.dispatchEvent(new CustomEvent('dataUpdated'));
        } catch (error) {
          console.error("Failed to save project update", error);
          // Could revert changes here if strict data integrity needed
        }
      };

      // 3. Execute with debounce logic
      if (debounceMs > 0) {
        // Create a unique key for this project and the fields being updated
        const key = `proj-${id}-${Object.keys(updates).sort().join('-')}`;

        // Clear existing timer for this specific update key
        if (debounceTimers.current[key]) {
          clearTimeout(debounceTimers.current[key]);
        }

        debounceTimers.current[key] = setTimeout(async () => {
          await performSave();
          delete debounceTimers.current[key];
        }, debounceMs);
      } else {
        // Immediate execution
        await performSave();
      }

    } catch (error) {
      console.error("Failed to update project", error);
      alert("Failed to update project");
      throw error;
    }
  };

  const handleProjectFieldChange = (id: string, field: keyof Project, value: string) => {
    // Use 500ms debounce for text fields to balance responsiveness and API load
    handleUpdateProject(id, { [field]: value }, 500);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  // Use shared table styling constants
  const {
    no: LEFT_NO_WIDTH,
    exclusionMark: LEFT_EXCLUSION_WIDTH,
    code: LEFT_CODE_WIDTH,
    name: LEFT_NAME_WIDTH,
    notes: LEFT_NOTES_WIDTH,
    software: LEFT_SOFTWARE_WIDTH,
    businessContent: BUSINESS_CONTENT_WIDTH,
    month: MONTH_WIDTH,
    actions: RIGHT_ACTIONS_WIDTH
  } = TABLE_COLUMN_WIDTHS;

  // New column width for Price
  const PRICE_WIDTH = 100;

  const { leftCell: stickyLeftClass, leftHeader: stickyLeftHeaderClass, rightCell: stickyRightClass, rightHeader: stickyRightHeaderClass, header: stickyHeaderZ, corner: stickyCornerZ } = STICKY_CLASSES;

  const pendingCount = Object.keys(pendingChanges).length;
  const hasPendingChanges = pendingCount > 0;

  // Calculate sticky positions
  // CODE column is effectively hidden (width 0), so we can skip it or it will calculate to same pos
  const POS_EXCLUSION = LEFT_NO_WIDTH;
  const POS_CODE = POS_EXCLUSION + LEFT_EXCLUSION_WIDTH; // If WIDTH is 0, POS_CODE == POS_EXCLUSION
  const POS_NAME = POS_CODE + LEFT_CODE_WIDTH;
  const POS_NOTES = POS_NAME + LEFT_NAME_WIDTH;
  const POS_SOFTWARE = POS_NOTES + LEFT_NOTES_WIDTH;

  return (
    <div className="flex flex-col h-full bg-slate-50 p-2 sm:p-4 md:p-6 overflow-hidden">
      <div className="flex-1 min-h-0 w-full border rounded-lg shadow-sm bg-white relative isolate flex flex-col">
        {/* Save Button Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {t('tracker.title', 'Project Tracking')}
            </h2>
            {hasPendingChanges && (
              <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                {pendingCount} {t('unsavedChanges', 'unsaved changes')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Local Filter Box */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder={t('search.placeholder', 'Search...')}
                className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                value={localFilter}
                onChange={(e) => setLocalFilter(e.target.value)}
              />
            </div>

            {/* Edit Order Toggle */}
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              disabled={sortConfig.key !== 'display_order'}
              title={sortConfig.key !== 'display_order' ? t('tracker.reorderDisabledWithSort', 'Reordering disabled while sorted') : ''}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${isEditMode
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : (sortConfig.key !== 'display_order' ? 'opacity-50 cursor-not-allowed text-slate-400' : 'text-slate-600 hover:bg-slate-100')
                }`}
            >
              {isEditMode ? <Check className="w-4 h-4" /> : <ListChecks className="w-4 h-4" />}
              <span className="hidden sm:inline">{isEditMode ? t('tracker.done', 'Done') : t('tracker.editOrder', 'Edit Order')}</span>
            </button>

            <button
              onClick={handleSaveAll}
              disabled={!hasPendingChanges || isSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${hasPendingChanges && !isSaving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('saving', 'Saving...')}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {t('saveAll', 'Save All')}
                </>
              )}
            </button>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-auto relative isolate custom-scrollbar"
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table key={currentPeriodLabel} className="w-full min-w-max border-separate border-spacing-0">
              <thead className="bg-gray-50 sticky top-0 z-40">
                <tr>
                  <th scope="col" style={{ left: 0, width: `${LEFT_NO_WIDTH}px` }} className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                    <div className="flex items-center justify-center gap-1 cursor-pointer hover:bg-gray-100 rounded" onClick={() => handleSort('display_order')}>
                      {t('tracker.no')}
                      {sortConfig.key === 'display_order' && <ArrowUpDown className={`w-3 h-3 ${sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-blue-600 rotate-180'}`} />}
                    </div>
                  </th>
                  <th scope="col" style={{ left: `${POS_EXCLUSION}px`, width: `${LEFT_EXCLUSION_WIDTH}px` }} className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                    <div className="flex items-center justify-center gap-1 cursor-pointer hover:bg-gray-100 rounded" onClick={() => handleSort('exclusion_mark')}>
                      {t('tracker.exclusion', '除外')}
                      {sortConfig.key === 'exclusion_mark' && <ArrowUpDown className={`w-3 h-3 ${sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-blue-600 rotate-180'}`} />}
                    </div>
                  </th>

                  {/* Code Column - Hidden (Width 0) */}
                  {/* <th ...> - Removed for UI cleanliness, or empty if width 0 is enough to hide? 
                    Since width is 0 in tableStyles, it might still render border/padding. Better to skip rendering or ensure overflow hidden.
                    If we skip rendering, sticky calcs might break if simple CSS logic used. 
                    However, sticky styling is done via inline 'left' styles.
                    Since width is 0, we can render it empty, but best to not render the TH/TD to completely remove it from DOM flow.
                    BUT sticky positions depend on it if we don't adjust logic. 
                    Logic POS_NAME = POS_CODE + LEFT_CODE_WIDTH. If LEFT_CODE_WIDTH is 0, POS_NAME = POS_CODE.
                    So removing the TH/TD is fine as long as we don't assume its existence for other things. 
                    Let's remove it.
                 */}

                  <th scope="col" style={{ left: `${POS_NAME}px`, width: `${LEFT_NAME_WIDTH}px` }} className={`px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                    <div className="flex items-center justify-between gap-1 cursor-pointer hover:bg-gray-100 rounded" onClick={() => handleSort('name')}>
                      {t('tracker.projectName')}
                      {sortConfig.key === 'name' && <ArrowUpDown className={`w-3 h-3 ${sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-blue-600 rotate-180'}`} />}
                    </div>
                  </th>
                  <th scope="col" style={{ left: `${POS_NOTES}px`, width: `${LEFT_NOTES_WIDTH}px` }} className={`px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                    {t('tracker.notes', '補足')}
                  </th>
                  <th scope="col" style={{ left: `${POS_SOFTWARE}px`, width: `${LEFT_SOFTWARE_WIDTH}px` }} className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
                    {t('tracker.software')}
                  </th>

                  <th scope="col" style={{ width: `${BUSINESS_CONTENT_WIDTH}px` }} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b bg-gray-50 border-r">
                    {t('tracker.businessContent')}
                  </th>

                  {/* Price Column */}
                  <th scope="col" style={{ width: `${PRICE_WIDTH}px` }} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b bg-gray-50 border-r">
                    {t('totalView.tableHeader.price', 'Price')} (JPY/h)
                  </th>

                  <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b bg-gray-50 border-r w-16">
                    {t('tracker.type')}
                  </th>

                  {months.map((m) => (
                    <th key={m} scope="col" style={{ width: `${MONTH_WIDTH}px` }} className={`px-1 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 ${stickyHeaderZ}`}>
                      {formatMonthLabel(m)}
                    </th>
                  ))}

                  <th scope="col" className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyRightHeaderClass} ${stickyCornerZ}`} style={{ right: 0, width: `${RIGHT_ACTIONS_WIDTH}px` }}>
                    {t('tracker.actions')}
                  </th>
                </tr>
              </thead>

              <SortableContext items={filteredAndSortedProjects.map(p => p.id)} strategy={verticalListSortingStrategy}>
                {filteredAndSortedProjects.map((project, index) => {
                  const projRecords = records[project.id] || [];

                  return (
                    <SortableRow key={project.id} id={project.id} disabled={!isEditMode || sortConfig.key !== 'display_order'}>
                      {/* ROW 1: Plan */}
                      <tr className="hover:bg-gray-50 group">
                        <td rowSpan={2} style={{ left: 0, width: `${LEFT_NO_WIDTH}px` }} className={`px-2 py-3 text-center text-sm font-medium text-gray-500 ${stickyLeftClass} align-top`}>
                          {isEditMode && sortConfig.key === 'display_order' ? <DragHandleCell /> : index + 1}
                        </td>
                        <td rowSpan={2} style={{ left: `${POS_EXCLUSION}px`, width: `${LEFT_EXCLUSION_WIDTH}px` }} className={`px-1 py-3 text-center text-sm font-medium text-gray-900 ${stickyLeftClass} align-top group-hover:bg-gray-50`}>
                          <input
                            type="text"
                            className="w-full text-center text-xs border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-transparent"
                            value={project.exclusion_mark || ''}
                            onChange={(e) => handleProjectFieldChange(project.id, 'exclusion_mark', e.target.value)}
                            placeholder="-"
                          />
                        </td>

                        {/* Code Column - Hidden */}
                        {/* <td ...>{project.code}</td> */}

                        <td rowSpan={2} style={{ left: `${POS_NAME}px`, width: `${LEFT_NAME_WIDTH}px` }} className={`px-2 py-2 text-sm text-gray-700 border-b ${stickyLeftClass} align-top group-hover:bg-gray-50`}>
                          <div className="font-medium line-clamp-2" title={project.name}>{project.name}</div>
                        </td>
                        <td rowSpan={2} style={{ left: `${POS_NOTES}px`, width: `${LEFT_NOTES_WIDTH}px` }} className={`px-2 py-2 text-xs text-gray-600 border-b ${stickyLeftClass} align-top group-hover:bg-gray-50`}>
                          <textarea
                            className="w-full min-h-[50px] text-xs border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-1 py-1 bg-transparent resize-none overflow-hidden"
                            value={project.notes || ''}
                            onChange={(e) => handleProjectFieldChange(project.id, 'notes', e.target.value)}
                            placeholder=""
                            rows={2}
                          />
                        </td>
                        <td rowSpan={2} style={{ left: `${POS_SOFTWARE}px`, width: `${LEFT_SOFTWARE_WIDTH}px` }} className={`px-2 py-2 text-xs text-gray-600 text-center border-b ${stickyLeftClass} align-top group-hover:bg-gray-50`}>
                          <textarea
                            className="w-full min-h-[50px] text-xs border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-center px-1 py-1 bg-transparent resize-none overflow-hidden"
                            value={project.software || ''}
                            onChange={(e) => handleProjectFieldChange(project.id, 'software', e.target.value)}
                            placeholder="CAD"
                            rows={2}
                          />
                        </td>
                        <td rowSpan={2} style={{ width: `${BUSINESS_CONTENT_WIDTH}px` }} className="px-2 py-2 text-xs text-gray-500 text-center border-r border-b bg-white align-top p-0 group-hover:bg-gray-50">
                          <textarea
                            className="w-full h-full min-h-[50px] border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs p-2 bg-transparent resize-none"
                            value={project.type || ''}
                            onChange={(e) => handleProjectFieldChange(project.id, 'type', e.target.value)}
                            placeholder={t('tracker.businessContent')}
                          />
                        </td>

                        {/* Price Column */}
                        <td style={{ width: `${PRICE_WIDTH}px` }} className="px-2 py-2 text-xs text-gray-500 text-right border-r border-b bg-slate-50 font-mono">
                          {(project.plan_price || project.unit_price || 0).toLocaleString()}
                        </td>

                        <td className="px-2 py-2 text-xs font-semibold text-gray-500 text-center border-r border-b bg-slate-50">
                          {t('tracker.planShort')}
                        </td>

                        {months.map(m => {
                          const record = projRecords.find(r => r.month === m);
                          const plan = record?.planned_hours ?? 0;
                          const isSaving = savingStatus[`${project.id}-${m}-planned_hours`];

                          return (
                            <td key={`p-${m}`} className="px-0.5 py-1 border-r border-b relative" style={{ width: `${MONTH_WIDTH}px` }}>
                              <input
                                type="number"
                                className="w-full text-xs border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-right px-1 py-1 bg-white focus:bg-blue-50 transition-colors"
                                value={plan === 0 ? '' : plan}
                                placeholder="-"
                                onChange={(e) => handleValueChange(project.id, m, 'planned_hours', e.target.value)}
                              />
                              {isSaving && <Save className="w-2 h-2 absolute top-1 right-1 text-blue-500 animate-pulse" />}
                            </td>
                          );
                        })}

                        <td rowSpan={2} className={`px-2 py-3 text-center border-b ${stickyRightClass} align-top`} style={{ right: 0, width: `${RIGHT_ACTIONS_WIDTH}px` }}>
                          <ProjectActionsMenu
                            project={project}
                            onEdit={() => setEditingProject(project)}
                            onDelete={() => handleDeleteProjects([project.id])}
                            onMoveUp={() => handleMoveProject(project.id, 'up')}
                            onMoveDown={() => handleMoveProject(project.id, 'down')}
                            t={t}
                            disableReorder={sortConfig.key !== 'display_order'}
                          />
                        </td>
                      </tr>

                      {/* ROW 2: Actual */}
                      <tr className="hover:bg-gray-50 group">

                        {/* Price Column */}
                        <td style={{ width: `${PRICE_WIDTH}px` }} className="px-2 py-2 text-xs text-emerald-600 text-right border-r border-b bg-emerald-50/10 font-mono">
                          {(project.actual_price || project.unit_price || 0).toLocaleString()}
                        </td>

                        <td className="px-2 py-2 text-xs font-bold text-blue-600 text-center border-r border-b bg-blue-50/30">
                          {t('tracker.actualShort')}
                        </td>

                        {months.map(m => {
                          const record = projRecords.find(r => r.month === m);
                          const actual = record?.actual_hours ?? 0;
                          const isSaving = savingStatus[`${project.id}-${m}-actual_hours`];

                          return (
                            <td key={`a-${m}`} className="px-0.5 py-1 border-r border-b relative" style={{ width: `${MONTH_WIDTH}px` }}>
                              <input
                                type="number"
                                className={`w-full text-xs border-gray-300 rounded focus:ring-green-500 focus:border-green-500 text-right px-1 py-1 transition-colors ${actual > 0 ? 'bg-green-50 font-medium text-green-700' : 'bg-white'}`}
                                value={actual === 0 ? '' : actual}
                                placeholder="-"
                                onChange={(e) => handleValueChange(project.id, m, 'actual_hours', e.target.value)}
                              />
                              {isSaving && <Save className="w-2 h-2 absolute top-1 right-1 text-green-500 animate-pulse" />}
                            </td>
                          );
                        })}
                      </tr>
                    </SortableRow>
                  );
                })}
              </SortableContext>
            </table>
          </DndContext>
        </div>
        {filteredAndSortedProjects.length === 0 && (
          <div className="p-4 sm:p-8 text-center text-gray-500 text-sm sm:text-base">
            {t('tracker.noResults')}
          </div>
        )}
      </div>

      {
        editingProject && (
          <EditProjectModal
            project={editingProject}
            isOpen={!!editingProject}
            onClose={() => setEditingProject(null)}
            onSave={handleUpdateProject}
          />
        )
      }

    </div >
  );
};