/**
 * BottomTabBar - Bottom navigation bar component
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { navigate } from "../../navigation/navigationRef";
import { colors } from "../../theme/colors";
import { useConversationsStore } from "../../store/conversationsStore";

// Extract color values for StyleSheet.create() to avoid runtime resolution issues
const TEXT_LIGHT_COLOR = colors.text.light;
const PRIMARY_MAIN_COLOR = colors.primary.main;
const GRADIENT_APP_COLORS = colors.background.gradient.app;

interface TabItem {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
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

  const handleTabPress = (tabRoute: string) => {
    if (currentRouteName !== tabRoute) {
      navigate(tabRoute as any);
    }
  };

  const isActive = (tabRoute: string) => {
    return currentRouteName === tabRoute;
  };

  const visible = tabs.some((t) => t.route === currentRouteName);

  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "web" ? 0 : insets.bottom;

  return (
    <View
      style={[styles.container, !visible ? styles.containerHidden : null]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <LinearGradient
        colors={GRADIENT_APP_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradientBackground,
          { paddingBottom: visible ? bottomInset : 0 },
          !visible ? styles.gradientBackgroundHidden : null,
        ]}
      >
        <View
          style={[
            styles.tabBar,
            { borderTopColor: "rgba(255, 255, 255, 0.1)" },
          ]}
        >
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
                  <Ionicons
                    name={tab.icon}
                    size={24}
                    color={
                      active ? TEXT_LIGHT_COLOR : "rgba(255, 255, 255, 0.6)"
                    }
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
                        {badgeCount > 99 ? "99+" : String(badgeCount)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: active
                        ? TEXT_LIGHT_COLOR
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
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 0,
  },
  containerHidden: {
    height: 0,
    paddingBottom: 0,
    opacity: 0,
    overflow: "hidden",
  },
  gradientBackground: {
    borderTopWidth: 1,
  },
  gradientBackgroundHidden: {
    borderTopWidth: 0,
  },
  tabBar: {
    flexDirection: "row",
    height: 60,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    backgroundColor: "transparent",
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
