import React from 'react';
import type { useSortable } from '@dnd-kit/sortable';

type SortableListeners = ReturnType<typeof useSortable>['listeners'];

/**
 * Carries the drag listeners from the sortable <tbody> down to the grip cell.
 *
 * They cannot be passed as props: the grip sits several rows deep inside
 * children the row wrapper does not own. Lives in its own file so Fast Refresh
 * still works on the components that use it.
 */
export const SortableRowContext = React.createContext<{ listeners: SortableListeners } | null>(null);
