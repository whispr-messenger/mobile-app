import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView } from 'react-native';

export default function MessagesScreen({ baseUrl }) {
  const [userId1, setUserId1] = useState('f2bdd7ad-f491-45d5-b9e0-7137ceb7e5f7');
  const [userId2, setUserId2] = useState('6c511646-a2b8-4d6c-bdc4-7f129c784017');
  const [message, setMessage] = useState('Salut Bob !');
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: userId1, recipientId: userId2, content: message })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.json();
      await loadConversation();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/messages/conversation?userId1=${encodeURIComponent(userId1)}&userId2=${encodeURIComponent(userId2)}&limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConversation(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.label}>Expéditeur</Text>
      <TextInput style={styles.input} value={userId1} onChangeText={setUserId1} />
      <Text style={styles.label}>Destinataire</Text>
      <TextInput style={styles.input} value={userId2} onChangeText={setUserId2} />
      <Text style={styles.label}>Contenu</Text>
      <TextInput style={styles.input} value={message} onChangeText={setMessage} />
      <View style={styles.row}>
        <Button title={loading ? 'Envoi…' : 'Envoyer'} onPress={sendMessage} disabled={loading} />
        <View style={{ width: 12 }} />
        <Button title={loading ? 'Chargement…' : 'Charger conversation'} onPress={loadConversation} disabled={loading} />
      </View>

      {error && <Text style={styles.error}>Erreur: {error}</Text>}

      <Text style={styles.subtitle}>Conversation</Text>
      {conversation.length === 0 ? (
        <Text style={styles.empty}>Aucun message</Text>
      ) : (
        conversation.map((m) => (
          <View key={m.id} style={styles.messageItem}>
            <Text style={styles.messageMeta}>
              {m.senderId === userId1 ? '→' : '←'} {new Date(m.createdAt).toLocaleString()} ({m.status})
            </Text>
            <Text style={styles.messageText}>{m.content}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  subtitle: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  label: { marginTop: 8, marginBottom: 4, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  error: { color: 'red', marginTop: 8 },
  messageItem: { borderWidth: 1, borderColor: '#eee', borderRadius: 6, padding: 8, marginBottom: 8 },
  messageMeta: { fontSize: 12, color: '#555' },
  messageText: { fontSize: 14, marginTop: 4 },
  empty: { color: '#888' },
});