import { useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  ChipGroup,
  MessageBanner,
  SectionTitle,
  TextField,
  type MessageKind,
  type UiMessage,
} from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useContributions, type SyncResult } from '@/context/contributions-context';
import { displayName, usePreferences } from '@/context/preferences-context';
import { useAnnouncer } from '@/hooks/use-announcer';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/lib/user-context';
import { getCurrentLocation } from '@/services/location';
import {
  emptyRatings,
  FEATURES,
  RATINGS,
  ratingLabel,
  type Contribution,
  type RatingKey,
  type Ratings,
} from '@/types/contribution';

type FormState = {
  editingId: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  ratings: Ratings;
  comment: string;
};

const emptyForm = (): FormState => ({
  editingId: null,
  address: '',
  latitude: null,
  longitude: null,
  ratings: emptyRatings(),
  comment: '',
});

/** Traffic-light color per rating: green = accessible, yellow = needs booking, red = not, gray = no info. */
function ratingColor(theme: ReturnType<typeof useTheme>, rating: RatingKey): string {
  switch (rating) {
    case 'accessible':
      return theme.ratingGood;
    case 'priorBooking':
      return theme.ratingWarn;
    case 'undesirable':
      return theme.ratingBad;
    default:
      return theme.ratingNone;
  }
}

type PermissionUi = 'none' | 'denied' | 'blocked';


