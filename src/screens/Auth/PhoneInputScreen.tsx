import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Button } from '../../components';
import { useTheme } from '../../context/ThemeContext';
import { countries, searchCountries, type Country } from '../../data/countries';
import { AuthService } from '../../services/AuthService';
import { colors, spacing, typography } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { normalizePhoneToE164 } from '../../utils/phoneUtils';
import { AuthLanguageSwitcher } from './AuthLanguageSwitcher';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'PhoneInput'>;
type PhoneInputRouteProp = RouteProp<AuthStackParamList, 'PhoneInput'>;

const MIN_DIGITS = 7;
const LOGO_SIZE_DEFAULT = 100;
const LOGO_SIZE_FOCUSED = 56;

export const PhoneInputScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PhoneInputRouteProp>();
  const { mode } = route.params;
  const insets = useSafeAreaInsets();

  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();

  const [selectedCountry, setSelectedCountry] = useState<Country>(
    countries.find((c) => c.id === 'fr')!
  );
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const phoneInputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const logoSize = useRef(new Animated.Value(LOGO_SIZE_DEFAULT)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: false }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: false }),
    ]).start();

    const showSub = Keyboard.addListener('keyboardWillShow', () => {
      setKeyboardVisible(true);
      Animated.spring(logoSize, {
        toValue: LOGO_SIZE_FOCUSED,
        tension: 60,
        friction: 8,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardVisible(false);
      Animated.spring(logoSize, {
        toValue: LOGO_SIZE_DEFAULT,
        tension: 60,
        friction: 8,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: false }),
    ]).start();
  };

  const filteredCountries = countrySearch.trim()
    ? searchCountries(countrySearch.trim())
    : countries;

  const digits = phoneNumber.replace(/\D/g, '');
  const isPhoneValid = digits.length >= MIN_DIGITS;

  const handleContinue = async () => {
    Keyboard.dismiss();
    setError('');

    if (!isPhoneValid) {
      setError(getLocalizedText('auth.enterPhone'));
      shake();
      return;
    }

    const e164 = normalizePhoneToE164(digits, selectedCountry.code);
    setLoading(true);

    try {
      const result = await AuthService.requestVerification(e164, mode);
      navigation.navigate('Otp', {
        phoneNumber: e164,
        verificationId: result.verificationId,
        purpose: mode,
        demoCode: result.code,
      });
    } catch (err: unknown) {
      const apiError = err as { status?: number };
      if (mode === 'login' && apiError.status === 400) {
        setError(getLocalizedText('auth.noAccountFound'));
        setShowRegister(true);
      } else if (mode === 'register' && apiError.status === 409) {
        setError(getLocalizedText('auth.accountAlreadyExists'));
        setShowLogin(true);
      } else {
        setError(getLocalizedText('auth.errorSendCode'));
      }
      shake();
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === 'login'
      ? getLocalizedText('auth.seConnecter')
      : getLocalizedText('auth.creerCompte');

  return (
    <LinearGradient
      colors={themeColors.background.gradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Safe area top — protège du Dynamic Island */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={Platform.OS !== 'web' ? Keyboard.dismiss : undefined} accessible={false}>
          <Animated.View
            style={[
              styles.content,
              {
                paddingTop: insets.top + spacing.xl,
                paddingBottom: insets.bottom + spacing.base,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.topRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={[styles.backText, { color: themeColors.primary }]}>←</Text>
              </TouchableOpacity>
              <AuthLanguageSwitcher />
            </View>

            {/* Logo animé — réduit au focus clavier */}
            <View style={styles.logoContainer}>
              <Animated.Image
                source={require('../../../assets/images/logo-icon.png')}
                style={{ width: logoSize, height: logoSize }}
                resizeMode="contain"
              />
            </View>

            <View style={[styles.titleContainer, keyboardVisible && styles.titleContainerCompact]}>
              <Text style={[styles.title, { fontSize: getFontSize('xxxl') }]}>
                {title}
              </Text>
              {!keyboardVisible && (
                <Text style={[styles.subtitle, { color: themeColors.text.secondary, fontSize: getFontSize('base') }]}>
                  {getLocalizedText('auth.smsCode')}
                </Text>
              )}
            </View>

            <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
              <Text style={[styles.label, { fontSize: getFontSize('base') }]}>
                {getLocalizedText('auth.phone')}
              </Text>

              <View
                style={[
                  styles.phoneInputContainer,
                  error ? styles.phoneInputContainerError : undefined,
                ]}
              >
                <TouchableOpacity
                  style={styles.countryCodeButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    if (showCountryPicker) {
                      setCountrySearch('');
                    }
                    setShowCountryPicker(!showCountryPicker);
                  }}
                >
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={[styles.countryCode, { color: themeColors.text.primary }]}>
                    {selectedCountry.code}
                  </Text>
                </TouchableOpacity>

                <View style={styles.phoneFieldWrap}>
                  <TextInput
                    ref={phoneInputRef}
                    style={styles.phoneField}
                    placeholder="07 12 34 56 78"
                    placeholderTextColor="rgba(0, 0, 0, 0.45)"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={(t) => {
                      const cleaned = t.replace(/[^0-9\s]/g, '');
                      setPhoneNumber(cleaned);
                      setError('');
                      setShowRegister(false);
                      setShowLogin(false);
                    }}
                  />
                </View>
              </View>

              {showCountryPicker && (
                <View
                  style={[
                    styles.countryPicker,
                    { backgroundColor: themeColors.background.secondary },
                  ]}
                >
                  <View style={styles.searchBarOuter}>
                    <TextInput
                      style={styles.searchField}
                      placeholder={getLocalizedText('auth.searchCountry')}
                      placeholderTextColor="rgba(0, 0, 0, 0.45)"
                      value={countrySearch}
                      onChangeText={setCountrySearch}
                      returnKeyType="search"
                    />
                  </View>

                  <ScrollView
                    style={styles.countriesList}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {filteredCountries.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.countryOption}
                        onPress={() => {
                          setSelectedCountry(item);
                          setCountrySearch('');
                          Keyboard.dismiss();
                          setShowCountryPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.countryOptionText,
                            { color: themeColors.text.primary, fontSize: getFontSize('base') },
                          ]}
                        >
                          {item.flag} {item.name} {item.code}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {filteredCountries.length === 0 && (
                      <Text
                        style={[
                          styles.noResultsText,
                          { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                        ]}
                      >
                        {getLocalizedText('auth.noCountryFound')}
                      </Text>
                    )}
                  </ScrollView>
                </View>
              )}

              {error !== '' && (
                <Text style={[styles.errorText, { fontSize: getFontSize('sm') }]}>
                  {error}
                </Text>
              )}
            </Animated.View>

            {/* Bouton toujours dans le flux — visible clavier ouvert */}
            <View style={styles.buttons}>
              {showRegister ? (
                <Button
                  title={getLocalizedText('auth.creerCompte')}
                  variant="primary"
                  size="large"
                  fullWidth
                  onPress={() => {
                    navigation.replace('PhoneInput', { mode: 'register' });
                  }}
                />
              ) : showLogin ? (
                <Button
                  title={getLocalizedText('auth.seConnecter')}
                  variant="primary"
                  size="large"
                  fullWidth
                  onPress={() => {
                    navigation.replace('PhoneInput', { mode: 'login' });
                  }}
                />
              ) : (
                <Button
                  title={getLocalizedText('auth.continue')}
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={loading}
                  disabled={!isPhoneValid || loading}
                  onPress={handleContinue}
                />
              )}
            </View>
          </Animated.View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    // paddingTop / paddingBottom injectés dynamiquement via insets
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backButton: {
    minWidth: 44,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 28,
    fontWeight: '300',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  titleContainerCompact: {
    marginBottom: spacing.lg,
  },
  title: {
    fontWeight: '800',
    color: colors.text.light,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.light,
    opacity: 0.75,
    textAlign: 'center',
  },
  form: {
    marginBottom: spacing.lg,
  },
  label: {
    fontWeight: '600',
    color: colors.text.light,
    marginBottom: spacing.sm,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  countryCodeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing.base,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 88,
    minHeight: 44,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCode: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
  },
  phoneFieldWrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  phoneField: {
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  countryPicker: {
    borderRadius: 12,
    marginTop: spacing.md,
    padding: spacing.md,
    maxHeight: 240,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  searchBarOuter: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  searchField: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  countriesList: {
    maxHeight: 168,
  },
  countryOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.xs,
  },
  countryOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  noResultsText: {
    textAlign: 'center',
    paddingVertical: spacing.md,
    opacity: 0.75,
  },
  errorText: {
    color: colors.ui.error,
    marginTop: spacing.sm,
    fontWeight: '500',
  },
  buttons: {
    // Toujours présent dans le layout, disabled géré par le prop Button
  },
});
