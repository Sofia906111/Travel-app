import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  RadioGroup,
  SectionTitle,
  SettingSwitch,
} from '@/components/ui/form-controls';
import { LabeledTextInput } from '@/components/labeled-text-input';
import { ThemedText } from '@/components/ui/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { FEATURE_GROUPS, FEATURES } from '@/constants/accessibility';
import { TEXT_SCALE_OPTIONS, THEME_OPTIONS, usePreferences } from '@/context/preferences-context';
import { useAnnouncer } from '@/hooks/use-announcer';
import { useTheme } from '@/hooks/use-theme';
import { logout } from '@/lib/user';
import { useUser } from '@/lib/user-context';

export default function PreferencesScreen() {
  const { preferences: p, update, setMapFeature } = usePreferences();
  const { user, profile, loading, updateProfile } = useUser();
  const announce = useAnnouncer();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(profile?.name ?? '');
  const [surname, setSurname] = useState(profile?.surname ?? '');
  const [profileRef, setProfileRef] = useState(profile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  if (profile !== profileRef) {
    setProfileRef(profile);
    setName(profile?.name ?? '');
    setSurname(profile?.surname ?? '');
  }

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
        {
          paddingTop: insets.top + Spacing.three,
          paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inner}>
        <ThemedText type="subtitle" accessibilityRole="header">
          Settings
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Changes are saved on this phone straight away and kept when you close the app.
        </ThemedText>

        <SectionTitle>Account</SectionTitle>
        <Card style={{ backgroundColor: theme.background }}>
          <ThemedText>
            {loading ? 'Loading account…' : user ? user.email : 'Not signed in'}
          </ThemedText>
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
        <ThemedText type="small" themeColor="textSecondary">
          Marker colours on the map only use the accessibility features you care about. Turn off
          mobility features if you only need vision guidance, and the other way around.
        </ThemedText>
        {FEATURE_GROUPS.map((group) => (
          <View key={group.id} style={styles.featureGroup}>
            <ThemedText type="smallBold" themeColor="tabsColor">
              {group.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {group.description}
            </ThemedText>
            <Card style={{ backgroundColor: theme.background }}>
              {group.keys.map((key) => (
                <SettingSwitch
                  key={key}
                  title={FEATURES[key]}
                  value={p.mapFeatures[key]}
                  onValueChange={(enabled) => setMapFeature(key, enabled)}
                />
              ))}
            </Card>
          </View>
        ))}

        <SectionTitle>Accessibility</SectionTitle>
        <ThemedText type="smallBold" themeColor="tabsColor">
          Theme
        </ThemedText>
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

        <ThemedText type="smallBold" themeColor="tabsColor">
          Text size
        </ThemedText>
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
  featureGroup: {
    gap: Spacing.two,
  },
});
