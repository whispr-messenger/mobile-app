/**
 * BottomTabBar - Bottom navigation bar component
 * WHISPR-1194: pilule flottante avec effet glassmorphism (BlurView).
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { navigate } from "../../navigation/navigationRef";
import { colors } from "../../theme/colors";
import { useConversationsStore } from "../../store/conversationsStore";
import {
  FLOATING_TAB_BAR_BORDER_RADIUS as PILL_BORDER_RADIUS,
  FLOATING_TAB_BAR_BOTTOM_OFFSET as PILL_BOTTOM_OFFSET,
  FLOATING_TAB_BAR_HORIZONTAL_MARGIN as PILL_HORIZONTAL_MARGIN,
  FLOATING_TAB_BAR_PILL_HEIGHT as PILL_HEIGHT,
} from "./floatingTabBarLayout";

// Extract color values for StyleSheet.create() to avoid runtime resolution issues
const TEXT_LIGHT_COLOR = colors.text.light;
const PRIMARY_MAIN_COLOR = colors.primary.main;

interface TabItem {
  name: string;
  icon?: keyof typeof Ionicons.glyphMap;
  useLogo?: boolean;
  logoVariant?: "single" | "double";
  route: string;
  badgeKey?: "chats";
}

const tabs: TabItem[] = [
  { name: "Contacts", icon: "person-outline", route: "Contacts" },
  { name: "Appels", icon: "call-outline", route: "Calls" },
  {
    name: "Discussions",
    useLogo: true,
    logoVariant: "double",
    route: "ConversationsList",
    badgeKey: "chats",
  },
  { name: "Réglages", useLogo: true, logoVariant: "single", route: "Settings" },
];

type Props = {
  currentRouteName: string;
};

export const BottomTabBar: React.FC<Props> = ({ currentRouteName }) => {
  const chatsUnread = useConversationsStore((s) =>
    s.conversations.reduce(
      (sum, c) =>
        sum + (typeof c.unread_count === "number" ? c.unread_count : 0),
      0,
    ),
  );
  const unreadCounts = { chats: chatsUnread };

  const insets = useSafeAreaInsets();

  const handleTabPress = (tabRoute: string) => {
    if (currentRouteName !== tabRoute) {
      navigate(tabRoute as any);
    }
  };

  const isActive = (tabRoute: string) => currentRouteName === tabRoute;

  const visible = tabs.some((t) => t.route === currentRouteName);
  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.floatingContainer,
        { bottom: PILL_BOTTOM_OFFSET + insets.bottom },
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
                  const active = isActive(tab.route);
                  const badgeCount =
                    tab.badgeKey &&
                    unreadCounts[tab.badgeKey] &&
                    unreadCounts[tab.badgeKey] > 0
                      ? unreadCounts[tab.badgeKey]
                      : 0;

                  return (
                    <TouchableOpacity
                      key={tab.name}
                      style={styles.tab}
                      onPress={() => handleTabPress(tab.route)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.iconContainer}>
                        {tab.useLogo ? (
                          <View style={styles.logoContainer}>
                            {tab.logoVariant === "double" ? (
                              <View style={styles.doubleLogoContainer}>
                                <View style={styles.logoBack}>
                                  <Image
                                    source={require("../../../assets/images/logo-icon.png")}
                                    style={styles.logoImageBack}
                                    resizeMode="contain"
                                  />
                                </View>
                                <View style={styles.logoFront}>
                                  <Image
                                    source={require("../../../assets/images/logo-icon.png")}
                                    style={styles.logoImageFront}
                                    resizeMode="contain"
                                  />
                                  {badgeCount > 0 && (
                                    <View
                                      style={[
                                        styles.badge,
                                        {
                                          backgroundColor: PRIMARY_MAIN_COLOR,
                                          borderColor: "transparent",
                                        },
                                      ]}
                                    >
                                      <Text style={styles.badgeText}>
                                        {badgeCount > 99
                                          ? "99+"
                                          : String(badgeCount)}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            ) : (
                              <Image
                                source={require("../../../assets/images/logo-icon.png")}
                                style={styles.logoImage}
                                resizeMode="contain"
                              />
                            )}
                          </View>
                        ) : tab.icon ? (
                          <Ionicons
                            name={tab.icon}
                            size={24}
                            color={
                              active
                                ? PRIMARY_MAIN_COLOR
                                : "rgba(255, 255, 255, 0.6)"
                            }
                          />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.tabLabel,
                          {
                            color: active
                              ? PRIMARY_MAIN_COLOR
                              : "rgba(255, 255, 255, 0.7)",
                            fontWeight: active ? "600" : "500",
                          },
                        ]}
                      >
                        {tab.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </BlurView>
        </View>
      </View>
    </View>
  );
};

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
    backgroundColor: "rgba(20, 25, 50, 0.35)",
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
  logoContainer: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  logoImage: {
    width: 24,
    height: 24,
    tintColor: undefined,
  },
  doubleLogoContainer: {
    width: 48,
    height: 32,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  logoBack: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 1,
  },
  logoFront: {
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 2,
  },
  logoImageBack: {
    width: 28,
    height: 28,
    opacity: 0.7,
  },
  logoImageFront: {
    width: 28,
    height: 28,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
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
