import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MapContainer from '@/components/map/map-container';
import { ThemedText } from '@/components/ui/themed-text';
import { ThemedView } from '@/components/ui/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function paramString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function HomeScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ focusLat?: string; focusLng?: string }>();

  const focus = useMemo(() => {
    const latitude = Number(paramString(params.focusLat));
    const longitude = Number(paramString(params.focusLng));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  }, [params.focusLat, params.focusLng]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search place"
            onPress={() => router.push('/search')}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: theme.background, borderColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold">Search</ThemedText>
          </Pressable>
        </View>
        <MapContainer
          center={focus ?? undefined}
          focusKey={focus ? `${focus.latitude},${focus.longitude}` : null}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    position: 'relative',
  },
  actions: {
    position: 'absolute',
    left: Spacing.two,
    top: 30,
    zIndex: 1000,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.85,
  },
});
