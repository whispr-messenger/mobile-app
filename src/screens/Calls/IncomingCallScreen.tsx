import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useCallsStore } from "../../store/callsStore";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { systemCallProvider } from "../../services/calls/systemCallProvider";

type Nav = StackNavigationProp<AuthStackParamList>;

const showAcceptError = (message: string) => {
  const title = "Impossible de prendre l'appel";
  if (Platform.OS === "web") {
    // window.alert est synchrone sur web ; Alert.alert RN ne s'affiche pas.
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

/**
 * Full-screen incoming call UI. Shown as a modal over the current stack
 * when a WS `incoming_call` event arrives. Accept connects to LiveKit and
 * transitions to InCall; decline closes the screen.
 */
export const IncomingCallScreen: React.FC = () => {
  const incoming = useCallsStore((s) => s.incoming);
  const acceptIncoming = useCallsStore((s) => s.acceptIncoming);
  const declineIncoming = useCallsStore((s) => s.declineIncoming);
  const setIncoming = useCallsStore((s) => s.setIncoming);
  const navigation = useNavigation<Nav>();

  const onAccept = async () => {
    const callId = incoming?.callId;
    try {
      await acceptIncoming();
      if (callId) {
        await systemCallProvider.markCallConnected(callId);
      }
      navigation.reset({
        index: 0,
        routes: [{ name: "InCall" }],
      });
    } catch (err) {
      // WHISPR-1200 : on ne peut plus avaler l'erreur silencieusement, sinon
      // l'utilisateur reste coincé sur la modale. callsStore tague l'étape
      // (`accept-api: ...` vs `livekit-connect: ...`) pour aider au diagnostic.
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      console.error("Failed to accept call", err);
      showAcceptError(message);
      // Dismiss la modale : le call peut être dans un état incohérent côté
      // serveur, on rend la main à l'utilisateur plutôt que de le laisser
      // bloqué sur un bouton qui ne réagit plus.
      setIncoming(null);
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  };

  const onDecline = async () => {
    const callId = incoming?.callId;
    try {
      await declineIncoming();
      if (callId) {
        await systemCallProvider.endCall(callId, 5);
      }
    } catch (err) {
      console.error("Failed to decline call", err);
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  if (!incoming) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Appel {incoming.type === "video" ? "vidéo" : "audio"} entrant
      </Text>
      <Text style={styles.caller} numberOfLines={1}>
        {incoming.displayName ?? incoming.initiatorId}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.decline]}
          onPress={onDecline}
          accessibilityRole="button"
          accessibilityLabel="Refuser l'appel"
        >
          <Text style={styles.btnText}>Refuser</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.accept]}
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel="Accepter l'appel"
        >
          <Text style={styles.btnText}>Accepter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  label: { color: "#ccc", fontSize: 16, fontFamily: "Inter_400Regular" },
  caller: {
    color: "#fff",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    marginTop: 16,
  },
  actions: { flexDirection: "row", gap: 24, marginTop: 64 },
  btn: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 32 },
  decline: { backgroundColor: "#e53935" },
  accept: { backgroundColor: "#43a047" },
  btnText: { color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold" },
});

export default IncomingCallScreen;
