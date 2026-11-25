import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LabeledTextInput } from '@/components/labeled-text-input';
import { Button } from '@/components/ui/form-controls';
import { ThemedView } from '@/components/ui/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePreferences } from '@/context/preferences-context';
import { useTheme } from '@/hooks/use-theme';
import { login, register } from '@/lib/user';

const CONFIRM_EMAIL_MESSAGE =
  'Account created successfully, please confirm your e-mail to activate the account';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validateAuthForm(
  email: string,
  password: string,
  confirmPassword: string,
  name: string,
  surname: string,
  isLoginMode: boolean,
) {
  const errors = {
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    surname: '',
  };

  if (!email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  if (!isLoginMode) {
    if (!name.trim()) {
      errors.name = 'Name is required';
    }
    if (!surname.trim()) {
      errors.surname = 'Surname is required';
    }
    if (confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match';
    }
  }

  return {
    errors,
    isValid:
      !errors.email &&
      !errors.password &&
      !errors.confirmPassword &&
      !errors.name &&
      !errors.surname,
  };
}

export default function AuthScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();
  const { update } = usePreferences();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [nameError, setNameError] = useState('');
  const [surnameError, setSurnameError] = useState('');
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
    name: string;
    surname: string;
  }) {
    setEmailError(errors.email);
    setPasswordError(errors.password);
    setConfirmPasswordError(errors.confirmPassword);
    setNameError(errors.name);
    setSurnameError(errors.surname);
  }

  function clearMessages() {
    applyErrors({ email: '', password: '', confirmPassword: '', name: '', surname: '' });
    setInfoMessage('');
  }

  async function submitLogin() {
    try {
      const result = await login(email, password);
      if (result.session) {
        router.replace('/preferences');
        return;
      }
      setPasswordError('Sign in did not return a session. Confirm your email, then try again.');
    } catch (error) {
      console.log(error);
      setPasswordError('Sign in failed');
    }
  }

  async function submitRegister() {
    try {
      const result = await register(email, password, name, surname);
      update({ name: name.trim(), surname: surname.trim() });
      if (result.session) {
        router.replace('/preferences');
        return;
      }
      setInfoMessage(CONFIRM_EMAIL_MESSAGE);
      setIsLoginMode(true);
    } catch (error) {
      console.log(error);
      setConfirmPasswordError('Register failed');
    }
  }

  async function onSubmit() {
    clearMessages();
    const { errors, isValid } = validateAuthForm(
      email,
      password,
      confirmPassword,
      name,
      surname,
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
        contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}
      >
        <ThemedView style={styles.container}>
          <Text style={styles.title}>{isLoginMode ? 'Sign in' : 'Register'}</Text>
          <LabeledTextInput
            label="Name"
            placeholder="Your name"
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            hidden={isLoginMode}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setNameError('');
            }}
            error={nameError}
          />
          <LabeledTextInput
            label="Surname"
            placeholder="Your surname"
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
            hidden={isLoginMode}
            value={surname}
            onChangeText={(text) => {
              setSurname(text);
              setSurnameError('');
            }}
            error={surnameError}
          />
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

          <Button title={isLoginMode ? 'Sign in' : 'Register'} onPress={onSubmit} />
          <Text style={{ marginHorizontal: 'auto', fontSize: 14 }}>
            Don&apos;t have an account?{' '}
          </Text>
          <Button
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
