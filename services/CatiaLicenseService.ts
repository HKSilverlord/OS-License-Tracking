/**
 * CatiaLicenseService
 *
 * Server-side persistence for the CATIA licence cost/revenue sheet (defect A4).
 * The whole sheet lives in a single row (`id = 'default'`) of
 * `public.catia_license_data` — see db/migration_catia_license.sql.
 *
 * JSON object keys always arrive from PostgREST as strings; this service is the
 * boundary that converts them back to the numeric keys the Zustand store uses.
 */
import { BaseService } from './BaseService';

export interface CatiaLicenseDoc {
  licenseCosts: Record<number, (number | null)[]>;
  licenseRevenues: Record<number, Record<number, number | null>>;
  updatedAt: string | null;
}

/** Primary key of the single document row. */
export const CATIA_DOC_ID = 'default';

/** 2023-09 .. 2027-12 inclusive. */
export const CATIA_MONTH_SLOTS = 52;

interface CatiaLicenseRow {
  license_costs: unknown;
  license_revenues: unknown;
  updated_at: string | null;
}

const toNumberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * `{"1": [...], "2": [...]}` -> `{1: [...52 slots...], 2: [...]}`.
 * Arrays shorter than 52 are padded with null; longer ones are truncated.
 */
const normalizeCosts = (raw: unknown): Record<number, (number | null)[]> => {
  const out: Record<number, (number | null)[]> = {};
  if (!isPlainObject(raw)) return out;

  for (const [key, value] of Object.entries(raw)) {
    const licenseId = Number(key);
    if (!Number.isFinite(licenseId)) continue;
    const source: unknown[] = Array.isArray(value) ? value : [];
    out[licenseId] = Array.from({ length: CATIA_MONTH_SLOTS }, (_unused, index) =>
      toNumberOrNull(source[index]),
    );
  }
  return out;
};

/** `{"1": {"2023": 99.5}}` -> `{1: {2023: 99.5}}`. */
const normalizeRevenues = (raw: unknown): Record<number, Record<number, number | null>> => {
  const out: Record<number, Record<number, number | null>> = {};
  if (!isPlainObject(raw)) return out;

  for (const [key, value] of Object.entries(raw)) {
    const licenseId = Number(key);
    if (!Number.isFinite(licenseId)) continue;

    const byYear: Record<number, number | null> = {};
    if (isPlainObject(value)) {
      for (const [yearKey, yearValue] of Object.entries(value)) {
        const year = Number(yearKey);
        if (!Number.isFinite(year)) continue;
        byYear[year] = toNumberOrNull(yearValue);
      }
    }
    out[licenseId] = byYear;
  }
  return out;
};

export class CatiaLicenseService extends BaseService {
    constructor() {
        super('CatiaLicenseService');
    }

  /**
   * Reads the single document row.
   * Returns `null` when the row does not exist yet or has never been written
   * (empty `license_costs`), so the caller can seed the DB from its local state.
   * Throws on a real database/RLS error.
   */
  async load(): Promise<CatiaLicenseDoc | null> {
    const { data, error } = await this.supabase
      .from('catia_license_data')
      .select('license_costs, license_revenues, updated_at')
      .eq('id', CATIA_DOC_ID)
      .maybeSingle();

    this.handleError(error);

    const row: CatiaLicenseRow | null = data ?? null;
    if (!row) return null;

    const licenseCosts = normalizeCosts(row.license_costs);
    const licenseRevenues = normalizeRevenues(row.license_revenues);

    // `{}` means the row exists but was never populated — treat as "no document".
    if (Object.keys(licenseCosts).length === 0) return null;

    return {
      licenseCosts,
      licenseRevenues,
      updatedAt: row.updated_at ?? null,
    };
  }

  /**
   * Upserts the whole document. Throws on failure (RLS rejects non-admins),
   * so the caller can surface a sync error without discarding local edits.
   */
  async save(doc: Omit<CatiaLicenseDoc, 'updatedAt'>): Promise<void> {
    const { data: authData } = await this.supabase.auth.getUser();
    const updatedBy: string | null = authData?.user?.id ?? null;

    const { error } = await this.supabase
      .from('catia_license_data')
      .upsert(
        {
          id: CATIA_DOC_ID,
          license_costs: doc.licenseCosts,
          license_revenues: doc.licenseRevenues,
          updated_at: new Date().toISOString(),
          updated_by: updatedBy,
        },
        { onConflict: 'id' },
      );

    this.handleError(error);
  }
}

export const catiaLicenseService = new CatiaLicenseService();
