import React, { useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { Button, Logo } from "../../components";
import { useTheme } from "../../context/ThemeContext";
import { colors, spacing, typography } from "../../theme";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { AuthLanguageSwitcher } from "./AuthLanguageSwitcher";

type NavigationProp = StackNavigationProp<AuthStackParamList, "Welcome">;

export const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoAnim = useRef(new Animated.Value(1)).current;

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

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(logoAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(logoAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
  }, []);

  return (
    <LinearGradient
      colors={themeColors.background.gradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View
        style={[
          styles.langBar,
          { top: insets.top + spacing.sm, paddingHorizontal: spacing.xl },
        ]}
      >
        <AuthLanguageSwitcher />
      </View>

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Animated.View
          style={[styles.logoContainer, { transform: [{ scale: logoAnim }] }]}
        >
          <Logo variant="icon" size="xlarge" />
        </Animated.View>

        <View style={styles.titleContainer}>
          <Text style={[styles.title, { fontSize: getFontSize("xxxl") }]}>
            Whispr
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
            {getLocalizedText("auth.tagline")}
          </Text>
        </View>

        <View style={styles.buttons}>
          <Button
            title={getLocalizedText("auth.seConnecter")}
            variant="primary"
            size="large"
            fullWidth
            onPress={() => navigation.navigate("PhoneInput", { mode: "login" })}
          />
          <View style={styles.buttonGap} />
          <Button
            title={getLocalizedText("auth.creerCompte")}
            variant="secondary"
            size="large"
            fullWidth
            onPress={() =>
              navigation.navigate("PhoneInput", { mode: "register" })
            }
          />
        </View>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  langBar: {
    position: "absolute",
    right: 0,
    zIndex: 10,
    alignItems: "flex-end",
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: spacing.massive,
  },
  title: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: "800",
    color: colors.text.light,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.light,
    opacity: 0.8,
  },
  buttons: {
    marginTop: spacing.md,
  },
  buttonGap: {
    height: spacing.md,
  },
});
