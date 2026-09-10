/**
 * BaseService
 * Provides common error handling and Supabase instance access for all services.
 */
import { supabase } from '../lib/supabase';
import { PostgrestError } from '@supabase/supabase-js';
import { createLogger, type Logger } from '../utils/logger';

export class BaseService {
    protected supabase = supabase;

    /**
     * Scoped logger for the concrete service.
     *
     * The scope is passed in rather than read from `this.constructor.name`: the
     * production build minifies class names, so that prefix came out as a single
     * mangled letter in exactly the logs someone would be reading to diagnose a
     * live failure.
     */
    protected readonly log: Logger;

    constructor(scope: string) {
        this.log = createLogger(scope);
    }

    protected handleError(error: PostgrestError | null) {
        if (error) {
            this.log.error('Database error:', error);
            throw error;
        }
    }

    protected handleUnknownError(error: unknown) {
        if (error) {
            this.log.error('Unexpected error:', error);
            throw error;
        }
    }
}
