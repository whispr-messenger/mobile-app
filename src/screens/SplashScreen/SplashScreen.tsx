/**
 * Whispr Splash Screen
 * First screen displayed when app launches
 */

import React, { useEffect, useRef } from "react";
import { StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Logo } from "../../components/Logo";
import { colors } from "../../theme";

/**
 * Écran de marque affiché au cold start. La durée d’affichage est contrôlée
 * par le parent (ex. AuthNavigator) pour attendre la session + un minimum UX.
 */
export const SplashScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <LinearGradient
      colors={colors.background.gradient.auth as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim }]}>
        <Logo variant="icon" size="xlarge" />
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default SplashScreen;
