import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { RoundedButton } from '@/components/rounded-button';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logout } from '@/lib/user';
import { useUser } from '@/lib/user-context';

export default function PreferencesScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();
  const { user, loading } = useUser();

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
    },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <Text style={styles.title}>Preferences</Text>
          <Text>
            {loading ? 'Loading account…' : user ? user.email : 'Not signed in'}
          </Text>
          {!user ? (
            <RoundedButton title="Sign in" onPress={() => router.push('/auth')} />
          ) : (
            <RoundedButton
              title="Log out"
              variant="cancel"
              onPress={() => {
                logout().catch((error) => {
                  console.error(error);
                });
              }}
            />
          )}
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    padding: 20,
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    gap: Spacing.three,
  },
  titleContainer: {
    gap: Spacing.three,
  },
  title: {
    fontSize: 24,
    fontWeight: 'medium',
  },
});
