/**
 * MaskedBubbleSurface — renders the painted background of a chat bubble
 * (gradient for sent, BlurView + tint for received) clipped to a single
 * silhouette that includes the tail. The text/media content is rendered as
 * children on top, naturally laying out and measuring the surface.
 *
 * Why this exists: stacking a separate tail SVG on top of a translucent
 * BlurView (or differently-clipped LinearGradient) leaves a visible seam at
 * the join. By masking ONE continuous surface, the seam disappears.
 */

import React, { useState, useCallback } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import MaskedView from "@react-native-masked-view/masked-view";
import {
  BubbleSilhouette,
  BUBBLE_TAIL_WIDTH,
  BUBBLE_TAIL_HEIGHT,
} from "./BubbleSilhouette";

type Variant = "sent" | "received" | "failed";

interface MaskedBubbleSurfaceProps {
  variant: Variant;
  side: "left" | "right";
  /** When false, the tail is omitted (consecutive messages from same sender). */
  showTail?: boolean;
  children: React.ReactNode;
  contentStyle?: object;
}

const SENT_GRADIENT = ["#FFB07B", "#F86F71", "#F04882"] as const;
const FAILED_BG = "rgba(240, 72, 72, 0.15)";
const FAILED_BORDER = "rgba(240, 72, 72, 0.4)";
const RECEIVED_BG = "rgba(11, 17, 36, 0.35)";
const RECEIVED_BORDER = "rgba(255, 255, 255, 0.12)";

export const MaskedBubbleSurface: React.FC<MaskedBubbleSurfaceProps> = ({
  variant,
  side,
  showTail = true,
  children,
  contentStyle,
}) => {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => {
      if (
        prev &&
        Math.abs(prev.w - width) < 0.5 &&
        Math.abs(prev.h - height) < 0.5
      ) {
        return prev;
      }
      return { w: width, h: height };
    });
  }, []);

  // The tail droops down-and-outward from the bubble's bottom corner, so the
  // background surface must extend both horizontally (a little, for the side
  // bulge) and vertically (more, for the drop).
  const tailW = showTail ? BUBBLE_TAIL_WIDTH : 0;
  const tailH = showTail ? BUBBLE_TAIL_HEIGHT + 1 : 0;
  const surfaceW = size ? size.w + tailW : 0;
  const surfaceH = size ? size.h + tailH : 0;
  const surfaceOffsetX = side === "left" ? -tailW : 0;

  const surface = size ? (
    variant === "received" ? (
      <BlurView
        intensity={30}
        tint="dark"
        style={{
          width: surfaceW,
          height: surfaceH,
          backgroundColor: RECEIVED_BG,
        }}
      />
    ) : variant === "failed" ? (
      <View
        style={{
          width: surfaceW,
          height: surfaceH,
          backgroundColor: FAILED_BG,
        }}
      />
    ) : (
      <LinearGradient
        colors={SENT_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: surfaceW, height: surfaceH }}
      />
    )
  ) : null;

  const borderColor =
    variant === "received"
      ? RECEIVED_BORDER
      : variant === "failed"
        ? FAILED_BORDER
        : null;

  return (
    <View style={styles.container}>
      {/* Background masked surface (gradient or blur), behind the content. */}
      {size ? (
        <View
          pointerEvents="none"
          style={[
            styles.surfaceLayer,
            { left: surfaceOffsetX, width: surfaceW, height: surfaceH },
          ]}
        >
          <MaskedView
            style={{ width: surfaceW, height: surfaceH }}
            maskElement={
              <BubbleSilhouette
                width={size.w}
                height={size.h}
                side={side}
                withTail={showTail}
              />
            }
          >
            {surface}
          </MaskedView>
          {borderColor ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <BubbleSilhouette
                width={size.w}
                height={size.h}
                side={side}
                withTail={showTail}
                stroke={borderColor}
                strokeWidth={1}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {/* Foreground content — its layout determines bubble size. */}
      <View onLayout={onLayout} style={contentStyle}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignSelf: "flex-start",
  },
  surfaceLayer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
