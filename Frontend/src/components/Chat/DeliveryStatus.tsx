/**
 * DeliveryStatus - Message delivery status icons
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

// Extract color values for StyleSheet.create() to avoid runtime resolution issues
const UI_ERROR_COLOR = colors.ui.error;
const TEXT_LIGHT_COLOR = colors.text.light;

interface DeliveryStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export const DeliveryStatus: React.FC<DeliveryStatusProps> = ({ status }) => {
  if (!status) {
    return null;
  }

  if (status === 'sending') {
    return <Text style={styles.sending}>⏳</Text>;
  }

  if (status === 'failed') {
    return <Text style={styles.failed}>⚠️</Text>;
  }

  if (status === 'sent') {
    return <Text style={[styles.check, { color: colors.text.tertiary }]}>✓</Text>;
  }

  if (status === 'delivered') {
    return (
      <LinearGradient
        colors={['#FFB07B', '#F04882']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCheck}
      >
        <Text style={styles.checkText}>✓✓</Text>
      </LinearGradient>
    );
  }

  if (status === 'read') {
    return (
      <LinearGradient
        colors={['#FFB07B', '#F04882']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCheck}
      >
        <Text style={styles.checkText}>✓✓</Text>
      </LinearGradient>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  sending: {
    fontSize: 12,
  },
  failed: {
    fontSize: 12,
    color: UI_ERROR_COLOR,
  },
  check: {
    fontSize: 12,
    fontWeight: '600',
  },
  gradientCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: TEXT_LIGHT_COLOR,
    fontSize: 10,
    fontWeight: '600',
  },
});


