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

// Extract color values for StyleSheet.create() to avoid runtime resolution issues
const TEXT_LIGHT_COLOR = colors.text.light;
const PRIMARY_MAIN_COLOR = colors.primary.main;
const GRADIENT_APP_COLORS = colors.background.gradient.app;

interface TabItem {
  name: string;
  icon?: keyof typeof Ionicons.glyphMap;
  useLogo?: boolean;
  logoVariant?: 'single' | 'double';
  route: string;
  badgeKey?: 'chats';
}

const tabs: TabItem[] = [
  { name: 'Contacts', icon: 'person-outline', route: 'Contacts' },
  { name: 'Calls', icon: 'call-outline', route: 'ConversationsList' },
  { name: 'Chats', useLogo: true, logoVariant: 'double', route: 'ConversationsList', badgeKey: 'chats' },
  { name: 'Settings', useLogo: true, logoVariant: 'single', route: 'Settings' },
];

export const BottomTabBar: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const [unreadCounts, setUnreadCounts] = React.useState<{ chats: number }>({ chats: 0 });

  React.useEffect(() => {
    const updateCounts = (conversations: any[]) => {
      const chatsUnread = conversations.reduce((sum, conv) => {
        const count = conv.unread_count || 0;
        return sum + (typeof count === 'number' ? count : 0);
      }, 0);
      setUnreadCounts({ chats: chatsUnread });
    };

    const handleUpdate = (event: any) => {
      if (event && event.conversations && Array.isArray(event.conversations)) {
        updateCounts(event.conversations);
      }
    };

    const subscription = (globalThis as any).whisprEvents?.addListener?.(
      'conversationsUpdated',
      handleUpdate
    );

    const initial = (globalThis as any).whisprConversations as any[] | undefined;
    if (initial && Array.isArray(initial)) {
      updateCounts(initial);
    }

    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      } else if ((globalThis as any).whisprEvents?.removeListener) {
        (globalThis as any).whisprEvents.removeListener('conversationsUpdated', handleUpdate);
      }
    };
  }, []);

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
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <LinearGradient
        colors={GRADIENT_APP_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      >
        <View style={[styles.tabBar, { borderTopColor: 'rgba(255, 255, 255, 0.1)' }]}>
        {tabs.map((tab) => {
          const active = isActive(tab.route);
          const badgeCount =
            tab.badgeKey && unreadCounts[tab.badgeKey] && unreadCounts[tab.badgeKey] > 0
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
                    {tab.logoVariant === 'double' ? (
                      <View style={styles.doubleLogoContainer}>
                        <View style={styles.logoBack}>
                          <Image
                            source={require('../../../assets/images/logo-icon.png')}
                            style={styles.logoImageBack}
                            resizeMode="contain"
                          />
                        </View>
                        <View style={styles.logoFront}>
                          <Image
                            source={require('../../../assets/images/logo-icon.png')}
                            style={styles.logoImageFront}
                            resizeMode="contain"
                          />
                          {badgeCount > 0 && (
                            <View
                              style={[
                                styles.badge,
                                {
                                  backgroundColor: PRIMARY_MAIN_COLOR,
                                  borderColor: 'transparent',
                                },
                              ]}
                            >
                              <Text style={styles.badgeText}>
                                {badgeCount > 99 ? '99+' : String(badgeCount)}
                              </Text>
                            </View>
                          )}
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
                    color={active ? PRIMARY_MAIN_COLOR : 'rgba(255, 255, 255, 0.6)'}
                  />
                ) : null}
              </View>
              <Text style={[
                styles.tabLabel,
                {
                  color: active ? PRIMARY_MAIN_COLOR : 'rgba(255, 255, 255, 0.7)',
                  fontWeight: active ? '600' : '500',
                }
              ]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 0,
  },
  gradientBackground: {
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
    width: 48,
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
    width: 48,
    height: 32,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logoBack: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
  },
  logoFront: {
    position: 'absolute',
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
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  badgeText: {
    color: TEXT_LIGHT_COLOR,
    fontSize: 10,
    fontWeight: '600',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});
