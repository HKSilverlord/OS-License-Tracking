import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useUserRole } from '../contexts/UserRoleContext';
import type { UserRole } from '../contexts/UserRoleContext';
import { createLogger } from '../utils/logger';

const log = createLogger('auth');

export interface AuthSession {
  session: Session | null;
  /** Stable across token refreshes — use this, not `session`, as an effect key. */
  userId: string | null;
  signOut: () => Promise<void>;
}

/**
 * Owns the Supabase session and the role that goes with it.
 *
 * The role comes from `get_my_role()` rather than from anything in the token,
 * so a client cannot promote itself by editing local storage. A failure to read
 * it resolves to 'user': the safe direction is always fewer permissions.
 */
export function useAuthSession(): AuthSession {
  const { setRole, setIsLoading } = useUserRole();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_my_role');

        if (error) {
          log.warn('Error fetching role via RPC, defaulting to viewer', error);
          setRole('user');
        } else {
          const resolved: UserRole = data === 'admin' || data === 'user' ? data : 'user';
          setRole(resolved);
        }
      } catch (e) {
        log.error('Error fetching role:', e);
        setRole('user');
      } finally {
        setIsLoading(false);
      }
    };

    void supabase.auth.getSession().then(({ data: { session: restored } }) => {
      setSession(restored);
      if (restored?.user?.id) void fetchRole();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user?.id) {
        void fetchRole();
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setRole, setIsLoading]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return { session, userId: session?.user?.id ?? null, signOut };
}
