import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { VideoTrack } from "@livekit/react-native";
import { Track, type Participant } from "livekit-client";
import { LinearGradient } from "expo-linear-gradient";
import { colors, withOpacity } from "../../theme/colors";

interface Props {
  participant: Participant;
  displayName?: string;
}

/**
 * Single participant tile used by InCallScreen. Shows the participant's
 * camera feed when a published video track exists, otherwise falls back to
 * a placeholder with the identity.
 */
export const CallParticipantTile: React.FC<Props> = ({
  participant,
  displayName,
}) => {
  const videoPublication = participant.getTrackPublication(Track.Source.Camera);
  const videoTrack = videoPublication?.videoTrack;
  const label = participant.isLocal
    ? "Vous"
    : participant.name || displayName || participant.identity;
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <View style={styles.tile}>
      {videoTrack && videoPublication ? (
        <>
          <VideoTrack
            style={styles.video}
            trackRef={{
              participant,
              publication: videoPublication,
              source: Track.Source.Camera,
            }}
          />
          <LinearGradient
            colors={["rgba(3,6,20,0.08)", "rgba(3,6,20,0.65)"]}
            style={styles.videoOverlay}
          />
        </>
      ) : (
        <LinearGradient
          colors={[
            withOpacity(colors.secondary.dark, 0.92),
            withOpacity(colors.secondary.main, 0.38),
            withOpacity(colors.primary.main, 0.28),
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.placeholder}
        >
          <View style={styles.glow} />
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </View>
          <Text style={styles.identity} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.subLabel}>
            {participant.isLocal ? "Votre aperçu" : "Participant"}
          </Text>
        </LinearGradient>
      )}
      <View style={styles.nameBadge}>
        <Text style={styles.nameBadgeText} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 3 / 4,
    backgroundColor: withOpacity(colors.secondary.dark, 0.64),
    borderRadius: 28,
    overflow: "hidden",
    margin: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  video: { flex: 1 },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  glow: {
    position: "absolute",
    top: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: withOpacity(colors.primary.light, 0.22),
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  avatarLetter: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 34,
  },
  identity: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  subLabel: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 8,
  },
  nameBadge: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(9,13,28,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  nameBadgeText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});

export default CallParticipantTile;
