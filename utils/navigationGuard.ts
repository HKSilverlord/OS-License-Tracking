/**
 * Module-level navigation guard.
 *
 * The app mounts a HashRouter, which is not a data router, so react-router's
 * `useBlocker` is unavailable. Instead a single blocker is registered here and
 * the shell consults `confirmNavigation()` before every route/year change it
 * controls. Browser back/forward and manual hash edits are covered by the
 * `beforeunload` handler in the view that registers the blocker.
 */

/**
 * Resolves true when navigation may go ahead: nothing would be lost, or the
 * user agreed to lose it (asked in the app's own dialog, never window.confirm).
 */
export type NavigationBlocker = () => Promise<boolean>;

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

/** Resolves true when navigation is free or the user agreed to leave. */
export async function confirmNavigation(): Promise<boolean> {
  const blocker = activeBlocker;
  if (!blocker) return true;
  try {
    return await blocker();
  } catch {
    // A broken blocker must never trap the user on a page.
    return true;
  }
}
