import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ContributionsProvider } from '@/context/contributions-context';
import { PreferencesProvider } from '@/context/preferences-context';
import { useThemeName } from '@/hooks/use-theme';
import { UserProvider } from '@/lib/user-context';

SplashScreen.preventAutoHideAsync();

/**
 * Root of the app. The providers make shared state available to every screen:
 *  - PreferencesProvider:   user preferences (saved on the phone)
 *  - UserProvider:          Supabase login session
 *  - ContributionsProvider: contributions + sync with the MOCK server
 */
export default function RootLayout() {
  return (
    <PreferencesProvider>
      <UserProvider>
        <ContributionsProvider>
          <ThemedApp />
        </ContributionsProvider>
      </UserProvider>
    </PreferencesProvider>
  );
}

function ThemedApp() {
  const themeName = useThemeName();
  const isLight = themeName === 'light';
  return (
    <ThemeProvider value={isLight ? DefaultTheme : DarkTheme}>
      <StatusBar style={isLight ? 'dark' : 'light'} />
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" options={{ headerShown: true, title: 'Authenticate' }} />
      </Stack>
    </ThemeProvider>
  );
}
