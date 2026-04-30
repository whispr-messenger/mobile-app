import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { RoomEvent, type Participant } from "livekit-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useCallsStore } from "../../store/callsStore";
import { callsLiveKit } from "../../services/calls/liveKitProvider";
import { systemCallProvider } from "../../services/calls/systemCallProvider";
import { CallParticipantTile } from "../../components/Calls/CallParticipantTile";
import { CallControls } from "../../components/Calls/CallControls";
import { colors, withOpacity } from "../../theme/colors";
import { Avatar } from "../../components/Chat/Avatar";
import { messagingAPI } from "../../services/messaging/api";
import { TokenService } from "../../services/TokenService";

/**
 * In-call UI: status header (ringing/connected + elapsed time), grid of
 * participant tiles, fixed controls bar at the bottom.
 * Syncs participants from the LiveKit Room whenever connections or track
 * subscriptions change.
 */
export const InCallScreen: React.FC = () => {
  const active = useCallsStore((s) => s.active);
  const end = useCallsStore((s) => s.end);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [selfDisplayName, setSelfDisplayName] = useState<string>("");
  const [selfAvatarUrl, setSelfAvatarUrl] = useState<string | undefined>();

  useEffect(() => {
    const room = active?.room;
    if (!room) return;

    const sync = () => {
      const remote = Array.from(room.remoteParticipants.values());
      setParticipants([room.localParticipant, ...remote]);
      if (remote.length > 0 && connectedAt === null) {
        setConnectedAt(Date.now());
      }
    };
    sync();

    room.on(RoomEvent.ParticipantConnected, sync);
    room.on(RoomEvent.ParticipantDisconnected, sync);
    room.on(RoomEvent.TrackSubscribed, sync);
    room.on(RoomEvent.TrackUnsubscribed, sync);
    room.on(RoomEvent.TrackMuted, sync);
    room.on(RoomEvent.TrackUnmuted, sync);
    room.on(RoomEvent.LocalTrackPublished, sync);

    return () => {
      room.off(RoomEvent.ParticipantConnected, sync);
      room.off(RoomEvent.ParticipantDisconnected, sync);
      room.off(RoomEvent.TrackSubscribed, sync);
      room.off(RoomEvent.TrackUnsubscribed, sync);
      room.off(RoomEvent.TrackMuted, sync);
      room.off(RoomEvent.TrackUnmuted, sync);
      room.off(RoomEvent.LocalTrackPublished, sync);
    };
  }, [active, connectedAt]);

  // Tick the elapsed-time counter once per second while connected.
  useEffect(() => {
    if (connectedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [connectedAt]);

  useEffect(() => {
    if (!active?.callId || connectedAt === null) return;
    void systemCallProvider.markCallConnected(active.callId);
  }, [active?.callId, connectedAt]);

  useEffect(() => {
    let cancelled = false;

    const loadSelfIdentity = async () => {
      const token = await TokenService.getAccessToken();
      const userId = token ? TokenService.decodeAccessToken(token)?.sub : null;
      if (!userId) return;

      const me = await messagingAPI.getUserInfo(userId).catch(() => null);
      if (!me || cancelled) return;

      setSelfDisplayName(me.display_name || me.username || "");
      setSelfAvatarUrl(me.avatar_url);
    };

    void loadSelfIdentity();

    return () => {
      cancelled = true;
    };
  }, []);

  // Safety net: if the user navigates away (system back, tab close, etc.)
  // without pressing the end button, end the call so the room is disconnected
  // and tracks are released. Otherwise the mic/camera stay on in the
  // background.
  useEffect(() => {
    return () => {
      if (useCallsStore.getState().active) {
        end().catch((err) => console.error("Failed to cleanup call", err));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onToggleMute = useCallback(async () => {
    const next = !muted;
    await callsLiveKit.enableMic(!next);
    setMuted(next);
  }, [muted]);

  const onToggleCamera = useCallback(async () => {
    const next = !camOff;
    await callsLiveKit.enableCamera(!next);
    setCamOff(next);
  }, [camOff]);

  const onFlip = useCallback(() => callsLiveKit.flipCamera(), []);

  const onEnd = useCallback(async () => {
    const callId = active?.callId;
    try {
      await end();
      if (callId) {
        await systemCallProvider.endCall(callId, 3);
      }
    } catch (err) {
      console.error("Failed to end call", err);
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      (navigation as any).navigate("ConversationsList");
    }
  }, [active?.callId, end, navigation]);

  const remoteCount = participants.length - 1; // exclude self
  const status: "ringing" | "connected" =
    remoteCount > 0 ? "connected" : "ringing";

  const elapsed =
    connectedAt === null ? 0 : Math.floor((now - connectedAt) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const numColumns = participants.length <= 4 ? 2 : 3;
  const remoteLabel = active?.displayName;
  const remoteAvatarUrl = active?.avatarUrl;
  const isVideoCall = active?.type === "video";

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <View style={styles.container}>
        <View style={styles.ambientGlowTop} />
        <View style={styles.ambientGlowBottom} />

        <View
          style={[
            styles.headerWrap,
            { paddingTop: Math.max(insets.top, 16), paddingHorizontal: 16 },
          ]}
        >
          <BlurView intensity={55} tint="dark" style={styles.headerBlur}>
            <View style={styles.headerGlass}>
              <View style={styles.statusChip}>
                <Ionicons
                  name={status === "connected" ? "radio" : "call-outline"}
                  size={14}
                  color={status === "connected" ? "#9FE8A0" : "#FFD27A"}
                />
                <Text style={styles.statusChipText}>
                  {status === "ringing"
                    ? "Appel en cours…"
                    : "En communication"}
                </Text>
              </View>
              {!!remoteLabel && (
                <View style={styles.remoteAvatarWrap}>
                  <Avatar uri={remoteAvatarUrl} name={remoteLabel} size={72} />
                </View>
              )}
              {!!remoteLabel && (
                <Text style={styles.remoteLabel} numberOfLines={1}>
                  {remoteLabel}
                </Text>
              )}
              <Text style={styles.hint}>
                {status === "connected"
                  ? "Connexion sécurisée établie"
                  : "En attente que le destinataire décroche"}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.metaPill}>
                  <Ionicons
                    name={isVideoCall ? "videocam-outline" : "call-outline"}
                    size={14}
                    color="rgba(255,255,255,0.85)"
                  />
                  <Text style={styles.metaPillText}>
                    {isVideoCall ? "Vidéo" : "Audio"}
                  </Text>
                </View>
                <View style={styles.metaPill}>
                  <Ionicons
                    name="people-outline"
                    size={14}
                    color="rgba(255,255,255,0.85)"
                  />
                  <Text style={styles.metaPillText}>
                    {Math.max(remoteCount, 1)} participant
                    {Math.max(remoteCount, 1) > 1 ? "s" : ""}
                  </Text>
                </View>
                {status === "connected" && (
                  <View style={[styles.metaPill, styles.metaPillSuccess]}>
                    <Text style={styles.elapsed}>
                      {mm}:{ss}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </BlurView>
        </View>

        <View style={styles.gridShell}>
          <BlurView intensity={40} tint="dark" style={styles.gridBlur}>
            <View style={styles.gridGlass}>
              <FlatList
                data={participants}
                key={`cols-${numColumns}`}
                keyExtractor={(p) => p.identity}
                numColumns={numColumns}
                renderItem={({ item }) => (
                  <CallParticipantTile
                    participant={item}
                    displayName={!item.isLocal ? remoteLabel : undefined}
                    avatarUrl={!item.isLocal ? remoteAvatarUrl : undefined}
                    selfDisplayName={selfDisplayName}
                    selfAvatarUrl={selfAvatarUrl}
                  />
                )}
                contentContainerStyle={styles.gridContent}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </BlurView>
        </View>

        <CallControls
          muted={muted}
          cameraOff={camOff}
          onToggleMute={onToggleMute}
          onToggleCamera={onToggleCamera}
          onFlip={onFlip}
          onEnd={onEnd}
          bottomInset={insets.bottom}
        />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    position: "relative",
  },
  ambientGlowTop: {
    position: "absolute",
    top: -80,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: withOpacity(colors.primary.light, 0.16),
  },
  ambientGlowBottom: {
    position: "absolute",
    left: -80,
    bottom: 80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: withOpacity(colors.secondary.light, 0.12),
  },
  headerWrap: {
    zIndex: 2,
  },
  headerBlur: {
    borderRadius: 30,
    overflow: "hidden",
  },
  headerGlass: {
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(10,14,39,0.28)",
  },
  statusChip: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  statusChipText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  remoteLabel: {
    color: "#fff",
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    marginTop: 16,
    textAlign: "center",
  },
  remoteAvatarWrap: {
    alignSelf: "center",
    marginTop: 16,
    padding: 6,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  hint: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  metaPillSuccess: {
    backgroundColor: "rgba(44,106,67,0.28)",
    borderColor: "rgba(159,232,160,0.22)",
  },
  metaPillText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  elapsed: {
    color: "#9fe8a0",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  gridShell: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  gridBlur: {
    flex: 1,
    borderRadius: 34,
    overflow: "hidden",
  },
  gridGlass: {
    flex: 1,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(7,10,22,0.26)",
  },
  gridContent: {
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 18,
  },
});

export default InCallScreen;
