import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';

export default function ContactsScreen({ baseUrl }) {
  const [userId, setUserId] = useState('f2bdd7ad-f491-45d5-b9e0-7137ceb7e5f7');
  const [contactId, setContactId] = useState('6c511646-a2b8-4d6c-bdc4-7f129c784017');
  const [reciprocal, setReciprocal] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const addContact = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res1 = await fetch(`${baseUrl}/contacts/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId })
      });
      if (!res1.ok) throw new Error(`HTTP ${res1.status}`);
      const data1 = await res1.json();

      let data2 = null;
      if (reciprocal) {
        const res2 = await fetch(`${baseUrl}/contacts/${contactId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId: userId })
        });
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
        data2 = await res2.json();
      }

      setResult({ oneWay: data1, reciprocal: data2 });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ajouter un contact</Text>
      <Text style={styles.label}>Utilisateur</Text>
      <TextInput style={styles.input} value={userId} onChangeText={setUserId} />
      <Text style={styles.label}>Contact</Text>
      <TextInput style={styles.input} value={contactId} onChangeText={setContactId} />
      <View style={styles.row}>
        <Button title={loading ? 'Ajout…' : 'Ajouter'} onPress={addContact} disabled={loading} />
      </View>
      <Text style={styles.hint}>Ajout réciproque est activé par défaut.</Text>
      {error && <Text style={styles.error}>Erreur: {error}</Text>}
      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Contact(s) ajouté(s)</Text>
          <Text style={styles.resultText}>1 → {result.oneWay?.id}</Text>
          {result.reciprocal && <Text style={styles.resultText}>2 → {result.reciprocal?.id}</Text>}
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
  hint: { color: '#666', marginTop: 6 },
  error: { color: 'red', marginTop: 8 },
  resultBox: { marginTop: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 6, padding: 8 },
  resultTitle: { fontWeight: '600' },
  resultText: { fontSize: 14 },
});