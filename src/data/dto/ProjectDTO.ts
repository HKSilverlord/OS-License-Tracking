/**
 * Project Data Transfer Object
 *
 * Represents the raw structure from Supabase database.
 * Uses snake_case to match database column names.
 * This is in the data layer.
 */

export interface ProjectDTO {
  id: string;
  code: string;
  name: string;
  type: string;
  software: string;
  status: string;
  unit_price: number;
  plan_price: number;
  actual_price: number;
  notes: string;
  exclusion_mark: string;
  display_order: number;
  created_at: string;  // ISO string from Supabase
  period?: string;
}
