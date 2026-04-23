import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  Track,
  type Participant,
  type RemoteVideoTrack,
  type LocalVideoTrack,
} from "livekit-client";

interface Props {
  participant: Participant;
}

/**
 * Web-only implementation of the participant tile. `@livekit/react-native`'s
 * <VideoTrack> is native-only (requireNativeComponent) and crashes on web, so
 * the web build attaches the LiveKit Track to a plain <video> element via
 * track.attach()/detach(). Metro picks this .web.tsx over the sibling .tsx
 * automatically when building for the web platform.
 */
export const CallParticipantTile: React.FC<Props> = ({ participant }) => {
  const videoPublication = participant.getTrackPublication(Track.Source.Camera);
  const videoTrack = videoPublication?.videoTrack as
    | RemoteVideoTrack
    | LocalVideoTrack
    | undefined;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!videoTrack || !el) return undefined;
    videoTrack.attach(el);
    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack]);

  return (
    <View style={styles.tile}>
      {videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          style={webStyles.video as React.CSSProperties}
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

const webStyles = {
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
};

export default CallParticipantTile;
