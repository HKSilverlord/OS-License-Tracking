/**
 * Module-level navigation guard.
 *
 * The app mounts a HashRouter, which is not a data router, so react-router's
 * `useBlocker` is unavailable. Instead a single blocker is registered here and
 * the shell consults `confirmNavigation()` before every route/year change it
 * controls. Browser back/forward and manual hash edits are covered by the
 * `beforeunload` handler in the view that registers the blocker.
 */

/** Returns a human-readable reason to block (already translated), or null when navigation is free. */
export type NavigationBlocker = () => string | null;

let activeBlocker: NavigationBlocker | null = null;

/** Registers the single active blocker; returns an unregister function. Re-registering replaces. */
export function setNavigationBlocker(blocker: NavigationBlocker | null): () => void {
  activeBlocker = blocker;
  return () => {
    if (activeBlocker === blocker) {
      activeBlocker = null;
    }
  };
}

export function hasNavigationBlocker(): boolean {
  return activeBlocker !== null;
}

/**
 * Calls the blocker; if it returns a reason, shows window.confirm(reason) and
 * returns the user's answer; returns true when navigation is free.
 */
export function confirmNavigation(): boolean {
  const blocker = activeBlocker;
  if (!blocker) return true;

  let reason: string | null = null;
  try {
    reason = blocker();
  } catch {
    // A broken blocker must never trap the user on a page.
    return true;
  }

  if (!reason) return true;
  return window.confirm(reason);
}
