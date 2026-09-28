import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronsUpDown, LogOut, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Sun, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SUPPORTED_LANGUAGES, useLanguage } from '../../contexts/LanguageContext';
import type { SupportedLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemePreference } from '../../contexts/ThemeContext';
import { confirmNavigation, hasNavigationBlocker } from '../../utils/navigationGuard';
import { AppIcon } from '../ui/AppIcon';
import { Badge } from '../ui/Badge';
import { Popover } from '../ui/Popover';
import { SegmentedControl } from '../ui/SegmentedControl';

export interface NavItemDef {
  to: string;
  icon: LucideIcon;
  label: string;
}

export interface NavGroupDef {
  id: string;
  label: string;
  items: NavItemDef[];
}

export interface AccountInfo {
  email: string;
  isAdmin: boolean;
  onSignOut: () => void;
}

interface SidebarProps {
  groups: NavGroupDef[];
  account: AccountInfo;
  /**
   * `rail`: the desktop sidebar, which can fold down to icons.
   * `drawer`: the same navigation on a phone, slid in over the page.
   */
  variant: 'rail' | 'drawer';
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Drawer only: close after a navigation, or from its close button. */
  onClose?: () => void;
}

const ICON_BUTTON =
  'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white';

/** The label a folded rail shows beside an icon on hover and on keyboard focus. */
const RailTooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
  >
    {children}
  </span>
);

const NavItem: React.FC<{ item: NavItemDef; collapsed: boolean; onNavigate?: () => void }> = ({
  item,
  collapsed,
  onNavigate,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const active = location.pathname === item.to;
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      onClick={event => {
        if (active) {
          event.preventDefault();
          onNavigate?.();
          return;
        }
        const newTab = event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0;
        if (newTab || !hasNavigationBlocker()) {
          onNavigate?.();
          return;
        }
        // Never leave a view with unsaved changes without asking. The app's
        // dialog answers later, so the link is held and followed on a yes.
        event.preventDefault();
        void confirmNavigation().then(leave => {
          if (!leave) return;
          navigate(item.to);
          onNavigate?.();
        });
      }}
      className={`group relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150 ${
        collapsed ? 'mx-auto h-10 w-10 justify-center' : 'h-9 gap-3 px-2.5'
      } ${
        active
          ? 'bg-white/10 text-white'
          : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
      }`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
          active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
        }`}
        aria-hidden="true"
      />
      {collapsed ? <RailTooltip>{item.label}</RailTooltip> : <span className="truncate">{item.label}</span>}
    </Link>
  );
};

/** Initial on a neutral disc: the account is identity, not a status. */
const Avatar: React.FC<{ email: string; size?: 'sm' | 'md' }> = ({ email, size = 'sm' }) => (
  <span
    aria-hidden="true"
    className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-b from-slate-400 to-slate-600 font-semibold text-white ${
      size === 'md' ? 'h-10 w-10 text-base' : 'h-8 w-8 text-[13px]'
    }`}
  >
    {email.charAt(0).toUpperCase() || '?'}
  </span>
);

const AccountPanel: React.FC<{ account: AccountInfo; onDone: () => void }> = ({ account, onDone }) => {
  const { t, language, setLanguage } = useLanguage();
  const { preference, setPreference } = useTheme();

  return (
    <div className="w-72">
      <div className="flex items-center gap-3 p-4">
        <Avatar email={account.email} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-white" title={account.email}>
            {account.email}
          </p>
          <Badge tone={account.isAdmin ? 'blue' : 'neutral'} className="mt-1">
            {account.isAdmin ? t('role.administrator', 'Administrator') : t('role.viewer', 'Viewer')}
          </Badge>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 px-4 py-4 dark:border-slate-800">
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t('theme.label', 'Appearance')}</p>
          <SegmentedControl<ThemePreference>
            fullWidth
            size="sm"
            ariaLabel={t('theme.label', 'Appearance')}
            value={preference}
            onChange={setPreference}
            options={[
              { value: 'light', label: t('theme.light', 'Light'), icon: Sun },
              { value: 'dark', label: t('theme.dark', 'Dark'), icon: Moon },
              { value: 'system', label: t('theme.system', 'Auto'), icon: Monitor, title: t('theme.systemHint', 'Follow the device setting') },
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t('language.label', 'Language')}</p>
          <SegmentedControl<SupportedLanguage>
            fullWidth
            size="sm"
            ariaLabel={t('language.select', 'Select language')}
            value={language}
            onChange={setLanguage}
            options={SUPPORTED_LANGUAGES.map(({ code, label }) => ({ value: code, label }))}
          />
        </div>
      </div>

      <div className="border-t border-slate-100 p-1.5 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            onDone();
            account.onSignOut();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4 text-slate-400" aria-hidden="true" />
          {t('nav.signOut', 'Sign out')}
        </button>
      </div>
    </div>
  );
};

