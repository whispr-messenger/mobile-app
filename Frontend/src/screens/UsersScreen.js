import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';

export default function UsersScreen({ baseUrl }) {
  const [username, setUsername] = useState('alice');
  const [phoneNumber, setPhoneNumber] = useState('+33123456789');
  const [firstName, setFirstName] = useState('Alice');
  const [lastName, setLastName] = useState('Dupont');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [biography, setBiography] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const createUser = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        username,
        phoneNumber,
        firstName,
        lastName,
      };
      if (profilePictureUrl) payload.profilePictureUrl = profilePictureUrl;
      if (biography) payload.biography = biography;
      const res = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Créer un utilisateur</Text>
      <Text style={styles.label}>Username</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} />
      <Text style={styles.label}>Téléphone (E.164)</Text>
      <TextInput style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} />
      <Text style={styles.label}>Prénom</Text>
      <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />
      <Text style={styles.label}>Nom</Text>
      <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />
      <Text style={styles.label}>Photo (URL, optionnel)</Text>
      <TextInput style={styles.input} value={profilePictureUrl} onChangeText={setProfilePictureUrl} />
      <Text style={styles.label}>Bio (optionnel)</Text>
      <TextInput style={styles.input} value={biography} onChangeText={setBiography} />

      <View style={styles.row}>
        <Button title={loading ? 'Création…' : 'Créer'} onPress={createUser} disabled={loading} />
      </View>

      {error && <Text style={styles.error}>Erreur: {error}</Text>}
      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Utilisateur créé</Text>
          <Text style={styles.resultText}>ID: {result.id}</Text>
          <Text style={styles.resultText}>Username: {result.username}</Text>
          <Text style={styles.resultText}>Téléphone: {result.phoneNumber}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  label: { marginTop: 8, marginBottom: 4, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  error: { color: 'red', marginTop: 8 },
  resultBox: { marginTop: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 6, padding: 8 },
  resultTitle: { fontWeight: '600' },
  resultText: { fontSize: 14 },
});