import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';

export default function AuthScreen({ baseUrl, onAuthenticated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [bgImageUri, setBgImageUri] = useState(null);
  const [gradientStart, setGradientStart] = useState('#1b2b64');
  const [gradientEnd, setGradientEnd] = useState('#5b2c83');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const deviceName = useMemo(() => {
    if (Platform.OS === 'web') return 'Web';
    return `${Platform.OS}-${Platform.select({ ios: 'iOS', android: 'Android', default: 'RN' })}`;
  }, []);

  const deviceType = useMemo(() => (Platform.OS === 'web' ? 'web' : 'mobile'), []);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled) {
      const uri = result.assets?.[0]?.uri;
      if (uri) setAvatarUri(uri);
    }
  };

  const pickBackgroundImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled) {
      const uri = result.assets?.[0]?.uri;
      if (uri) setBgImageUri(uri);
    }
  };

  const requestCode = async () => {
    setLoading(true);
    setError(null);
    setMessage('');
    try {
      const endpoint = mode === 'register' ? '/auth/register/verify/request' : '/auth/login/verify/request';
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setVerificationId(data.verificationId);
      setMessage('Code envoyé. Entrez le code reçu par SMS.');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const confirmCode = async () => {
    setLoading(true);
    setError(null);
    setMessage('');
    try {
      const endpoint = mode === 'register' ? '/auth/register/verify/confirm' : '/auth/login/verify/confirm';
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId, code })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (mode === 'login' && data.requires2FA) {
        setMessage('2FA activé sur ce compte. (UI 2FA à venir)');
      } else {
        setMessage('Code vérifié. Vous pouvez continuer.');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const completeAuth = async () => {
    setLoading(true);
    setError(null);
    setMessage('');
    try {
      if (!verificationId) throw new Error('Aucune vérification active');
      if (mode === 'register') {
        const payload = { verificationId, firstName, lastName, deviceName, deviceType };
        const res = await fetch(`${baseUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const tokens = await res.json();
        onAuthenticated?.(tokens);
      } else {
        const payload = { verificationId, deviceName, deviceType };
        const res = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const tokens = await res.json();
        onAuthenticated?.(tokens);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const HeaderLogo = () => (
    <Text style={styles.logoText}>WHISPR</Text>
  );

  const GlassPanel = ({ children }) => (
    Platform.OS === 'web' ? (
      <View style={styles.glassWrap}>
        <View style={[
          styles.glassInner,
          { pointerEvents: 'auto', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }
        ]}>{children}</View>
      </View>
    ) : (
      <BlurView intensity={60} tint="dark" style={styles.glassWrap}>
        <View style={[styles.glassInner, { pointerEvents: 'auto' }]}>{children}</View>
      </BlurView>
    )
  );

  const Background = ({ children }) => (
    Platform.OS === 'web'
      ? (<View style={styles.flex}><View style={styles.flex}>{children}</View></View>)
      : (<View style={styles.flex}><LinearGradient colors={["#1b2b64", "#5b2c83"]} style={styles.flex} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}><View style={styles.flex}>{children}</View></LinearGradient></View>)
  );

  const PanelContent = () => {
    const children = [];
    // Toggle mode (Register / Login)
    children.push(
      <View key="mode-row" style={styles.rowBetween}>{[
        <TouchableOpacity key="register" onPress={() => setMode('register')} style={[styles.modeBtn, mode === 'register' && styles.modeBtnActive]}><Text style={styles.modeText}>S'inscrire</Text></TouchableOpacity>,
        <View key="spacer-1" style={{ width: 12 }} />,
        <TouchableOpacity key="login" onPress={() => setMode('login')} style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]}><Text style={styles.modeText}>Se connecter</Text></TouchableOpacity>
      ]}</View>
    );

    // Page content
    children.push(
      mode === 'login'
        ? <LoginScreen key="login" baseUrl={baseUrl} onAuthenticated={onAuthenticated} />
        : <RegisterScreen key="register" baseUrl={baseUrl} onAuthenticated={onAuthenticated} />
    );

    // Footer
    children.push(<Text key="footer" style={styles.footerText}>Whispr · Powered by Hermes engine</Text>);

    return <View>{children}</View>;
  };

  return (
    <Background>
      <View style={styles.centerContainer}>
        <HeaderLogo />
        <GlassPanel>
          <PanelContent />
        </GlassPanel>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerContainer: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#dbe3ff', fontSize: 42, letterSpacing: 8, fontWeight: '800', marginBottom: 24 },
  glassWrap: { width: '92%', maxWidth: 760, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  glassInner: { padding: 20, backgroundColor: 'rgba(255,255,255,0.05)' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modeBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  modeBtnActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  modeText: { color: '#cbd3ff', fontWeight: '600' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  avatarInitials: { color: '#eaf0ff', fontWeight: '700' },
  label: { color: '#cbd3ff', marginTop: 8, marginBottom: 4, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: '#eaf0ff', backgroundColor: 'rgba(255,255,255,0.08)' },
  codeInput: { width: 120, textAlign: 'center' },
  primaryBtn: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  primaryBtnText: { color: '#ffffff', fontWeight: '700' },
  secondaryBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  secondaryBtnText: { color: '#eaf0ff', fontWeight: '600' },
  smallBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  smallBtnText: { color: '#cbd3ff', fontWeight: '600' },
  colorInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  colorLabel: { color: '#cbd3ff', marginRight: 8 },
  colorInput: { flex: 1, color: '#eaf0ff' },
  errorText: { color: '#ff8a8a', marginTop: 8 },
  infoText: { color: '#cbd3ff', marginTop: 8 },
  wideBtn: { marginTop: 12, alignItems: 'center' },
  footerText: { color: '#9aa2c7', textAlign: 'center', marginTop: 12 },
});