import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { RoomEvent, type Participant } from "livekit-client";
import { useCallsStore } from "../../store/callsStore";
import { callsLiveKit } from "../../services/calls/liveKitProvider";
import { CallParticipantTile } from "../../components/Calls/CallParticipantTile";
import { CallControls } from "../../components/Calls/CallControls";

/**
 * In-call UI: grid of participant tiles + controls bar.
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

  useEffect(() => {
    const room = active?.room;
    if (!room) return;

    const sync = () => {
      setParticipants([
        room.localParticipant,
        ...Array.from(room.remoteParticipants.values()),
      ]);
    };
    sync();

    room.on(RoomEvent.ParticipantConnected, sync);
    room.on(RoomEvent.ParticipantDisconnected, sync);
    room.on(RoomEvent.TrackSubscribed, sync);
    room.on(RoomEvent.TrackUnsubscribed, sync);

    return () => {
      room.off(RoomEvent.ParticipantConnected, sync);
      room.off(RoomEvent.ParticipantDisconnected, sync);
      room.off(RoomEvent.TrackSubscribed, sync);
      room.off(RoomEvent.TrackUnsubscribed, sync);
    };
  }, [active]);

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
    }
  }, [end, navigation]);

  const numColumns = participants.length <= 4 ? 2 : 3;

  return (
    <View style={styles.container}>
      <FlatList
        data={participants}
        // key forces FlatList to remount when numColumns changes — otherwise
        // React Native crashes with "numColumns cannot change dynamically".
        key={`cols-${numColumns}`}
        keyExtractor={(p) => p.identity}
        numColumns={numColumns}
        renderItem={({ item }) => <CallParticipantTile participant={item} />}
        contentContainerStyle={styles.grid}
      />
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
  container: { flex: 1, backgroundColor: "#000" },
  grid: { gap: 8, padding: 8 },
});

export default InCallScreen;
