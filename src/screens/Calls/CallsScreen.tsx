/**
 * @danger-zone-mobile-layout
 *
 * DANGER ZONE - Layout web/iOS critique
 *
 * Bug historique : scroll bottom inaccessible sur Safari iOS PWA si la chaine flex
 * ne porte pas le pattern WHISPR-1254 (height:100% + minHeight:0 web).
 *
 * AVANT TOUTE MODIF :
 * 1. Tester live sur Safari iOS PWA (whispr-preprod.roadmvn.com).
 * 2. Verifier scroll vers le bas + boutons visibles + retour fonctionnel.
 * 3. Preserver les Platform.OS === 'web' ? minHeight:0 sur containers/scroll.
 *
 * Tickets historiques : WHISPR-1254, WHISPR-1291, WHISPR-1313, WHISPR-1335
 *
 * Tag parsable : @danger-zone-mobile-layout (utilise par script CI grep pour detection).
 */

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
