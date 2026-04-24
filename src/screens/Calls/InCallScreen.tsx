import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { RoomEvent, type Participant } from "livekit-client";
import { useCallsStore } from "../../store/callsStore";
import { callsLiveKit } from "../../services/calls/liveKitProvider";
import { CallParticipantTile } from "../../components/Calls/CallParticipantTile";
import { CallControls } from "../../components/Calls/CallControls";

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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

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
    try {
      await end();
    } catch (err) {
      console.error("Failed to end call", err);
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      (navigation as any).navigate("ConversationsList");
    }
  }, [end, navigation]);

  const remoteCount = participants.length - 1; // exclude self
  const status: "ringing" | "connected" =
    remoteCount > 0 ? "connected" : "ringing";

  const elapsed =
    connectedAt === null ? 0 : Math.floor((now - connectedAt) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const numColumns = participants.length <= 4 ? 2 : 3;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.statusLabel}>
          {status === "ringing" ? "Appel en cours…" : "En communication"}
        </Text>
        {status === "connected" && (
          <Text style={styles.elapsed}>
            {mm}:{ss}
          </Text>
        )}
        {status === "ringing" && (
          <Text style={styles.hint}>
            En attente que le destinataire décroche
          </Text>
        )}
      </View>

      <View style={styles.grid}>
        <FlatList
          data={participants}
          // key forces FlatList to remount when numColumns changes — otherwise
          // React Native crashes with "numColumns cannot change dynamically".
          key={`cols-${numColumns}`}
          keyExtractor={(p) => p.identity}
          numColumns={numColumns}
          renderItem={({ item }) => <CallParticipantTile participant={item} />}
          contentContainerStyle={styles.gridContent}
        />
      </View>

      <CallControls
        muted={muted}
        cameraOff={camOff}
        onToggleMute={onToggleMute}
        onToggleCamera={onToggleCamera}
        onFlip={onFlip}
        onEnd={onEnd}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "space-between",
  },
  header: {
    paddingTop: 32,
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  statusLabel: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  elapsed: {
    color: "#9fe8a0",
    fontSize: 16,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  hint: {
    color: "#bbb",
    fontSize: 13,
    marginTop: 4,
  },
  grid: {
    flex: 1,
    minHeight: 0,
  },
  gridContent: {
    gap: 8,
    padding: 8,
  },
});

export default InCallScreen;
