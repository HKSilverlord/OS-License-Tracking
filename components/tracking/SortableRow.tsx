import React, { useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../ui/Button';
import { Menu, MenuItem, MenuSeparator } from '../ui/Menu';
import { SortableRowContext } from './sortableRowContext';

/** Wraps a project's rows in a draggable <tbody> so a whole row group moves as one. */
export const SortableRow = ({ children, id, disabled, className = '' }: { children: React.ReactNode, id: string, disabled?: boolean, className?: string }) => {
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

  // dnd-kit's attributes turn the row group into a focusable button and mark it
  // aria-disabled whenever dragging is off - which is most of the time, over rows
  // full of inputs people are meant to type into. The row only wears them when it
  // can actually be dragged.
  return (
    <tbody
      ref={setNodeRef}
      style={style}
      className={`${className} ${isDragging ? 'relative z-50 opacity-95 shadow-lg shadow-slate-900/10' : ''} ${
        disabled ? '' : 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500'
      }`}
      {...(disabled ? {} : attributes)}
    >
      <SortableRowContext.Provider value={{ listeners }}>
        {children}
      </SortableRowContext.Provider>
    </tbody>
  );
};

export const DragHandleCell = ({ label }: { label: string }) => {
  const context = React.useContext(SortableRowContext);
  return (
    <div
      title={label}
      className="mx-auto flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      {...context?.listeners}
    >
      <GripVertical className="h-4 w-4" aria-hidden="true" />
    </div>
  );
};

/**
 * A project's row actions. Only admins get the menu at all — for anyone else
 * there is nothing in it to do.
 */
export const ProjectActionsMenu: React.FC<{
  projectName: string;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Why moving is off, when it is off because the table is sorted. */
  reorderHint?: string;
}> = ({ projectName, onEdit, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown, reorderHint }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = t('tracker.actionsFor', 'Actions for {name}').replace('{name}', projectName);

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={t('tracker.actions', 'Actions')}
        className="text-slate-400"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Menu open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} align="end" minWidth={196} label={label}>
        <MenuItem icon={<Pencil />} onSelect={onEdit}>
          {t('tracker.editDetails', 'Edit details…')}
        </MenuItem>
        <MenuItem icon={<ArrowUp />} onSelect={onMoveUp} disabled={!canMoveUp} title={reorderHint}>
          {t('common.moveUp', 'Move up')}
        </MenuItem>
        <MenuItem icon={<ArrowDown />} onSelect={onMoveDown} disabled={!canMoveDown} title={reorderHint}>
          {t('common.moveDown', 'Move down')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Trash2 />} tone="danger" onSelect={onDelete}>
          {t('tracker.deleteProject', 'Delete project…')}
        </MenuItem>
      </Menu>
    </>
  );
};
