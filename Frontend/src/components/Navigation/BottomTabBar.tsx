/**
 * BottomTabBar - Bottom navigation bar component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  { name: 'Calls', icon: 'call-outline', route: 'ConversationsList', badge: 2 },
  { name: 'Chats', useLogo: true, logoVariant: 'double', route: 'ConversationsList' },
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
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: '#1A1625' }]}>
      <View style={[styles.tabBar, { borderTopColor: 'rgba(255, 255, 255, 0.08)' }]}>
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
                          <View style={[styles.logoBackGradient, { backgroundColor: 'rgba(107, 91, 149, 0.6)' }]}>
                            <Image
                              source={require('../../../assets/images/logo-icon.png')}
                              style={[styles.logoImage, { width: 28, height: 28 }]}
                              resizeMode="contain"
                            />
                          </View>
                        </View>
                        <View style={styles.logoFront}>
                          <LinearGradient
                            colors={['#FFB07B', '#F04882']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.logoFrontGradient}
                          >
                            <Image
                              source={require('../../../assets/images/logo-icon.png')}
                              style={[styles.logoImage, { width: 32, height: 32, tintColor: '#FFFFFF' }]}
                              resizeMode="contain"
                            />
                          </LinearGradient>
                        </View>
                      </View>
                    ) : (
                      <Image
                        source={require('../../../assets/images/logo-icon.png')}
                        style={[styles.logoImage, { width: 28, height: 28, tintColor: active ? '#F04882' : 'rgba(235, 235, 245, 0.6)' }]}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                ) : tab.icon ? (
                  <Ionicons
                    name={tab.icon}
                    size={28}
                    color={active ? '#F04882' : 'rgba(235, 235, 245, 0.6)'}
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
                  color: active ? '#F04882' : 'rgba(235, 235, 245, 0.6)',
                  fontWeight: active ? '600' : '400',
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
    height: 83,
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
    height: 40,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logoBack: {
    position: 'absolute',
    top: 6,
    left: 0,
    zIndex: 1,
  },
  logoBackGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoFront: {
    position: 'absolute',
    top: 0,
    right: 6,
    zIndex: 2,
  },
  logoFrontGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '400',
  },
});

