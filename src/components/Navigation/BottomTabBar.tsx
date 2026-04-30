/**
 * BottomTabBar - Bottom navigation bar component
 * WHISPR-1194: pilule flottante avec effet glassmorphism (BlurView).
 * WHISPR-1195: animation d'apparition/disparition (translateY + opacity).
 */

import React, { memo, useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { navigate } from "../../navigation/navigationRef";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { colors } from "../../theme/colors";
import { useConversationsStore } from "../../store/conversationsStore";
import { useUIStore } from "../../store/uiStore";
import {
  FLOATING_TAB_BAR_BORDER_RADIUS as PILL_BORDER_RADIUS,
  FLOATING_TAB_BAR_BOTTOM_OFFSET as PILL_BOTTOM_OFFSET,
  FLOATING_TAB_BAR_HORIZONTAL_MARGIN as PILL_HORIZONTAL_MARGIN,
  FLOATING_TAB_BAR_PILL_HEIGHT as PILL_HEIGHT,
} from "./floatingTabBarLayout";

const TEXT_LIGHT_COLOR = colors.text.light;
const PRIMARY_MAIN_COLOR = colors.primary.main;
const INACTIVE_ICON_COLOR = "rgba(255, 255, 255, 0.6)";
const INACTIVE_LABEL_COLOR = "rgba(255, 255, 255, 0.7)";

// On iOS BlurView gives a real glass effect, so the overlay tint can stay
// light. On Android the blur is very translucent (and the default method is
// a no-op fallback on some devices), so we use a more opaque tint to keep
// the pill readable.
const PILL_OVERLAY_BG_COLOR =
  Platform.OS === "ios" ? "rgba(20, 25, 50, 0.35)" : "rgba(20, 25, 50, 0.7)";

// WHISPR-1195: timings de l'animation d'entrée/sortie de la pilule.
const HIDDEN_TRANSLATE_Y = 16;
const ENTER_DURATION_MS = 180;
const EXIT_DURATION_MS = 140;

type TabRoute = keyof AuthStackParamList;

interface TabItem {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: TabRoute;
  badgeKey?: "chats";
}

const tabs: TabItem[] = [
  { name: "Contacts", icon: "person-outline", route: "Contacts" },
  { name: "Appels", icon: "call-outline", route: "Calls" },
  {
    name: "Discussions",
    icon: "chatbubble-ellipses-outline",
    route: "ConversationsList",
    badgeKey: "chats",
  },
  { name: "Réglages", icon: "settings-outline", route: "Settings" },
];

type TabButtonProps = {
  tab: TabItem;
  active: boolean;
  badgeCount: number;
  onPress: (route: TabRoute) => void;
};

const TabButton = memo<TabButtonProps>(
  ({ tab, active, badgeCount, onPress }) => {
    const handlePress = useCallback(
      () => onPress(tab.route),
      [onPress, tab.route],
    );

    const accessibilityLabel =
      badgeCount > 0
        ? `${tab.name}, ${badgeCount} ${
            badgeCount > 1 ? "messages non lus" : "message non lu"
          }`
        : tab.name;

    return (
      <TouchableOpacity
        style={styles.tab}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={accessibilityLabel}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={tab.icon}
            size={24}
            color={active ? PRIMARY_MAIN_COLOR : INACTIVE_ICON_COLOR}
          />
          {badgeCount > 0 && (
            <View
              style={[styles.badge, { backgroundColor: PRIMARY_MAIN_COLOR }]}
            >
              <Text style={styles.badgeText}>
                {badgeCount > 99 ? "99+" : String(badgeCount)}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.tabLabel,
            {
              color: active ? PRIMARY_MAIN_COLOR : INACTIVE_LABEL_COLOR,
              fontWeight: active ? "600" : "500",
            },
          ]}
        >
          {tab.name}
        </Text>
      </TouchableOpacity>
    );
  },
);
TabButton.displayName = "TabButton";

type Props = {
  currentRouteName: string;
};

const BottomTabBarImpl: React.FC<Props> = ({ currentRouteName }) => {
  const chatsUnread = useConversationsStore((s) =>
    s.conversations.reduce(
      (sum, c) =>
        sum + (typeof c.unread_count === "number" ? c.unread_count : 0),
      0,
    ),
  );

  const insets = useSafeAreaInsets();

  // Keep the latest route in a ref so the press callback can stay stable
  // across renders — required for React.memo on TabButton to actually skip.
  const currentRouteRef = useRef(currentRouteName);
  currentRouteRef.current = currentRouteName;

  const handleTabPress = useCallback((tabRoute: TabRoute) => {
    if (currentRouteRef.current !== tabRoute) {
      navigate(tabRoute);
    }
  }, []);

  const bottomTabBarHidden = useUIStore((s) => s.bottomTabBarHidden);
  const visible =
    tabs.some((t) => t.route === currentRouteName) && !bottomTabBarHidden;

  // On garde la pilule montée en permanence pour ne pas couper l'animation
  // de sortie ; `pointerEvents="none"` empêche les touches résiduelles de
  // toucher les onglets pendant le fade-out, et `opacity:0` la rend invisible
  // une fois la transition finie.
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateY = useRef(
    new Animated.Value(visible ? 0 : HIDDEN_TRANSLATE_Y),
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? ENTER_DURATION_MS : EXIT_DURATION_MS,
        easing: visible ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : HIDDEN_TRANSLATE_Y,
        duration: visible ? ENTER_DURATION_MS : EXIT_DURATION_MS,
        easing: visible ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, translateY]);

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[
        styles.floatingContainer,
        {
          bottom: PILL_BOTTOM_OFFSET + insets.bottom,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.shadowFrame}>
        <View style={styles.pillClip}>
          <BlurView
            intensity={Platform.OS === "ios" ? 60 : 80}
            tint="dark"
            style={styles.pillBlur}
          >
            <View style={styles.pillBorderOverlay}>
              <View style={styles.tabRow}>
                {tabs.map((tab) => {
                  const active = currentRouteName === tab.route;
                  const badgeCount =
                    tab.badgeKey === "chats" && chatsUnread > 0
                      ? chatsUnread
                      : 0;
                  return (
                    <TabButton
                      key={tab.name}
                      tab={tab}
                      active={active}
                      badgeCount={badgeCount}
                      onPress={handleTabPress}
                    />
                  );
                })}
              </View>
            </View>
          </BlurView>
        </View>
      </View>
    </Animated.View>
  );
};