/**
 * Where you are and where you can go, plus who you are signed in as.
 *
 * Kept dark in both themes — the one large surface in the app's colours that
 * frames the content — with the current page lifted out in white and its icon
 * in the accent blue.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  groups,
  account,
  variant,
  collapsed: collapsedProp = false,
  onToggleCollapsed,
  onClose,
}) => {
  const { t } = useLanguage();
  const collapsed = variant === 'rail' && collapsedProp;
  const accountRef = useRef<HTMLButtonElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const role = account.isAdmin ? t('role.administrator', 'Administrator') : t('role.viewer', 'Viewer');

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      {/* Brand, and the fold control in the same corner in both states */}
      {collapsed ? (
        <div className="flex h-16 shrink-0 items-center justify-center">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={t('shell.expand', 'Expand sidebar')}
            className="group relative grid h-10 w-10 place-items-center rounded-xl transition-colors hover:bg-white/[0.07]"
          >
            <AppIcon size={30} className="transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0" />
            <PanelLeftOpen
              className="absolute h-[18px] w-[18px] text-slate-200 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden="true"
            />
            <RailTooltip>{t('shell.expand', 'Expand sidebar')}</RailTooltip>
          </button>
        </div>
      ) : (
        <div className="flex h-16 shrink-0 items-center gap-2.5 pl-4 pr-3">
          <AppIcon size={30} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-5 tracking-tight text-white">{t('app.title', 'OS Manager')}</p>
            <p className="truncate text-xs leading-4 text-slate-400">{t('app.subtitle', 'Esuhai Group')}</p>
          </div>
          {variant === 'rail' ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={t('shell.collapse', 'Collapse sidebar')}
              title={t('shell.collapse', 'Collapse sidebar')}
              className={ICON_BUTTON}
            >
              <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close', 'Close')}
              data-autofocus
              className={ICON_BUTTON}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <nav
        aria-label={t('shell.navigation', 'Main navigation')}
        className={`flex-1 px-3 pb-4 pt-2 ${collapsed ? 'overflow-visible' : 'overflow-y-auto custom-scrollbar'}`}
      >
        {groups.map((group, index) => (
          <div key={group.id} className={index > 0 ? 'mt-5' : ''}>
            {collapsed ? (
              index > 0 && <div className="mx-auto mb-4 h-px w-6 bg-white/10" aria-hidden="true" />
            ) : (
              <p className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(item => (
                <li key={item.to}>
                  <NavItem item={item} collapsed={collapsed} onNavigate={onClose} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <button
          ref={accountRef}
          type="button"
          onClick={() => setAccountOpen(open => !open)}
          aria-haspopup="dialog"
          aria-expanded={accountOpen}
          aria-label={collapsed ? `${account.email} · ${role}` : undefined}
          className={`group relative flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/[0.06] ${
            collapsed ? 'justify-center' : ''
          } ${accountOpen ? 'bg-white/[0.06]' : ''}`}
        >
          <Avatar email={account.email} />
          {collapsed ? (
            <RailTooltip>{t('shell.account', 'Account and settings')}</RailTooltip>
          ) : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-5 text-slate-100">{account.email}</span>
                <span className="block truncate text-xs leading-4 text-slate-400">{role}</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            </>
          )}
        </button>
        <Popover
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          anchorRef={accountRef}
          align="start"
          label={t('shell.account', 'Account and settings')}
        >
          <AccountPanel account={account} onDone={() => setAccountOpen(false)} />
        </Popover>
      </div>
    </div>
  );
};
