import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { usePreferences } from '@/context/preferences-context';
import { mockSupabase } from '@/services/mock-supabase';
import { checkOnline, isOnline } from '@/services/network';
import { newId, type Contribution, type Ratings } from '@/types/contribution';

/**
 * Single source of truth for contributions ("repository").
 *
 * Data flow:  Contribute screen -> save() -> AsyncStorage (ALWAYS, on the phone)
 *                                         -> sync() -> mockSupabase (best effort)
 *
 * - Offline: the item stays "pendingUpload" and the user is told it is saved on the phone.
 * - When NetInfo reports the connection is back, sync() runs automatically.
 * - Server error: the error is stored on the item and the user can tap "Retry sync".
 */

export type SyncResult =
  | { kind: 'allSynced' }
  | { kind: 'offline' }
  | { kind: 'failed'; failed: number; reason: string };

export type ContributionInput = {
  id?: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  ratings: Ratings;
  comment: string;
  authorName: string;
};

type ContributionsContextValue = {
  /** Visible contributions, newest first (items waiting to be deleted are hidden). */
  contributions: Contribution[];
  loaded: boolean;
  isSyncing: boolean;
  isOnline: boolean | null;
  pendingCount: number;
  save: (input: ContributionInput) => Promise<SyncResult>;
  remove: (id: string) => Promise<SyncResult>;
  sync: () => Promise<SyncResult>;
  addSampleData: () => Promise<SyncResult>;
};

const STORAGE_KEY = 'accessway.contributions.v1';

const ContributionsContext = createContext<ContributionsContextValue | null>(null);

