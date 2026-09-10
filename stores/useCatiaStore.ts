import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { catiaLicenseService } from '../services/CatiaLicenseService';
import { supabase } from '../lib/supabase';

export type CatiaSyncStatus = 'idle' | 'loading' | 'saving' | 'error';

export interface CatiaState {
  licenseCosts: Record<number, (number | null)[]>;
  licenseRevenues: Record<number, Record<number, number | null>>;

  hydrated: boolean;
  syncStatus: CatiaSyncStatus;
  syncError: string | null;

  updateCost: (licenseId: number, monthIndex: number, value: number | null) => void;
  updateRevenue: (licenseId: number, year: number, value: number | null) => void;
  resetToDefaults: () => void;

  /**
   * Loads the document from Supabase. DB wins over the persisted local copy.
   *
   * `canSeed` must be true only for an admin whose role has actually resolved:
   * an empty document is published from the caller's local values, so seeding
   * on a guess overwrites the shared sheet with this browser's copy.
   */
  hydrate: (options?: { force?: boolean; canSeed?: boolean }) => Promise<void>;
  /** Awaits any pending debounced save (call from a component unmount cleanup). */
  flush: () => Promise<void>;

  getYearlyCost: (year: number) => number;
}

/** Only these two fields are written to localStorage — never functions or sync status. */
export type CatiaPersistedState = Pick<CatiaState, 'licenseCosts' | 'licenseRevenues'>;

// Helper to fill arrays easily
const fillArray = (startIdx: number, endIdx: number, value: number | null, prevArray?: (number | null)[]) => {
  const arr = prevArray ? [...prevArray] : Array(52).fill(null);
  for (let i = startIdx; i <= endIdx; i++) {
    arr[i] = value;
  }
  return arr;
};

// Exact initial state derived from CATIA_LISENCE.xlsx
const defaultLicenseCosts: Record<number, (number | null)[]> = {
  1: fillArray(24, 51, 5.333333333333333, fillArray(12, 23, 31.5, fillArray(0, 11, 20.833333333333332))),
  2: fillArray(24, 51, 5.333333333333333, fillArray(12, 23, 31.5, fillArray(0, 11, 20.833333333333332))),
  3: fillArray(33, 51, 5.333333333333333, fillArray(21, 32, 31.5, fillArray(9, 20, 20.833333333333332))),
  4: fillArray(33, 51, 5.333333333333333, fillArray(21, 32, 31.5, fillArray(9, 20, 20.833333333333332))),
  5: fillArray(19, 30, 20.97222222222222),
  6: fillArray(19, 30, 20.97222222222222),
  7: fillArray(19, 30, 20.97222222222222),
};

const defaultLicenseRevenues: Record<number, Record<number, number | null>> = {
  1: { 2023: 99.5, 2024: 490, 2025: 43.75, 2026: null, 2027: null },
  2: { 2023: 99.5, 2024: 490, 2025: 43.75, 2026: null, 2027: null },
  3: { 2023: null, 2024: 90, 2025: 43.75, 2026: null, 2027: null },
  4: { 2023: null, 2024: 90, 2025: 43.75, 2026: null, 2027: null },
  5: { 2023: null, 2024: null, 2025: 16.333333333333332, 2026: null, 2027: null },
  6: { 2023: null, 2024: null, 2025: 16.333333333333332, 2026: null, 2027: null },
  7: { 2023: null, 2024: null, 2025: 16.333333333333332, 2026: null, 2027: null },
};

// Map year to start and end indices of the 52-month array
const yearIndices: Record<number, [number, number]> = {
  2023: [0, 3],
  2024: [4, 15],
  2025: [16, 27],
  2026: [28, 39],
  2027: [40, 51],
};

const FIRST_LICENSE_ID = 1;
const LAST_LICENSE_ID = 7;
const MONTH_SLOTS = 52;

const emptySlots = (): (number | null)[] =>
  Array.from({ length: MONTH_SLOTS }, () => null);

/**
 * Pure yearly-cost maths — identical semantics to the old `getYearlyCost`:
 * sum the year's month slots (man-yen) across licences 1..7, convert to JPY
 * (x10,000) and round to the nearest whole yen to match Excel.
 *
 * Consumers MUST derive the number from state (e.g.
 * `useCatiaStore(s => computeYearlyCost(s.licenseCosts, year))`) instead of
 * selecting the stable `getYearlyCost` function, otherwise React never
 * re-renders when the CATIA data changes (defect D6).
 */
export function computeYearlyCost(costs: Record<number, (number | null)[]>, year: number): number {
  const indices = yearIndices[year];
  if (!indices) return 0;
  const [startIdx, endIdx] = indices;

  let totalManYen = 0;
  for (let licId = FIRST_LICENSE_ID; licId <= LAST_LICENSE_ID; licId++) {
    const slots = costs[licId];
    if (!slots) continue;
    for (let i = startIdx; i <= endIdx; i++) {
      totalManYen += slots[i] || 0;
    }
  }

  return Math.round(totalManYen * 10000);
}

