import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * REAL network state of the phone (Wi-Fi / mobile data / airplane mode), via NetInfo.
 * `isInternetReachable` is null while unknown, so we only treat an explicit `false` as offline.
 */
export function isOnline(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

export async function checkOnline(): Promise<boolean> {
  return isOnline(await NetInfo.fetch());
}

/** Returns true/false, or null while the first check is still running. */
export function useIsOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(isOnline(s))), []);
  return online;
}
