import { useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
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
  type MessageKind,
  type UiMessage,
} from '@/components/ui/form-controls';
import { RatingDot, RatingLegend, ratingColor } from '@/components/rating-legend';
import { ThemedText } from '@/components/ui/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useContributions } from '@/context/contributions-context';
import { useAnnouncer } from '@/hooks/use-announcer';
import { useTheme } from '@/hooks/use-theme';
import { addRating, emptyRatings, ratingLabel } from '@/lib/rating';
import { useUser } from '@/lib/user-context';
import { FEATURE_KEYS, FEATURES, RATING_KEYS, RATINGS } from '@/constants/accessibility';
import type { Contribution, Ratings } from '@/types';

const RATING_OPTIONS = RATING_KEYS.map((key) => ({ key, label: RATINGS[key] }));

type FormState = {
  editingId: string | null;
  address: string;
  placeName: string;
  placeAddress: string;
  placeKind: string;
  osmId: number | null;
  osmType: string | null;
  latitude: number | null;
  longitude: number | null;
  ratings: Ratings;
};

const emptyForm = (): FormState => ({
  editingId: null,
  address: '',
  placeName: '',
  placeAddress: '',
  placeKind: '',
  osmId: null,
  osmType: null,
  latitude: null,
  longitude: null,
  ratings: emptyRatings(),
});

