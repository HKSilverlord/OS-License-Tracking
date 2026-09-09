/**
 * Supabase Client (Clean Architecture data layer)
 *
 * There must be exactly ONE Supabase client in the app: two `createClient` calls
 * mean two auth instances racing over the same storage key, which shows up as
 * lost or flapping sessions. `lib/supabase.ts` owns it; this module only
 * re-exports it so the `@data/clients/supabaseClient` import path keeps working.
 *
 * Environment variables (read in lib/supabase.ts):
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 */

export { supabase } from '../../../lib/supabase';