export function ContributionsProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const [items, setItems] = useState<Contribution[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);

  // Refs give async code (sync loop) the latest values without stale closures.
  const itemsRef = useRef<Contribution[]>([]);
  const simulateFailureRef = useRef(preferences.simulateServerFailure);
  simulateFailureRef.current = preferences.simulateServerFailure;
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  /** Updates the list in memory AND writes it to the phone's storage. */
  const commit = useCallback((change: (prev: Contribution[]) => Contribution[]) => {
    const next = change(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((e) =>
      console.warn('Could not save contributions', e),
    );
  }, []);

  const runSync = useCallback(async (): Promise<SyncResult> => {
    const pending = itemsRef.current.filter((i) => i.syncState !== 'synced');
    if (pending.length === 0) return { kind: 'allSynced' };
    if (!(await checkOnline())) return { kind: 'offline' };

    setIsSyncing(true);
    let failed = 0;
    let reason = '';
    try {
      for (const item of pending) {
        // Re-read: the user may have edited or deleted it while we were uploading others.
        const current = itemsRef.current.find((i) => i.id === item.id);
        if (!current || current.syncState === 'synced') continue;
        try {
          if (current.syncState === 'pendingUpload') {
            const remoteId = await mockSupabase.upsert(current, simulateFailureRef.current);
            commit((prev) =>
              prev.map((i) =>
                i.id !== current.id
                  ? i
                  : i.updatedAt === current.updatedAt
                    ? { ...i, remoteId, syncState: 'synced', lastSyncError: null }
                    : { ...i, remoteId }, // edited during upload: keep it pending
              ),
            );
          } else {
            if (current.remoteId) await mockSupabase.remove(current.remoteId, simulateFailureRef.current);
            commit((prev) => prev.filter((i) => i.id !== current.id));
          }
        } catch (e) {
          failed++;
          reason = e instanceof Error ? e.message : 'Unknown error';
          const msg = reason;
          commit((prev) => prev.map((i) => (i.id === current.id ? { ...i, lastSyncError: msg } : i)));
        }
      }
    } finally {
      setIsSyncing(false);
    }
    return failed === 0 ? { kind: 'allSynced' } : { kind: 'failed', failed, reason };
  }, [commit]);

  /** Runs one sync at a time (calls are queued), so the same item is never uploaded twice. */
  const sync = useCallback((): Promise<SyncResult> => {
    const run = queueRef.current.then(runSync, runSync);
    queueRef.current = run.catch(() => undefined);
    return run;
  }, [runSync]);

  // Load saved contributions when the app starts, then try to upload anything pending.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((json) => {
        const parsed: unknown = json ? JSON.parse(json) : [];
        if (Array.isArray(parsed)) {
          itemsRef.current = parsed as Contribution[];
          setItems(itemsRef.current);
        }
      })
      .catch((e) => console.warn('Could not read contributions', e))
      .finally(() => {
        setLoaded(true);
        sync();
      });
  }, [sync]);

  // Auto-retry: every time the phone goes from offline to online, push pending work.
  useEffect(() => {
    let wasOnline: boolean | null = null;
    return NetInfo.addEventListener((state) => {
      const now = isOnline(state);
      setOnline(now);
      if (now && wasOnline === false) sync();
      wasOnline = now;
    });
  }, [sync]);

  const save = useCallback(
    (input: ContributionInput) => {
      const now = Date.now();
      const fields = {
        address: input.address.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        ratings: input.ratings,
        comment: input.comment.trim(),
        updatedAt: now,
        syncState: 'pendingUpload' as const,
        lastSyncError: null,
      };
      if (input.id) {
        commit((prev) => prev.map((i) => (i.id === input.id ? { ...i, ...fields } : i)));
      } else {
        const created: Contribution = {
          ...fields,
          id: newId(),
          authorName: input.authorName,
          createdAt: now,
          remoteId: null,
        };
        commit((prev) => [created, ...prev]);
      }
      return sync();
    },
    [commit, sync],
  );

  const remove = useCallback(
    async (id: string): Promise<SyncResult> => {
      const existing = itemsRef.current.find((i) => i.id === id);
      if (!existing) return { kind: 'allSynced' };
      if (!existing.remoteId) {
        // Never reached the server: nothing to tell it.
        commit((prev) => prev.filter((i) => i.id !== id));
        return { kind: 'allSynced' };
      }
      commit((prev) =>
        prev.map((i) => (i.id === id ? { ...i, syncState: 'pendingDelete', lastSyncError: null } : i)),
      );
      return sync();
    },
    [commit, sync],
  );

  /** TEST DATA: two fictional places in Łódź for the demo, clearly labelled in the UI. */
  const addSampleData = useCallback(() => {
    const now = Date.now();
    const base = {
      authorName: 'Sample data',
      createdAt: now,
      updatedAt: now,
      syncState: 'pendingUpload' as const,
      remoteId: null,
      lastSyncError: null,
      isTestData: true,
    };
    const samples: Contribution[] = [
      {
        ...base,
        id: newId(),
        address: 'Piotrkowska 104, Łódź (fictional)',
        latitude: 51.7592,
        longitude: 19.458,
        ratings: {
          wheelchairEntrance: 'accessible',
          elevators: 'accessible',
          tactilePaving: 'undesirable',
          stepFreeAccess: 'accessible',
          brailleSigns: 'unknown',
        },
        comment: 'Fictional test entry for the demo.',
      },
      {
        ...base,
        id: newId(),
        address: 'Manufaktura, Łódź (fictional)',
        latitude: 51.7795,
        longitude: 19.4475,
        ratings: {
          wheelchairEntrance: 'accessible',
          elevators: 'priorBooking',
          tactilePaving: 'unknown',
          stepFreeAccess: 'accessible',
          brailleSigns: 'undesirable',
        },
        comment: 'Fictional test entry for the demo.',
      },
    ];
    commit((prev) => [...samples, ...prev]);
    return sync();
  }, [commit, sync]);

  const value = useMemo<ContributionsContextValue>(() => {
    const visible = items.filter((i) => i.syncState !== 'pendingDelete');
    return {
      contributions: visible,
      loaded,
      isSyncing,
      isOnline: online,
      pendingCount: items.filter((i) => i.syncState !== 'synced').length,
      save,
      remove,
      sync,
      addSampleData,
    };
  }, [items, loaded, isSyncing, online, save, remove, sync, addSampleData]);

  return <ContributionsContext.Provider value={value}>{children}</ContributionsContext.Provider>;
}

export function useContributions() {
  const ctx = useContext(ContributionsContext);
  if (!ctx) throw new Error('useContributions must be used inside <ContributionsProvider>');
  return ctx;
}
