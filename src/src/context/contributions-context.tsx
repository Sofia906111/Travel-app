import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { deleteMyRatingsForPlace, getMyContributions } from '@/lib/rating';
import { useUser } from '@/lib/user-context';
import type { Contribution } from '@/types/contribution';

type ContributionsContextValue = {
  contributions: Contribution[];
  loaded: boolean;
  refresh: () => Promise<void>;
  remove: (osmId: number) => Promise<void>;
};

const ContributionsContext = createContext<ContributionsContextValue | null>(null);

export function ContributionsProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [items, setItems] = useState<Contribution[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoaded(true);
      return;
    }
    const next = await getMyContributions(user.id);
    setItems(next);
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        if (!user) {
          if (!cancelled) {
            setItems([]);
            setLoaded(true);
          }
          return;
        }
        const next = await getMyContributions(user.id);
        if (!cancelled) setItems(next);
      } catch (error) {
        console.log('load contributions failed', error);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const remove = useCallback(
    async (osmId: number) => {
      await deleteMyRatingsForPlace(osmId);
      setItems((prev) => prev.filter((item) => item.osmId !== osmId));
    },
    [],
  );

  const value = useMemo<ContributionsContextValue>(
    () => ({
      contributions: items,
      loaded,
      refresh,
      remove,
    }),
    [items, loaded, refresh, remove],
  );

  return <ContributionsContext.Provider value={value}>{children}</ContributionsContext.Provider>;
}

export function useContributions() {
  const ctx = useContext(ContributionsContext);
  if (!ctx) throw new Error('useContributions must be used inside <ContributionsProvider>');
  return ctx;
}
