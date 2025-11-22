/**
 * DeliveryStatus - Message delivery status icons
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

interface DeliveryStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export const DeliveryStatus: React.FC<DeliveryStatusProps> = ({ status }) => {
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
      <Text style={[styles.check, { color: colors.text.tertiary }]}>✓✓</Text>
    );
  }

  if (status === 'read') {
    return (
      <LinearGradient
        colors={[colors.secondary.main, colors.secondary.light]}
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
    color: colors.ui.error,
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
    color: colors.text.light,
    fontSize: 10,
    fontWeight: '600',
  },
});

