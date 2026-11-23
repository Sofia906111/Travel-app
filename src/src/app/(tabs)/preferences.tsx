import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  RadioGroup,
  SectionTitle,
  SettingSwitch,
} from '@/components/form-controls';
import { LabeledTextInput } from '@/components/labeled-text-input';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { TEXT_SCALE_OPTIONS, THEME_OPTIONS, usePreferences } from '@/context/preferences-context';
import { useAnnouncer } from '@/hooks/use-announcer';
import { useTheme } from '@/hooks/use-theme';
import { logout } from '@/lib/user';
import { useUser } from '@/lib/user-context';

export default function PreferencesScreen() {
  const { preferences: p, update } = usePreferences();
  const { user, profile, loading, updateProfile } = useUser();
  const announce = useAnnouncer();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.name ?? '');
    setSurname(profile?.surname ?? '');
  }, [profile]);

  async function onSaveProfile() {
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      await updateProfile({ name, surname });
      setProfileMessage('Profile saved.');
      announce('Profile saved');
    } catch (error) {
      console.log('profile update failed', error);
      setProfileMessage('Could not save profile.');
    } finally {
      setSavingProfile(false);
    }
  }

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
        <Card style={{ backgroundColor: theme.background }}>
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
            <Card style={{ backgroundColor: theme.background }}>
              <LabeledTextInput
                label="Name"
                placeholder="Your name"
                autoCapitalize="words"
                autoComplete="given-name"
                textContentType="givenName"
                value={name}
                onChangeText={setName}
              />
              <LabeledTextInput
                label="Surname"
                placeholder="Your surname"
                autoCapitalize="words"
                autoComplete="family-name"
                textContentType="familyName"
                value={surname}
                onChangeText={setSurname}
              />
              <Button
                title={savingProfile ? 'Saving…' : 'Save profile'}
                loading={savingProfile}
                onPress={onSaveProfile}
              />
              {profileMessage ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {profileMessage}
                </ThemedText>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                Shown as the author of your contributions.
              </ThemedText>
            </Card>
          </>
        ) : null}

        <SectionTitle>Map preferences</SectionTitle>
        <Card style={{ backgroundColor: theme.background }}>
          <SettingSwitch
            title="Show wheelchair-accessible places"
            subtitle="Highlights places with a wheelchair badge on the map."
            value={p.showWheelchairBadge}
            onValueChange={(showWheelchairBadge) => update({ showWheelchairBadge })}
          />
        </Card>

        <SectionTitle>Accessibility</SectionTitle>
        <ThemedText type="smallBold">Theme</ThemedText>
        <Card style={{ backgroundColor: theme.background }}>
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
        <Card style={{ backgroundColor: theme.background }}>
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
