import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RatingDot } from '@/components/rating-legend';
import { Button } from '@/components/ui/form-controls';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DROPPED_PIN } from '@/lib/nominatim';
import { FEATURE_KEYS, FEATURES } from '@/constants/accessibility';
import { ratingLabel } from '@/lib/rating';
import type { PlacePreview, Ratings } from '@/types';

type Props = {
  place: PlacePreview;
  ratings: Ratings | null;
  ratingsLoading: boolean;
  canContribute: boolean;
  onClose: () => void;
  onContribute: () => void;
};

function LoadingRow({ label, small }: { label: string; small?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator color={theme.primary} size="small" />
      <ThemedText type={small ? 'small' : undefined} themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function PlaceRatings({ ratings, loading }: { ratings: Ratings | null; loading: boolean }) {
  if (loading || !ratings) return <LoadingRow label="Loading ratings…" small />;

  return (
    <>
      {FEATURE_KEYS.map((key) => {
        const rating = ratings[key];
        return (
          <View key={key} style={styles.ratingRow}>
            <RatingDot rating={rating} />
            <ThemedText type="small" style={styles.ratingLabel} numberOfLines={2}>
              {FEATURES[key]}: {ratingLabel(rating)}
            </ThemedText>
          </View>
        );
      })}
    </>
  );
}

export function PlaceCard({
  place,
  ratings,
  ratingsLoading,
  canContribute,
  onClose,
  onContribute,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}
    >
      <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            {place.loading ? (
              <LoadingRow label="Looking up place…" />
            ) : (
              <>
                <ThemedText type="heading" numberOfLines={2}>
                  {place.name ?? DROPPED_PIN}
                </ThemedText>
                {place.address ? (
                  <ThemedText themeColor="textSecondary" numberOfLines={3}>
                    {place.address}
                  </ThemedText>
                ) : null}
              </>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close place details"
            hitSlop={12}
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: theme.backgroundSelected }]}
          >
            <ThemedText type="smallBold">X</ThemedText>
          </Pressable>
        </View>

        {!place.loading && place.osmId != null ? (
          <View style={styles.ratingsList}>
            <PlaceRatings ratings={ratings} loading={ratingsLoading} />
          </View>
        ) : null}

        {canContribute ? (
          <View style={styles.contributeRow}>
            <Button
              title="Contribute"
              onPress={onContribute}
              accessibilityHint={`Rate accessibility for ${place.name ?? 'this place'}`}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  headerText: { flex: 1, gap: 4 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingsList: { marginTop: Spacing.three, gap: Spacing.two },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  ratingLabel: { flex: 1 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 28 },
  contributeRow: { marginTop: Spacing.three },
});
