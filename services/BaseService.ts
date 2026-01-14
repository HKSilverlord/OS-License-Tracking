
/**
 * BaseService
 * Provides common error handling and Supabase instance access for all services.
 */
import { supabase } from '../lib/supabase';
import { PostgrestError } from '@supabase/supabase-js';

export class BaseService {
    protected supabase = supabase;

    protected handleError(error: PostgrestError | null) {
        if (error) {
            console.error(`[${this.constructor.name}] Database Error:`, error);
            throw error;
        }
    }

    protected handleUnknownError(error: unknown) {
        if (error) {
            console.error(`[${this.constructor.name}] Unexpected Error:`, error);
            throw error;
        }
    }
}
