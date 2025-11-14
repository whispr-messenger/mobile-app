import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';

export default function LoginScreen({ baseUrl, onAuthenticated }) {
  const [identifier, setIdentifier] = useState(''); // email ou téléphone
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const deviceName = useMemo(() => {
    if (Platform.OS === 'web') return 'Web';
    return `${Platform.OS}-${Platform.select({ ios: 'iOS', android: 'Android', default: 'RN' })}`;
  }, []);

  const deviceType = useMemo(() => (Platform.OS === 'web' ? 'web' : 'mobile'), []);

  // Bypass: connexion par mot de passe (style Discord)

  // (supprimé: flux SMS)

  const completeLogin = async () => {
    // DEV bypass: simule une connexion réussie avec identifiant/mot de passe
    setLoading(true);
    setError(null);
    setMessage('');
    try {
      if (!identifier) throw new Error("E-mail ou téléphone requis");
      if (!password) throw new Error('Mot de passe requis');
      const tokens = { accessToken: 'dev-access-token', refreshToken: 'dev-refresh-token' };
      onAuthenticated?.(tokens);
      setMessage('Connexion simulée.');
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  };

  const row = (key, children) => (
    <View key={key} style={styles.rowBetween}>{children}</View>
  );

  const content = [
    <Text key="label-id" style={styles.label}>E-mail ou numéro de téléphone</Text>,
    <TextInput key="input-id" style={styles.input} value={identifier} onChangeText={setIdentifier} placeholder="ex: alice@example.com" placeholderTextColor="#9aa2c7" autoCapitalize="none" />,
    <Text key="label-pass" style={styles.label}>Mot de passe</Text>,
    <TextInput key="input-pass" style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="#9aa2c7" secureTextEntry />,
    error ? <Text key="error" style={styles.errorText}>Erreur: {error}</Text> : null,
    message ? <Text key="info" style={styles.infoText}>{message}</Text> : null,
    <TouchableOpacity key="submit" style={[styles.primaryBtn, styles.wideBtn]} onPress={completeLogin} disabled={loading}><Text style={styles.primaryBtnText}>Connexion</Text></TouchableOpacity>
  ].filter(Boolean);

  return <View>{content}</View>;
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { color: '#cbd3ff', marginTop: 8, marginBottom: 4, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: '#eaf0ff', backgroundColor: 'rgba(255,255,255,0.08)' },
  codeInput: { width: 120, textAlign: 'center' },
  primaryBtn: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  primaryBtnText: { color: '#ffffff', fontWeight: '700' },
  secondaryBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  secondaryBtnText: { color: '#eaf0ff', fontWeight: '600' },
  errorText: { color: '#ff8a8a', marginTop: 8 },
  infoText: { color: '#cbd3ff', marginTop: 8 },
  wideBtn: { marginTop: 12, alignItems: 'center' },
});