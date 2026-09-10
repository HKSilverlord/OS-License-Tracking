import { useEffect } from 'react';
import { useUserRole } from '../contexts/UserRoleContext';
import { useCatiaStore } from '../stores/useCatiaStore';

/**
 * Pulls the shared CATIA licence document once the caller's role is known.
 *
 * `role` is null until `get_my_role()` answers, and that wait is load-bearing:
 * when the document has never been published, `hydrate()` publishes THIS
 * browser's copy to a sheet everybody shares, so it may only do that for a
 * confirmed admin. Hydrating on a guess would let whichever client opened first
 * decide the numbers for everyone.
 *
 * Dashboard and CatiaLicenseView both need this, and both getting it subtly
 * different is exactly the failure this hook removes.
 */
export function useCatiaHydration(): void {
  const { role } = useUserRole();

  useEffect(() => {
    if (role === null) return;
    void useCatiaStore.getState().hydrate({ canSeed: role === 'admin' });
  }, [role]);
}
