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
/** Its address and state, to put back when there is no telling how far away the move went. */
let guardedUrl = '';
let guardedState: unknown = null;

const historyIndex = (state: unknown): number | null => {
  const idx = (state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' ? idx : null;
};

/** Registers the single active blocker; returns an unregister function. Re-registering replaces. */
export function setNavigationBlocker(blocker: NavigationBlocker | null): () => void {
  activeBlocker = blocker;
  guardedIndex = blocker ? historyIndex(window.history.state) : null;
  guardedUrl = window.location.href;
  guardedState = window.history.state;
  return () => {
    if (activeBlocker === blocker) release();
  };
}

function release(): void {
  activeBlocker = null;
  guardedIndex = null;
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
/** A dialog is open for a move of unknown distance: it decides for wherever the address goes next. */
let askingUnnumbered = false;

/*
 * Once the user chooses to leave, the blocker is let go at once rather than when
 * the page unmounts: the router finishes the move in a transition, and a second
 * Back pressed in that time was caught against the page being left, putting its
 * address back over the page the user had moved to.
 */
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
  if (!activeBlocker) return;
  const to = historyIndex(event.state);
  const home = window.location.href === guardedUrl;
  if (to !== null && to === guardedIndex && home) return;

  event.stopImmediatePropagation();
  if (askingUnnumbered) return;

  if (to !== null && guardedIndex !== null && to !== guardedIndex) {
    const steps = to - guardedIndex;
    restoring = true;
    window.history.go(-steps);
    void confirmNavigation().then(leave => {
      if (!leave) return;
      release();
      replaying = true;
      window.history.go(steps);
    });
    return;
  }

  // An entry react-router never numbered: an address typed into the bar, or
  // the history before it (or a number it handed out twice after one). There
  // is no telling how far the move went, so the page stays as it is while the
  // user decides, and further moves meanwhile only change what "leave" means.
  // Staying writes the page's address back as a new entry; leaving lets the
  // router follow the address, unless the moves came back to this page.
  askingUnnumbered = true;
  void confirmNavigation().then(leave => {
    askingUnnumbered = false;
    const moved = window.location.href !== guardedUrl;
    if (!leave) {
      if (moved) window.history.pushState(guardedState, '', guardedUrl);
      return;
    }
    if (!moved) return;
    release();
    replaying = true;
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
};

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', onPopState, true);
}
