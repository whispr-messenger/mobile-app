/**
 * MyProfileScreen - Édition du profil de l'utilisateur connecté.
 * Séparé de UserProfileScreen (consultation d'un profil tiers) — WHISPR-1189.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../components";
import {
  ProfileHeader,
  ProfilePictureBlock,
  ProfileFieldRow,
  StatusChip,
} from "../../components/Profile";
import {
  formatUsername,
  isValidUsername,
  normalizeUsername,
} from "../../utils";
import { colors, spacing, typography, borderRadius } from "../../theme";
import { UserService } from "../../services";
import type { UpdateProfileRequest } from "../../services/UserService";
import { MediaService } from "../../services/MediaService";
import { useAuth } from "../../context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

type NavigationProp = StackNavigationProp<any, "MyProfile">;

const isMediaNotFound = (message?: string) =>
  typeof message === "string" && /media not found/i.test(message);

/**
 * WHISPR-1255 — Fallback web pour sélectionner une image.
 * expo-image-picker SDK 17 supporte mal le user-gesture côté web; on
 * crée un <input type="file"> détaché qu'on click programmatiquement.
 * On retourne un blob URL utilisable comme uri par MediaService.
 */
const pickImageFromWeb = (
  opts: { preferCamera?: boolean } = {},
): Promise<string | null> => {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (opts.preferCamera) {
      input.setAttribute("capture", "environment");
    }
    input.style.position = "fixed";
    input.style.left = "-9999px";
    let settled = false;
    const settle = (value: string | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return settle(null);
      settle(URL.createObjectURL(file));
    };
    // Si l'utilisateur ferme la dialog sans choisir, focus revient à
    // window — on libère la promesse pour ne pas leak.
    const onFocus = () => {
      window.removeEventListener("focus", onFocus);
      setTimeout(() => settle(null), 300);
    };
    window.addEventListener("focus", onFocus);
    document.body.appendChild(input);
    input.click();
  });
};

