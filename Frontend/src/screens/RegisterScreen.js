import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';

export default function RegisterScreen({ baseUrl, onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const deviceName = useMemo(() => {
    if (Platform.OS === 'web') return 'Web';
    return `${Platform.OS}-${Platform.select({ ios: 'iOS', android: 'Android', default: 'RN' })}`;
  }, []);

  const deviceType = useMemo(() => (Platform.OS === 'web' ? 'web' : 'mobile'), []);

  const requestCode = async () => {
    // DEV bypass: vérification fictive (pas d’API)
    setLoading(true);
    setError(null);
    setMessage('');
    try {
      const fakeId = `DEV-BYPASS-${Date.now()}`;
      setVerificationId(fakeId);
      setMessage('Bypass activé: vous pouvez continuer.');
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  };

  const confirmCode = async () => {
    // DEV bypass: confirmation fictive
    setLoading(true);
    setError(null);
    setMessage('');
    try {
      if (!verificationId) throw new Error('Aucune vérification active');
      setMessage('Code simulé, vous pouvez continuer.');
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  };

  const completeRegister = async () => {
    // DEV bypass: créer compte façon Discord (champs locaux) et connecter
    setLoading(true);
    setError(null);
    setMessage('');
    try {
      if (!verificationId) throw new Error('Aucune vérification active');
      if (!email) throw new Error('E-mail requis');
      if (!username) throw new Error("Nom d'utilisateur requis");
      if (!password) throw new Error('Mot de passe requis');
      if (!(birthDay && birthMonth && birthYear)) throw new Error('Date de naissance incomplète');
      if (!termsAccepted) throw new Error('Vous devez accepter les conditions');
      const tokens = { accessToken: 'dev-access-token', refreshToken: 'dev-refresh-token' };
      onAuthenticated?.(tokens);
      setMessage('Inscription simulée.');
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  };

  const row = (key, children) => (
    <View key={key} style={styles.rowBetween}>{children}</View>
  );

  const content = [
    <Text key="label-email" style={styles.label}>E-mail</Text>,
    <TextInput key="input-email" style={styles.input} value={email} onChangeText={setEmail} placeholder="ex: alice@example.com" placeholderTextColor="#9aa2c7" autoCapitalize="none" />,
    <Text key="label-display" style={styles.label}>Nom d'affichage</Text>,
    <TextInput key="input-display" style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Alice" placeholderTextColor="#9aa2c7" />,
    <Text key="label-username" style={styles.label}>Nom d'utilisateur</Text>,
    <TextInput key="input-username" style={styles.input} value={username} onChangeText={setUsername} placeholder="alice" placeholderTextColor="#9aa2c7" autoCapitalize="none" />,
    <Text key="label-pass" style={styles.label}>Mot de passe</Text>,
    <TextInput key="input-pass" style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="#9aa2c7" secureTextEntry />,
    <Text key="label-dob" style={styles.label}>Date de naissance</Text>,
    row('dob-row', [
      <TextInput key="day" style={[styles.input, styles.inputSmall]} value={birthDay} onChangeText={setBirthDay} placeholder="Jour" placeholderTextColor="#9aa2c7" keyboardType="numeric" />,
      <View key="spacer-1" style={{ width: 12 }} />,
      <TextInput key="month" style={[styles.input, styles.inputSmall]} value={birthMonth} onChangeText={setBirthMonth} placeholder="Mois" placeholderTextColor="#9aa2c7" keyboardType="numeric" />,
      <View key="spacer-2" style={{ width: 12 }} />,
      <TextInput key="year" style={[styles.input, styles.inputSmall]} value={birthYear} onChangeText={setBirthYear} placeholder="Année" placeholderTextColor="#9aa2c7" keyboardType="numeric" />
    ]),
    row('terms-row', [
      <TouchableOpacity key="checkbox" onPress={() => setTermsAccepted(!termsAccepted)} style={styles.checkboxWrap}>
        <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]} />
        <Text style={styles.checkboxText}>J'ai lu et accepté les Conditions d'Utilisation et la Politique de Confidentialité</Text>
      </TouchableOpacity>
    ]),
    error ? <Text key="error" style={styles.errorText}>Erreur: {error}</Text> : null,
    message ? <Text key="info" style={styles.infoText}>{message}</Text> : null,
    row('code-row', [
      <TouchableOpacity key="request" style={styles.secondaryBtn} onPress={requestCode} disabled={loading}><Text style={styles.secondaryBtnText}>Préparer</Text></TouchableOpacity>,
      <View key="spacer-3" style={{ width: 12 }} />,
      <TouchableOpacity key="confirm" style={styles.secondaryBtn} onPress={confirmCode} disabled={loading || !verificationId}><Text style={styles.secondaryBtnText}>Confirmer</Text></TouchableOpacity>
    ]),
    <TouchableOpacity key="submit" style={[styles.primaryBtn, styles.wideBtn]} onPress={completeRegister} disabled={loading}><Text style={styles.primaryBtnText}>Créer un compte</Text></TouchableOpacity>
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