import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { CallHistoryScreen } from "./CallHistoryScreen";
import { colors } from "../../theme/colors";

export const CallsScreen: React.FC = () => {
  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <BlurView intensity={45} tint="dark" style={styles.headerBlur}>
            <View style={styles.headerCard}>
              <View style={styles.headerBadge}>
                <Ionicons
                  name="call-outline"
                  size={14}
                  color={colors.primary.main}
                />
                <Text style={styles.headerBadgeText}>Centre d'appels</Text>
              </View>
              <Text style={styles.headerTitle}>Appels</Text>
              <Text style={styles.headerSubtitle}>
                Historique audio et vidéo dans une interface plus claire et plus
                immersive.
              </Text>
            </View>
          </BlurView>
        </View>
        <View style={styles.content}>
          <CallHistoryScreen />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerBlur: {
    borderRadius: 30,
    overflow: "hidden",
  },
  headerCard: {
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(11,17,36,0.18)",
  },
  headerBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerBadgeText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  headerTitle: {
    marginTop: 14,
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: colors.text.light,
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.72)",
  },
  content: {
    flex: 1,
  },
});

export default CallsScreen;
