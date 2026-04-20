import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { Button, Input } from "../../components";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { MediaService } from "../../services/MediaService";
import { UserService } from "../../services";
import { normalizeUsername } from "../../utils";
import { colors, spacing, typography } from "../../theme";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";

type NavigationProp = StackNavigationProp<AuthStackParamList, "ProfileSetup">;

export const ProfileSetupScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();
  const { userId } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  // Poll until the user profile exists on the user service
  React.useEffect(() => {
    let cancelled = false;
    const MAX_ATTEMPTS = 10;
    const INTERVAL_MS = 1500;

    const poll = async () => {
      const service = UserService.getInstance();
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (cancelled) return;
        try {
          const res = await service.getProfile();
          if (res.success) {
            if (!cancelled) setProfileReady(true);
            return;
          }
        } catch {
          // not ready yet
        }
        await new Promise((r) => setTimeout(r, INTERVAL_MS));
      }
      // After max attempts, let the user try anyway
      if (!cancelled) setProfileReady(true);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        getLocalizedText("notif.error"),
        "Permission refusée pour accéder à la galerie.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert(
        getLocalizedText("notif.error"),
        "Veuillez remplir tous les champs obligatoires.",
      );
      return;
    }

    setLoading(true);
    try {
      const profileData: Record<string, string> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      };
      const normalizedUsername = normalizeUsername(username);
      if (normalizedUsername.length >= 3) {
        profileData.username = normalizedUsername;
      }

      // Upload avatar image if one was selected
      if (avatarUri) {
        try {
          const fileName = avatarUri.split("/").pop() || "avatar.jpg";
          const fileType = fileName.endsWith(".png")
            ? "image/png"
            : "image/jpeg";
          const uploadResult = await MediaService.uploadMedia(
            {
              uri: avatarUri,
              name: fileName,
              type: fileType,
            },
            undefined,
            { context: "avatar", ownerId: userId ?? undefined },
          );
          profileData.avatarMediaId = uploadResult.id;
        } catch (uploadError) {
          console.warn("[ProfileSetup] Avatar upload failed:", uploadError);
          // Continue without avatar rather than blocking profile creation
        }
      }

      const service = UserService.getInstance();
      const res = await service.updateProfile(profileData);

      if (!res.success) {
        throw new Error(res.message || "Profile update failed");
      }

      navigation.reset({ index: 0, routes: [{ name: "ConversationsList" }] });
    } catch (error: any) {
      Alert.alert(
        getLocalizedText("notif.error"),
        error.message || getLocalizedText("auth.errorConnection"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigation.reset({ index: 0, routes: [{ name: "ConversationsList" }] });
  };

  return (
    <LinearGradient
      colors={themeColors.background.gradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.content,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.titleContainer}>
              <Text
                style={[
                  styles.title,
                  {
                    color: themeColors.text.primary,
                    fontSize: getFontSize("xxl"),
                  },
                ]}
              >
                {getLocalizedText("auth.profileSetup")}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  {
                    color: themeColors.text.secondary,
                    fontSize: getFontSize("base"),
                  },
                ]}
              >
                {getLocalizedText("auth.profileSetupSubtitle")}
              </Text>
            </View>

            {/* Avatar */}
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={pickImage}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderIcon}>📷</Text>
                  <Text
                    style={[
                      styles.avatarPlaceholderText,
                      { fontSize: getFontSize("sm") },
                    ]}
                  >
                    {getLocalizedText("auth.selectPhoto")}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Form */}
            <View style={styles.form}>
              <Text
                style={[
                  styles.fieldLabel,
                  {
                    color: themeColors.text.primary,
                    fontSize: getFontSize("base"),
                  },
                ]}
              >
                {getLocalizedText("auth.firstName")} *
              </Text>
              <Input
                placeholder={getLocalizedText("auth.firstName")}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                containerStyle={styles.inputContainer}
              />

              <Text
                style={[
                  styles.fieldLabel,
                  {
                    color: themeColors.text.primary,
                    fontSize: getFontSize("base"),
                  },
                ]}
              >
                {getLocalizedText("auth.lastName")} *
              </Text>
              <Input
                placeholder={getLocalizedText("auth.lastName")}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                containerStyle={styles.inputContainer}
              />

              <Text
                style={[
                  styles.fieldLabel,
                  {
                    color: themeColors.text.primary,
                    fontSize: getFontSize("base"),
                  },
                ]}
              >
                {getLocalizedText("profile.username")} *
              </Text>
              <Input
                placeholder="@username"
                value={username}
                onChangeText={(t) => setUsername(normalizeUsername(t))}
                autoCapitalize="none"
                containerStyle={styles.inputContainer}
                error={
                  username.trim().length > 0 && username.trim().length < 3
                    ? "Minimum 3 caractères"
                    : undefined
                }
                helperText="Seuls minuscules, chiffres et _ (auto-corrigé)"
              />
            </View>

            {!profileReady && (
              <View style={styles.readyBanner}>
                <ActivityIndicator size="small" color={colors.primary.main} />
                <Text
                  style={[
                    styles.readyText,
                    {
                      color: themeColors.text.secondary,
                      fontSize: getFontSize("sm"),
                    },
                  ]}
                >
                  Préparation de votre compte...
                </Text>
              </View>
            )}

            <Button
              title={getLocalizedText("common.save")}
              variant="primary"
              size="large"
              fullWidth
              loading={loading}
              disabled={
                !profileReady ||
                !firstName.trim() ||
                !lastName.trim() ||
                loading
              }
              onPress={handleSave}
            />

            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text
                style={[
                  styles.skipText,
                  {
                    color: themeColors.text.secondary,
                    fontSize: getFontSize("base"),
                  },
                ]}
              >
                {getLocalizedText("auth.cancel")} — compléter plus tard
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: {
    flex: 1,
    padding: spacing.xl,
    paddingTop: spacing.xxxl + spacing.xl,
    justifyContent: "center",
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontWeight: "800",
    color: colors.text.light,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.text.light,
    opacity: 0.7,
    textAlign: "center",
  },
  avatarContainer: {
    alignSelf: "center",
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.primary.main,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    borderStyle: "dashed",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  avatarPlaceholderIcon: {
    fontSize: 28,
  },
  avatarPlaceholderText: {
    color: colors.text.light,
    opacity: 0.7,
    textAlign: "center",
  },
  form: {
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontWeight: "600",
    color: colors.text.light,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  inputContainer: {
    marginBottom: 0,
  },
  skipButton: {
    alignItems: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  skipText: {
    opacity: 0.6,
  },
  readyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  readyText: {
    color: colors.text.light,
    opacity: 0.7,
  },
});
