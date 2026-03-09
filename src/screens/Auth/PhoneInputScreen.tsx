import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { countries, type Country } from '../../data/countries';
import { AuthService } from '../../services/AuthService';
import { colors, spacing, typography } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { normalizePhoneToE164 } from '../../utils/phoneUtils';

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
    ? countries.filter(
        (c) =>
          c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
          c.code.includes(countrySearch)
      )
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
            {/* Back */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={[styles.backText, { color: themeColors.primary }]}>←</Text>
            </TouchableOpacity>

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

              <View style={[styles.phoneRow, error ? styles.phoneRowError : undefined]}>
                <TouchableOpacity
                  style={styles.countryButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowCountryPicker(true);
                  }}
                >
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                  <Text style={styles.countryChevron}>▾</Text>
                </TouchableOpacity>

                <TextInput
                  ref={phoneInputRef}
                  style={styles.phoneInput}
                  placeholder="7 12 34 56 78"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={(t) => {
                    setPhoneNumber(t);
                    setError('');
                    setShowRegister(false);
                  }}
                />
              </View>

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

      {/* Country picker modal */}
      <Modal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowCountryPicker(false);
        }}
      >
        {/* Overlay : tap outside → ferme modal + clavier */}
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            setShowCountryPicker(false);
          }}
          accessible={false}
        >
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        {/* Sheet : KeyboardAvoidingView pour que la liste remonte avec le clavier */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalSheetWrapper}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom || spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {getLocalizedText('auth.searchCountry')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setShowCountryPicker(false);
                }}
              >
                <Text style={styles.modalClose}>{getLocalizedText('auth.cancel')}</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder={getLocalizedText('auth.searchCountry')}
              placeholderTextColor={colors.text.placeholder}
              value={countrySearch}
              onChangeText={setCountrySearch}
              returnKeyType="search"
            />

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={styles.countryList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryOption}
                  onPress={() => {
                    setSelectedCountry(item);
                    setCountrySearch('');
                    Keyboard.dismiss();
                    setShowCountryPicker(false);
                  }}
                >
                  <Text style={styles.countryOptionFlag}>{item.flag}</Text>
                  <Text style={styles.countryOptionName}>{item.name}</Text>
                  <Text style={styles.countryOptionCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.noResults}>
                  {getLocalizedText('auth.noCountryFound')}
                </Text>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  backButton: {
    marginBottom: spacing.md,
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
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    overflow: 'hidden',
    height: 56,
  },
  phoneRowError: {
    borderColor: colors.ui.error,
    backgroundColor: 'rgba(255,59,48,0.1)',
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.15)',
    gap: spacing.xs,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCode: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.text.light,
  },
  countryChevron: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 2,
  },
  phoneInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.lg,
    fontWeight: '500',
    color: colors.text.light,
  },
  errorText: {
    color: colors.ui.error,
    marginTop: spacing.sm,
    fontWeight: '500',
  },
  buttons: {
    // Toujours présent dans le layout, disabled géré par le prop Button
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheetWrapper: {
    // Positionné en absolu en bas de l'écran
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalSheet: {
    backgroundColor: colors.background.darkCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: 480,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: colors.text.light,
  },
  modalClose: {
    fontSize: typography.fontSize.base,
    color: colors.primary.main,
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.light,
    marginBottom: spacing.md,
  },
  countryList: {
    flexGrow: 0,
  },
  countryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    gap: spacing.sm,
  },
  countryOptionFlag: {
    fontSize: 22,
  },
  countryOptionName: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.light,
  },
  countryOptionCode: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  noResults: {
    textAlign: 'center',
    color: colors.text.secondary,
    paddingVertical: spacing.xl,
    fontSize: typography.fontSize.sm,
  },
});
