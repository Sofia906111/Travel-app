import type { Contribution } from '@/types/contribution';

import { checkOnline } from './network';

/**
 * Stands in for the Supabase REST API. Keeps a server table in memory (lost on restart;
 * the phone's AsyncStorage copy is the source of truth), waits ~1 s like a real request,
 * and fails when offline.
 *
 * Replace these functions with real fetch() calls later; the contributions context stays the same.
 */

const serverTable = new Map<string, Contribution>();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request() {
  await delay(1000);
  if (!(await checkOnline())) throw new Error('No internet connection');
}

export const mockSupabase = {
  /** Creates or updates the contribution on the server and returns its remote id. */
  async upsert(contribution: Contribution): Promise<string> {
    await request();
    const remoteId = contribution.remoteId ?? `srv_${contribution.id}`;
    serverTable.set(remoteId, { ...contribution, remoteId, syncState: 'synced' });
    return remoteId;
  },

  async remove(remoteId: string): Promise<void> {
    await request();
    serverTable.delete(remoteId);
  },
};
