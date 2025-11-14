import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useSettings } from '../context/SettingsContext';

export default function MainScreen({ onAvatarPress }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { backgroundType, backgroundColor, avatarUri, theme } = useSettings();
  const textPrimary = theme === 'light' ? '#0b1020' : '#eaf0ff';
  const textSecondary = theme === 'light' ? '#1f2a44' : '#cbd3ff';

  const Background = ({ children }) => {
    if (backgroundType === 'gradient') {
      return (
        <LinearGradient colors={['#0b1020', '#1b2b64']} style={styles.flex} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {children}
        </LinearGradient>
      );
    }
    const bgDefault = theme === 'light' ? '#ffffff' : '#000';
    const bgStyle = backgroundType === 'color' ? { backgroundColor } : { backgroundColor: bgDefault };
    return <View style={[styles.flex, bgStyle]}>{children}</View>;
  };

  const avatarSource = avatarUri ? { uri: avatarUri } : require('../../assets/dalm1chatstorm.gif');

  return (
    <Background>
      <View style={styles.root}>
        <View style={[styles.sidebar, sidebarCollapsed && styles.sidebarCollapsed]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={sidebarCollapsed ? 'Ouvrir la sidebar' : 'Fermer la sidebar'}
            onPress={() => setSidebarCollapsed((v) => !v)}
            style={styles.toggleBtn}
          >
            <Text style={styles.toggleText}>{sidebarCollapsed ? '›' : '‹'}</Text>
          </TouchableOpacity>

          {!sidebarCollapsed && (
            <TouchableOpacity accessibilityRole="button" onPress={onAvatarPress} style={styles.avatarTouch}>
              <Image source={avatarSource} style={styles.avatarImg} resizeMode="cover" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: textPrimary }]}>WHISPR.</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Créez une conversation pour commencer.</Text>
        </View>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 72,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.12)',
    paddingTop: 10,
    alignItems: 'center'
  },
  sidebarCollapsed: { width: 20 },
  toggleBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12
  },
  toggleText: { color: '#e5e7eb', fontSize: 16, lineHeight: 16 },
  avatarTouch: { marginTop: 4 },
  avatarImg: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#eaf0ff', fontSize: 22, fontWeight: '700', letterSpacing: 0.4 },
  subtitle: { color: '#cbd3ff', marginTop: 6 }
});
