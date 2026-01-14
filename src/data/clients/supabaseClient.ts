/**
 * Supabase Client
 *
 * IMPORTANT: This code is EXACTLY the same as before.
 * Only the file location has changed (lib/supabase.ts -> data/clients/supabaseClient.ts)
 *
 * Environment variables are still read from Vercel dashboard:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 *
 * NO CHANGES to connection logic or algorithm.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
