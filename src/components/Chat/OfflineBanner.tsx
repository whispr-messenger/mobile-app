/**
 * OfflineBanner - Displayed when the WebSocket is not connected
 * Shows a non-intrusive strip at the top of the screen
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ConnectionState } from "../../services/messaging/websocket";

interface OfflineBannerProps {
  connectionState: ConnectionState;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  connectionState,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  // Only show offline banner for reconnecting state or after we were previously
  // connected and then disconnected. Don't show during initial connection setup.
  const hasBeenConnected = useRef(false);

  if (connectionState === "connected") {
    hasBeenConnected.current = true;
  }

  const isReconnecting = connectionState === "reconnecting";
  const isOffline =
    isReconnecting ||
    (connectionState === "disconnected" && hasBeenConnected.current);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isOffline ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, opacity]);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        isReconnecting ? styles.reconnecting : styles.offline,
        { opacity },
      ]}
      pointerEvents="none"
    >
      <Ionicons
        name={isReconnecting ? "sync-outline" : "cloud-offline-outline"}
        size={14}
        color="#fff"
        style={styles.icon}
      />
      <Text style={styles.text}>
        {isReconnecting
          ? "Reconnexion en cours"
          : "Hors ligne — les messages seront envoyés à la reconnexion"}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  offline: {
    backgroundColor: "rgba(239, 68, 68, 0.85)",
  },
  reconnecting: {
    backgroundColor: "rgba(234, 179, 8, 0.85)",
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
});
