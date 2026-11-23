import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { RatingDot, RatingLegend, ratingColor } from '@/components/rating-legend';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useContributions, type SyncResult } from '@/context/contributions-context';
import { displayName, usePreferences } from '@/context/preferences-context';
import { useAnnouncer } from '@/hooks/use-announcer';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/lib/user-context';
import {
  emptyRatings,
  FEATURES,
  RATINGS,
  ratingLabel,
  type Contribution,
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

/**
 * Contribute tab (core task): rate the accessibility of a place.
 * Places are selected on the map (hold → Contribute); address is not typed here.
 */
export default function ContributeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const announce = useAnnouncer();
  const { preferences } = usePreferences();
  const { user } = useUser();
  const { contributions, loaded, isOnline, isSyncing, pendingCount, save, remove, sync } = useContributions();
  const params = useLocalSearchParams<{
    address?: string;
    latitude?: string;
    longitude?: string;
  }>();

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<UiMessage | null>(null);

  const show = (text: string, kind: MessageKind) => {
    setMessage({ text, kind });
    announce(text);
  };

  // Prefill from map "Contribute" (place hold → place card).
  useEffect(() => {
    const address = typeof params.address === 'string' ? params.address.trim() : '';
    if (!address) return;
    const latitude = params.latitude != null ? Number(params.latitude) : NaN;
    const longitude = params.longitude != null ? Number(params.longitude) : NaN;
    setForm({
      editingId: null,
      address,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      ratings: emptyRatings(),
      comment: '',
    });
    show(`Place filled from the map: ${address}`, 'info');
    // Only react to incoming map params, not every form edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.address, params.latitude, params.longitude]);

  const resultMessage = (r: SyncResult, done: string, offline: string): [string, MessageKind] => {
    if (r.kind === 'allSynced') return [done, 'success'];
    if (r.kind === 'offline') return [offline, 'info'];
    return [`Saved on your phone, but the upload failed (${r.reason}). Tap "Retry sync".`, 'error'];
  };

  const onSubmit = async () => {
    if (!form.address.trim()) {
      show('Select the place from map and press Contribute.', 'error');
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
  const hasPlace = form.address.trim().length > 0;

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

          {isOnline === false ? (
            <MessageBanner
              message={{
                kind: 'info',
                text: 'You are offline. New contributions are saved on your phone and uploaded later.',
              }}
            />
          ) : null}
          {message ? <MessageBanner message={message} onDismiss={() => setMessage(null)} /> : null}

          <SectionTitle>{isEditing ? 'Edit place' : 'Add a place'}</SectionTitle>
          {!hasPlace ? (
            <ThemedText themeColor="textSecondary">
              Select the place from map and press Contribute.
            </ThemedText>
          ) : (
            <Card>
              <TextField
                label="Place"
                value={form.address}
                editable={false}
                selectTextOnFocus={false}
                accessibilityHint="Selected from the map; not editable"
              />

              <RatingLegend />

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
                <Button variant="secondary" title="Cancel" onPress={onCancel} />
              </View>
            </Card>
          )}

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
              No contributions yet. Select a place on the map to get started.
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
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        by {item.authorName} · {new Date(item.updatedAt).toLocaleString()}
      </ThemedText>

      <View>
        {rated.map((f) => (
          <View key={f.key} style={styles.ratingRow}>
            <RatingDot rating={item.ratings[f.key]} />
            <ThemedText type="small" style={styles.flex}>
              {f.label}: {ratingLabel(item.ratings[f.key])}
            </ThemedText>
          </View>
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
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
