import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  Track,
  type Participant,
  type RemoteVideoTrack,
  type LocalVideoTrack,
  type RemoteAudioTrack,
  type LocalAudioTrack,
} from "livekit-client";
import { colors, withOpacity } from "../../theme/colors";

interface Props {
  participant: Participant;
  displayName?: string;
}

/**
 * Web-only implementation of the participant tile. `@livekit/react-native`'s
 * <VideoTrack> is native-only (requireNativeComponent) and crashes on web, so
 * the web build attaches the LiveKit Track to a plain <video> element via
 * track.attach()/detach(). Metro picks this .web.tsx over the sibling .tsx
 * automatically when building for the web platform.
 */
export const CallParticipantTile: React.FC<Props> = ({
  participant,
  displayName,
}) => {
  const videoPublication = participant.getTrackPublication(Track.Source.Camera);
  const videoTrack = videoPublication?.videoTrack as
    | RemoteVideoTrack
    | LocalVideoTrack
    | undefined;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const audioPublication = participant.getTrackPublication(
    Track.Source.Microphone,
  );
  const audioTrack = audioPublication?.audioTrack as
    | RemoteAudioTrack
    | LocalAudioTrack
    | undefined;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!videoTrack || !el) return undefined;
    videoTrack.attach(el);
    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack]);

  useEffect(() => {
    if (participant.isLocal) return undefined;
    const el = audioRef.current;
    if (!audioTrack || !el) return undefined;
    audioTrack.attach(el);
    return () => {
      audioTrack.detach(el);
    };
  }, [audioTrack, participant.isLocal]);

  const label = participant.isLocal
    ? "Vous"
    : participant.name || displayName || `${participant.identity.slice(0, 8)}…`;
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <View style={styles.tile}>
      {videoTrack ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={participant.isLocal}
            style={webStyles.video as React.CSSProperties}
          />
          <View style={styles.videoOverlay} />
        </>
      ) : (
        <View style={styles.placeholder}>
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
        </View>
      )}
      <View style={styles.nameBadge}>
        <Text style={styles.nameBadgeText} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {!participant.isLocal && (
        <audio ref={audioRef} autoPlay style={{ display: "none" }} />
      )}
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
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,6,20,0.28)",
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 12,
    backgroundColor: withOpacity(colors.secondary.dark, 0.92),
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
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: {
    color: "#fff",
    fontSize: 34,
    fontFamily: "Inter_700Bold",
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

const webStyles = {
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
};

export default CallParticipantTile;
