import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Spacing } from '@/constants/theme';

const VARIANTS = {
  primary: { backgroundColor: '#0E6E67', color: '#FFFFFF', borderColor: '#0E6E67' },
  secondary: { backgroundColor: 'transparent', color: '#0E6E67', borderColor: '#0E6E67' },
  cancel: { backgroundColor: '#FF4242', color: '#FFFFFF', borderColor: '#FF4242' },
} as const;

type RoundedButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: keyof typeof VARIANTS;
  style?: StyleProp<ViewStyle>;
};

export function RoundedButton({
  title,
  variant = 'primary',
  style,
  disabled,
  ...pressableProps
}: RoundedButtonProps) {
  const colors = VARIANTS[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...pressableProps}>
      <Text style={[styles.label, { color: colors.color }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 48,
    borderRadius: 9999,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
  },
});
