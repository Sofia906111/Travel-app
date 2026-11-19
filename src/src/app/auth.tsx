import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { LabeledTextInput } from '@/components/labeled-text-input';
import { RoundedButton } from '@/components/rounded-button';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { login, register } from '@/lib/user';

const CONFIRM_EMAIL_MESSAGE =
  'Account created successfully, please confirm your e-mail to activate the account';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function validateAuthForm(
  email: string,
  password: string,
  confirmPassword: string,
  isLoginMode: boolean,
) {
  const errors = {
    email: '',
    password: '',
    confirmPassword: '',
  };

  if (!email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  if (!isLoginMode && confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return {
    errors,
    isValid: !errors.email && !errors.password && !errors.confirmPassword,
  };
}

export default function AuthScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
    },
  });

  function applyErrors(errors: {
    email: string;
    password: string;
    confirmPassword: string;
  }) {
    setEmailError(errors.email);
    setPasswordError(errors.password);
    setConfirmPasswordError(errors.confirmPassword);
  }

  function clearMessages() {
    applyErrors({ email: '', password: '', confirmPassword: '' });
    setInfoMessage('');
  }

  async function submitLogin() {
    try {
      const result = await login(email, password);
      if (result.session) {
        router.replace('/preferences');
      }
    } catch (error) {
      setPasswordError(errorMessage(error, 'Sign in failed'));
    }
  }

  async function submitRegister() {
    try {
      const result = await register(email, password);
      if (!result.session) {
        setInfoMessage(CONFIRM_EMAIL_MESSAGE);
      }
    } catch (error) {
      setConfirmPasswordError(errorMessage(error, 'Register failed'));
    }
  }

  async function onSubmit() {
    clearMessages();
    const { errors, isValid } = validateAuthForm(
      email,
      password,
      confirmPassword,
      isLoginMode,
    );
    applyErrors(errors);
    if (!isValid) return;

    if (isLoginMode) {
      await submitLogin();
    } else {
      await submitRegister();
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentInset={insets}
        contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
        <ThemedView style={styles.container}>
          <Text style={styles.title}>{isLoginMode ? 'Sign in' : 'Register'}</Text>
          <LabeledTextInput
            label="Email"
            placeholder="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError('');
            }}
            error={emailError}
          />
          <LabeledTextInput
            label="Password"
            placeholder="Password"
            autoCapitalize="none"
            autoComplete="password"
            keyboardType="default"
            textContentType="password"
            secureTextEntry
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setPasswordError('');
            }}
            error={passwordError}
          />
          <LabeledTextInput
            label="Confirm Password"
            placeholder="Confirm Password"
            autoCapitalize="none"
            keyboardType="default"
            secureTextEntry
            hidden={isLoginMode}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setConfirmPasswordError('');
            }}
            error={confirmPasswordError}
          />
          {infoMessage ? (
            <Text style={[styles.info, { color: theme.tabsColor }]}>{infoMessage}</Text>
          ) : null}

          <RoundedButton
            title={isLoginMode ? 'Sign in' : 'Register'}
            onPress={onSubmit}
          />
          <Text style={{ marginHorizontal: 'auto', fontSize: 14 }}>
            Don't have an account?{' '}
          </Text>
          <RoundedButton
            variant="secondary"
            title={isLoginMode ? 'Create an account' : 'Sign In'}
            onPress={() => setIsLoginMode(!isLoginMode)}
          />
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    padding: 20,
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    gap: Spacing.three,
  },
  title: {
    fontSize: 24,
    fontWeight: 'medium',
  },
  info: {
    fontSize: 16,
    lineHeight: 22,
  },
});
