import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ContributionsProvider } from '@/context/contributions-context';
import { PreferencesProvider } from '@/context/preferences-context';
import { useThemeName } from '@/hooks/use-theme';
import { UserProvider } from '@/lib/user-context';

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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" options={{ headerShown: true, title: 'Authenticate' }} />
      </Stack>
    </ThemeProvider>
  );
}
