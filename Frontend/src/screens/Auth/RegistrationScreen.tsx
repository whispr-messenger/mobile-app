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
import { countries, searchCountries } from '../../data/countries';
import { useTheme } from '../../context/ThemeContext';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'Registration'>;

export const RegistrationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+33');
  const [countryFlag, setCountryFlag] = useState('🇫🇷');
  const [loading, setLoading] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  const formatPhoneNumber = (text: string) => {
    // Format français: 0X XX XX XX XX (10 chiffres)
    const cleaned = text.replace(/\D/g, '');
    
    // Limiter à 10 chiffres maximum
    const limited = cleaned.slice(0, 10);
    
    // Formatage: 0X XX XX XX XX
    if (limited.length <= 2) {
      return limited;
    } else if (limited.length <= 4) {
      return `${limited.slice(0, 2)} ${limited.slice(2)}`;
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 2)} ${limited.slice(2, 4)} ${limited.slice(4)}`;
    } else if (limited.length <= 8) {
      return `${limited.slice(0, 2)} ${limited.slice(2, 4)} ${limited.slice(4, 6)} ${limited.slice(6)}`;
    } else {
      return `${limited.slice(0, 2)} ${limited.slice(2, 4)} ${limited.slice(4, 6)} ${limited.slice(6, 8)} ${limited.slice(8)}`;
    }
  };

  const handleContinue = async () => {
    const cleanNumber = phoneNumber.replace(/\s/g, '');
    
    if (cleanNumber.length < 10) {
      Alert.alert(getLocalizedText('notif.error'), getLocalizedText('auth.phoneMinLength'));
      return;
    }

    setLoading(true);
    
    try {
      // TODO: Appel API auth-service
      // await authService.register({ phone: countryCode + phoneNumber })
      
      // Simulate API call
      setTimeout(() => {
        setLoading(false);
        navigation.navigate('Verification', { 
          phoneNumber: countryCode + ' ' + phoneNumber 
        });
      }, 1500);
    } catch (error) {
      setLoading(false);
      Alert.alert(getLocalizedText('notif.error'), getLocalizedText('auth.errorConnection'));
    }
  };

  // Filtrer les pays selon la recherche
  const filteredCountries = searchQuery 
    ? searchCountries(searchQuery)
    : countries; // Afficher tous les pays par défaut

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

          {/* Phone Input */}
          <View style={styles.formContainer}>
            <Text style={[styles.label, { color: themeColors.text.primary, fontSize: getFontSize('base') }]}>{getLocalizedText('auth.phone')}</Text>
            
            <View style={styles.phoneInputContainer}>
              {/* Country Code */}
              <TouchableOpacity 
                style={styles.countryCodeButton}
                onPress={() => setShowCountryPicker(!showCountryPicker)}
              >
                    <Text style={[styles.countryCodeText, { color: themeColors.text.primary, fontSize: getFontSize('base') }]}>{countryFlag} {countryCode}</Text>
              </TouchableOpacity>

              {/* Phone Number */}
              <View style={styles.phoneInput}>
                <Input
                  placeholder={phoneNumber ? "" : "07 12 34 56 78"}
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={(text) => setPhoneNumber(formatPhoneNumber(text))}
                  maxLength={14} // 0X XX XX XX XX with spaces
                  containerStyle={styles.inputContainer}
                  style={[styles.phoneNumberInput, { color: themeColors.text.primary }]}
                />
              </View>
            </View>

            {/* Country Picker */}
            {showCountryPicker && (
              <View style={[styles.countryPicker, { backgroundColor: themeColors.background.secondary }]}>
                {/* Search Input */}
                <Input
                  placeholder={getLocalizedText('auth.searchCountry')}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  containerStyle={styles.searchContainer}
                  style={styles.searchInput}
                />
                
                {/* Countries List */}
                <ScrollView style={styles.countriesList} nestedScrollEnabled>
                  {filteredCountries.map((country) => (
                    <TouchableOpacity
                      key={country.id}
                      style={styles.countryOption}
                      onPress={() => {
                        setCountryCode(country.code);
                        setCountryFlag(country.flag);
                        setShowCountryPicker(false);
                        setSearchQuery('');
                      }}
                    >
                      <Text style={[styles.countryOptionText, { color: themeColors.text.primary, fontSize: getFontSize('base') }]}>
                        {country.flag} {country.name} {country.code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  
                  {filteredCountries.length === 0 && (
                    <Text style={[styles.noResultsText, { color: themeColors.text.secondary, fontSize: getFontSize('sm') }]}>
                      {getLocalizedText('auth.noCountryFound')}
                    </Text>
                  )}
                </ScrollView>
              </View>
            )}

            <Text style={[styles.helperText, { color: themeColors.text.secondary, fontSize: getFontSize('sm') }]}>
              {getLocalizedText('auth.smsCode')}
            </Text>
          </View>

          {/* Continue Button */}
          <View style={styles.buttonContainer}>
            <Button
              title={getLocalizedText('auth.continue')}
              variant="primary"
              size="large"
              onPress={handleContinue}
              loading={loading}
              disabled={phoneNumber.replace(/\s/g, '').length < 10}
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


