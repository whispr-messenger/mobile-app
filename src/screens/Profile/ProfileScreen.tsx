/**
 * ProfileScreen - User Profile Management
 * WHISPR-132: Implement ProfileScreen with user profile management
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Image,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Logo, Button } from "../../components";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../theme";
import { UserService } from "../../services";
import { MediaService } from "../../services/MediaService";

// Types
interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  biography: string;
  profilePicture?: string;
  isOnline: boolean;
  lastSeen?: string;
  createdAt?: string;
}

interface ProfileScreenProps {
  userId?: string;
  token?: string;
}

type NavigationProp = StackNavigationProp<any, "Profile">;
type RouteParams = {
  userId?: string;
  token?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  biography?: string;
  profilePicture?: string;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  userId,
  token,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const params = (route as any)?.params as RouteParams | undefined;
  // ProfileScreen params loaded

  // States
  const [profile, setProfile] = useState<UserProfile>({
    id: params?.userId || userId || "",
    firstName: params?.firstName || "",
    lastName: params?.lastName || "",
    username: params?.username || "",
    phoneNumber: params?.phoneNumber || "",
    biography: params?.biography || "",
    profilePicture: params?.profilePicture,
    isOnline: true,
    lastSeen: "Maintenant",
    createdAt: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
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
    // Load from API unless navigation params already provided full data
    const loadProfile = async () => {
      if (params?.firstName && params?.lastName) return;
      try {
        const service = UserService.getInstance();
        const res = await service.getProfile();
        if (res.success && res.profile) {
          setProfile((prev) => ({
            ...prev,
            firstName: res.profile!.firstName || prev.firstName || "",
            lastName: res.profile!.lastName || prev.lastName || "",
            username: res.profile!.username || prev.username || "",
            phoneNumber: res.profile!.phoneNumber || prev.phoneNumber || "",
            biography: res.profile!.biography || prev.biography || "",
            profilePicture: res.profile!.profilePicture,
            createdAt: res.profile!.createdAt || prev.createdAt,
          }));
        }
      } catch (e) {
        console.error("[ProfileScreen] Failed to load profile:", e);
      }
    };

    loadProfile();
  }, []);

  // Handle profile picture change
  const handleImagePicker = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission refusée",
          "Permission d'accès à la galerie requise",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfile((prev) => ({
          ...prev,
          profilePicture: result.assets[0].uri,
        }));
        setShowImagePicker(false);
        Alert.alert("Succès", "Photo de profil mise à jour");
      }
    } catch (error) {
      console.error("Erreur sélection image:", error);
      Alert.alert("Erreur", "Impossible de sélectionner l'image");
    }
  };

  // Handle camera capture
  const handleCameraCapture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission refusée",
          "Permission d'accès à la caméra requise",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfile((prev) => ({
          ...prev,
          profilePicture: result.assets[0].uri,
        }));
        setShowImagePicker(false);
        Alert.alert("Succès", "Photo de profil mise à jour");
      }
    } catch (error) {
      console.error("Erreur capture caméra:", error);
      Alert.alert("Erreur", "Impossible d'utiliser la caméra");
    }
  };

  // Handle profile update
  const handleSaveProfile = async () => {
    // Validation globale avant sauvegarde
    const errors: string[] = [];

    const firstNameError = validateField("firstName", profile.firstName);
    if (firstNameError) errors.push(`Prénom: ${firstNameError}`);

    const lastNameError = validateField("lastName", profile.lastName);
    if (lastNameError) errors.push(`Nom: ${lastNameError}`);

    const usernameError = validateField("username", profile.username);
    if (usernameError) errors.push(`Nom d'utilisateur: ${usernameError}`);

    const phoneError = validateField("phoneNumber", profile.phoneNumber);
    if (phoneError) errors.push(`Téléphone: ${phoneError}`);

    const bioError = validateField("biography", profile.biography);
    if (bioError) errors.push(`Biographie: ${bioError}`);

    if (errors.length > 0) {
      Alert.alert("Erreurs de validation", errors.join("\n\n"));
      return;
    }

    setLoading(true);

    // Animation feedback
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      // Upload avatar if it's a local URI (not already a remote URL)
      let profilePictureUrl = profile.profilePicture;
      const previousProfilePicture = profile.profilePicture;
      if (
        profilePictureUrl &&
        (profilePictureUrl.startsWith("file://") ||
          profilePictureUrl.startsWith("content://") ||
          profilePictureUrl.startsWith("ph://"))
      ) {
        try {
          const fileName = profilePictureUrl.split("/").pop() || "avatar.jpg";
          const fileType = fileName.endsWith(".png")
            ? "image/png"
            : "image/jpeg";
          const uploadResult = await MediaService.uploadMedia({
            uri: profilePictureUrl,
            name: fileName,
            type: fileType,
          });
          profilePictureUrl = uploadResult.url;
          setProfile((prev) => ({
            ...prev,
            profilePicture: uploadResult.url,
          }));
        } catch (uploadError) {
          console.warn("[ProfileScreen] Avatar upload failed:", uploadError);
          // Revert to previous profile picture to avoid broken state
          setProfile((prev) => ({
            ...prev,
            profilePicture: previousProfilePicture,
          }));
          Alert.alert("Erreur", "Impossible de télécharger la photo de profil");
          setLoading(false);
          return;
        }
      }

      const service = UserService.getInstance();
      const res = await service.updateProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        username: profile.username,
        biography: profile.biography,
        profilePicture: profilePictureUrl,
      });

      if (!res.success) {
        Alert.alert(
          "Erreur",
          res.message || "Impossible de mettre à jour le profil",
        );
        return;
      }

      if (res.profile) {
        setProfile((prev) => ({ ...prev, ...res.profile }));
      }

      setIsEditing(false);
      Alert.alert("Succès", "Profil mis à jour avec succès");
    } catch (error) {
      Alert.alert("Erreur", "Impossible de mettre à jour le profil");
    } finally {
      setLoading(false);
    }
  };

  // Validation functions
  const validateField = (
    field: keyof UserProfile,
    value: string | null | undefined,
  ): string | null => {
    const v = value || "";
    switch (field) {
      case "firstName":
      case "lastName":
        if (!v.trim()) return "Ce champ est obligatoire";
        if (v.trim().length < 2) return "Minimum 2 caractères";
        if (v.trim().length > 50) return "Maximum 50 caractères";
        return null;

      case "username":
        if (!v.trim()) return "Le nom d'utilisateur est obligatoire";
        if (v.trim().length < 3) return "Minimum 3 caractères";
        if (v.trim().length > 20) return "Maximum 20 caractères";
        if (!/^[a-zA-Z0-9_]+$/.test(v.trim()))
          return "Seuls lettres, chiffres et _ autorisés";
        return null;

      case "phoneNumber":
        if (!v.trim()) return "Le numéro de téléphone est obligatoire";
        const cleanNumber = v.replace(/\s/g, "");
        // Validation format international E.164: +[code pays][numéro]
        // Exemples: +33123456789, +1234567890, +86123456789
        if (!/^\+[1-9]\d{1,14}$/.test(cleanNumber))
          return "Format international invalide (ex: +33 1 23 45 67 89)";
        if (cleanNumber.length < 8 || cleanNumber.length > 16)
          return "Numéro trop court ou trop long (8-16 chiffres)";
        return null;

      case "biography":
        if (v.length > 500) return "Maximum 500 caractères";
        return null;

      default:
        return null;
    }
  };

  // Handle field change with validation
  const handleFieldChange = (field: keyof UserProfile, value: string) => {
    const error = validateField(field, value);

    // Update profile
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Show validation error if any
    if (error) {
      Alert.alert("Erreur de validation", error);
    }
  };

  // Handle settings navigation
  const handleSettingsPress = () => {
    navigation.navigate("Settings");
  };

  // Handle home navigation (ConversationsList)
  const handleHomePress = () => {
    navigation.navigate("ConversationsList");
  };

  // Handle back navigation
  const handleBackPress = () => {
    if (isEditing) {
      Alert.alert(
        "Modifications non sauvegardées",
        "Voulez-vous vraiment quitter sans sauvegarder ?",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Quitter", onPress: () => setIsEditing(false) },
        ],
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBackPress}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← Retour</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Profil</Text>

            {!isEditing ? (
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={handleHomePress}
                  style={styles.homeButton}
                >
                  <Ionicons
                    name="chatbubbles"
                    size={24}
                    color={colors.text.light}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSettingsPress}
                  style={styles.settingsButton}
                >
                  <Text style={styles.settingsButtonText}>⚙️</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setIsEditing(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Picture Section */}
            <Animated.View
              style={[
                styles.profilePictureSection,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <TouchableOpacity
                onPress={() => setShowImagePicker(true)}
                style={styles.profilePictureContainer}
                disabled={!isEditing}
              >
                {profile.profilePicture ? (
                  <Image
                    source={{ uri: profile.profilePicture }}
                    style={styles.profilePicture}
                  />
                ) : (
                  <View style={styles.profilePicturePlaceholder}>
                    <Text style={styles.profilePicturePlaceholderText}>
                      {(profile.firstName || "").charAt(0)}
                      {(profile.lastName || "").charAt(0)}
                    </Text>
                  </View>
                )}

                {isEditing && (
                  <View style={styles.editOverlay}>
                    <Ionicons name="camera" size={18} color="#333" />
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.profilePictureLabel}>
                {isEditing ? "Appuyez pour changer" : "Photo de profil"}
              </Text>
            </Animated.View>

            {/* Profile Information */}
            <View style={styles.profileInfo}>
              {/* Name Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Nom complet</Text>
                {isEditing ? (
                  <View style={styles.nameInputsContainer}>
                    <TextInput
                      style={[styles.input, styles.nameInput]}
                      value={profile.firstName}
                      onChangeText={(text) =>
                        handleFieldChange("firstName", text)
                      }
                      placeholder="Prénom"
                      placeholderTextColor="rgba(255,255,255,0.5)"
                    />
                    <TextInput
                      style={[styles.input, styles.nameInput]}
                      value={profile.lastName}
                      onChangeText={(text) =>
                        handleFieldChange("lastName", text)
                      }
                      placeholder="Nom"
                      placeholderTextColor="rgba(255,255,255,0.5)"
                    />
                  </View>
                ) : (
                  <Text style={styles.sectionValue}>
                    {profile.firstName} {profile.lastName}
                  </Text>
                )}
              </View>

              {/* Username Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Nom d'utilisateur</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={profile.username}
                    onChangeText={(text) => handleFieldChange("username", text)}
                    placeholder="@nomdutilisateur"
                    placeholderTextColor={colors.text.placeholder}
                    autoCapitalize="none"
                  />
                ) : (
                  <Text style={styles.sectionValue}>@{profile.username}</Text>
                )}
              </View>

              {/* Phone Number Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Numéro de téléphone</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={profile.phoneNumber}
                    onChangeText={(text) =>
                      handleFieldChange("phoneNumber", text)
                    }
                    placeholder="+33 07 12 34 56 78"
                    placeholderTextColor={colors.text.placeholder}
                    keyboardType="phone-pad"
                  />
                ) : (
                  <Text style={styles.sectionValue}>{profile.phoneNumber}</Text>
                )}
              </View>

              {/* Biography Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Biographie</Text>
                {isEditing ? (
                  <>
                    <TextInput
                      style={[styles.input, styles.biographyInput]}
                      value={profile.biography}
                      onChangeText={(text) =>
                        handleFieldChange("biography", text)
                      }
                      placeholder="Parlez-nous de vous..."
                      placeholderTextColor={colors.text.placeholder}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      maxLength={500}
                    />
                    <Text style={styles.characterCount}>
                      {(profile.biography || "").length}/500 caractères
                    </Text>
                  </>
                ) : (
                  <Text style={styles.sectionValue}>{profile.biography}</Text>
                )}
              </View>

              {/* Status Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Statut</Text>
                <View
                  style={[
                    styles.statusChip,
                    profile.isOnline
                      ? styles.statusChipOnline
                      : styles.statusChipOffline,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDotSmall,
                      {
                        backgroundColor: profile.isOnline
                          ? colors.status.online
                          : colors.status.offline,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      profile.isOnline
                        ? styles.statusTextOnline
                        : styles.statusTextOffline,
                    ]}
                  >
                    {profile.isOnline
                      ? "Actif maintenant"
                      : `Hors ligne - ${profile.lastSeen}`}
                  </Text>
                </View>
              </View>

              {/* Member Since Section */}
              {profile.createdAt && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Membre depuis</Text>
                  <Text style={styles.sectionValue}>
                    {new Date(profile.createdAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {!isEditing ? (
                <Button
                  title="Modifier le profil"
                  variant="primary"
                  size="large"
                  onPress={() => setIsEditing(true)}
                  fullWidth
                />
              ) : (
                <Button
                  title={loading ? "Sauvegarde..." : "Sauvegarder"}
                  variant="primary"
                  size="large"
                  onPress={handleSaveProfile}
                  loading={loading}
                  fullWidth
                />
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Alerte centrée (style iOS) pour changer la photo */}
      <Modal
        visible={showImagePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImagePicker(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>Changer la photo de profil</Text>
            <Text style={styles.alertSubtitle}>Sélectionnez une option</Text>

            <TouchableOpacity
              style={styles.alertAction}
              onPress={handleCameraCapture}
            >
              <Ionicons
                name="camera"
                size={18}
                color="#0A84FF"
                style={styles.alertIcon}
              />
              <Text style={styles.alertActionText}>Prendre une photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.alertAction}
              onPress={handleImagePicker}
            >
              <Ionicons
                name="image"
                size={18}
                color="#0A84FF"
                style={styles.alertIcon}
              />
              <Text style={styles.alertActionText}>
                Choisir depuis la galerie
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.alertCancel}
              onPress={() => setShowImagePicker(false)}
            >
              <Text style={styles.alertCancelText}>Continuer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.lg,
    backgroundColor: "transparent",
    borderBottomWidth: 0,
  },
  backButton: {
    padding: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.text.light,
    fontWeight: typography.fontWeight.medium,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.light,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  homeButton: {
    padding: spacing.sm,
  },
  settingsButton: {
    padding: spacing.sm,
  },
  settingsButtonText: {
    fontSize: typography.fontSize.lg,
  },
  cancelButton: {
    padding: spacing.sm,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.ui.error,
    fontWeight: typography.fontWeight.medium,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  profilePictureSection: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
  },
  profilePictureContainer: {
    position: "relative",
    marginBottom: spacing.md,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  profilePicturePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary.main,
    justifyContent: "center",
    alignItems: "center",
  },
  profilePicturePlaceholderText: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.light,
  },
  editOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.main,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.background.primary,
  },
  editOverlayText: {
    fontSize: typography.fontSize.md,
  },
  profilePictureLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.light,
    textAlign: "center",
    opacity: 0.9,
  },
  profileInfo: {
    paddingBottom: spacing.xxxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: "rgba(255,255,255,0.8)",
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.light,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  nameInputsContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.light,
    backgroundColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  nameInput: {
    flex: 1,
  },
  biographyInput: {
    height: 100,
    textAlignVertical: "top",
    lineHeight: 18,
  },
  characterCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textAlign: "right",
    marginTop: spacing.xs,
    opacity: 0.7,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 0,
  },
  statusChipOnline: {
    backgroundColor: "rgba(33, 192, 4, 0.18)",
  },
  statusChipOffline: {
    backgroundColor: "rgba(142, 142, 147, 0.18)",
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  statusTextOnline: {
    color: colors.text.light,
  },
  statusTextOffline: {
    color: "rgba(255,255,255,0.85)",
  },
  actionButtons: {
    paddingBottom: spacing.xxxl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    alignItems: "stretch",
  },
  sheet: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  optionIconText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text.primary,
  },
  optionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  optionChevron: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    paddingHorizontal: spacing.sm,
  },
  sheetCancel: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.ui.border,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  sheetCancelText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  floatingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  floatingMenu: {
    width: "86%",
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  floatingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  floatingIcon: {
    marginRight: spacing.md,
  },
  floatingItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  floatingCancel: {
    fontSize: typography.fontSize.base,
    color: colors.ui.error,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  alertCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFF",
    borderRadius: 14,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  alertTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
  },
  alertSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: 2,
    marginBottom: spacing.md,
  },
  alertAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  alertIcon: {
    marginRight: spacing.md,
  },
  alertActionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  alertCancel: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  alertCancelText: {
    fontSize: typography.fontSize.base,
    color: "#0A84FF",
    fontWeight: typography.fontWeight.medium,
  },
});

export default ProfileScreen;
