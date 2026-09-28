import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu as MenuIcon } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { AppIcon } from '../ui/AppIcon';
import { Sidebar } from './Sidebar';
import type { AccountInfo, NavGroupDef } from './Sidebar';

const COLLAPSED_KEY = 'sidebar_collapsed';

const readCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The navigation on a phone: the sidebar, slid in over the page. */
const MobileDrawer: React.FC<{
  groups: NavGroupDef[];
  account: AccountInfo;
  onClose: () => void;
}> = ({ groups, account, onClose }) => {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => opener?.focus();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
      return;
    }
    // Keep Tab inside the drawer. The account panel handles its own Tab.
    if (event.key !== 'Tab' || event.defaultPrevented || !panelRef.current) return;
    const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[900] md:hidden" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-slate-950/50 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('shell.navigation', 'Main navigation')}
        className="absolute inset-y-0 left-0 w-[288px] max-w-[85vw] shadow-2xl shadow-black/40 animate-slide-in-left"
      >
        <Sidebar variant="drawer" groups={groups} account={account} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
};

/**
 * The frame around every page: the sidebar on a desktop, a slim bar and a
 * drawer on a phone. Pages bring their own header, so there is no app-wide
 * toolbar competing with it.
 */
export const AppShell: React.FC<{
  groups: NavGroupDef[];
  account: AccountInfo;
  children: React.ReactNode;
}> = ({ groups, account, children }) => {
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // Remembering the choice is best-effort.
      }
      return next;
    });
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950">
      <aside
        className={`hidden shrink-0 overflow-hidden transition-[width] duration-200 ease-out-soft md:block dark:border-r dark:border-white/[0.06] ${
          collapsed ? 'w-[68px]' : 'w-[248px]'
        }`}
      >
        <Sidebar
          variant="rail"
          groups={groups}
          account={account}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white/85 px-2 backdrop-blur-xl md:hidden dark:border-slate-800 dark:bg-slate-900/85">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('shell.openMenu', 'Open menu')}
            aria-expanded={drawerOpen}
            className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <MenuIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <AppIcon size={26} />
          <span className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">
            {t('app.title', 'OS Manager')}
          </span>
        </header>

        <main className="relative min-h-0 flex-1">{children}</main>
      </div>

      {drawerOpen && <MobileDrawer groups={groups} account={account} onClose={() => setDrawerOpen(false)} />}
    </div>
  );
};
