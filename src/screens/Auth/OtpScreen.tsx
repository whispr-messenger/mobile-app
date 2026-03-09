import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Button } from '../../components';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AuthService } from '../../services/AuthService';
import { TokenService } from '../../services/TokenService';
import { colors, spacing, typography } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'Otp'>;
type OtpRouteProp = RouteProp<AuthStackParamList, 'Otp'>;

const OTP_LENGTH = 6;
const RESEND_DELAY = 60;

export const OtpScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<OtpRouteProp>();
  const { phoneNumber, verificationId, purpose, demoCode } = route.params;

  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();
  const { signIn } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(RESEND_DELAY);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();

    // Auto-focus first input
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  // Resend countdown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const shake = () => {
    if (Platform.OS !== 'web') Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const submittingRef = useRef(false);

  const handleSubmit = useCallback(
    async (code: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setLoading(true);
      setError('');

      try {
        const confirmResult = await AuthService.confirmVerification(
          verificationId,
          code,
          purpose
        );

        if (!confirmResult.verified) {
          setError(getLocalizedText('auth.codeIncorrect'));
          shake();
          setLoading(false);
          submittingRef.current = false;
          return;
        }

        const tokens =
          purpose === 'register'
            ? await AuthService.register(verificationId)
            : await AuthService.login(verificationId);

        const payload = TokenService.decodeAccessToken(tokens.accessToken);
        if (!payload) throw new Error('Invalid token');

        signIn(payload.sub, payload.deviceId);

        if (purpose === 'register') {
          navigation.reset({ index: 0, routes: [{ name: 'ProfileSetup' }] });
        } else {
          navigation.reset({ index: 0, routes: [{ name: 'ConversationsList' }] });
        }
      } catch (err: unknown) {
        const apiError = err as { status?: number };
        if (apiError.status === 400) {
          setError(getLocalizedText('auth.codeIncorrect'));
        } else {
          setError(getLocalizedText('auth.errorConnection'));
        }
        shake();
        setLoading(false);
        submittingRef.current = false;
      }
    },
    [verificationId, purpose, signIn, navigation, getLocalizedText]
  );

  const handleDigitChange = (value: string, index: number) => {
    // Handle paste of full code
    if (value.length === OTP_LENGTH) {
      const newDigits = value.slice(0, OTP_LENGTH).split('');
      setDigits(newDigits);
      inputRefs.current[OTP_LENGTH - 1]?.focus();
      handleSubmit(newDigits.join(''));
      return;
    }

    const digit = value.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const code = newDigits.join('');
    if (newDigits.every((d) => d !== '') && code.length === OTP_LENGTH) {
      handleSubmit(code);
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && digits[index] === '' && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await AuthService.requestVerification(phoneNumber, purpose);
      setResendCountdown(RESEND_DELAY);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch {
      setError(getLocalizedText('auth.errorSendCode'));
    } finally {
      setResending(false);
    }
  };

  const maskedPhone = phoneNumber.replace(/(\+\d{2})(\d+)(\d{2})$/, (_, p1, p2, p3) =>
    `${p1}${'•'.repeat(p2.length)}${p3}`
  );

  return (
    <LinearGradient
      colors={themeColors.background.gradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Back */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={[styles.backText, { color: themeColors.primary }]}>←</Text>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: themeColors.text.primary, fontSize: getFontSize('xxl') }]}>
              {getLocalizedText('auth.verificationTitle')}
            </Text>
            <Text style={[styles.subtitle, { color: themeColors.text.secondary, fontSize: getFontSize('base') }]}>
              {getLocalizedText('auth.verificationSubtitle')}
            </Text>
            <Text style={[styles.phone, { color: themeColors.text.primary, fontSize: getFontSize('lg') }]}>
              {maskedPhone}
            </Text>
          </View>

          {/* DEMO_MODE hint */}
          {demoCode !== undefined && (
            <View style={styles.demoBanner}>
              <Text style={styles.demoText}>DEMO — code : {demoCode}</Text>
            </View>
          )}

          {/* OTP inputs */}
          <Animated.View
            style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}
          >
            {Array(OTP_LENGTH)
              .fill(null)
              .map((_, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { inputRefs.current[i] = ref; }}
                  style={[
                    styles.otpCell,
                    focusedIndex === i && styles.otpCellFocused,
                    digits[i] !== '' && styles.otpCellFilled,
                    error !== '' && styles.otpCellError,
                  ]}
                  value={digits[i]}
                  onChangeText={(v) => handleDigitChange(v, i)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                  onFocus={() => setFocusedIndex(i)}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  selectTextOnFocus
                  caretHidden
                />
              ))}
          </Animated.View>

          {error !== '' && (
            <Text style={[styles.errorText, { fontSize: getFontSize('sm') }]}>
              {error}
            </Text>
          )}

          <Button
            title={getLocalizedText('auth.verify')}
            variant="primary"
            size="large"
            fullWidth
            loading={loading}
            disabled={digits.some((d) => d === '') || loading}
            onPress={() => handleSubmit(digits.join(''))}
          />

          {/* Resend */}
          <View style={styles.resendContainer}>
            {resendCountdown > 0 ? (
              <Text style={[styles.resendTimer, { color: themeColors.text.secondary, fontSize: getFontSize('sm') }]}>
                {getLocalizedText('auth.resendIn')} {resendCountdown}s
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={resending}>
                <Text style={[styles.resendLink, { color: themeColors.primary, fontSize: getFontSize('base') }]}>
                  {resending ? '...' : getLocalizedText('auth.resendCode')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: spacing.xl + 20,
    left: spacing.xl,
  },
  backText: {
    fontSize: 28,
    fontWeight: '300',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  title: {
    fontWeight: '800',
    color: colors.text.light,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.text.light,
    opacity: 0.7,
    textAlign: 'center',
  },
  phone: {
    fontWeight: '700',
    color: colors.text.light,
    marginTop: spacing.xs,
  },
  demoBanner: {
    backgroundColor: 'rgba(254,122,92,0.2)',
    borderWidth: 1,
    borderColor: colors.primary.main,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  demoText: {
    color: colors.primary.main,
    fontWeight: '700',
    fontSize: typography.fontSize.base,
    letterSpacing: 2,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  otpCell: {
    width: 46,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    textAlign: 'center',
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: colors.text.light,
  },
  otpCellFocused: {
    borderColor: colors.primary.main,
    borderWidth: 2,
    backgroundColor: 'rgba(254,122,92,0.1)',
  },
  otpCellFilled: {
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  otpCellError: {
    borderColor: colors.ui.error,
    backgroundColor: 'rgba(255,59,48,0.1)',
  },
  errorText: {
    color: colors.ui.error,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  resendTimer: {
    opacity: 0.7,
  },
  resendLink: {
    fontWeight: '600',
  },
});
