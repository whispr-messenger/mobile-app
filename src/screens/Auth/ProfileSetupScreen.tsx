import React, { useRef, useState } from "react";
import {
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
import { UserService } from "../../services";
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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

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
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      Alert.alert(
        getLocalizedText("notif.error"),
        "Veuillez remplir tous les champs obligatoires.",
      );
      return;
    }

    setLoading(true);
    try {
      if (!userId) throw new Error("Missing user id");
      const service = UserService.getInstance();
      const res = await service.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        profilePicture: avatarUri || undefined,
      });
      if (!res.success) {
        throw new Error(res.message || "Update failed");
      }

      navigation.reset({ index: 0, routes: [{ name: "ConversationsList" }] });
    } catch {
      Alert.alert(
        getLocalizedText("notif.error"),
        getLocalizedText("auth.errorConnection"),
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
                onChangeText={setUsername}
                autoCapitalize="none"
                containerStyle={styles.inputContainer}
              />
            </View>

            <Button
              title={getLocalizedText("common.save")}
              variant="primary"
              size="large"
              fullWidth
              loading={loading}
              disabled={
                !firstName.trim() ||
                !lastName.trim() ||
                !username.trim() ||
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
});
