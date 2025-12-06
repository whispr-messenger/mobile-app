/**
 * Toast Component - Notifications with icons
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide: () => void;
}

const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onHide,
}) => {
  const { getThemeColors, getFontSize } = useTheme();
  const themeColors = getThemeColors();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!visible) return null;

  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle',
          color: themeColors.success || '#21C004',
          backgroundColor: themeColors.success + '15' || 'rgba(33, 192, 4, 0.15)',
        };
      case 'error':
        return {
          icon: 'close-circle',
          color: themeColors.error || '#FF3B30',
          backgroundColor: themeColors.error + '15' || 'rgba(255, 59, 48, 0.15)',
        };
      case 'warning':
        return {
          icon: 'warning',
          color: themeColors.warning || '#FF9500',
          backgroundColor: themeColors.warning + '15' || 'rgba(255, 149, 0, 0.15)',
        };
      case 'info':
      default:
        return {
          icon: 'information-circle',
          color: themeColors.secondary || '#9692AC',
          backgroundColor: themeColors.secondary + '15' || 'rgba(150, 146, 172, 0.15)',
        };
    }
  };

  const { icon, color, backgroundColor } = getIconAndColor();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor: themeColors.background.secondary,
            borderLeftColor: color,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
              },
              android: {
                elevation: 8,
              },
            }),
          },
        ]}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor },
          ]}
        >
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <Text
          style={[
            styles.message,
            {
              color: themeColors.text.primary,
              fontSize: getFontSize('base'),
            },
          ]}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    minHeight: 56,
    width: SCREEN_WIDTH - 40,
    maxWidth: 400,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontWeight: '500',
    lineHeight: 20,
  },
});

export default Toast;

