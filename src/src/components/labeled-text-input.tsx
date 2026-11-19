import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type LabeledTextInputProps = TextInputProps & {
  label: string;
  hidden?: boolean;
  error?: string;
};

export function LabeledTextInput({
  label,
  style,
  hidden = false,
  error,
  placeholderTextColor,
  ...inputProps
}: LabeledTextInputProps) {
  const theme = useTheme();
  const hasError = Boolean(error);

  return (
    <View style={[styles.field, hidden ? { display: 'none' } : {}]}>
      <ThemedText type="smallBold" style={styles.label}>
        {label}
      </ThemedText>
      <TextInput
        accessibilityLabel={hasError ? `${label}, ${error}` : label}
        placeholderTextColor={placeholderTextColor ?? theme.textSecondary}
        underlineColorAndroid="transparent"
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundSelected,
            color: theme.text,
            borderColor: hasError ? theme.danger : 'transparent',
            borderWidth: 2,
          },
          style,
        ]}
        {...inputProps}
      />
      {hasError ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 17,
    lineHeight: 22,
  },
});
