/**
 * ProfileScreen - User Profile Management
 * WHISPR-132: Implement ProfileScreen with user profile management
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { formatUsername, normalizeUsername } from "../../utils";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
  type RouteProp,
} from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Logo, Button } from "../../components";
import { Avatar } from "../../components/Chat/Avatar";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../theme";
import { UserService } from "../../services";
import type { UpdateProfileRequest } from "../../services/UserService";
import { MediaService } from "../../services/MediaService";
import { useAuth } from "../../context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  const { userId: currentUserId } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<{ Profile: RouteParams }, "Profile">>();
  const params = route.params;
  // ProfileScreen params loaded

  // States
  const [profile, setProfile] = useState<UserProfile>({
    id: params?.userId || userId || currentUserId || "",
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
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    username?: string;
    biography?: string;
  }>({});
  const [pendingAvatar, setPendingAvatar] = useState<{
    localUri: string;
    mediaId?: string;
    remoteUrl?: string;
  } | null>(null);
  const saveAbortRef = useRef<AbortController | null>(null);

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

    // Cleanup: cancel any pending save on unmount
    return () => {
      if (saveAbortRef.current) {
        saveAbortRef.current.abort();
        saveAbortRef.current = null;
      }
    };
  }, []);

  const viewedUserId = params?.userId || userId || "";
  const isOwnProfile = !viewedUserId || viewedUserId === currentUserId;

  const loadProfile = useCallback(async () => {
    try {
      setProfileLoadError(null);
      const service = UserService.getInstance();
      const res = isOwnProfile
        ? await service.getProfile()
        : await service.getUserProfile(viewedUserId);
      if (res.success && res.profile) {
        const p = res.profile;
        setProfile((prev) => ({
          ...prev,
          id: p.id || prev.id,
          firstName: p.firstName || prev.firstName || "",
          lastName: p.lastName || prev.lastName || "",
          username: p.username || prev.username || "",
          phoneNumber: p.phoneNumber || prev.phoneNumber || "",
          biography: p.biography || prev.biography || "",
          profilePicture:
            pendingAvatar?.localUri || p.profilePicture || prev.profilePicture,
          createdAt: p.createdAt || prev.createdAt,
        }));
        setProfileLoaded(true);
        return;
      }
      setProfileLoadError(res.message || "Impossible de récupérer le profil");
      setProfileLoaded(true);
    } catch (e: any) {
      setProfileLoadError(e?.message || "Impossible de récupérer le profil");
      setProfileLoaded(true);
    }
  }, [pendingAvatar?.localUri, isOwnProfile, viewedUserId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Re-fetch profile from API every time the screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

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
        const uri = result.assets[0].uri;
        setProfile((prev) => ({
          ...prev,
          profilePicture: uri,
        }));
        setPendingAvatar({ localUri: uri });
        setShowImagePicker(false);
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
        const uri = result.assets[0].uri;
        setProfile((prev) => ({
          ...prev,
          profilePicture: uri,
        }));
        setPendingAvatar({ localUri: uri });
        setShowImagePicker(false);
      }
    } catch (error) {
      console.error("Erreur capture caméra:", error);
      Alert.alert("Erreur", "Impossible d'utiliser la caméra");
    }
  };

  // Cancel any pending save operation
  const cancelSave = useCallback(() => {
    if (saveAbortRef.current) {
      saveAbortRef.current.abort();
      saveAbortRef.current = null;
    }
    setLoading(false);
  }, []);

  const pendingAvatarKey = currentUserId
    ? `@whispr/pending_avatar_media_id:${currentUserId}`
    : "@whispr/pending_avatar_media_id:unknown";

  const isMediaNotFound = (message?: string) =>
    typeof message === "string" && /media not found/i.test(message);

  const waitForMediaAvailable = async (
    mediaId: string,
    abortSignal: AbortSignal,
  ): Promise<void> => {
    const delaysMs = [250, 400, 650, 1000, 1500];
    let lastErr: unknown;
    for (let i = 0; i < delaysMs.length; i++) {
      if (abortSignal.aborted) return;
      try {
        await MediaService.getMediaMetadata(mediaId);
        return;
      } catch (e: any) {
        lastErr = e;
        const msg = typeof e?.message === "string" ? e.message : "";
        const status = typeof e?.status === "number" ? e.status : undefined;
        const isRetryable =
          status === 404 || isMediaNotFound(msg) || msg.includes("HTTP 404");
        if (!isRetryable) throw e;
        await new Promise((r) => setTimeout(r, delaysMs[i]));
      }
    }
    throw lastErr ?? new Error("Media not found");
  };

  const finalizePendingAvatar = useCallback(async () => {
    if (!currentUserId) return;
    const mediaId = pendingAvatar?.mediaId;
    if (!mediaId) return;

    const abortController = new AbortController();
    try {
      await waitForMediaAvailable(mediaId, abortController.signal);
      const service = UserService.getInstance();
      const res = await service.updateProfile({ avatarMediaId: mediaId });
      if (res.success) {
        if (res.profile) {
          setProfile((prev) => ({ ...prev, ...res.profile }));
        } else {
          setProfile((prev) => ({ ...prev, profilePicture: mediaId }));
        }
        setPendingAvatar(null);
        await AsyncStorage.removeItem(pendingAvatarKey);
      }
    } catch {
      // keep pending
    }
  }, [currentUserId, pendingAvatar?.mediaId, pendingAvatarKey]);

  useEffect(() => {
    if (!currentUserId) return;
    AsyncStorage.getItem(pendingAvatarKey)
      .then((mediaId) => {
        if (!mediaId) return;
        setProfile((prev) => ({
          ...prev,
          profilePicture: prev.profilePicture || mediaId,
        }));
        setPendingAvatar((prev) => prev ?? { localUri: mediaId, mediaId });
      })
      .catch(() => {});
  }, [currentUserId, pendingAvatarKey]);

  useFocusEffect(
    useCallback(() => {
      finalizePendingAvatar();
    }, [finalizePendingAvatar]),
  );

  // Handle profile update
  const handleSaveProfile = async () => {
    const firstNameError = validateField("firstName", profile.firstName);
    const lastNameError = validateField("lastName", profile.lastName);
    const normalizedUsername = normalizeUsername(profile.username);
    const usernameError = normalizedUsername
      ? validateField("username", normalizedUsername)
      : null;

    // phoneNumber is read-only from registration — skip validation on save

    const bioError = validateField("biography", profile.biography);
    const nextErrors = {
      firstName: firstNameError ?? undefined,
      lastName: lastNameError ?? undefined,
      username: usernameError ?? undefined,
      biography: bioError ?? undefined,
    };
    setFieldErrors(nextErrors);
    if (firstNameError || lastNameError || bioError) return;

    // Abort any previous pending save
    cancelSave();

    const abortController = new AbortController();
    saveAbortRef.current = abortController;

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
      let avatarMediaId = pendingAvatar?.mediaId;
      let avatarRemoteUrl = pendingAvatar?.remoteUrl;

      if (pendingAvatar?.localUri && !avatarMediaId) {
        const localUri = pendingAvatar.localUri;
        const fileName = localUri.split("/").pop() || "avatar.jpg";
        const fileType = fileName.endsWith(".png") ? "image/png" : "image/jpeg";

        const uploadPromise = MediaService.uploadMedia(
          { uri: localUri, name: fileName, type: fileType },
          undefined,
          {
            context: "avatar",
            ownerId: currentUserId || profile.id || undefined,
          },
        );
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Upload timeout")), 15000),
        );
        const uploadResult = await Promise.race([
          uploadPromise,
          timeoutPromise,
        ]);

        if (abortController.signal.aborted) return;

        try {
          await waitForMediaAvailable(uploadResult.id, abortController.signal);
        } catch {
          Alert.alert(
            "Erreur",
            "La photo n'est pas encore disponible côté serveur. Réessayez dans quelques secondes.",
          );
          setLoading(false);
          return;
        }

        avatarMediaId = uploadResult.id;
        avatarRemoteUrl = uploadResult.url;
        setPendingAvatar({
          localUri,
          mediaId: avatarMediaId,
          remoteUrl: avatarRemoteUrl,
        });
        setProfile((prev) => ({ ...prev, profilePicture: avatarMediaId }));
        if (currentUserId) {
          await AsyncStorage.setItem(pendingAvatarKey, avatarMediaId);
        }
      }

      // Check if save was cancelled
      if (abortController.signal.aborted) return;

      const service = UserService.getInstance();
      const updateData: UpdateProfileRequest = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        biography: profile.biography,
      };
      if (avatarMediaId) {
        updateData.avatarMediaId = avatarMediaId;
      }
      if (!usernameError && normalizedUsername.length >= 3) {
        updateData.username = normalizedUsername;
      }
      const tryUpdate = () => service.updateProfile(updateData);
      let res = await tryUpdate();
      if (!res.success && avatarMediaId && isMediaNotFound(res.message)) {
        try {
          await waitForMediaAvailable(avatarMediaId, abortController.signal);
        } catch {
          // ignore, we'll still retry once below
        }
        await new Promise((r) => setTimeout(r, 650));
        res = await tryUpdate();
      }

      // Check if save was cancelled while updating profile
      if (abortController.signal.aborted) return;

      if (!res.success) {
        if (avatarMediaId && isMediaNotFound(res.message)) {
          const withoutAvatar = { ...updateData };
          delete withoutAvatar.avatarMediaId;
          const partialRes = await service.updateProfile(withoutAvatar);
          if (partialRes.success) {
            if (partialRes.profile) {
              setProfile((prev) => ({ ...prev, ...partialRes.profile }));
            }
            setIsEditing(false);
            setFieldErrors({});
            Alert.alert(
              "Profil enregistré",
              "Les informations du profil ont été sauvegardées. La photo est encore en cours de disponibilité serveur.",
            );
            setTimeout(() => {
              finalizePendingAvatar();
            }, 1500);
            return;
          }
          Alert.alert(
            "Erreur",
            partialRes.message || "Impossible de mettre à jour le profil",
          );
          return;
        }
        Alert.alert(
          "Erreur",
          res.message || "Impossible de mettre à jour le profil",
        );
        return;
      }

      if (res.profile) {
        setProfile((prev) => ({ ...prev, ...res.profile }));
        if (avatarMediaId) {
          setPendingAvatar(null);
          await AsyncStorage.removeItem(pendingAvatarKey);
        }
      } else if (!usernameError && normalizedUsername !== profile.username) {
        setProfile((prev) => ({ ...prev, username: normalizedUsername }));
        if (avatarRemoteUrl) {
          setProfile((prev) => ({ ...prev, profilePicture: avatarRemoteUrl }));
          if (avatarMediaId) {
            setPendingAvatar(null);
            await AsyncStorage.removeItem(pendingAvatarKey);
          }
        }
      } else if (avatarRemoteUrl) {
        setProfile((prev) => ({ ...prev, profilePicture: avatarRemoteUrl }));
        if (avatarMediaId) {
          setPendingAvatar(null);
          await AsyncStorage.removeItem(pendingAvatarKey);
        }
      }

      setIsEditing(false);
      setFieldErrors({});
      Alert.alert("Succès", "Profil mis à jour avec succès", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      // If save was cancelled, exit silently
      if (abortController.signal.aborted) return;
      Alert.alert(
        "Erreur",
        "Impossible de mettre à jour le profil. Vérifiez votre connexion et réessayez.",
      );
    } finally {
      setLoading(false);
      if (saveAbortRef.current === abortController) {
        saveAbortRef.current = null;
      }
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
        if (!/^[a-z0-9_]+$/.test(v.trim()))
          return "Seuls minuscules, chiffres et _ autorisés";
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

  // Handle field change (validation is done on save only)
  const handleFieldChange = (field: keyof UserProfile, value: string) => {
    setFieldErrors((prev) => {
      if (!prev[field as keyof typeof prev]) return prev;
      return { ...prev, [field]: undefined };
    });
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
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
    if (loading) {
      // Cancel any in-progress save and allow navigation
      Alert.alert(
        "Sauvegarde en cours",
        "Voulez-vous annuler la sauvegarde et quitter ?",
        [
          { text: "Attendre", style: "cancel" },
          {
            text: "Quitter",
            style: "destructive",
            onPress: () => {
              cancelSave();
              setIsEditing(false);
              navigation.goBack();
            },
          },
        ],
      );
    } else if (isEditing) {
      Alert.alert(
        "Modifications non sauvegardées",
        "Voulez-vous vraiment quitter sans sauvegarder ?",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Quitter",
            onPress: () => {
              setIsEditing(false);
              navigation.goBack();
            },
          },
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
                onPress={() => {
                  cancelSave();
                  setIsEditing(false);
                }}
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
                <Avatar
                  uri={profile.profilePicture}
                  name={`${profile.firstName} ${profile.lastName}`.trim()}
                  size={120}
                />

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
              {!profileLoaded ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="rgba(255,255,255,0.8)" />
                  <Text style={styles.loadingText}>Chargement du profil…</Text>
                </View>
              ) : profileLoadError ? (
                <Text style={styles.loadErrorText}>{profileLoadError}</Text>
              ) : null}
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
                    {profile.firstName || profile.lastName
                      ? `${profile.firstName} ${profile.lastName}`.trim()
                      : "—"}
                  </Text>
                )}
              </View>

              {/* Username Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Nom d'utilisateur</Text>
                {isEditing ? (
                  <>
                    <TextInput
                      style={styles.input}
                      value={profile.username}
                      onChangeText={(text) =>
                        handleFieldChange("username", normalizeUsername(text))
                      }
                      placeholder="@nomdutilisateur"
                      placeholderTextColor={colors.text.placeholder}
                      autoCapitalize="none"
                    />
                    {!!fieldErrors.username && (
                      <Text style={styles.fieldErrorText}>
                        {fieldErrors.username}
                      </Text>
                    )}
                    {!fieldErrors.username && (
                      <Text style={styles.fieldHelperText}>
                        Seuls minuscules, chiffres et _ (auto-corrigé)
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.sectionValue}>
                    {profile.username ? formatUsername(profile.username) : "—"}
                  </Text>
                )}
              </View>

              {/* Phone Number Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Numéro de téléphone</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={profile.phoneNumber}
                    placeholder="+33 07 12 34 56 78"
                    placeholderTextColor={colors.text.placeholder}
                    keyboardType="phone-pad"
                    editable={false}
                  />
                ) : (
                  <Text style={styles.sectionValue}>
                    {profile.phoneNumber || "—"}
                  </Text>
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
                  <Text style={styles.sectionValue}>
                    {profile.biography || "—"}
                  </Text>
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: "rgba(255,255,255,0.85)",
  },
  loadErrorText: {
    fontSize: typography.fontSize.sm,
    color: colors.ui.error,
    marginBottom: spacing.lg,
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
  fieldErrorText: {
    fontSize: typography.fontSize.xs,
    color: colors.ui.error,
    marginTop: spacing.xs,
  },
  fieldHelperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    opacity: 0.7,
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
