/**
 * BottomTabBar - Bottom navigation bar component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

interface TabItem {
  name: string;
  icon?: keyof typeof Ionicons.glyphMap;
  useLogo?: boolean;
  logoVariant?: 'single' | 'double';
  route: string;
  badge?: number;
}

const tabs: TabItem[] = [
  { name: 'Contacts', icon: 'person-outline', route: 'Profile' },
  { name: 'Calls', icon: 'call-outline', route: 'ConversationsList' },
  { name: 'Chats', useLogo: true, logoVariant: 'double', route: 'ConversationsList', badge: 4 },
  { name: 'Settings', useLogo: true, logoVariant: 'single', route: 'Settings' },
];

export const BottomTabBar: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const handleTabPress = (tabRoute: string) => {
    if (route.name !== tabRoute) {
      // @ts-ignore
      navigation.navigate(tabRoute);
    }
  };

  const isActive = (tabRoute: string) => {
    return route.name === tabRoute;
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <View style={[styles.tabBar, { borderTopColor: colors.ui.divider }]}>
        {tabs.map((tab) => {
          const active = isActive(tab.route);
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
                    {tab.logoVariant === 'double' ? (
                      <View style={styles.doubleLogoContainer}>
                        <View style={styles.logoBack}>
                          <Image
                            source={require('../../../assets/images/logo-icon.png')}
                            style={styles.logoImage}
                            resizeMode="contain"
                          />
                        </View>
                        <View style={styles.logoFront}>
                          <Image
                            source={require('../../../assets/images/logo-icon.png')}
                            style={styles.logoImage}
                            resizeMode="contain"
                          />
                        </View>
                      </View>
                    ) : (
                      <Image
                        source={require('../../../assets/images/logo-icon.png')}
                        style={styles.logoImage}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                ) : tab.icon ? (
                  <Ionicons
                    name={tab.icon}
                    size={24}
                    color={active ? themeColors.primary : themeColors.text.tertiary}
                  />
                ) : null}
              {tab.badge && tab.badge > 0 && (
                <View style={[
                  styles.badge, 
                  { 
                    backgroundColor: '#FF3B30',
                    borderColor: '#1A1625',
                  }
                ]}>
                  <Text style={styles.badgeText}>
                    {tab.badge > 99 ? '99+' : String(tab.badge)}
                  </Text>
                </View>
              )}
              </View>
              <Text style={[
                styles.tabLabel, 
                { 
                  color: active ? themeColors.primary : themeColors.text.primary,
                  fontWeight: active ? '600' : '500',
                }
              ]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
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
    paddingHorizontal: 4,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 2,
    width: 40,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logoImage: {
    width: 24,
    height: 24,
    tintColor: undefined,
  },
  doubleLogoContainer: {
    width: 40,
    height: 32,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logoBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.75,
    zIndex: 1,
    transform: [{ scale: 0.85 }],
  },
  logoFront: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 2,
    transform: [{ scale: 0.85 }],
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
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

