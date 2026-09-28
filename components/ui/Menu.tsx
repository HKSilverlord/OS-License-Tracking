import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { anchoredStyle, useAnchoredPosition } from './useAnchoredPosition';

const ITEMS =
  '[role="menuitem"]:not([aria-disabled="true"]),' +
  '[role="menuitemcheckbox"]:not([aria-disabled="true"]),' +
  '[role="menuitemradio"]:not([aria-disabled="true"])';

const MenuContext = createContext<{ close: () => void }>({ close: () => {} });

interface MenuProps {
  open: boolean;
  onClose: () => void;
  /** The button that opened the menu: the menu lines up with it and hands focus back to it. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Which edge of the anchor the menu lines up with. */
  align?: 'start' | 'end';
  minWidth?: number;
  label?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Every pop-up list of actions in the app: row actions, export formats.
 *
 * Drawn in a portal so a table's overflow never clips it, and driven from the
 * keyboard the way a menu is expected to be: arrows, Home/End, Esc, Tab to
 * leave.
 */
export const Menu: React.FC<MenuProps> = ({
  open,
  onClose,
  anchorRef,
  align = 'end',
  minWidth = 200,
  label,
  children,
  className = '',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const position = useAnchoredPosition({ open, anchorRef, panelRef: menuRef, align, onDismiss: onClose });

  const close = useCallback(() => {
    onClose();
    anchorRef.current?.focus();
  }, [anchorRef, onClose]);

  // Focus the first item once the menu is in place. Opened with the mouse, the
  // browser keeps the highlight hidden; opened with the keyboard, it shows.
  useEffect(() => {
    if (!open || !position) return;
    const menu = menuRef.current;
    if (menu && !menu.contains(document.activeElement)) {
      (menu.querySelector<HTMLElement>(ITEMS) ?? menu).focus();
    }
  }, [open, position]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEMS) ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (next: number) => items[(next + items.length) % items.length]?.focus();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(index < 0 ? -1 : index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(-1);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case 'Tab':
        // Leaving a menu closes it; Tab then carries on from the button.
        close();
        break;
      default:
        break;
    }
  };

  if (!open) return null;

  return createPortal(
    <MenuContext.Provider value={{ close }}>
      <div
        ref={menuRef}
        role="menu"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-html2canvas-ignore="true"
        style={anchoredStyle(position, minWidth)}
        className={`fixed z-[1100] max-h-[min(420px,calc(100dvh-16px))] overflow-y-auto rounded-xl bg-white p-1 text-sm shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/[0.08] outline-none custom-scrollbar dark:bg-slate-800 dark:shadow-black/40 dark:ring-white/10 ${
          position ? 'animate-scale-in' : ''
        } ${className}`}
      >
        {children}
      </div>
    </MenuContext.Provider>,
    document.body,
  );
};

const ITEM_BASE =
  'flex w-full select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] leading-5 outline-none ' +
  'transition-colors duration-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-45';

// Keyboard focus is shown as the hover highlight, not the ring: in a list of
// rows the highlight is the cursor.
const ITEM_TONE = {
  default:
    'text-slate-700 hover:bg-slate-100 focus-visible:bg-slate-100 ' +
    'dark:text-slate-200 dark:hover:bg-slate-700/70 dark:focus-visible:bg-slate-700/70',
  danger:
    'text-rose-600 hover:bg-rose-50 focus-visible:bg-rose-50 ' +
    'dark:text-rose-400 dark:hover:bg-rose-500/15 dark:focus-visible:bg-rose-500/15',
} as const;

interface MenuItemProps {
  onSelect: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Right-aligned: a shortcut, a state, a count. */
  trailing?: React.ReactNode;
  tone?: keyof typeof ITEM_TONE;
  disabled?: boolean;
  /** Why the item is disabled, shown on hover. */
  title?: string;
  /** Keep the menu open after choosing — for an item that shows its own progress. */
  keepOpen?: boolean;
}

export const MenuItem: React.FC<MenuItemProps> = ({
  onSelect,
  icon,
  children,
  trailing,
  tone = 'default',
  disabled = false,
  title,
  keepOpen = false,
}) => {
  const { close } = useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      title={title}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (disabled) return;
        // Close first so focus is back on the button before the action runs —
        // an action that opens a dialog then returns focus to the right place.
        if (!keepOpen) close();
        onSelect();
      }}
      className={`${ITEM_BASE} ${ITEM_TONE[tone]}`}
    >
      {icon && (
        <span
          className={`grid h-4 w-4 shrink-0 place-items-center [&>svg]:h-4 [&>svg]:w-4 ${
            tone === 'danger' ? '' : 'text-slate-400'
          }`}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing && <span className="ml-3 shrink-0 text-xs text-slate-500 dark:text-slate-400">{trailing}</span>}
    </button>
  );
};

interface MenuCheckItemProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  /** `radio` for one-of-many, `checkbox` for on/off (a preference). */
  kind?: 'checkbox' | 'radio';
  /** Close after choosing. Radio choices usually do; a preference toggle does not. */
  closeOnSelect?: boolean;
}

/** A choice inside a menu, with a check mark on the side that is on. */
export const MenuCheckItem: React.FC<MenuCheckItemProps> = ({
  checked,
  onChange,
  children,
  kind = 'checkbox',
  closeOnSelect = kind === 'radio',
}) => {
  const { close } = useContext(MenuContext);
  return (
    <button
      type="button"
      role={kind === 'radio' ? 'menuitemradio' : 'menuitemcheckbox'}
      aria-checked={checked}
      tabIndex={-1}
      onClick={() => {
        onChange(kind === 'radio' ? true : !checked);
        if (closeOnSelect) close();
      }}
      className={`${ITEM_BASE} ${ITEM_TONE.default}`}
    >
      <span className="grid h-4 w-4 shrink-0 place-items-center text-blue-600 dark:text-blue-400">
        {checked && <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
};

/** A small heading over a group of items. */
export const MenuLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
    {children}
  </div>
);

export const MenuSeparator: React.FC = () => (
  <div role="separator" className="-mx-1 my-1 h-px bg-slate-100 dark:bg-slate-700/70" />
);
