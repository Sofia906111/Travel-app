import type { Contribution } from '@/types/contribution';

import { checkOnline } from './network';

/**
 * ⚠ MOCK SERVICE — SIMULATED BEHAVIOUR ⚠
 *
 * Stands in for the Supabase REST API that the team plans to use (Deadline 1 tech choice).
 * It keeps the "server table" in memory (lost when the app restarts; the phone's copy is not),
 * waits about 1 s like a real request, and fails the way a real network call would:
 *  - "No internet connection" when the phone is really offline (REAL check with NetInfo);
 *  - "HTTP 503" when Preferences → Demo → "Simulate server failure" is on (SIMULATED).
 *
 * To use a real backend later, replace these two functions with fetch() calls; nothing else changes.
 */

const serverTable = new Map<string, Contribution>();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function simulateRequest(simulateFailure: boolean) {
  await delay(1000);
  if (!(await checkOnline())) throw new Error('No internet connection');
  if (simulateFailure) throw new Error('HTTP 503 Service Unavailable (simulated)');
}

export const mockSupabase = {
  /** Creates or updates the contribution on the server and returns its remote id. */
  async upsert(contribution: Contribution, simulateFailure: boolean): Promise<string> {
    await simulateRequest(simulateFailure);
    const remoteId = contribution.remoteId ?? `srv_${contribution.id}`;
    serverTable.set(remoteId, { ...contribution, remoteId, syncState: 'synced' });
    return remoteId;
  },

  async remove(remoteId: string, simulateFailure: boolean): Promise<void> {
    await simulateRequest(simulateFailure);
    serverTable.delete(remoteId);
  },
};