function formatPlaceKind(featureType?: string, featureClass?: string): string {
  const raw = (featureType || featureClass || '').trim();
  if (!raw) return '';
  const spaced = raw.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default function ContributeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const announce = useAnnouncer();
  const { user, loading: userLoading } = useUser();
  const { contributions, loaded, refresh, remove } = useContributions();
  const params = useLocalSearchParams<{
    address?: string;
    name?: string;
    addressLine?: string;
    featureClass?: string;
    featureType?: string;
    osmId?: string;
    osmType?: string;
    latitude?: string;
    longitude?: string;
  }>();

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [paramsSignature, setParamsSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<UiMessage | null>(null);

  const show = (text: string, kind: MessageKind) => {
    setMessage({ text, kind });
    announce(text);
  };

  // Adjust form when route params change (React-recommended alternative to syncing in an effect).
  const nextSignature = [
    params.address,
    params.name,
    params.addressLine,
    params.featureClass,
    params.featureType,
    params.osmId,
    params.osmType,
    params.latitude,
    params.longitude,
  ].join('|');
  if (nextSignature !== paramsSignature) {
    setParamsSignature(nextSignature);
    const address = typeof params.address === 'string' ? params.address.trim() : '';
    if (address) {
      const placeName =
        typeof params.name === 'string' && params.name.trim() ? params.name.trim() : address;
      const placeAddress = typeof params.addressLine === 'string' ? params.addressLine.trim() : '';
      const placeKind = formatPlaceKind(
        typeof params.featureType === 'string' ? params.featureType : undefined,
        typeof params.featureClass === 'string' ? params.featureClass : undefined,
      );
      const latitude = params.latitude != null ? Number(params.latitude) : NaN;
      const longitude = params.longitude != null ? Number(params.longitude) : NaN;
      const osmId = params.osmId != null ? Number(params.osmId) : NaN;
      const osmType =
        typeof params.osmType === 'string' && params.osmType.trim() ? params.osmType.trim() : null;
      setForm({
        editingId: null,
        address,
        placeName,
        placeAddress,
        placeKind,
        osmId: Number.isFinite(osmId) ? osmId : null,
        osmType,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        ratings: emptyRatings(),
      });
    }
  }

  const onSubmit = async () => {
    if (!form.address.trim()) {
      show('Select the place from map and press Contribute.', 'error');
      return;
    }
    if (form.osmId == null) {
      show('This place has no OSM id. Pick another place on the map.', 'error');
      return;
    }
    if (form.latitude == null || form.longitude == null) {
      show('This place has no coordinates. Pick another place on the map.', 'error');
      return;
    }
    if (saving) return;
    setSaving(true);
    const wasEditing = form.editingId !== null;
    const snapshot = form;

    try {
      await addRating(snapshot.osmId!, snapshot.ratings, {
        label: snapshot.placeName || snapshot.address,
        lat: snapshot.latitude!,
        lng: snapshot.longitude!,
      });
      await refresh();
      setForm(emptyForm());
      show(wasEditing ? 'Changes saved.' : 'Contribution saved. Thank you!', 'success');
    } catch (error) {
      console.log('addRating failed', error);
      show('Could not save rating to the server.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    setForm(emptyForm());
    show('Changes discarded.', 'info');
  };

  const onEdit = (item: Contribution) => {
    setForm({
      editingId: item.id,
      address: item.address,
      placeName: item.address,
      placeAddress: '',
      placeKind: '',
      osmId: item.osmId,
      osmType: null,
      latitude: item.latitude,
      longitude: item.longitude,
      ratings: { ...emptyRatings(), ...item.ratings },
    });
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const doDelete = async (item: Contribution) => {
    if (form.editingId === item.id) setForm(emptyForm());
    try {
      await remove(item.osmId);
      show('Contribution deleted.', 'success');
    } catch (error) {
      console.log('delete contribution failed', error);
      show('Could not delete contribution.', 'error');
    }
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

  const isEditing = form.editingId !== null;
  const hasPlace = form.address.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
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
            Contribute
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Rate how accessible a place is to help other travellers.
          </ThemedText>

          {message ? <MessageBanner message={message} onDismiss={() => setMessage(null)} /> : null}

          <SectionTitle>{isEditing ? 'Edit place' : 'Add a place'}</SectionTitle>
          {userLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : !user ? (
            <ThemedText themeColor="textSecondary">Sign in to contribute to AccessWay.</ThemedText>
          ) : !hasPlace ? (
            <ThemedText themeColor="textSecondary">
              Select the place from map and press Contribute.
            </ThemedText>
          ) : (
            <Card>
              <View
                accessible
                accessibilityLabel={[form.placeName, form.placeKind, form.placeAddress]
                  .filter(Boolean)
                  .join(', ')}
                style={styles.placeSummary}
              >
                <ThemedText type="heading" numberOfLines={2}>
                  {form.placeName || form.address}
                </ThemedText>
                {form.placeKind ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {form.placeKind}
                  </ThemedText>
                ) : null}
                {form.placeAddress && form.placeAddress !== form.placeName ? (
                  <ThemedText themeColor="textSecondary" numberOfLines={3}>
                    {form.placeAddress}
                  </ThemedText>
                ) : null}
              </View>

              <RatingLegend />

              {FEATURE_KEYS.map((featureKey) => (
                <ChipGroup
                  key={featureKey}
                  label={FEATURES[featureKey]}
                  options={RATING_OPTIONS}
                  value={form.ratings[featureKey]}
                  colorFor={(rating) => ratingColor(theme, rating)}
                  onChange={(rating) =>
                    setForm((f) => ({
                      ...f,
                      ratings: { ...f.ratings, [featureKey]: rating },
                    }))
                  }
                />
              ))}

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

          <SectionTitle>{`My contributions (${contributions.length})`}</SectionTitle>

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
  onEdit,
  onDelete,
}: {
  item: Contribution;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const rated = FEATURE_KEYS.filter((key) => item.ratings[key] && item.ratings[key] !== 'unknown');
  const missing = FEATURE_KEYS.length - rated.length;

  return (
    <Card>
      <View style={styles.cardHeader}>
        <ThemedText type="smallBold" style={[styles.flex, styles.address]}>
          {item.address}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {new Date(item.updatedAt).toLocaleString()}
      </ThemedText>

      <View>
        {rated.map((key) => (
          <View key={key} style={styles.ratingRow}>
            <RatingDot rating={item.ratings[key]} />
            <ThemedText type="small" style={styles.flex}>
              {FEATURES[key]}: {ratingLabel(item.ratings[key])}
            </ThemedText>
          </View>
        ))}
        {missing > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {missing} feature(s) without information
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.buttonRow}>
        <Button
          variant="secondary"
          title="Edit"
          onPress={onEdit}
          accessibilityHint={`Edit ${item.address}`}
        />
        <Button
          variant="danger"
          title="Delete"
          onPress={onDelete}
          accessibilityHint={`Delete ${item.address}`}
        />
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
  placeSummary: {
    gap: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
