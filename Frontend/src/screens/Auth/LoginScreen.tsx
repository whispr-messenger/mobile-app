/**
 * Login Screen - Whispr
 * Coherent design with RegistrationScreen
 * Dark gradient background with Whispr branding
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Animated,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Logo, Button, Input } from '../../components';
import { colors, spacing, typography } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import AuthService from '../../services/AuthService';
import { useTheme } from '../../context/ThemeContext';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState('');
  const inputContainerStyle = error
    ? { ...styles.inputContainer, ...styles.inputContainerError }
    : styles.inputContainer;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoAnim = useRef(new Animated.Value(1)).current;
  const labelAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Entrance animations avec logo pulsant
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Animation subtile du logo (pulsation)
    const logoPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(logoAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(logoAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    logoPulse.start();
  }, []);

  // Animation de secousse pour les erreurs
  const shakeInput = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();

    // Vibration pour le feedback haptique
    if (Platform.OS === 'ios') {
      Vibration.vibrate(100);
    }
  };

  // Animation du label flottant
  const animateLabel = (focused: boolean) => {
    Animated.timing(labelAnim, {
      toValue: focused ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleLogin = async () => {
    // Clear previous errors
    setError('');

    if (!identifier.trim()) {
      setError('Veuillez entrer votre nom d\'utilisateur ou numéro');
      shakeInput();
      return;
    }

    if (!password.trim()) {
      setError('Veuillez entrer votre mot de passe');
      shakeInput();
      return;
    }

    setLoading(true);

    try {
      const authService = AuthService.getInstance();
      const result = await authService.login(identifier.trim(), password.trim());

      setLoading(false);

      if (result.success) {
        navigation.navigate('ConversationsList');
      } else {
        Alert.alert(getLocalizedText('notif.error'), result.message || getLocalizedText('auth.errorConnection'));
      }
    } catch (error) {
      console.error('💥 Erreur inattendue:', error);
      setLoading(false);
      Alert.alert(getLocalizedText('notif.error'), getLocalizedText('auth.errorSendCode'));
    }
  };

  return (
    <LinearGradient
      colors={themeColors.background.gradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Logo avec animation */}
          <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoAnim }] }]}>
            <Logo variant="icon" size="xlarge" />
          </Animated.View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: themeColors.text.primary, fontSize: getFontSize('xxxl') }]}>Whispr</Text>
            <Text style={[styles.subtitle, { color: themeColors.text.secondary, fontSize: getFontSize('base') }]}>
              {getLocalizedText('auth.tagline')}
            </Text>
          </View>

          {/* Identifiant et mot de passe */}
          <Animated.View
            style={[
              styles.formContainer,
              { transform: [{ translateX: shakeAnim }] }
            ]}
          >
            {/* Label flottant pour l’identifiant */}
            <Animated.View style={[
              styles.floatingLabelContainer,
              {
                transform: [
                  {
                    translateY: labelAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -20],
                    }),
                  },
                  {
                    scale: labelAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.8],
                    }),
                  },
                ],
              },
            ]}>
              <Text
                style={[
                  styles.floatingLabel,
                  { color: error ? themeColors.error : themeColors.text.primary, fontSize: getFontSize('base') },
                ]}
              >
                Identifiant (username ou téléphone)
              </Text>
            </Animated.View>

            <View style={[
              styles.phoneInputContainer,
              error && styles.phoneInputContainerError
            ]}>
              <View style={styles.phoneInput}>
                <Input
                  placeholder="Username ou numéro de téléphone"
                  value={identifier}
                  onChangeText={(text) => {
                    setIdentifier(text);
                    setError('');
                  }}
                  onFocus={() => {
                    setIsFocused(true);
                    animateLabel(true);
                  }}
                  onBlur={() => {
                    setIsFocused(false);
                    animateLabel(false);
                  }}
                  autoCapitalize="none"
                  containerStyle={inputContainerStyle}
                  style={[styles.phoneNumberInput, { color: '#000000' }]}
                  placeholderTextColor="rgba(0, 0, 0, 0.5)"
                />
              </View>
            </View>

            {/* Error Message */}
            {error && (
              <Animated.View style={styles.errorContainer}>
                <Text style={[styles.errorText, { color: themeColors.error, fontSize: getFontSize('sm') }]}>{error}</Text>
              </Animated.View>
            )}

            {/* Mot de passe */}
            <View style={[styles.phoneInputContainer, { marginTop: spacing.md }]}>
              <View style={styles.phoneInput}>
                <Input
                  placeholder="Mot de passe"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError('');
                  }}
                  secureTextEntry
                  containerStyle={inputContainerStyle}
                  style={[styles.phoneNumberInput, { color: '#000000' }]}
                  placeholderTextColor="rgba(0, 0, 0, 0.5)"
                />
              </View>
            </View>
          </Animated.View>

          {/* Continue Button */}
          <View style={styles.buttonContainer}>
            <Button
              title={getLocalizedText('auth.seConnecter')}
              variant="primary"
              size="large"
              onPress={handleLogin}
              loading={loading}
              disabled={(!identifier.trim() || !password.trim()) || loading}
              fullWidth
            />
          </View>

          {/* Registration Link */}
          <TouchableOpacity
            style={styles.registrationLink}
            onPress={() => navigation.navigate('Registration')}
          >
            <Text style={[styles.registrationLinkText, { color: themeColors.text.secondary, fontSize: getFontSize('base') }]}>
              {getLocalizedText('auth.pasEncoreCompte')}{' '}
              <Text style={[styles.registrationLinkBold, { color: themeColors.primary }]}>
                {getLocalizedText('auth.creerCompte')}
              </Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  title: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: '800',
    color: colors.text.light,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.light,
    opacity: 0.8,
  },
  formContainer: {
    marginBottom: spacing.xl,
    position: 'relative',
  },
  floatingLabelContainer: {
    position: 'absolute',
    top: -10,
    left: 0,
    zIndex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.sm,
  },
  floatingLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.text.light,
  },
  label: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: colors.text.light,
    marginBottom: spacing.md,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  phoneInputContainerError: {
    borderColor: colors.ui.error,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  errorContainer: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.ui.error,
    fontWeight: '500',
  },
  countryCodeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing.base,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  countryCodeText: {
    color: colors.text.light,
    fontSize: typography.fontSize.md,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
  },
  inputContainer: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  inputContainerError: {
    borderColor: colors.ui.error,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  phoneNumberInput: {
    color: colors.text.primary, // Noir pour être visible sur fond blanc
    fontSize: typography.fontSize.md,
  },
  countryPicker: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    marginTop: spacing.md,
    padding: spacing.md,
    maxHeight: 200,
  },
  searchContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  searchInput: {
    color: colors.text.light,
    fontSize: typography.fontSize.sm,
  },
  countriesList: {
    maxHeight: 150,
  },
  countryOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.xs,
  },
  countryOptionText: {
    color: colors.text.light,
    fontSize: typography.fontSize.sm,
  },
  noResultsText: {
    color: colors.text.light,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.md,
    opacity: 0.7,
  },
  helperText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.light,
    opacity: 0.7,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  registrationLink: {
    alignItems: 'center',
  },
  registrationLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.light,
    opacity: 0.8,
  },
  registrationLinkBold: {
    color: colors.primary.main,
    fontWeight: '600',
  },
});
