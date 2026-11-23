import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { RATINGS, type RatingKey } from '@/types/contribution';

type Theme = ReturnType<typeof useTheme>;

/** Traffic-light color per rating: green = accessible, yellow = needs booking, red = not, gray = no info. */
export function ratingColor(theme: Theme, rating: RatingKey): string {
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

/** The three colored ratings shown in the legend ("No info" is left out, as in the Figma). */
const LEGEND_ITEMS = RATINGS.filter((r) => r.key !== 'unknown');

/**
 * Color legend (from the Figma prototype): ● Accessible  ● Requires prior booking  ● Undesirable.
 * TalkBack reads it as one sentence instead of three loose dots.
 */
export function RatingLegend() {
  const theme = useTheme();
  const spoken = 'Color legend: ' + LEGEND_ITEMS.map((r) => r.label).join(', ');
  return (
    <View style={styles.row} accessible accessibilityLabel={spoken}>
      {LEGEND_ITEMS.map((item) => (
        <View key={item.key} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: ratingColor(theme, item.key), borderColor: theme.border }]} />
          <ThemedText type="small" style={styles.label}>
            {item.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** Small colored dot, e.g. next to each rated feature in a contribution card. */
export function RatingDot({ rating, size = 12 }: { rating: RatingKey; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ratingColor(theme, rating) }}
      importantForAccessibility="no"
      accessibilityElementsHidden
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: Spacing.two,
    columnGap: Spacing.three,
  },
  item: {
    alignItems: 'center',
    gap: Spacing.one,
    maxWidth: 120,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { textAlign: 'center' },
});
