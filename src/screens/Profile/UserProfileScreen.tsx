/**
 * UserProfileScreen - Consultation lecture seule du profil d'un autre utilisateur.
 * Séparé de MyProfileScreen (édition du profil personnel) — WHISPR-1189.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
  type RouteProp,
} from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import {
  ProfileHeader,
  ProfilePictureBlock,
  ProfileFieldRow,
  StatusChip,
} from "../../components/Profile";
import { formatUsername } from "../../utils";
import { colors, spacing, typography } from "../../theme";
import { UserService } from "../../services";

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  biography: string;
  profilePicture?: string;
  isOnline: boolean;
  lastSeen?: string;
  createdAt?: string;
}

type NavigationProp = StackNavigationProp<any, "UserProfile">;
type RouteParams = { userId: string };

export const UserProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route =
    useRoute<RouteProp<{ UserProfile: RouteParams }, "UserProfile">>();
  const { userId } = route.params;

  const [profile, setProfile] = useState<UserProfile>({
    id: userId,
    firstName: "",
    lastName: "",
    username: "",
    biography: "",
    isOnline: true,
    lastSeen: "Maintenant",
    createdAt: "",
  });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const lastLoadAt = useRef<number | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

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
  }, [fadeAnim, slideAnim]);

  const loadProfile = useCallback(async () => {
    try {
      setProfileLoadError(null);
      const service = UserService.getInstance();
      const res = await service.getUserProfile(userId);
      if (res.success && res.profile) {
        const p = res.profile;
        setProfile((prev) => ({
          ...prev,
          id: p.id || prev.id,
          firstName: p.firstName || "",
          lastName: p.lastName || "",
          username: p.username || "",
          biography: p.biography || "",
          profilePicture: p.profilePicture || prev.profilePicture,
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
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      const last = lastLoadAt.current;
      if (last && Date.now() - last < 30_000) return;
      loadProfile();
    }, [loadProfile]),
  );

  const handleHomePress = () => navigation.navigate("ConversationsList");

  const rightActions = (
    <TouchableOpacity onPress={handleHomePress} style={styles.iconButton}>
      <Ionicons name="chatbubbles" size={24} color={colors.text.light} />
    </TouchableOpacity>
  );

  const fullName =
    profile.firstName || profile.lastName
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : undefined;

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
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
          onBack={() => navigation.goBack()}
          rightActions={rightActions}
        />

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <ProfilePictureBlock
            uri={profile.profilePicture}
            name={fullName ?? ""}
            editable={false}
            label="Photo de profil"
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

            <ProfileFieldRow label="Nom complet" value={fullName} />

            <ProfileFieldRow
              label="Nom d'utilisateur"
              value={
                profile.username ? formatUsername(profile.username) : undefined
              }
            />

            <ProfileFieldRow label="Biographie" value={profile.biography} />

            <StatusChip
              isOnline={profile.isOnline}
              lastSeen={profile.lastSeen}
            />

            {profile.createdAt && (
              <ProfileFieldRow
                label="Membre depuis"
                value={new Date(profile.createdAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              />
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // WHISPR-1254 - sur react-native-web, le wrapper racine doit borner la
    // hauteur du viewport sinon flex:1 ne propage pas aux enfants.
    ...(Platform.OS === "web" ? { height: "100%" } : {}),
  },
  content: {
    flex: 1,
    // WHISPR-1254 - minHeight:0 permet a la ScrollView enfant d'overflow
    // verticalement au lieu de pousser le parent.
    ...(Platform.OS === "web" ? { minHeight: 0 } : {}),
  },
  iconButton: { padding: spacing.sm },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    // WHISPR-1254 - meme raison que .content : autoriser l'overflow.
    ...(Platform.OS === "web" ? { minHeight: 0 } : {}),
  },
  profileInfo: {
    paddingBottom: spacing.xl,
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
});

export default UserProfileScreen;
