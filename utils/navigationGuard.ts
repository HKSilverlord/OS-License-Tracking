/**
 * Module-level navigation guard.
 *
 * The app mounts a HashRouter, which is not a data router, so react-router's
 * `useBlocker` is unavailable. Instead a single blocker is registered here and
 * the shell consults `confirmNavigation()` before every route/year change it
 * controls. Browser Back and Forward are caught below; a refresh or a closed
 * tab is covered by the `beforeunload` handler in the view that registers the
 * blocker.
 */

/**
 * Resolves true when navigation may go ahead: nothing would be lost, or the
 * user agreed to lose it (asked in the app's own dialog, never window.confirm).
 */
export type NavigationBlocker = () => Promise<boolean>;

let activeBlocker: NavigationBlocker | null = null;

/** The history entry the blocker guards, in react-router's numbering. */
let guardedIndex: number | null = null;

const historyIndex = (state: unknown): number | null => {
  const idx = (state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' ? idx : null;
};

/** Registers the single active blocker; returns an unregister function. Re-registering replaces. */
export function setNavigationBlocker(blocker: NavigationBlocker | null): () => void {
  activeBlocker = blocker;
  guardedIndex = blocker ? historyIndex(window.history.state) : null;
  return () => {
    if (activeBlocker === blocker) {
      activeBlocker = null;
      guardedIndex = null;
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

/*
 * Browser Back and Forward, and a phone's back gesture, move through history
 * without asking anyone: with a HashRouter it is a same-page navigation, so
 * `beforeunload` never fires. While a blocker is registered, a capturing
 * listener on window hears the move before the router does (at the target,
 * capturing listeners run first), keeps it from the router, puts the address
 * back and asks. If the user chooses to leave, the move is made again and this
 * time the router hears it.
 */

/** The pop that puts the address back: the router must not hear it either. */
let restoring = false;
/** The user's move, replayed after they chose to leave: the router must hear it. */
let replaying = false;

const onPopState = (event: PopStateEvent) => {
  if (replaying) {
    replaying = false;
    return;
  }
  if (restoring) {
    restoring = false;
    event.stopImmediatePropagation();
    return;
  }
  const to = historyIndex(event.state);
  // Without both numbers there is no telling how far to go back: let it through.
  if (!activeBlocker || guardedIndex === null || to === null || to === guardedIndex) return;

  event.stopImmediatePropagation();
  const steps = to - guardedIndex;
  restoring = true;
  window.history.go(-steps);
  void confirmNavigation().then(leave => {
    if (!leave) return;
    replaying = true;
    window.history.go(steps);
  });
};

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', onPopState, true);
}
