/**
 * BottomTabBar - Bottom navigation bar component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

interface TabItem {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  badge?: number;
}

const tabs: TabItem[] = [
  { name: 'Contacts', icon: 'person-outline', route: 'Contacts' },
  { name: 'Calls', icon: 'call-outline', route: 'Calls' },
  { name: 'Chats', icon: 'chatbubbles-outline', route: 'ConversationsList', badge: 4 },
  { name: 'Settings', icon: 'settings-outline', route: 'Settings' },
];

export const BottomTabBar: React.FC = () => {
  const navigation = useNavigation();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const handleTabPress = (route: string) => {
    // @ts-ignore
    navigation.navigate(route);
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <View style={[styles.tabBar, { borderTopColor: colors.ui.divider }]}>
        {tabs.map((tab) => (
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
                color={themeColors.text.primary}
              />
              {tab.badge && tab.badge > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.primary.main }]}>
                  <Text style={styles.badgeText}>
                    {tab.badge > 99 ? '99+' : String(tab.badge)}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, { color: themeColors.text.primary }]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    paddingHorizontal: 8,
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background.dark,
  },
  badgeText: {
    color: colors.text.light,
    fontSize: 10,
    fontWeight: '600',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});

