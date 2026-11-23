import { useCallback } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Announces a status message to the system screen reader (TalkBack / VoiceOver).
 * No-op for users who don't have a screen reader enabled.
 */
export function useAnnouncer() {
  return useCallback((text: string) => {
    AccessibilityInfo.announceForAccessibility(text);
  }, []);
}
