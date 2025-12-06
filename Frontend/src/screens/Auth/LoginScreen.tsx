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
import { countries, searchCountries } from '../../data/countries';
import { AuthService } from '../../services/AuthService';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+33');
  const [countryFlag, setCountryFlag] = useState('🇫🇷');
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [loading, setLoading] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState('');
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoAnim = useRef(new Animated.Value(1)).current;
  const labelAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Détection automatique du pays
  useEffect(() => {
    // Détection de la région (simulation - en production, utiliser expo-localization)
    const detectCountry = () => {
      // Simulation de détection basée sur la locale
      const locale = Platform.OS === 'ios' ? 'fr_FR' : 'fr';
      if (locale.includes('fr')) {
        setCountryCode('+33');
        setCountryFlag('🇫🇷');
        setSelectedCountry(countries.find(c => c.code === '33') || countries[0]);
      } else if (locale.includes('en')) {
        setCountryCode('+44');
        setCountryFlag('🇬🇧');
        setSelectedCountry(countries.find(c => c.code === '44') || countries[0]);
      }
    };
    
    detectCountry();
  }, []);

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

  const formatPhoneNumber = (text: string) => {
    // Remove all non-digits
    const digits = text.replace(/\D/g, '');
    
    // Format as 0X XX XX XX XX (plus flexible)
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6)}`;
    if (digits.length <= 10) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
    // Pour les numéros plus longs, on garde le format mais on limite
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  };

  const handleLogin = async () => {
    console.log('🚀 Début de la connexion...');
    console.log('📱 Numéro saisi:', phoneNumber);
    console.log('🌍 Code pays:', countryCode);
    
    // Clear previous errors
    setError('');
    
    if (!phoneNumber.trim()) {
      console.log('❌ Erreur: Numéro vide');
      setError('Veuillez entrer votre numéro de téléphone');
      shakeInput();
      return;
    }

    // Validation du format de numéro (plus flexible)
    const cleanNumber = phoneNumber.replace(/\s/g, '');
    console.log('🔢 Numéro nettoyé:', cleanNumber);
    
    if (cleanNumber.length < 10) {
      console.log('❌ Erreur: Numéro trop court');
      setError('Le numéro de téléphone doit contenir au moins 10 chiffres');
      shakeInput();
      return;
    }

    // Validation du format français
    if (!cleanNumber.match(/^0[1-9]\d{8}$/)) {
      console.log('❌ Erreur: Format invalide');
      setError('Format de numéro invalide (ex: 07 12 34 56 78)');
      shakeInput();
      return;
    }

    setLoading(true);
    console.log('⏳ Envoi du code de vérification...');
    
    try {
      const authService = AuthService.getInstance();
      const phoneData = {
        countryCode: countryCode,
        number: cleanNumber
      };
      
      console.log('📞 Données envoyées:', phoneData);
      
      // Utilisation de la méthode loginRequest pour la connexion
      const result = await authService.loginRequest(phoneData);
      
      console.log('📨 Résultat:', result);
      
      setLoading(false);
      
      if (result.success) {
        console.log('✅ Code envoyé avec succès, navigation vers VerificationScreen');
        navigation.navigate('Verification', { 
          phoneNumber: countryCode + ' ' + phoneNumber,
          isLogin: true // Flag pour distinguer login vs registration
        });
      } else {
        console.log('❌ Échec de l\'envoi:', result.message);
        Alert.alert('Erreur', result.message || 'Une erreur est survenue lors de la connexion');
      }
    } catch (error) {
      console.error('💥 Erreur inattendue:', error);
      setLoading(false);
      Alert.alert('Erreur', 'Impossible d\'envoyer le code de vérification');
    }
  };

  // Filtrer les pays selon la recherche
  const filteredCountries = searchQuery 
    ? searchCountries(searchQuery)
    : countries;

  return (
    <LinearGradient
      colors={[colors.background.dark, colors.secondary.darker, colors.secondary.dark]}
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
            <Text style={styles.title}>Whispr</Text>
            <Text style={styles.subtitle}>
              Sécurisé. Privé. Simple.
            </Text>
          </View>

          {/* Phone Input avec animations */}
          <Animated.View 
            style={[
              styles.formContainer,
              { transform: [{ translateX: shakeAnim }] }
            ]}
          >
            {/* Floating Label */}
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
              <Text style={[
                styles.floatingLabel,
                { color: error ? colors.ui.error : colors.text.light }
              ]}>
                Votre numéro de téléphone
              </Text>
            </Animated.View>
            
            <View style={[
              styles.phoneInputContainer,
              error && styles.phoneInputContainerError
            ]}>
              {/* Country Code */}
              <TouchableOpacity 
                style={styles.countryCodeButton}
                onPress={() => setShowCountryPicker(!showCountryPicker)}
              >
                <Text style={styles.countryCodeText}>{countryFlag} {countryCode}</Text>
              </TouchableOpacity>

              {/* Phone Number */}
              <View style={styles.phoneInput}>
                <Input
                  placeholder="07 12 34 56 78"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={(text) => {
                    setPhoneNumber(formatPhoneNumber(text));
                    setError(''); // Clear error on input
                  }}
                  onFocus={() => {
                    setIsFocused(true);
                    animateLabel(true);
                  }}
                  onBlur={() => {
                    setIsFocused(false);
                    animateLabel(false);
                  }}
                  maxLength={20}
                  containerStyle={[
                    styles.inputContainer,
                    error && styles.inputContainerError
                  ]}
                  style={[styles.phoneNumberInput, { color: colors.text.primary }]}
                />
              </View>
            </View>

            {/* Error Message */}
            {error && (
              <Animated.View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            )}

            {/* Country Picker */}
            {showCountryPicker && (
              <View style={styles.countryPicker}>
                {/* Search Input */}
                <Input
                  placeholder="Rechercher un pays..."
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
                        setSelectedCountry(country);
                        setShowCountryPicker(false);
                        setSearchQuery('');
                      }}
                    >
                      <Text style={styles.countryOptionText}>
                        {country.flag} {country.name} {country.code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  
                  {filteredCountries.length === 0 && (
                    <Text style={styles.noResultsText}>
                      Aucun pays trouvé
                    </Text>
                  )}
                </ScrollView>
              </View>
            )}

            <Text style={styles.helperText}>
              Nous vous enverrons un code de vérification par SMS
            </Text>
          </Animated.View>

          {/* Continue Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Se connecter"
              variant="primary"
              size="large"
              onPress={handleLogin}
              loading={loading}
              disabled={phoneNumber.replace(/\s/g, '').length < 10 || loading}
              fullWidth
            />
          </View>

          {/* Registration Link */}
          <TouchableOpacity 
            style={styles.registrationLink}
            onPress={() => navigation.navigate('Registration')}
          >
            <Text style={styles.registrationLinkText}>
              Pas encore de compte ? <Text style={styles.registrationLinkBold}>Créer un compte</Text>
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