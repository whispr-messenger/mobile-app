/**
 * SkeletonLoader - Placeholders animes pour les etats de chargement.
 * Exports : SkeletonLoader (brique de base), ConversationSkeleton,
 * ContactItemSkeleton, MessageBubbleSkeleton, InboxItemSkeleton.
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: "rgba(255, 255, 255, 0.1)",
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

export const ConversationSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <SkeletonLoader width={48} height={48} borderRadius={24} />
      <View style={styles.content}>
        <SkeletonLoader width="60%" height={16} style={styles.nameSkeleton} />
        <SkeletonLoader width="80%" height={14} />
      </View>
      <View style={styles.meta}>
        <SkeletonLoader width={40} height={12} />
      </View>
    </View>
  );
};

/** Skeleton d'un item contact : avatar rond + nom + badge optionnel. */
export const ContactItemSkeleton: React.FC = () => (
  <View style={styles.contactContainer}>
    <SkeletonLoader width={52} height={52} borderRadius={26} />
    <View style={styles.contactContent}>
      <SkeletonLoader width="55%" height={15} style={styles.nameSkeleton} />
      <SkeletonLoader width="35%" height={12} />
    </View>
    <SkeletonLoader width={24} height={24} borderRadius={12} />
  </View>
);

/** Skeleton d'une bulle de message : bulle alignee a gauche ou droite. */
export const MessageBubbleSkeleton: React.FC<{ align?: "left" | "right" }> = ({
  align = "left",
}) => (
  <View
    style={[
      styles.bubbleRow,
      align === "right" ? styles.bubbleRowRight : styles.bubbleRowLeft,
    ]}
  >
    {align === "left" && (
      <SkeletonLoader
        width={32}
        height={32}
        borderRadius={16}
        style={styles.bubbleAvatar}
      />
    )}
    <View style={styles.bubbleLines}>
      <SkeletonLoader
        width={align === "right" ? "70%" : "65%"}
        height={14}
        borderRadius={10}
        style={styles.bubbleLine}
      />
      <SkeletonLoader
        width={align === "right" ? "45%" : "50%"}
        height={14}
        borderRadius={10}
      />
    </View>
  </View>
);

/** Skeleton d'un item inbox : avatar + 2 lignes + timestamp. */
export const InboxItemSkeleton: React.FC = () => (
  <View style={styles.inboxContainer}>
    <SkeletonLoader width={44} height={44} borderRadius={22} />
    <View style={styles.inboxContent}>
      <View style={styles.inboxTopRow}>
        <SkeletonLoader width="50%" height={14} style={styles.nameSkeleton} />
        <SkeletonLoader width={36} height={11} />
      </View>
      <SkeletonLoader width="80%" height={12} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  // ConversationSkeleton
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  nameSkeleton: {
    marginBottom: 8,
  },
  meta: {
    alignItems: "flex-end",
  },
  // ContactItemSkeleton
  contactContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  contactContent: {
    flex: 1,
    marginLeft: 12,
  },
  // MessageBubbleSkeleton
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 6,
    paddingHorizontal: 12,
  },
  bubbleRowLeft: {
    justifyContent: "flex-start",
  },
  bubbleRowRight: {
    justifyContent: "flex-end",
  },
  bubbleAvatar: {
    marginRight: 8,
  },
  bubbleLines: {
    maxWidth: "72%",
  },
  bubbleLine: {
    marginBottom: 6,
  },
  // InboxItemSkeleton
  inboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  inboxContent: {
    flex: 1,
    marginLeft: 12,
  },
  inboxTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
});