const cloneDefaultCosts = (): Record<number, (number | null)[]> =>
  JSON.parse(JSON.stringify(defaultLicenseCosts));

const cloneDefaultRevenues = (): Record<number, Record<number, number | null>> =>
  JSON.parse(JSON.stringify(defaultLicenseRevenues));

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
};

// ---------------------------------------------------------------------------
// Debounced write-behind. The timer lives at module scope so it survives view
// remounts; `flush()` cancels the timer and awaits the in-flight request so a
// pending edit is never lost when CatiaLicenseView unmounts.
// ---------------------------------------------------------------------------
const SAVE_DEBOUNCE_MS = 800;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let inFlightSave: Promise<void> | null = null;

/** Never rejects: a failure sets syncStatus 'error' and leaves local values alone. */
const persistNow = async (): Promise<void> => {
  const { licenseCosts, licenseRevenues } = useCatiaStore.getState();
  useCatiaStore.setState({ syncStatus: 'saving', syncError: null });
  try {
    await catiaLicenseService.save({ licenseCosts, licenseRevenues });
    useCatiaStore.setState({ syncStatus: 'idle', syncError: null });
  } catch (error) {
    useCatiaStore.setState({ syncStatus: 'error', syncError: toErrorMessage(error) });
  }
};

/** Queues a save behind any save already running, so writes stay ordered. */
const runSave = (): Promise<void> => {
  const previous = inFlightSave ?? Promise.resolve();
  const next = previous.then(() => persistNow());
  inFlightSave = next;
  void next.then(() => {
    if (inFlightSave === next) inFlightSave = null;
  });
  return next;
};

const scheduleSave = (): void => {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void runSave();
  }, SAVE_DEBOUNCE_MS);
};

const flushSave = async (): Promise<void> => {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
    void runSave();
  }
  const pending = inFlightSave;
  if (pending) await pending;
};

export const useCatiaStore = create<CatiaState>()(
  persist(
    (set, get) => ({
      licenseCosts: cloneDefaultCosts(),
      licenseRevenues: cloneDefaultRevenues(),

      hydrated: false,
      syncStatus: 'idle',
      syncError: null,

      updateCost: (licenseId, monthIndex, value) => {
        set((state) => {
          const next = { ...state.licenseCosts };
          next[licenseId] = [...(next[licenseId] ?? emptySlots())];
          next[licenseId][monthIndex] = value;
          return { licenseCosts: next };
        });
        scheduleSave();
      },

      updateRevenue: (licenseId, year, value) => {
        set((state) => {
          const next = { ...state.licenseRevenues };
          next[licenseId] = { ...next[licenseId] };
          next[licenseId][year] = value;
          return { licenseRevenues: next };
        });
        scheduleSave();
      },

      resetToDefaults: () => {
        set({
          licenseCosts: cloneDefaultCosts(),
          licenseRevenues: cloneDefaultRevenues(),
        });
        if (saveTimer !== null) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        void runSave();
      },

      hydrate: async (options) => {
        const { force = false, canSeed = false } = options ?? {};
        const state = get();
        if (state.hydrated && !force) return;
        if (state.syncStatus === 'loading') return;

        set({ syncStatus: 'loading', syncError: null });
        try {
          // The read below is RLS-scoped. Running it before Supabase has restored
          // the session returns "no row", which the seed branch would misread as
          // "never published" and answer by overwriting the shared document.
          // Stay unhydrated so the next mount retries once auth has settled.
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            set({ syncStatus: 'idle', syncError: null });
            return;
          }

          const doc = await catiaLicenseService.load();
          if (doc) {
            // The database is authoritative — it replaces the persisted local copy.
            set({
              licenseCosts: doc.licenseCosts,
              licenseRevenues: doc.licenseRevenues,
              hydrated: true,
              syncStatus: 'idle',
              syncError: null,
            });
            return;
          }

          // migration_catia_license.sql seeds the row empty, so load() reports
          // "no document" until someone publishes one. Publishing writes THIS
          // browser's values to a sheet everybody shares, so only an admin may do
          // it: RLS rejects everyone else, and a viewer that tried would sit on a
          // permanent sync-error banner over a write they were never allowed.
          if (!canSeed) {
            // Deliberately not `hydrated` — retry on the next mount so a viewer
            // picks up the real sheet as soon as an admin publishes it.
            set({ syncStatus: 'idle', syncError: null });
            return;
          }

          set({ hydrated: true });
          await runSave();
        } catch (error) {
          // Keep the local values; just report that we are out of sync.
          set({ syncStatus: 'error', syncError: toErrorMessage(error) });
        }
      },

      flush: flushSave,

      getYearlyCost: (year) => computeYearlyCost(get().licenseCosts, year),
    }),
    {
      name: 'catia-license-storage',
      partialize: (state): CatiaPersistedState => ({
        licenseCosts: state.licenseCosts,
        licenseRevenues: state.licenseRevenues,
      }),
    },
  ),
);
