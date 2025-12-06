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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { Logo, Button } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'Verification'>;
type RoutePropType = RouteProp<AuthStackParamList, 'Verification'>;

export const VerificationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { phoneNumber } = route.params;

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(120); // 2 minutes
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

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

    return () => clearInterval(interval);
  }, []);

  const handleCodeChange = (text: string, index: number) => {
    if (text.length > 1) {
      // Pasted code
      const digits = text.slice(0, 6).split('');
      const newCode = [...code];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);
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

    // Auto-verify when all filled
    if (index === 5 && text) {
      setTimeout(() => handleVerify(newCode), 1000); // Délai plus long pour laisser le temps de voir
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
  };

  const handleVerify = async (codeToVerify = code) => {
    const fullCode = codeToVerify.join('');
    
    if (fullCode.length !== 6) {
      Alert.alert('Erreur', 'Veuillez entrer le code complet');
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
          Alert.alert(
            'Code vérifié ! ✅',
            'Votre numéro est maintenant vérifié',
            [
              {
                text: 'Continuer',
                onPress: () => {
                  navigation.navigate('ProfileSetup', { 
                    userId: 'demo-user-id',
                    token: 'demo-token'
                  });
                }
              }
            ]
          );
        } else {
          setLoading(false);
          shakeInputs();
          setCode(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
          Alert.alert('Code invalide', 'Veuillez réessayer');
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
      colors={[colors.background.dark, colors.secondary.darker, colors.secondary.dark]}
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
            <Text style={styles.title}>Vérification</Text>
            <Text style={styles.subtitle}>
              Code envoyé au {phoneNumber}
            </Text>
            <Text style={styles.demoInfo}>
              💡 Code de démonstration : 123456
            </Text>
          </View>

          {/* Code Inputs */}
          <Animated.View 
            style={[
              styles.codeContainer,
              { transform: [{ translateX: shakeAnim }] }
            ]}
          >
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.codeInput,
                  digit && styles.codeInputFilled,
                ]}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                textContentType="oneTimeCode"
              />
            ))}
          </Animated.View>

          {/* Timer / Resend */}
          <View style={styles.timerContainer}>
            {canResend ? (
              <TouchableOpacity onPress={handleResendCode}>
                <Text style={styles.resendText}>Renvoyer le code</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.timerText}>
                Renvoyer dans {formatTime(timer)}
              </Text>
            )}
          </View>

          {/* Verify Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Vérifier"
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


