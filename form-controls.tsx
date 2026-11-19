import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePreferences } from '@/context/preferences-context';
import { useTheme } from '@/hooks/use-theme';

/**
 * Small accessible building blocks shared by the Preferences and Contribute screens.
 * All touch targets are at least 48 dp high and expose a role + state to TalkBack.
 */

export function SectionTitle({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" themeColor="primary" accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </ThemedText>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}>
      {children}
    </View>
  );
}

/** A whole row that toggles a switch. TalkBack reads it as one element: "title, switch, on". */
export function SettingSwitch({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      style={({ pressed }) => [styles.switchRow, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <ThemedText>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor={value ? theme.onPrimary : theme.background}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

/** Vertical list of radio buttons (theme, text size). */
export function RadioGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, selected }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.radioRow,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.radioOuter, { borderColor: selected ? theme.primary : theme.textSecondary }]}>
              {selected ? <View style={[styles.radioInner, { backgroundColor: theme.primary }]} /> : null}
            </View>
            <ThemedText style={styles.flex}>{option.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Black or white, whichever reads better on the given #RRGGBB background. */
function readableTextOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

/**
 * Horizontal, wrapping chips: pick one option (used for the accessibility ratings).
 * `colorFor` gives each option its own color (border + dot; filled when selected).
 */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  colorFor,
}: {
  label: string;
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  colorFor?: (key: T) => string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chipBlock}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.chipRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.key === value;
          const accent = colorFor?.(option.key);
          if (accent) {
            return (
              <Pressable
                key={option.key}
                onPress={() => onChange(option.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, selected }}
                accessibilityLabel={`${label}: ${option.label}`}
                style={({ pressed }) => [
                  styles.chip,
                  styles.colorChip,
                  {
                    borderColor: accent,
                    backgroundColor: selected ? accent : theme.background,
                    borderWidth: selected ? 3 : 2,
                  },
                  pressed && styles.pressed,
                ]}>
                {!selected ? <View style={[styles.chipDot, { backgroundColor: accent }]} /> : null}
                <ThemedText
                  type={selected ? 'smallBold' : 'small'}
                  style={{ color: selected ? readableTextOn(accent) : theme.text }}>
                  {selected ? '✓ ' : ''}
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={option.key}
              onPress={() => onChange(option.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected }}
              accessibilityLabel={`${label}: ${option.label}`}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: selected ? theme.primary : theme.border,
                  backgroundColor: selected ? theme.primary : theme.background,
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
                {selected ? '✓ ' : ''}
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function TextField({
  label,
  error,
  style,
  ...rest
}: TextInputProps & { label: string; error?: string | null }) {
  const theme = useTheme();
  const scale = usePreferences().preferences.textScale;
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? undefined}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.background,
            borderColor: error ? theme.danger : theme.border,
            borderWidth: error ? 2 : 1,
            fontSize: 16 * scale,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          ⚠ {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const color = variant === 'primary' ? theme.onPrimary : variant === 'danger' ? theme.danger : theme.primary;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary'
          ? { backgroundColor: theme.primary, borderColor: theme.primary }
          : { backgroundColor: 'transparent', borderColor: color },
        isDisabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {loading ? <ActivityIndicator color={color} /> : null}
      <ThemedText type="smallBold" style={{ color }}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

export type MessageKind = 'success' | 'info' | 'error';
export type UiMessage = { text: string; kind: MessageKind };

/** Status message. `accessibilityLiveRegion` makes TalkBack read it as soon as it appears. */
export function MessageBanner({ message, onDismiss }: { message: UiMessage; onDismiss?: () => void }) {
  const theme = useTheme();
  const color = message.kind === 'success' ? theme.success : message.kind === 'error' ? theme.danger : theme.info;
  const icon = message.kind === 'success' ? '✓' : message.kind === 'error' ? '⚠' : 'ℹ';
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.banner, { borderColor: color, backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={[styles.flex, { color: theme.text }]}>
        <ThemedText style={{ color }}>{icon} </ThemedText>
        {message.text}
      </ThemedText>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          hitSlop={8}
          style={styles.dismiss}>
          <ThemedText themeColor="textSecondary">✕</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 26,
    marginTop: Spacing.three,
  },
  card: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  switchRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  radioRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  chipBlock: { gap: Spacing.two },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chipDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  field: { gap: Spacing.one },
  input: {
    minHeight: 48,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 24,
    borderWidth: 2,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: 2,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  dismiss: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
