/**
 * Verification Screen - Whispr
 * SMS code verification with 6 individual inputs (Telegram style)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { Logo, Button } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useTheme } from '../../context/ThemeContext';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'Verification'>;
type RoutePropType = RouteProp<AuthStackParamList, 'Verification'>;

export const VerificationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { phoneNumber, isLogin = false } = route.params || { phoneNumber: '', isLogin: false };
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(120); // 2 minutes
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Auto-focus first input
    inputRefs.current[0]?.focus();

    // Timer countdown
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleCodeChange = (text: string, index: number) => {
    // Clear error on input
    setError('');
    
    if (text.length > 1) {
      // Pasted code (OTP Autofill)
      const digits = text.slice(0, 6).split('');
      const newCode = [...code];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);
      
      // Auto-verify pasted code
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        setTimeout(() => handleVerify(newCode), 500);
      }
      
      inputRefs.current[5]?.focus();
      return;
    }

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all filled (avec délai pour éviter la disparition)
    if (index === 5 && text) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        setTimeout(() => handleVerify(newCode), 1000);
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const shakeInputs = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    
    // Vibration pour le feedback haptique
    if (Platform.OS === 'ios') {
      Vibration.vibrate(200);
    }
  };

  const pulseInputs = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.1, duration: 100, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleVerify = async (codeToVerify = code) => {
    const fullCode = codeToVerify.join('');
    
    if (fullCode.length !== 6) {
      setError('Veuillez entrer le code complet');
      shakeInputs();
      return;
    }

    setLoading(true);

    try {
      // TODO: API call
      // await authService.verify({ phone: phoneNumber, code: fullCode })
      
      // Simulate API
      setTimeout(() => {
        if (fullCode === '123456') { // Demo code
          setLoading(false);
          
          if (isLogin) {
            // Pour la connexion, aller directement à la home page (ConversationsList)
                 Alert.alert(
              getLocalizedText('auth.loginSuccess'),
              getLocalizedText('auth.welcome'),
              [
                {
                  text: getLocalizedText('auth.continue'),
                  onPress: () => {
                    navigation.navigate('ConversationsList');
                  }
                }
              ]
            );
          } else {
            // Pour l'inscription, aller au setup du profil
            Alert.alert(
              getLocalizedText('auth.codeVerified'),
              getLocalizedText('auth.phoneVerified'),
              [
                {
                  text: getLocalizedText('auth.continue'),
                  onPress: () => {
                    navigation.navigate('ProfileSetup', { 
                      userId: 'demo-user-id',
                      token: 'demo-token'
                    });
                  }
                }
              ]
            );
          }
        } else {
                 setLoading(false);
          setError(getLocalizedText('auth.codeIncorrect'));
          shakeInputs();
          setCode(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      }, 1500);
    } catch (error) {
      setLoading(false);
      shakeInputs();
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  };

  const handleResendCode = () => {
    if (!canResend) return;
    
    Alert.alert(
      'Code renvoyé',
      `Un nouveau code a été envoyé au ${phoneNumber}`,
      [{ text: 'OK' }]
    );
    
    setTimer(120);
    setCanResend(false);
    setCode(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Back Button */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Retour</Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <Logo variant="icon" size="large" />
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: themeColors.text.primary, fontSize: getFontSize('xxxl') }]}>{getLocalizedText('auth.verificationTitle')}</Text>
            <Text style={[styles.subtitle, { color: themeColors.text.secondary, fontSize: getFontSize('base') }]}>
              {getLocalizedText('auth.verificationSubtitle')} {phoneNumber}
            </Text>
            <Text style={styles.demoInfo}>
              💡 Code de démonstration : 123456
            </Text>
          </View>

          {/* Code Inputs avec animations */}
          <Animated.View 
            style={[
              styles.codeContainer,
              { 
                transform: [
                  { translateX: shakeAnim },
                  { scale: pulseAnim }
                ]
              }
            ]}
          >
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  if (ref) inputRefs.current[index] = ref;
                }}
                style={[
                  styles.codeInput,
                  digit && styles.codeInputFilled,
                  error && styles.codeInputError,
                ]}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                onFocus={() => pulseInputs()}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                importantForAutofill="yes"
              />
            ))}
          </Animated.View>

          {/* Error Message */}
          {error && (
            <Animated.View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* Timer / Resend */}
          <View style={styles.timerContainer}>
            {canResend ? (
              <TouchableOpacity onPress={handleResendCode}>
                <Text style={[styles.resendText, { color: themeColors.primary, fontSize: getFontSize('base') }]}>{getLocalizedText('auth.resendCode')}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.timerText}>
                {getLocalizedText('auth.resendIn')} {formatTime(timer)}
              </Text>
            )}
          </View>

          {/* Verify Button */}
          <View style={styles.buttonContainer}>
            <Button
              title={getLocalizedText('auth.verify')}
              variant="primary"
              size="large"
              onPress={() => handleVerify()}
              loading={loading}
              disabled={code.join('').length !== 6}
              fullWidth
            />
          </View>
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
  backButton: {
    position: 'absolute',
    top: spacing.xxxl + 10,
    left: spacing.lg,
    zIndex: 10,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.text.light,
    fontWeight: '600',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: '800',
    color: colors.text.light,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.light,
    opacity: 0.8,
    textAlign: 'center',
  },
  demoInfo: {
    fontSize: typography.fontSize.sm,
    color: colors.primary.main,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  codeInput: {
    width: 50,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    textAlign: 'center',
    fontSize: typography.fontSize.xxl,
    fontWeight: '700',
    color: colors.text.light,
  },
  codeInputFilled: {
    backgroundColor: 'rgba(254, 122, 92, 0.3)',
    borderColor: colors.primary.main,
  },
  codeInputError: {
    borderColor: colors.ui.error,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  errorContainer: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.ui.error,
    fontWeight: '500',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  timerText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.light,
    opacity: 0.7,
  },
  resendText: {
    fontSize: typography.fontSize.md,
    color: colors.primary.main,
    fontWeight: '600',
  },
  buttonContainer: {
    marginBottom: spacing.lg,
  },
});

export default VerificationScreen;


