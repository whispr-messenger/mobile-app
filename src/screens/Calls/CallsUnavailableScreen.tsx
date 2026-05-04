import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import {
  getCallsAvailability,
  getCallsUnavailableMessage,
} from "../../hooks/useCallsAvailable";

export const CallsUnavailableScreen: React.FC = () => {
  const { reason } = getCallsAvailability();

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.iconWrap}>
          <Ionicons
            name="call-outline"
            size={36}
            color="rgba(255,255,255,0.82)"
          />
        </View>
        <Text style={styles.title}>Appels indisponibles</Text>
        <Text style={styles.message}>{getCallsUnavailableMessage(reason)}</Text>
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 20,
  },
  title: {
    color: colors.text.light,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});

export default CallsUnavailableScreen;