export default function ContributeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const announce = useAnnouncer();
  const { preferences } = usePreferences();
  const { user } = useUser();
  const { contributions, loaded, isOnline, isSyncing, pendingCount, save, remove, sync } = useContributions();

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissionUi, setPermissionUi] = useState<PermissionUi>('none');
  const [message, setMessage] = useState<UiMessage | null>(null);

  const show = (text: string, kind: MessageKind) => {
    setMessage({ text, kind });
    announce(text);
  };

  const onUseLocation = async () => {
    setLocating(true);
    const result = await getCurrentLocation();
    setLocating(false);
    switch (result.kind) {
      case 'success': {
        const fallback = `${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}`;
        setForm((f) => ({
          ...f,
          address: result.address ?? fallback,
          latitude: result.latitude,
          longitude: result.longitude,
        }));
        setAddressError(null);
        setPermissionUi('none');
        if (result.address) show('Address filled from your current location.', 'success');
        else show('Address lookup unavailable (offline?). Coordinates were used instead; you can edit them.', 'info');
        break;
      }
      case 'permissionDenied':
        setPermissionUi(result.canAskAgain ? 'denied' : 'blocked');
        show('Location permission denied. You can still type the address yourself.', 'info');
        break;
      case 'servicesDisabled':
        show('Location is turned off on this phone. Turn it on or type the address.', 'info');
        break;
      case 'error':
        show(`Could not get your location (${result.message}). Please type the address.`, 'error');
        break;
    }
  };

  const resultMessage = (r: SyncResult, done: string, offline: string): [string, MessageKind] => {
    if (r.kind === 'allSynced') return [done, 'success'];
    if (r.kind === 'offline') return [offline, 'info'];
    return [`Saved on your phone, but the upload failed (${r.reason}). Tap "Retry sync".`, 'error'];
  };

  const onSubmit = async () => {
    if (!form.address.trim()) {
      setAddressError('Address is required.');
      show('Address is required.', 'error');
      return;
    }
    if (saving) return;
    setSaving(true);
    const wasEditing = form.editingId !== null;
    const promise = save({
      id: form.editingId,
      address: form.address,
      latitude: form.latitude,
      longitude: form.longitude,
      ratings: form.ratings,
      comment: form.comment,
      authorName: displayName(preferences) || user?.email || 'Anonymous',
    });
    setForm(emptyForm());
    setPermissionUi('none');
    const result = await promise;
    setSaving(false);
    show(
      ...resultMessage(
        result,
        wasEditing ? 'Changes saved and uploaded.' : 'Contribution saved and uploaded. Thank you!',
        'You are offline. Saved on your phone; it will upload automatically when you reconnect.',
      ),
    );
  };

  const onCancel = () => {
    setForm(emptyForm());
    setAddressError(null);
    show('Changes discarded.', 'info');
  };

  const onEdit = (item: Contribution) => {
    setForm({
      editingId: item.id,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
      ratings: { ...emptyRatings(), ...item.ratings },
      comment: item.comment,
    });
    setAddressError(null);
    show(`Editing "${item.address}".`, 'info');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const doDelete = async (item: Contribution) => {
    if (form.editingId === item.id) setForm(emptyForm());
    const r = await remove(item.id);
    show(
      ...resultMessage(
        r,
        'Contribution deleted.',
        'Deleted on your phone. The server will be updated when you reconnect.',
      ),
    );
  };

  const onDelete = (item: Contribution) => {
    if (Platform.OS === 'web') {
      const { confirm } = globalThis as { confirm?: (text: string) => boolean };
      if (confirm?.(`Delete "${item.address}"?`)) doDelete(item);
      return;
    }
    Alert.alert('Delete contribution?', item.address, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => doDelete(item) },
    ]);
  };

  const onRetry = async () => {
    const r = await sync();
    if (r.kind === 'allSynced') show('Everything is up to date.', 'success');
    else if (r.kind === 'offline') show('Still offline. We will retry automatically.', 'info');
    else show(`Sync failed for ${r.failed} item(s): ${r.reason}`, 'error');
  };

  const isEditing = form.editingId !== null;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <ThemedText type="subtitle" accessibilityRole="header">
            Contribute
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Rate how accessible a place is to help other travellers.
          </ThemedText>

          {/* ---- Connection / sync status -------------------------------------------------- */}
          {isOnline === false ? (
            <MessageBanner
              message={{
                kind: 'info',
                text: 'You are offline. New contributions are saved on your phone and uploaded later.',
              }}
            />
          ) : null}
          {preferences.simulateServerFailure ? (
            <MessageBanner
              message={{ kind: 'error', text: 'Demo: "Simulate server failure" is ON (MOCK server returns HTTP 503).' }}
            />
          ) : null}
          {message ? <MessageBanner message={message} onDismiss={() => setMessage(null)} /> : null}

          {/* ---- Form ---------------------------------------------------------------------- */}
          <SectionTitle>{isEditing ? 'Edit place' : 'Add a place'}</SectionTitle>
          <Card>
            <TextField
              label="Address (required)"
              value={form.address}
              onChangeText={(address) => {
                // Typing by hand invalidates GPS coordinates that belonged to another address.
                setForm((f) => ({ ...f, address, latitude: null, longitude: null }));
                setAddressError(null);
              }}
              error={addressError}
              placeholder="Street, number, city"
              autoComplete="street-address"
            />
            <Button
              variant="secondary"
              title={locating ? 'Finding your location…' : '📍 Use my current location'}
              loading={locating}
              onPress={onUseLocation}
              accessibilityHint="Fills in the address using GPS"
            />
            {permissionUi !== 'none' ? (
              <View style={styles.permissionBox}>
                <ThemedText type="small" themeColor="textSecondary">
                  {permissionUi === 'blocked'
                    ? 'Location is blocked for this app. You can allow it in the phone settings, or type the address.'
                    : 'Without location permission, please type the address above.'}
                </ThemedText>
                {permissionUi === 'blocked' ? (
                  <Button variant="secondary" title="Open app settings" onPress={() => Linking.openSettings()} />
                ) : null}
              </View>
            ) : null}

            {FEATURES.map((feature) => (
              <ChipGroup
                key={feature.key}
                label={feature.label}
                options={RATINGS}
                value={form.ratings[feature.key]}
                colorFor={(rating) => ratingColor(theme, rating)}
                onChange={(rating) =>
                  setForm((f) => ({ ...f, ratings: { ...f.ratings, [feature.key]: rating } }))
                }
              />
            ))}

            <TextField
              label="Comment (optional)"
              value={form.comment}
              onChangeText={(comment) => setForm((f) => ({ ...f, comment }))}
              placeholder="For example: the lift is at the back entrance"
              multiline
              style={styles.comment}
              textAlignVertical="top"
            />

            <View style={styles.buttonRow}>
              <View style={styles.flex}>
                <Button
                  title={isEditing ? 'Save changes' : 'Submit contribution'}
                  onPress={onSubmit}
                  loading={saving}
                />
              </View>
              {isEditing || form.address || form.comment ? (
                <Button variant="secondary" title="Cancel" onPress={onCancel} />
              ) : null}
            </View>
          </Card>

          {/* ---- My contributions ---------------------------------------------------------- */}
          <View style={styles.listHeader}>
            <SectionTitle>{`My contributions (${contributions.length})`}</SectionTitle>
            {pendingCount > 0 ? (
              <View style={styles.pendingRow}>
                <ThemedText type="small" themeColor="info" style={styles.flex}>
                  {isSyncing ? 'Uploading…' : `${pendingCount} waiting to upload`}
                </ThemedText>
                <Button variant="secondary" title="Retry sync" onPress={onRetry} loading={isSyncing} />
              </View>
            ) : null}
          </View>

          {!loaded ? <ActivityIndicator color={theme.primary} /> : null}
          {loaded && contributions.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              No contributions yet. Fill in the form above, or add TEST DATA from Settings → Demo.
            </ThemedText>
          ) : null}

          {contributions.map((item) => (
            <ContributionCard
              key={item.id}
              item={item}
              isSyncing={isSyncing}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
            />
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ContributionCard({
  item,
  isSyncing,
  onEdit,
  onDelete,
}: {
  item: Contribution;
  isSyncing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const rated = FEATURES.filter((f) => item.ratings[f.key] && item.ratings[f.key] !== 'unknown');
  const missing = FEATURES.length - rated.length;

  let status: { text: string; color: string };
  if (item.syncState === 'synced') status = { text: '✓ Uploaded', color: theme.success };
  else if (item.lastSyncError) status = { text: `⚠ Upload failed: ${item.lastSyncError}`, color: theme.danger };
  else if (isSyncing) status = { text: '↑ Uploading…', color: theme.info };
  else status = { text: '⏳ Saved on phone, waiting for network', color: theme.info };

  return (
    <Card>
      <View style={styles.cardHeader}>
        <ThemedText type="smallBold" style={[styles.flex, styles.address]}>
          {item.address}
        </ThemedText>
        {item.isTestData ? (
          <View style={[styles.badge, { borderColor: theme.danger }]}>
            <ThemedText type="small" themeColor="danger">
              TEST DATA
            </ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        by {item.authorName} · {new Date(item.updatedAt).toLocaleString()}
      </ThemedText>

      <View>
        {rated.map((f) => (
          <ThemedText key={f.key} type="small">
            • {f.label}: {ratingLabel(item.ratings[f.key])}
          </ThemedText>
        ))}
        {missing > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {missing} feature(s) without information
          </ThemedText>
        ) : null}
      </View>
      {item.comment ? <ThemedText type="small">“{item.comment}”</ThemedText> : null}

      <ThemedText type="small" style={{ color: status.color }} accessibilityLabel={`Status: ${status.text}`}>
        {status.text}
      </ThemedText>

      <View style={styles.buttonRow}>
        <Button variant="secondary" title="Edit" onPress={onEdit} accessibilityHint={`Edit ${item.address}`} />
        <Button variant="danger" title="Delete" onPress={onDelete} accessibilityHint={`Delete ${item.address}`} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  permissionBox: { gap: Spacing.two },
  comment: { minHeight: 96 },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  listHeader: { gap: Spacing.two },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  address: { fontSize: 16, lineHeight: 22 },
  badge: {
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
});
