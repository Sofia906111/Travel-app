import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  RadioGroup,
  SectionTitle,
  SettingSwitch,
  TextField,
} from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { TEXT_SCALE_OPTIONS, THEME_OPTIONS, usePreferences } from '@/context/preferences-context';
import { useAnnouncer } from '@/hooks/use-announcer';
import { useTheme } from '@/hooks/use-theme';
import { logout } from '@/lib/user';
import { useUser } from '@/lib/user-context';

/**
 * Preferences (Settings) tab. Every change is saved immediately on the phone (AsyncStorage, see
 * `context/preferences-context.tsx`) and applied to the whole app at once.
 * The Account section uses Supabase Auth (`lib/user.ts`).
 */
export default function PreferencesScreen() {
  const { preferences: p, update } = usePreferences();
  const { user, loading } = useUser();
  const announce = useAnnouncer();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
      ]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <ThemedText type="subtitle" accessibilityRole="header">
          Settings
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Changes are saved on this phone straight away and kept when you close the app.
        </ThemedText>

        <SectionTitle>Account</SectionTitle>
        <Card>
          <ThemedText>{loading ? 'Loading account…' : user ? user.email : 'Not signed in'}</ThemedText>
          {!user ? (
            <Button title="Sign in" onPress={() => router.push('/auth')} />
          ) : (
            <Button
              variant="danger"
              title="Log out"
              onPress={() => {
                logout().catch((error) => console.error(error));
              }}
            />
          )}
        </Card>

        {user ? (
          <>
            <SectionTitle>Profile</SectionTitle>
            <Card>
              <TextField
                label="Name"
                value={p.name}
                onChangeText={(name) => update({ name })}
                autoCapitalize="words"
                autoComplete="given-name"
                placeholder="Your name"
              />
              <TextField
                label="Surname"
                value={p.surname}
                onChangeText={(surname) => update({ surname })}
                autoCapitalize="words"
                autoComplete="family-name"
                placeholder="Your surname"
              />
              <ThemedText type="small" themeColor="textSecondary">
                Shown as the author of your contributions. Leave empty to appear as &quot;Anonymous&quot;.
              </ThemedText>
            </Card>
          </>
        ) : null}

        <SectionTitle>Map preferences</SectionTitle>
        <Card>
          <SettingSwitch
            title="Show wheelchair-accessible places"
            subtitle="Highlights places with a wheelchair badge on the map."
            value={p.showWheelchairBadge}
            onValueChange={(showWheelchairBadge) => update({ showWheelchairBadge })}
          />
        </Card>

        <SectionTitle>Accessibility</SectionTitle>
        <ThemedText type="smallBold">Theme</ThemedText>
        <Card>
          <RadioGroup
            label="Theme"
            options={THEME_OPTIONS}
            value={p.theme}
            onChange={(value) => {
              update({ theme: value });
              announce(`Theme changed to ${THEME_OPTIONS.find((o) => o.value === value)?.label}`);
            }}
          />
        </Card>

        <ThemedText type="smallBold">Text size</ThemedText>
        <Card>
          <RadioGroup
            label="Text size"
            options={TEXT_SCALE_OPTIONS}
            value={p.textScale}
            onChange={(textScale) => update({ textScale })}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Multiplies the text size of the app. It combines with the font size of your phone.
          </ThemedText>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
});
