import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSettings } from '../context/SettingsContext';
import { uploadMedia } from '../api/media';

export default function UserGestScreen({ onBack }) {
  const { avatarUri, setAvatarUri, theme, setTheme, backgroundType, setBackgroundType, backgroundColor, setBackgroundColor, backgroundImageId, setBackgroundImageId, mediaBaseUrl, accessToken } = useSettings();
  const textPrimary = theme === 'light' ? '#0b1020' : '#eaf0ff';
  const textSecondary = theme === 'light' ? '#1f2a44' : '#cbd3ff';

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      alert("Permission refusée pour accéder à la galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const pickBackgroundImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      alert("Permission refusée pour accéder à la galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      try {
        const asset = result.assets[0];
        const uploaded = await uploadMedia({ mediaBaseUrl, accessToken, userId: undefined, uri: asset.uri, filename: asset.fileName || 'background.jpg' });
        setBackgroundImageId(uploaded.id);
        setBackgroundType('image');
      } catch (e) {
        alert('Échec de l’upload de l’image de fond.');
      }
    }
  };

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

  return (
    <Background>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Text style={styles.backText}>◀</Text></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Profil utilisateur</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={[styles.title, { color: textPrimary }]}>UserGest</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Gestion du profil, avatar, thème et fond d’écran</Text>

          {/* Avatar */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Photo d’avatar</Text>
            <View style={styles.row}>
              <Image source={avatarUri ? { uri: avatarUri } : require('../../assets/dalm1chatstorm.gif')} style={styles.avatarPreview} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={styles.btn} onPress={pickAvatar}><Text style={styles.btnText}>Choisir dans la galerie</Text></TouchableOpacity>
              </View>
            </View>
            <Text style={[styles.label, { color: textSecondary }]}>Ou coller une URL d’image</Text>
            <TextInput
              style={styles.input}
              placeholder="https://exemple.com/mon-avatar.png"
              placeholderTextColor="#9aa2c7"
              value={avatarUri || ''}
              onChangeText={setAvatarUri}
              autoCapitalize="none"
            />
          </View>

          {/* Thème */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Thème de l’application</Text>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => setTheme('dark')} style={[styles.btn, theme === 'dark' && styles.btnActive]}><Text style={styles.btnText}>Sombre</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setTheme('light')} style={[styles.btn, theme === 'light' && styles.btnActive]}><Text style={styles.btnText}>Clair</Text></TouchableOpacity>
            </View>
          </View>

          {/* Fond d’écran */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Fond d’écran</Text>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => setBackgroundType('black')} style={[styles.btn, backgroundType === 'black' && styles.btnActive]}><Text style={styles.btnText}>Noir</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setBackgroundType('gradient')} style={[styles.btn, backgroundType === 'gradient' && styles.btnActive]}><Text style={styles.btnText}>Dégradé</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setBackgroundType('color')} style={[styles.btn, backgroundType === 'color' && styles.btnActive]}><Text style={styles.btnText}>Couleur</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setBackgroundType('image')} style={[styles.btn, backgroundType === 'image' && styles.btnActive]}><Text style={styles.btnText}>Image</Text></TouchableOpacity>
            </View>
            {backgroundType === 'color' && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.label}>Couleur hex (#RRGGBB)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="#101820"
                  placeholderTextColor="#9aa2c7"
                  value={backgroundColor}
                  onChangeText={setBackgroundColor}
                  autoCapitalize="none"
                />
              </View>
            )}
            {backgroundType === 'image' && (
              <View style={{ marginTop: 10, gap: 12 }}>
                <Text style={[styles.label, { color: textSecondary }]}>Choisir une image de fond</Text>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btn} onPress={pickBackgroundImage}><Text style={styles.btnText}>Choisir dans la galerie</Text></TouchableOpacity>
                  {backgroundImageId && (
                    <TouchableOpacity style={styles.btn} onPress={() => { setBackgroundImageId(null); setBackgroundType('black'); }}>
                      <Text style={styles.btnText}>Supprimer</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {backgroundImageId ? (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: textSecondary }}>Image stockée (id): {backgroundImageId}</Text>
                  </View>
                ) : (
                  <Text style={{ color: textSecondary }}>Aucune image sélectionnée.</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  backText: { color: '#eaf0ff', fontSize: 16 },
  headerTitle: { color: '#eaf0ff', fontWeight: '700', marginLeft: 12 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: '92%', maxWidth: 720, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)', padding: 20 },
  title: { color: '#eaf0ff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#cbd3ff', marginTop: 6 },
  section: { marginTop: 16 },
  sectionTitle: { color: '#eaf0ff', fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarPreview: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  btn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  btnActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  btnText: { color: '#eaf0ff', fontWeight: '600' },
  label: { color: '#cbd3ff', marginTop: 8, marginBottom: 4, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: '#eaf0ff', backgroundColor: 'rgba(255,255,255,0.08)' },
});