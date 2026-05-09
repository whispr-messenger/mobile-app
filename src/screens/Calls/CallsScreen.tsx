import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
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
    // WHISPR-1254 / WHISPR-1335 - sur react-native-web le wrapper racine
    // doit borner la hauteur du viewport sinon flex:1 ne propage pas et
    // la FlatList des appels n'est ni visible ni scrollable.
    ...(Platform.OS === "web" ? { height: "100%" } : {}),
  },
  container: {
    flex: 1,
    ...(Platform.OS === "web" ? { minHeight: 0 } : {}),
  },
  content: {
    flex: 1,
    ...(Platform.OS === "web" ? { minHeight: 0 } : {}),
  },
});

export default CallsScreen;
