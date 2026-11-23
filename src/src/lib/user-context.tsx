import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import {
  ensureUserProfile,
  getUserProfile,
  updateUserProfile,
  type UserProfile,
} from '@/lib/user';

type UserContextValue = {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: { name: string; surname: string }) => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

function profileFromMetadata(user: User): UserProfile {
  return {
    authUID: user.id,
    name: typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : '',
    surname: typeof user.user_metadata?.surname === 'string' ? user.user_metadata.surname : '',
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (authUser: User | null | undefined) => {
    if (!authUser) {
      setProfile(null);
      return;
    }

    const fallback = profileFromMetadata(authUser);

    try {
      await ensureUserProfile(authUser.id, {
        name: fallback.name,
        surname: fallback.surname,
      });

      let next = await getUserProfile(authUser.id);

      if (
        next &&
        !next.name &&
        !next.surname &&
        (fallback.name || fallback.surname)
      ) {
        next = await updateUserProfile(authUser.id, {
          name: fallback.name,
          surname: fallback.surname,
        });
      }

      setProfile(next ?? fallback);
    } catch (error) {
      console.log('failed to load user profile', error);
      setProfile(fallback);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      setSession(data.session ?? null);
      await loadProfile(data.session?.user ?? null);
      if (isMounted) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setTimeout(() => {
        void loadProfile(nextSession?.user ?? null).finally(() => {
          if (isMounted) setLoading(false);
        });
      }, 0);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user ?? null);
  }, [loadProfile, session?.user]);

  const updateProfile = useCallback(
    async (patch: { name: string; surname: string }) => {
      const authUser = session?.user;
      if (!authUser) throw new Error('Not signed in');

      const next = await updateUserProfile(authUser.id, patch);
      setProfile(next);
    },
    [session?.user],
  );

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      profile,
      session,
      loading,
      refreshProfile,
      updateProfile,
    }),
    [session, profile, loading, refreshProfile, updateProfile],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used inside UserProvider');
  }
  return context;
}
