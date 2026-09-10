import React, { useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreVertical, Edit, Trash, ArrowUp, ArrowDown, GripVertical, Eye } from 'lucide-react';
import { DropdownMenu } from '../DropdownMenu';
import { SortableRowContext } from './sortableRowContext';

/** Wraps a project's rows in a draggable <tbody> so a whole row group moves as one. */
export const SortableRow = ({ children, id, disabled, className }: { children: React.ReactNode, id: string, disabled?: boolean, className?: string }) => {
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

export const DragHandleCell = ({ disabled }: { disabled?: boolean }) => {
  const context = React.useContext(SortableRowContext);
  return (
    <div
      className={`touch-none flex items-center justify-center p-2 cursor-grab active:cursor-grabbing ${disabled ? 'opacity-30 cursor-not-allowed' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
      {...(disabled ? {} : context?.listeners)}
    >
      <GripVertical className="w-4 h-4" />
    </div>
  );
};

export const ProjectActionsMenu: React.FC<{
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  t: (key: string, defaultVal?: string) => string;
  disableReorder?: boolean;
  isAdmin?: boolean;
}> = ({ onEdit, onDelete, onMoveUp, onMoveDown, t, disableReorder, isAdmin }) => {
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
        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
      >
        <MoreVertical className="w-4 h-4 text-slate-600 dark:text-slate-400" />
      </button>

      <DropdownMenu
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
      >
        <div className="flex flex-col">
          {isAdmin && (
            <>
              <button
                type="button"
                disabled={disableReorder}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp();
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${disableReorder
                  ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
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
                  ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                title={disableReorder ? t('tracker.sortDisabled', 'Sort by No. to reorder') : ''}
              >
                <ArrowDown className="w-4 h-4" />
                {t('common.moveDown', 'Move Down')}
              </button>
              <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
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
                className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
              >
                <Trash className="w-4 h-4" />
                {t('common.delete', 'Delete')}
              </button>
            </>
          )}
          {!isAdmin && (
            <div className="px-3 py-2 text-xs text-slate-500 flex items-center gap-2 uppercase tracking-wider font-semibold">
              <Eye className="w-3 h-3" />
              {t('common.viewOnly', 'View Only')}
            </div>
          )}
        </div>
      </DropdownMenu>
    </>
  );
};