export const MyProfileScreen: React.FC = () => {
  const { userId: currentUserId } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [profile, setProfile] = useState<UserProfile>({
    id: currentUserId || "",
    firstName: "",
    lastName: "",
    username: "",
    phoneNumber: "",
    biography: "",
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
  const lastLoadAt = useRef<number | null>(null);

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

    return () => {
      if (saveAbortRef.current) {
        saveAbortRef.current.abort();
        saveAbortRef.current = null;
      }
    };
  }, [fadeAnim, slideAnim]);

  const loadProfile = useCallback(async () => {
    try {
      setProfileLoadError(null);
      const service = UserService.getInstance();
      const res = await service.getProfile();
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
        lastLoadAt.current = Date.now();
        setProfileLoaded(true);
        return;
      }
      setProfileLoadError(res.message || "Impossible de récupérer le profil");
      setProfileLoaded(true);
    } catch (e: any) {
      setProfileLoadError(e?.message || "Impossible de récupérer le profil");
      setProfileLoaded(true);
    }
  }, [pendingAvatar?.localUri]);

  useFocusEffect(
    useCallback(() => {
      const last = lastLoadAt.current;
      if (last && Date.now() - last < 30_000) return;
      loadProfile();
    }, [loadProfile]),
  );

  const handleImagePicker = async () => {
    try {
      // WHISPR-1255 — sur react-native-web, expo-image-picker ne déclenche
      // pas de file picker (le polyfill web requiert un user-gesture
      // synchrone qu'on perd à travers la promesse permissions). On
      // contourne avec un <input type="file"> natif qu'on click depuis
      // le clic utilisateur courant.
      if (Platform.OS === "web") {
        const uri = await pickImageFromWeb();
        if (uri) {
          setProfile((prev) => ({ ...prev, profilePicture: uri }));
          setPendingAvatar({ localUri: uri });
          setShowImagePicker(false);
        }
        return;
      }

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
        setProfile((prev) => ({ ...prev, profilePicture: uri }));
        setPendingAvatar({ localUri: uri });
        setShowImagePicker(false);
      }
    } catch (error) {
      console.error("Erreur sélection image:", error);
      Alert.alert("Erreur", "Impossible de sélectionner l'image");
    }
  };

  const handleCameraCapture = async () => {
    try {
      // WHISPR-1255 — sur web, on retombe sur le même <input type=file>
      // mais avec capture="environment" pour proposer la caméra quand
      // disponible (mobile web). Sur desktop le navigateur retombe
      // automatiquement sur le file picker classique.
      if (Platform.OS === "web") {
        const uri = await pickImageFromWeb({ preferCamera: true });
        if (uri) {
          setProfile((prev) => ({ ...prev, profilePicture: uri }));
          setPendingAvatar({ localUri: uri });
          setShowImagePicker(false);
        }
        return;
      }

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
        setProfile((prev) => ({ ...prev, profilePicture: uri }));
        setPendingAvatar({ localUri: uri });
        setShowImagePicker(false);
      }
    } catch (error) {
      console.error("Erreur capture caméra:", error);
      Alert.alert("Erreur", "Impossible d'utiliser la caméra");
    }
  };

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
        if (!isValidUsername(v.trim()))
          return "Seules les lettres, chiffres et _ sont autorises";
        return null;

      case "biography":
        if (v.length > 500) return "Maximum 500 caractères";
        return null;

      default:
        return null;
    }
  };

  const handleFieldChange = (field: keyof UserProfile, value: string) => {
    setFieldErrors((prev) => {
      if (!prev[field as keyof typeof prev]) return prev;
      return { ...prev, [field]: undefined };
    });
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    const firstNameError = validateField("firstName", profile.firstName);
    const lastNameError = validateField("lastName", profile.lastName);
    const normalizedUsername = normalizeUsername(profile.username);
    const usernameError = normalizedUsername
      ? validateField("username", normalizedUsername)
      : null;
    const bioError = validateField("biography", profile.biography);
    setFieldErrors({
      firstName: firstNameError ?? undefined,
      lastName: lastNameError ?? undefined,
      username: usernameError ?? undefined,
      biography: bioError ?? undefined,
    });
    if (firstNameError || lastNameError || bioError) return;

    cancelSave();
    const abortController = new AbortController();
    saveAbortRef.current = abortController;

    setLoading(true);

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

    const uploadPendingAvatarIfNeeded = async (): Promise<{
      mediaId: string | undefined;
      remoteUrl: string | undefined;
    } | null> => {
      let mediaId = pendingAvatar?.mediaId;
      let remoteUrl = pendingAvatar?.remoteUrl;

      if (!pendingAvatar?.localUri || mediaId) return { mediaId, remoteUrl };

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
      const uploadResult = await Promise.race([uploadPromise, timeoutPromise]);

      if (abortController.signal.aborted) return null;

      try {
        await waitForMediaAvailable(uploadResult.id, abortController.signal);
      } catch {
        Alert.alert(
          "Erreur",
          "La photo n'est pas encore disponible côté serveur. Réessayez dans quelques secondes.",
        );
        setLoading(false);
        return null;
      }

      mediaId = uploadResult.id;
      remoteUrl = uploadResult.url;
      setPendingAvatar({ localUri, mediaId, remoteUrl });
      setProfile((prev) => ({ ...prev, profilePicture: mediaId }));
      if (currentUserId) {
        await AsyncStorage.setItem(pendingAvatarKey, mediaId);
      }
      return { mediaId, remoteUrl };
    };

    const buildUpdatePayload = (
      avatarMediaId: string | undefined,
    ): UpdateProfileRequest => {
      const payload: UpdateProfileRequest = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        biography: profile.biography,
      };
      if (avatarMediaId) payload.avatarMediaId = avatarMediaId;
      if (!usernameError && normalizedUsername.length >= 3) {
        payload.username = normalizedUsername;
      }
      return payload;
    };

    try {
      const uploadResult = await uploadPendingAvatarIfNeeded();
      if (uploadResult === null) return;
      const { mediaId: avatarMediaId, remoteUrl: avatarRemoteUrl } =
        uploadResult;

      if (abortController.signal.aborted) return;

      const service = UserService.getInstance();
      const updateData = buildUpdatePayload(avatarMediaId);
      const tryUpdate = () => service.updateProfile(updateData);
      let res = await tryUpdate();
      if (!res.success && avatarMediaId && isMediaNotFound(res.message)) {
        try {
          await waitForMediaAvailable(avatarMediaId, abortController.signal);
        } catch {
          // ignore
        }
        await new Promise((r) => setTimeout(r, 650));
        res = await tryUpdate();
      }

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

  const handleHomePress = () => navigation.navigate("ConversationsList");

  const handleBackPress = () => {
    if (loading) {
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

  const rightActions = !isEditing ? (
    <>
      <TouchableOpacity onPress={handleHomePress} style={styles.iconButton}>
        <Ionicons name="chatbubbles" size={24} color={colors.text.light} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setIsEditing(true)}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="Modifier le profil"
      >
        <Ionicons name="pencil" size={22} color={colors.text.light} />
      </TouchableOpacity>
    </>
  ) : (
    <TouchableOpacity
      onPress={() => {
        cancelSave();
        setIsEditing(false);
      }}
      style={styles.iconButton}
    >
      <Text style={styles.cancelButtonText}>Annuler</Text>
    </TouchableOpacity>
  );

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
          <ProfileHeader
            title="Profil"
            onBack={handleBackPress}
            rightActions={rightActions}
          />

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            <ProfilePictureBlock
              uri={profile.profilePicture}
              name={`${profile.firstName} ${profile.lastName}`.trim()}
              editable={isEditing}
              onPress={() => setShowImagePicker(true)}
              label={isEditing ? "Appuyez pour changer" : "Photo de profil"}
              scaleAnim={scaleAnim}
            />

            <View style={styles.profileInfo}>
              {!profileLoaded ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="rgba(255,255,255,0.8)" />
                  <Text style={styles.loadingText}>Chargement du profil</Text>
                </View>
              ) : profileLoadError ? (
                <Text style={styles.loadErrorText}>{profileLoadError}</Text>
              ) : null}

              {isEditing ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Nom complet</Text>
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
                </View>
              ) : (
                <ProfileFieldRow
                  label="Nom complet"
                  value={
                    profile.firstName || profile.lastName
                      ? `${profile.firstName} ${profile.lastName}`.trim()
                      : undefined
                  }
                />
              )}

              {isEditing ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Nom d'utilisateur</Text>
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
                </View>
              ) : (
                <ProfileFieldRow
                  label="Nom d'utilisateur"
                  value={
                    profile.username
                      ? formatUsername(profile.username)
                      : undefined
                  }
                />
              )}

              <ProfileFieldRow
                label="Numéro de téléphone"
                value={profile.phoneNumber}
              />

              {isEditing ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Biographie</Text>
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
                </View>
              ) : (
                <ProfileFieldRow label="Biographie" value={profile.biography} />
              )}

              <StatusChip
                isOnline={profile.isOnline}
                lastSeen={profile.lastSeen}
              />

              {profile.createdAt && (
                <ProfileFieldRow
                  label="Membre depuis"
                  value={new Date(profile.createdAt).toLocaleDateString(
                    "fr-FR",
                    {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    },
                  )}
                />
              )}
            </View>

            {isEditing && (
              <View style={styles.actionButtons}>
                <Button
                  title={loading ? "Sauvegarde" : "Sauvegarder"}
                  variant="primary"
                  size="large"
                  onPress={handleSaveProfile}
                  loading={loading}
                  fullWidth
                />
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>

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
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { flex: 1 },
  iconButton: { padding: spacing.sm },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.ui.error,
    fontWeight: typography.fontWeight.medium,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  profileInfo: {
    paddingBottom: spacing.sm,
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
  section: { marginBottom: spacing.xl },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: "rgba(255,255,255,0.8)",
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  nameInput: { flex: 1 },
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
  actionButtons: {
    paddingBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
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
  alertIcon: { marginRight: spacing.md },
  alertActionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  alertCancel: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  alertCancelText: {
    fontSize: typography.fontSize.base,
    color: "#0A84FF",
    fontWeight: typography.fontWeight.medium,
  },
});

export default MyProfileScreen;
