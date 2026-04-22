import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BottomTabBar } from "../../components/Navigation/BottomTabBar";
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
          <Text style={styles.headerTitle}>Appels</Text>
        </View>
        <View style={styles.content}>
          <CallHistoryScreen />
        </View>
      </SafeAreaView>
      <BottomTabBar />
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text.light,
  },
  content: {
    flex: 1,
    paddingBottom: 80,
  },
});

export default CallsScreen;
