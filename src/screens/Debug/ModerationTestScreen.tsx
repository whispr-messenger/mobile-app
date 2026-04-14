import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { tfjsService } from "../../services/moderation";
import type { GateResult } from "../../services/moderation/moderation.types";

type Nav = StackNavigationProp<AuthStackParamList>;

export const ModerationTestScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<GateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (res.canceled) return;
    const uri = res.assets[0].uri;
    setImageUri(uri);
    setResult(null);
    setError(null);
    runGate(uri);
  };

  const runGate = async (uri: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    const t0 = Date.now();
    try {
      const r = await tfjsService.gate({ uri, threshold: 0.99 });
      setElapsed(Date.now() - t0);
      setResult(r);
    } catch (e) {
      setElapsed(Date.now() - t0);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>TFJS Moderation Test</Text>
        <View style={s.backBtn} />
      </View>
      <Text style={s.sub}>Platform: {Platform.OS}</Text>

      <TouchableOpacity style={s.btn} onPress={pickImage}>
        <Text style={s.btnText}>Pick Image</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.btn, s.appealBtn]}
        onPress={() => navigation.navigate("ModerationDecision")}
      >
        <Text style={s.btnText}>Open appeal flow mock</Text>
      </TouchableOpacity>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={s.img} resizeMode="contain" />
      )}

      {loading && (
        <View style={s.row}>
          <ActivityIndicator size="large" color="#4fc3f7" />
          <Text style={s.loading}>Running inference...</Text>
        </View>
      )}

      {error && (
        <View style={[s.card, s.errorCard]}>
          <Text style={s.errorTitle}>Error</Text>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {result && (
        <View style={[s.card, result.allowed ? s.passCard : s.blockCard]}>
          <Text style={s.resultTitle}>
            {result.allowed ? "ALLOWED" : "BLOCKED"}
          </Text>
          <Text style={s.resultSub}>
            Reason: {result.reason} | Time: {elapsed}ms
          </Text>
          <Text style={s.resultSub}>
            Best: {result.bestClass} ({(result.bestProb * 100).toFixed(1)}%)
          </Text>

          <Text style={s.probTitle}>All probabilities:</Text>
          {Object.entries(result.probs)
            .sort(([, a], [, b]) => b - a)
            .map(([cls, prob]) => (
              <View key={cls} style={s.probRow}>
                <Text style={s.probLabel}>{cls}</Text>
                <View style={s.barBg}>
                  <View
                    style={[s.bar, { width: `${Math.max(prob * 100, 0.5)}%` }]}
                  />
                </View>
                <Text style={s.probVal}>{(prob * 100).toFixed(1)}%</Text>
              </View>
            ))}
        </View>
      )}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  content: { padding: 20, alignItems: "center", paddingTop: 60 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 4,
  },
  backBtn: { width: 32, alignItems: "flex-start" },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  sub: { fontSize: 14, color: "#888", marginBottom: 20 },
  btn: {
    backgroundColor: "#4fc3f7",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  appealBtn: {
    backgroundColor: "#FE7A5C",
    marginBottom: 14,
  },
  btnText: { color: "#000", fontSize: 16, fontWeight: "600" },
  img: { width: 224, height: 224, borderRadius: 12, marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", marginVertical: 12 },
  loading: { color: "#aaa", marginLeft: 12, fontSize: 14 },
  card: { width: "100%", borderRadius: 12, padding: 16, marginTop: 12 },
  passCard: { backgroundColor: "#1b5e20" },
  blockCard: { backgroundColor: "#b71c1c" },
  errorCard: { backgroundColor: "#4a1010" },
  resultTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  resultSub: { fontSize: 13, color: "#ddd", marginTop: 4 },
  errorTitle: { fontSize: 18, fontWeight: "bold", color: "#ff5252" },
  errorText: { fontSize: 13, color: "#ffcdd2", marginTop: 4 },
  probTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginTop: 12,
    marginBottom: 6,
  },
  probRow: { flexDirection: "row", alignItems: "center", marginVertical: 3 },
  probLabel: { width: 110, fontSize: 12, color: "#ccc" },
  barBg: {
    flex: 1,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 5,
    marginHorizontal: 8,
  },
  bar: { height: 10, backgroundColor: "#4fc3f7", borderRadius: 5 },
  probVal: { width: 50, fontSize: 12, color: "#ccc", textAlign: "right" },
});

export default ModerationTestScreen;
