/**
 * DevicesScreen — liste des appareils/sessions actifs de l'utilisateur (WHISPR-1055).
 *
 * Consomme `DeviceManagerService.listDevices` (GET /auth/device) et
 * `revokeDevice` (DELETE /auth/device/:id) déjà en place côté
 * SecurityService. Affiche le nom, la plateforme, la dernière activité et
 * un bouton de révocation sur chaque appareil autre que celui utilisé
 * actuellement.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  DeviceManagerService,
  type DeviceInfo,
} from "../../services/SecurityService";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";

function formatRelative(iso: string, lang: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return iso;
  const diffMs = Date.now() - ts;
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return lang === "fr" ? "à l'instant" : "just now";
  if (m < 60) return `${m} ${lang === "fr" ? "min" : "min"}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${lang === "fr" ? "h" : "h"}`;
  const d = Math.floor(h / 24);
  return `${d} ${lang === "fr" ? "j" : "d"}`;
}

export const DevicesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { getThemeColors, getLocalizedText, settings } = useTheme();
  const themeColors = getThemeColors();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const list = await DeviceManagerService.listDevices();
      setDevices(list);
    } catch (error) {
      console.error("[DevicesScreen] Error loading devices:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadDevices();
  }, [loadDevices]);

  const handleRevoke = useCallback(
    (device: DeviceInfo) => {
      if (device.is_current) return;

      const title = getLocalizedText("devices.revokeTitle") || "Revoke device";
      const message =
        getLocalizedText("devices.revokeConfirm") ||
        `Are you sure you want to sign out "${device.name}"? You'll need to log in again on that device.`;
      const cancel = getLocalizedText("auth.cancel") || "Cancel";
      const confirm =
        getLocalizedText("devices.revokeConfirmAction") || "Revoke";

      Alert.alert(title, message, [
        { text: cancel, style: "cancel" },
        {
          text: confirm,
          style: "destructive",
          onPress: async () => {
            try {
              setRevokingId(device.id);
              await DeviceManagerService.revokeDevice(device.id);
              await loadDevices();
            } catch (error) {
              console.error("[DevicesScreen] Error revoking device:", error);
              Alert.alert(
                getLocalizedText("notif.error") || "Error",
                getLocalizedText("devices.revokeError") ||
                  "Could not revoke the device",
              );
            } finally {
              setRevokingId(null);
            }
          },
        },
      ]);
    },
    [getLocalizedText, loadDevices],
  );

  const renderItem = useCallback(
    ({ item }: { item: DeviceInfo }) => {
      const isRevoking = revokingId === item.id;
      return (
        <View
          style={[
            styles.deviceCard,
            { backgroundColor: themeColors.background.secondary },
          ]}
        >
          <View style={styles.deviceIconWrap}>
            <Ionicons
              name={
                item.platform.toLowerCase().includes("ios")
                  ? "phone-portrait-outline"
                  : item.platform.toLowerCase().includes("android")
                    ? "phone-portrait-outline"
                    : "laptop-outline"
              }
              size={24}
              color={themeColors.text.primary}
            />
          </View>
          <View style={styles.deviceBody}>
            <View style={styles.deviceHeaderRow}>
              <Text
                style={[styles.deviceName, { color: themeColors.text.primary }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {item.is_current && (
                <View
                  style={[
                    styles.currentBadge,
                    { borderColor: themeColors.primary },
                  ]}
                  accessibilityLabel={
                    getLocalizedText("devices.currentBadge") || "Current device"
                  }
                >
                  <Text
                    style={[
                      styles.currentBadgeText,
                      { color: themeColors.primary },
                    ]}
                  >
                    {getLocalizedText("devices.currentBadge") || "This device"}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.deviceMeta, { color: themeColors.text.secondary }]}
            >
              {item.platform} ·{" "}
              {getLocalizedText("devices.lastActive") || "Last active"}{" "}
              {formatRelative(item.last_active, settings.language)}
            </Text>
          </View>
          {!item.is_current && (
            <TouchableOpacity
              onPress={() => handleRevoke(item)}
              disabled={isRevoking}
              accessibilityRole="button"
              accessibilityLabel={
                getLocalizedText("devices.revokeAction") || "Revoke"
              }
              style={styles.revokeButton}
            >
              {isRevoking ? (
                <ActivityIndicator size="small" color={colors.ui.error} />
              ) : (
                <Ionicons
                  name="log-out-outline"
                  size={22}
                  color={colors.ui.error}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [
      getLocalizedText,
      handleRevoke,
      revokingId,
      settings.language,
      themeColors,
    ],
  );

  return (
    <LinearGradient
      colors={themeColors.background.gradient}
      style={styles.container}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={getLocalizedText("common.back") || "Back"}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={themeColors.text.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { color: themeColors.text.primary }]}>
            {getLocalizedText("devices.title") || "My devices"}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={themeColors.primary} />
          </View>
        ) : devices.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons
              name="phone-portrait-outline"
              size={48}
              color={themeColors.text.tertiary}
            />
            <Text
              style={[styles.emptyText, { color: themeColors.text.secondary }]}
            >
              {getLocalizedText("devices.empty") ||
                "No active devices on your account."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={devices}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={themeColors.primary}
              />
            }
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 8, marginRight: 8 },
  title: { fontSize: 20, fontWeight: "600" },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: { marginTop: 12, fontSize: 15, textAlign: "center" },
  list: { padding: 16 },
  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  deviceIconWrap: { marginRight: 12 },
  deviceBody: { flex: 1 },
  deviceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  deviceName: { fontSize: 16, fontWeight: "600", maxWidth: "70%" },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 8,
    marginLeft: 8,
  },
  currentBadgeText: { fontSize: 11, fontWeight: "600" },
  deviceMeta: { marginTop: 4, fontSize: 13 },
  revokeButton: { padding: 8, marginLeft: 8 },
});
