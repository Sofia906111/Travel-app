import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LabeledTextInput } from '@/components/labeled-text-input';
import { Card } from '@/components/ui/form-controls';
import { ThemedText } from '@/components/ui/themed-text';
import { ThemedView } from '@/components/ui/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { searchPlaces } from '@/lib/nominatim';
import type { NominatimPlace } from '@/types';

const SEARCH_DEBOUNCE_MS = 400;

export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim();
  const canSearch = q.length >= 2;
  const shownResults = canSearch ? results : [];
  const shownError = canSearch ? error : null;
  const shownLoading = canSearch && loading;

  useEffect(() => {
    if (!canSearch) return;

    let cancelled = false;
    const id = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const places = await searchPlaces(q);
          if (!cancelled) setResults(places);
        } catch (e) {
          console.log('place search failed', e);
          if (!cancelled) {
            setResults([]);
            setError('Could not search. Check your connection and try again.');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [canSearch, q]);

  function selectPlace(place: NominatimPlace) {
    router.replace({
      pathname: '/',
      params: {
        focusLat: String(place.latitude),
        focusLng: String(place.longitude),
        focusLabel: place.name ?? place.displayName ?? '',
      },
    });
  }

  return (
    <ThemedView style={styles.screen}>
      <View
        style={[
          styles.inner,
          {
            paddingTop: Spacing.three,
            paddingBottom: insets.bottom + Spacing.four,
          },
        ]}
      >
        <ThemedText themeColor="textSecondary">
          Search for a place, useful when location access is not available.
        </ThemedText>

        <LabeledTextInput
          label="Place"
          placeholder="e.g. Łódź or 51.75, 19.45"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        {shownLoading ? <ActivityIndicator color={theme.primary} /> : null}
        {shownError ? (
          <ThemedText type="small" themeColor="textSecondary">
            {shownError}
          </ThemedText>
        ) : null}

        <FlatList
          data={shownResults}
          keyExtractor={(item, index) =>
            item.osmId != null ? `${item.osmType ?? 'x'}-${item.osmId}` : `result-${index}`
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !shownLoading && canSearch && !shownError ? (
              <ThemedText type="small" themeColor="textSecondary">
                No places found.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => {
            const name = item.name ?? item.displayName ?? 'Unknown place';
            return (
              <Pressable
                onPress={() => selectPlace(item)}
                accessibilityRole="button"
                accessibilityLabel={`Use ${name}`}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Card style={{ backgroundColor: theme.background }}>
                  <ThemedText>{name}</ThemedText>
                  {item.displayName && item.displayName !== item.name ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.displayName}
                    </ThemedText>
                  ) : null}
                </Card>
              </Pressable>
            );
          }}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  pressed: {
    opacity: 0.85,
  },
});
