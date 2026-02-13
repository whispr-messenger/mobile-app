/**
 * Registration Screen - Whispr
 * Modern Telegram-style phone number registration
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Logo, Button, Input } from '../../components';
import { colors, spacing, typography } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import AuthService from '../../services/AuthService';
import { useTheme } from '../../context/ThemeContext';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'Registration'>;

export const RegistrationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    // Entrance animations
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
  }, []);

  const handleContinue = async () => {
    if (!username.trim()) {
      Alert.alert(getLocalizedText('notif.error'), 'Veuillez entrer un nom d\'utilisateur');
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert(getLocalizedText('notif.error'), 'Veuillez entrer un numéro de téléphone');
      return;
    }

    if (!password.trim()) {
      Alert.alert(getLocalizedText('notif.error'), 'Veuillez entrer un mot de passe');
      return;
    }

    if (!confirmPassword.trim()) {
      Alert.alert(getLocalizedText('notif.error'), 'Veuillez confirmer votre mot de passe');
      return;
    }

    if (password.trim() !== confirmPassword.trim()) {
      Alert.alert(getLocalizedText('notif.error'), 'Les mots de passe ne correspondent pas');
      return;
    }

    const cleanNumber = phoneNumber.replace(/\s/g, '');

    setLoading(true);

    try {
      const authService = AuthService.getInstance();
      const result = await authService.register({
        username: username.trim(),
        password: password.trim(),
        phone: cleanNumber,
      });

      setLoading(false);

      if (result.success) {
        navigation.navigate('Login');
      } else {
        Alert.alert(getLocalizedText('notif.error'), result.message || getLocalizedText('auth.errorConnection'));
      }
    } catch (error) {
      setLoading(false);
      Alert.alert(getLocalizedText('notif.error'), getLocalizedText('auth.errorConnection'));
    }
  };

  return (
    <LinearGradient
      colors={themeColors.background.gradient}
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
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Logo variant="icon" size="xlarge" />
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: themeColors.text.primary, fontSize: getFontSize('xxxl') }]}>Whispr</Text>
            <Text style={[styles.subtitle, { color: themeColors.text.secondary, fontSize: getFontSize('base') }]}>
              {getLocalizedText('auth.tagline')}
            </Text>
          </View>

          {/* Username */}
          <View style={styles.formContainer}>
            <Text style={[styles.label, { color: themeColors.text.primary, fontSize: getFontSize('base') }]}>Nom d'utilisateur</Text>
            <Input
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              containerStyle={styles.inputContainer}
              style={[styles.phoneNumberInput, { color: themeColors.text.primary }]}
            />

            <Text style={[styles.label, { color: themeColors.text.primary, fontSize: getFontSize('base'), marginTop: spacing.lg }]}>
              Numéro de téléphone
            </Text>
            <Input
              placeholder="07 12 34 56 78"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              containerStyle={styles.inputContainer}
              style={[styles.phoneNumberInput, { color: themeColors.text.primary }]}
            />

            <Text style={[styles.label, { color: themeColors.text.primary, fontSize: getFontSize('base'), marginTop: spacing.lg }]}>
              Mot de passe
            </Text>
            <Input
              placeholder="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              containerStyle={styles.inputContainer}
              style={[styles.phoneNumberInput, { color: themeColors.text.primary }]}
            />

            <Text style={[styles.label, { color: themeColors.text.primary, fontSize: getFontSize('base'), marginTop: spacing.lg }]}>
              Confirmer le mot de passe
            </Text>
            <Input
              placeholder="Confirmer le mot de passe"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              containerStyle={styles.inputContainer}
              style={[styles.phoneNumberInput, { color: themeColors.text.primary }]}
            />
          </View>

          {/* Continue Button */}
          <View style={styles.buttonContainer}>
            <Button
              title={getLocalizedText('auth.continue')}
              variant="primary"
              size="large"
              onPress={handleContinue}
              loading={loading}
              disabled={!username.trim() || !password.trim() || !confirmPassword.trim()}
              fullWidth
            />
          </View>

          {/* Login Link */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => {
              navigation.navigate('Login');
            }}
          >
            <Text style={[styles.loginLinkText, { color: themeColors.text.secondary, fontSize: getFontSize('base') }]}>
              {getLocalizedText('auth.dejaCompte')}{' '}
              <Text style={[styles.loginLinkBold, { color: themeColors.primary }]}>
                {getLocalizedText('auth.seConnecter')}
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
    fontSize: typography.fontSize.base,
    color: colors.text.light,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 0,
  },
  phoneNumberInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: colors.text.light,
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
  },
  countryPicker: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    marginTop: spacing.sm,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: spacing.sm,
  },
  searchContainer: {
    marginBottom: spacing.sm,
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: colors.text.light,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  countriesList: {
    maxHeight: 200,
  },
  countryOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  countryOptionText: {
    color: colors.text.light,
    fontSize: typography.fontSize.base,
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
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: spacing.lg,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  loginLinkText: {
    fontSize: typography.fontSize.md,
    color: colors.text.light,
    opacity: 0.8,
  },
  loginLinkBold: {
    fontWeight: '700',
    color: colors.primary.main,
  },
});

export default RegistrationScreen;