export const BottomTabBar = memo(BottomTabBarImpl);

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    left: PILL_HORIZONTAL_MARGIN,
    right: PILL_HORIZONTAL_MARGIN,
    // `bottom` est calculé dynamiquement (insets.bottom + offset) côté composant.
  },
  // Le shadow doit vivre sur un conteneur SANS overflow:hidden, sinon
  // l'ombre est clippée sur iOS et l'élévation Android disparaît.
  shadowFrame: {
    borderRadius: PILL_BORDER_RADIUS,
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    backgroundColor: "transparent",
  },
  // Clipping séparé du shadow pour que les coins arrondis appliquent au blur.
  pillClip: {
    borderRadius: PILL_BORDER_RADIUS,
    overflow: "hidden",
  },
  pillBlur: {
    borderRadius: PILL_BORDER_RADIUS,
  },
  // Le rendu BlurView Android est très translucide ; on appuie l'effet verre
  // avec un fond semi-opaque + une bordure blanche subtile.
  pillBorderOverlay: {
    borderRadius: PILL_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor: PILL_OVERLAY_BG_COLOR,
  },
  tabRow: {
    flexDirection: "row",
    height: PILL_HEIGHT,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  iconContainer: {
    position: "relative",
    marginBottom: 2,
    width: 48,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: TEXT_LIGHT_COLOR,
    fontSize: 10,
    fontWeight: "600",
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
});
