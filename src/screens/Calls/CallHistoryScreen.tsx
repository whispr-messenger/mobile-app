import React, { useCallback, useEffect, useState } from "react";
import { Text, FlatList, StyleSheet, RefreshControl, View } from "react-native";
import { callsApi } from "../../services/calls/callsApi";
import type { Call, CallStatus } from "../../types/calls";

/**
 * List of past calls for the current user. Pull-to-refresh rehydrates
 * from the calls-service /calls endpoint.
 */
export const CallHistoryScreen: React.FC = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await callsApi.list({ limit: 50 });
      setCalls(r.data);
    } catch (err) {
      console.error("Failed to load call history", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <FlatList
      data={calls}
      keyExtractor={(c) => c.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.title}>
            {item.type === "video" ? "Video" : "Audio"} -{" "}
            {statusLabel(item.status)}
          </Text>
          <Text style={styles.sub}>
            {new Date(item.started_at).toLocaleString()}
          </Text>
          {item.duration_seconds != null && (
            <Text style={styles.sub}>
              Duree: {formatDuration(item.duration_seconds)}
            </Text>
          )}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Aucun appel</Text>}
    />
  );
};

const STATUS_LABELS: Record<CallStatus, string> = {
  ringing: "Sonnerie",
  connected: "En cours",
  ended: "Termine",
  missed: "Manque",
  declined: "Refuse",
  failed: "Echec",
};

function statusLabel(s: string): string {
  return STATUS_LABELS[s as CallStatus] || s;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

const styles = StyleSheet.create({
  row: { padding: 16, borderBottomWidth: 1, borderColor: "#eee" },
  title: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sub: { color: "#666", fontSize: 12, fontFamily: "Inter_400Regular" },
  empty: { textAlign: "center", padding: 32, color: "#999" },
});

export default CallHistoryScreen;
