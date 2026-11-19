import * as Speech from 'expo-speech';
import { useCallback } from 'react';
import { AccessibilityInfo } from 'react-native';

import { usePreferences } from '@/context/preferences-context';

/** Reads a text aloud with the phone's text-to-speech engine. */
export function speak(text: string) {
  try {
    Speech.stop();
    Speech.speak(text, { language: 'en-US' });
  } catch (e) {
    console.warn('Text to speech unavailable', e);
  }
}

/**
 * Announces a status message (saved, error, offline...).
 * - "Voice assistance" ON  -> spoken with text-to-speech, even without a screen reader.
 * - OFF -> only sent to TalkBack/VoiceOver, which read it if the user has them enabled.
 */
export function useAnnouncer() {
  const voice = usePreferences().preferences.voiceAssistance;
  return useCallback(
    (text: string) => {
      if (voice) speak(text);
      else AccessibilityInfo.announceForAccessibility(text);
    },
    [voice],
  );
}
