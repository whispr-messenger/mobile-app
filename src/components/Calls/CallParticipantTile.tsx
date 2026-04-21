import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { VideoTrack } from "@livekit/react-native";
import { Track, type Participant } from "livekit-client";

interface Props {
  participant: Participant;
}

/**
 * Single participant tile used by InCallScreen. Shows the participant's
 * camera feed when a published video track exists, otherwise falls back to
 * a placeholder with the identity.
 */
export const CallParticipantTile: React.FC<Props> = ({ participant }) => {
  const videoPublication = participant.getTrackPublication(Track.Source.Camera);
  const videoTrack = videoPublication?.videoTrack;

  return (
    <View style={styles.tile}>
      {videoTrack && videoPublication ? (
        <VideoTrack
          style={styles.video}
          trackRef={{
            participant,
            publication: videoPublication,
            source: Track.Source.Camera,
          }}
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.identity} numberOfLines={1}>
            {participant.identity}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 3 / 4,
    backgroundColor: "#222",
    borderRadius: 12,
    overflow: "hidden",
    margin: 4,
  },
  video: { flex: 1 },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  identity: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});

export default CallParticipantTile;
