/**
 * Overlay shown on outgoing media bubbles while upload / share / send runs.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
} from "react-native";
import { colors } from "../../theme/colors";

export interface MediaUploadProgressOverlayProps {
  progress?: number;
  label?: string;
  indeterminate?: boolean;
  style?: ViewStyle;
}

export const MediaUploadProgressOverlay: React.FC<
  MediaUploadProgressOverlayProps
> = ({ progress = 0, label, indeterminate = false, style }) => {
  const clamped = Math.min(100, Math.max(0, progress));
  const displayLabel = label ?? (indeterminate ? undefined : `${clamped} %`);

  return (
    <View style={[styles.overlay, style]} pointerEvents="none">
      <View style={styles.inner}>
        {indeterminate ? (
          <ActivityIndicator size="small" color={colors.text.light} />
        ) : (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${clamped}%` }]} />
            </View>
            {displayLabel ? (
              <Text style={styles.percentText}>{displayLabel}</Text>
            ) : null}
          </>
        )}
        {indeterminate && displayLabel ? (
          <Text style={[styles.percentText, styles.indeterminateLabel]}>
            {displayLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  inner: {
    width: "72%",
    maxWidth: 200,
    alignItems: "center",
  },
  track: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: colors.text.light,
  },
  percentText: {
    marginTop: 8,
    color: colors.text.light,
    fontSize: 12,
    fontWeight: "600",
  },
  indeterminateLabel: {
    marginTop: 10,
  },
});
