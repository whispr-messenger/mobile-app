/**
 * Profile Setup Screen - Whispr
 * User profile creation after verification
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { Logo, Button, Input } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useTheme } from '../../context/ThemeContext';
import { AuthService } from '../../services/auth';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'ProfileSetup'>;
type RoutePropType = RouteProp<AuthStackParamList, 'ProfileSetup'>;

export const ProfileSetupScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { userId, token, verificationId } = route.params;
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
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

  const handleImagePicker = () => {
    const options = ['Caméra', 'Galerie', 'Annuler'];
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 2,
          title: 'Choisir une photo',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            openCamera();
          } else if (buttonIndex === 1) {
            openGallery();
          }
        }
      );
    } else {
      Alert.alert(
        'Choisir une photo',
        'Comment voulez-vous ajouter une photo ?',
        [
          { text: 'Caméra', onPress: openCamera },
          { text: 'Galerie', onPress: openGallery },
          { text: 'Annuler', style: 'cancel' }
        ]
      );
    }
  };

  const openCamera = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission requise', 'Permission caméra refusée');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur caméra:', error);
      Alert.alert('Erreur', 'Impossible d\'accéder à la caméra');
    }
  };

  const openGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission requise', 'Permission galerie refusée');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur galerie:', error);
      Alert.alert('Erreur', 'Impossible d\'accéder à la galerie');
    }
  };

  const handleContinue = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre prénom et nom');
      return;
    }

    if (!verificationId) {
      Alert.alert('Erreur', 'Erreur: verificationId manquant');
      return;
    }

    setLoading(true);

    try {
      // Finaliser l'inscription avec le profil
      const result = await AuthService.register(
        verificationId,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          profilePicture: profilePhoto || undefined,
        },
        {
          name: 'Mobile Device',
          type: 'mobile',
        }
      );

      setLoading(false);

      if (result.success && result.data) {
        Alert.alert(
          'Compte créé ! 🎉',
          'Votre compte Whispr est prêt',
          [{ 
            text: 'Continuer',
            onPress: () => {
              // Navigation vers ConversationsList (home page)
              navigation.navigate('ConversationsList');
            }
          }]
        );
      } else {
        Alert.alert('Erreur', result.message || 'Impossible de créer le profil');
      }
    } catch (error: any) {
      setLoading(false);
      console.error('Erreur création profil:', error);
      Alert.alert('Erreur', error.message || 'Impossible de créer le profil');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Passer cette étape ?',
      'Vous pourrez ajouter ces informations plus tard',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Passer',
          onPress: () => {
            // TODO: Navigate to Home
            Alert.alert('Navigation', 'Redirection vers Home (à implémenter)');
          }
        },
      ]
    );
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
          {/* Skip Button */}
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Passer →</Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <Logo variant="icon" size="medium" />
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Votre profil</Text>
            <Text style={styles.subtitle}>
              Ajoutez vos informations pour personnaliser votre compte
            </Text>
          </View>

          {/* Photo Picker */}
            <TouchableOpacity 
              style={styles.photoContainer}
              onPress={handleImagePicker}
            >
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>📸</Text>
                <Text style={styles.photoPlaceholderLabel}>Ajouter une photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Form */}
          <View style={styles.formContainer}>
            <Input
              label="Prénom"
              placeholder="John"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="name"
              containerStyle={styles.input}
              style={{ color: colors.text.primary }}
            />

            <Input
              label="Nom (optionnel)"
              placeholder="Doe"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
              containerStyle={styles.input}
              style={{ color: colors.text.primary }}
            />
          </View>

          {/* Continue Button */}
          <Button
            title="Terminer"
            variant="primary"
            size="large"
            onPress={handleContinue}
            loading={loading}
            disabled={!firstName.trim()}
            fullWidth
          />
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
  skipButton: {
    position: 'absolute',
    top: spacing.xxxl + 10,
    right: spacing.lg,
    zIndex: 10,
  },
  skipButtonText: {
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
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: '800',
    color: colors.text.light,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.light,
    opacity: 0.8,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.primary.main,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  photoPlaceholderLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.light,
    opacity: 0.7,
  },
  formContainer: {
    marginBottom: spacing.xl,
  },
  input: {
    marginBottom: spacing.md,
  },
});

export default ProfileSetupScreen;


