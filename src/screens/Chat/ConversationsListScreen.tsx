/**
 * ConversationsListScreen - Home Page
 * Displays list of conversations with real-time updates
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  TextInput,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  FLOATING_TAB_BAR_BORDER_RADIUS,
  FLOATING_TAB_BAR_BOTTOM_OFFSET,
  FLOATING_TAB_BAR_HORIZONTAL_MARGIN,
  FLOATING_TAB_BAR_PILL_HEIGHT,
  FLOATING_TAB_BAR_RESERVED_SPACE,
} from "../../components/Navigation/floatingTabBarLayout";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Conversation, Message } from "../../types/messaging";
import { useAuth } from "../../context/AuthContext";
import { useWebSocket } from "../../hooks/useWebSocket";
import { TokenService } from "../../services/TokenService";
import { SwipeableConversationItem } from "../../components/Chat/SwipeableConversationItem";
import { EmptyState } from "../../components/Chat/EmptyState";
import { ConversationSkeleton } from "../../components/Chat/SkeletonLoader";
import { NewConversationModal } from "../../components/Chat/NewConversationModal";
import { useTheme } from "../../context/ThemeContext";
import { AuthStackParamList } from "../../navigation/AuthNavigator";
import { colors } from "../../theme/colors";
import Toast from "../../components/Toast/Toast";
import { useConversationsStore } from "../../store/conversationsStore";
import { useUIStore } from "../../store/uiStore";
import { messagingAPI } from "../../services/messaging/api";
import { OfflineBanner } from "../../components/Chat/OfflineBanner";
import { getConversationDisplayName } from "../../utils";

type NavigationProp = StackNavigationProp<AuthStackParamList, "Chat">;

export const ConversationsListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  // Store
  const conversations = useConversationsStore((s) => s.conversations);
  const status = useConversationsStore((s) => s.status);
  const fetchConversations = useConversationsStore((s) => s.fetchConversations);
  const refreshConversations = useConversationsStore(
    (s) => s.refreshConversations,
  );
  const applyConversationUpdate = useConversationsStore(
    (s) => s.applyConversationUpdate,
  );
  const applyConversationSummaries = useConversationsStore(
    (s) => s.applyConversationSummaries,
  );
  const applyNewMessage = useConversationsStore((s) => s.applyNewMessage);
  const storeDeleteConversation = useConversationsStore(
    (s) => s.deleteConversation,
  );
  const archiveConversation = useConversationsStore(
    (s) => s.archiveConversation,
  );
  const applyArchiveBroadcast = useConversationsStore(
    (s) => s.applyArchiveBroadcast,
  );
  const muteConversation = useConversationsStore((s) => s.muteConversation);
  const pinConversation = useConversationsStore((s) => s.pinConversation);
  const markAsUnread = useConversationsStore((s) => s.markAsUnread);
  const clearManualUnread = useConversationsStore((s) => s.clearManualUnread);
  const resetUnreadCount = useConversationsStore((s) => s.resetUnreadCount);
  const loadManuallyUnreadIds = useConversationsStore(
    (s) => s.loadManuallyUnreadIds,
  );
  const setBottomTabBarHidden = useUIStore((s) => s.setBottomTabBarHidden);

  // UI-only state
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    setBottomTabBarHidden(editMode);
    return () => setBottomTabBarHidden(false);
  }, [editMode, setBottomTabBarHidden]);
  const [selectedConversations, setSelectedConversations] = useState<
    Set<string>
  >(new Set());
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  }>({
    visible: false,
    message: "",
    type: "info",
  });
  const [showNewConversationModal, setShowNewConversationModal] =
    useState(false);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [messageSearchConvIds, setMessageSearchConvIds] = useState<Set<string>>(
    new Set(),
  );
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  // Filter and sort conversations
  const filteredAndSortedConversations = useMemo(() => {
    if (!conversations || conversations.length === 0) {
      return [];
    }

    let filtered = conversations.filter((conv) => !conv.is_archived);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((conv) => {
        const name = getConversationDisplayName(conv);
        const lastMessage = conv.last_message?.content || "";
        return (
          name.toLowerCase().includes(query) ||
          lastMessage.toLowerCase().includes(query) ||
          messageSearchConvIds.has(conv.id)
        );
      });
    }

    return [...filtered].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      const aTime = a.last_message?.sent_at || a.updated_at;
      const bTime = b.last_message?.sent_at || b.updated_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [conversations, searchQuery, messageSearchConvIds]);

  const { userId: rawUserId } = useAuth();
  const userId = rawUserId ?? "";
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    if (!userId) {
      setToken("");
      return;
    }
    TokenService.getAccessToken().then((t) => setToken(t ?? ""));
  }, [userId]);

  const { connectionState, joinConversationChannel, markAsRead } = useWebSocket(
    {
      userId,
      token,
      onNewMessage: (message: Message) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        applyNewMessage(message, userId);
      },
      onConversationUpdate: (conversation: Conversation) => {
        applyConversationUpdate(conversation);
      },
      onConversationSummaries: (conversations: Conversation[]) => {
        applyConversationSummaries(conversations);
      },
      onConversationArchived: (conversationId: string, archived: boolean) => {
        applyArchiveBroadcast(conversationId, archived);
      },
    },
  );

  // Subscribe to every visible conversation so we receive presence_diff /
  // presence_state events for members. Without this, the list items show
  // stale online indicators — presence events are only broadcast on
  // conversation:{id} channels, never on user:{userId}.
  const conversationIdsKey = conversations
    .map((c) => c?.id)
    .filter(Boolean)
    .sort()
    .join(",");
  useEffect(() => {
    if (!token || connectionState !== "connected" || !conversationIdsKey) {
      return;
    }
    const ids = conversationIdsKey.split(",");
    const cleanups: Array<() => void> = [];
    for (const id of ids) {
      const { cleanup } = joinConversationChannel(id);
      cleanups.push(cleanup);
    }
    return () => {
      cleanups.forEach((c) => c());
    };
  }, [token, connectionState, conversationIdsKey, joinConversationChannel]);

  useEffect(() => {
    if (!userId) return;
    fetchConversations();
    loadManuallyUnreadIds();
  }, [fetchConversations, loadManuallyUnreadIds, userId]);

  // Refresh conversations when WebSocket reconnects to pick up messages
  // that were missed during the disconnection window
  const prevConnStateRef = React.useRef<string>(connectionState);
  useEffect(() => {
    const wasOffline =
      prevConnStateRef.current === "disconnected" ||
      prevConnStateRef.current === "reconnecting";
    if (wasOffline && connectionState === "connected") {
      refreshConversations();
    }
    prevConnStateRef.current = connectionState;
  }, [connectionState, refreshConversations]);

  const handleConversationPress = useCallback(
    (conversationId: string) => {
      if (editMode) {
        setSelectedConversations((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(conversationId)) {
            newSet.delete(conversationId);
          } else {
            newSet.add(conversationId);
          }
          return newSet;
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        clearManualUnread(conversationId);
        navigation.navigate("Chat", { conversationId });
      }
    },
    [navigation, editMode, clearManualUnread],
  );

  const handleSelectAll = useCallback(() => {
    if (selectedConversations.size === filteredAndSortedConversations.length) {
      setSelectedConversations(new Set());
    } else {
      setSelectedConversations(
        new Set(filteredAndSortedConversations.map((c) => c.id)),
      );
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [filteredAndSortedConversations, selectedConversations]);

  const handleBulkDelete = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const ids = Array.from(selectedConversations);
    const count = ids.length;
    try {
      await Promise.all(
        ids.map((id) => storeDeleteConversation(id).catch(() => {})),
      );
      setSelectedConversations(new Set());
      setEditMode(false);
      setToast({
        visible: true,
        message: `${count} conversation${count > 1 ? "s" : ""} supprimée${count > 1 ? "s" : ""}`,
        type: "success",
      });
    } catch {
      setToast({
        visible: true,
        message: "Impossible de supprimer les conversations",
        type: "error",
      });
    }
  }, [selectedConversations, storeDeleteConversation]);

  const handleBulkArchive = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ids = Array.from(selectedConversations);
    const count = ids.length;
    setSelectedConversations(new Set());
    setEditMode(false);
    const results = await Promise.allSettled(
      ids.map((id) => archiveConversation(id)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      setToast({
        visible: true,
        message: `${count} conversation${count > 1 ? "s" : ""} archivée${count > 1 ? "s" : ""}`,
        type: "success",
      });
    } else {
      setToast({
        visible: true,
        message: `${count - failed}/${count} archivée${count > 1 ? "s" : ""}`,
        type: "warning",
      });
    }
  }, [selectedConversations, archiveConversation]);

  const handleDelete = useCallback(
    async (conversationId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      try {
        await storeDeleteConversation(conversationId);
      } catch {
        setToast({
          visible: true,
          message: "Impossible de supprimer la conversation",
          type: "error",
        });
      }
    },
    [storeDeleteConversation],
  );

  const handleMute = useCallback(
    async (conversationId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        await muteConversation(conversationId);
      } catch {
        setToast({
          visible: true,
          message: "Impossible de mettre à jour le mode silencieux",
          type: "error",
        });
      }
    },
    [muteConversation],
  );

  const handleToggleRead = useCallback(
    (conversationId: string, isCurrentlyUnread: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (isCurrentlyUnread) {
        clearManualUnread(conversationId);
        resetUnreadCount(conversationId);
        const conv = useConversationsStore
          .getState()
          .conversations.find((c) => c.id === conversationId);
        const lastMessageId = conv?.last_message?.id;
        if (lastMessageId) {
          markAsRead(conversationId, lastMessageId);
        }
        setToast({
          visible: true,
          message: "Conversation marquée comme lue",
          type: "info",
        });
      } else {
        markAsUnread(conversationId);
        setToast({
          visible: true,
          message: "Conversation marquée comme non lue",
          type: "info",
        });
      }
    },
    [markAsUnread, clearManualUnread, resetUnreadCount, markAsRead],
  );

  const handleArchive = useCallback(
    async (conversationId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        await archiveConversation(conversationId);
      } catch {
        setToast({
          visible: true,
          message: "Impossible d'archiver la conversation",
          type: "error",
        });
      }
    },
    [archiveConversation],
  );

  const handlePin = useCallback(
    (conversationId: string) => {
      pinConversation(conversationId);
    },
    [pinConversation],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Conversation; index: number }) => (
      <SwipeableConversationItem
        conversation={item}
        onPress={handleConversationPress}
        onDelete={handleDelete}
        onMute={handleMute}
        onToggleRead={handleToggleRead}
        onArchive={handleArchive}
        onPin={handlePin}
        index={index}
        editMode={editMode}
        isSelected={selectedConversations.has(item.id)}
      />
    ),
    [
      handleConversationPress,
      handleDelete,
      handleMute,
      handleToggleRead,
      handleArchive,
      handlePin,
      editMode,
      selectedConversations,
    ],
  );

  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<Conversation> | null | undefined, index: number) => ({
      length: 72,
      offset: 72 * index,
      index,
    }),
    [],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  }, [refreshConversations]);

  const renderContent = () => {
    if (status === "loading" || status === "grace_period") {
      return (
        <View style={styles.loadingContainer}>
          {[...Array(5)].map((_, i) => (
            <ConversationSkeleton key={i} />
          ))}
        </View>
      );
    }

    if (status === "empty" || filteredAndSortedConversations.length === 0) {
      return (
        <EmptyState
          onNewConversation={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowNewConversationModal(true);
          }}
        />
      );
    }

    return (
      <FlatList
        data={filteredAndSortedConversations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + FLOATING_TAB_BAR_RESERVED_SPACE },
        ]}
        style={styles.list}
        removeClippedSubviews={false}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={15}
        windowSize={10}
        getItemLayout={getItemLayout}
        // WHISPR-1254 — sur web on garde l'indicateur visible pour qu'il
        // soit clair que la liste scrolle; sur natif on conserve le look
        // d'origine.
        showsVerticalScrollIndicator={Platform.OS === "web"}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text.light}
            colors={[colors.primary.main]}
          />
        }
      />
    );
  };

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <OfflineBanner connectionState={connectionState} />
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: "rgba(255, 255, 255, 0.1)" },
          ]}
        >
          <View style={styles.headerLeftGroup}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEditMode(!editMode);
                if (editMode) {
                  setSelectedConversations(new Set());
                }
              }}
              style={[styles.headerButton, styles.editButtonPill]}
            >
              <Text style={[styles.editButton, { color: colors.text.light }]}>
                {editMode ? "Annuler" : "Modifier"}
              </Text>
            </TouchableOpacity>
            {!editMode && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("ArchivedConversations");
                }}
                style={[styles.headerButton, styles.archiveIconButton]}
                accessibilityLabel="Voir les conversations archivées"
              >
                <Ionicons
                  name="archive-outline"
                  size={20}
                  color={colors.text.light}
                />
              </TouchableOpacity>
            )}
          </View>
          <Text
            style={[styles.headerTitle, { color: colors.text.light }]}
          ></Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowNewConversationModal(true);
            }}
            style={styles.headerButton}
          >
            <LinearGradient
              colors={["#FFB07B", "#F04882"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.composeButton}
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={colors.text.light}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: "rgba(255, 255, 255, 0.15)" },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={20}
              color="rgba(255, 255, 255, 0.7)"
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text.light }]}
              placeholder="Rechercher des messages ou utilisateurs"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (searchTimeoutRef.current) {
                  clearTimeout(searchTimeoutRef.current);
                }
                if (!text.trim()) {
                  setMessageSearchConvIds(new Set());
                  return;
                }
                searchTimeoutRef.current = setTimeout(async () => {
                  try {
                    const results = await messagingAPI.searchMessagesGlobal(
                      text.trim(),
                      { limit: 50 },
                    );
                    if (results) {
                      const convIds = new Set(
                        results.map((msg) => msg.conversation_id),
                      );
                      setMessageSearchConvIds(convIds);
                    } else {
                      setMessageSearchConvIds(new Set());
                    }
                  } catch {
                    setMessageSearchConvIds(new Set());
                  }
                }, 300);
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setMessageSearchConvIds(new Set());
                  if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                  }
                }}
                style={styles.clearButton}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color="rgba(255, 255, 255, 0.7)"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {renderContent()}

        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast({ ...toast, visible: false })}
        />
      </SafeAreaView>

      {editMode && (
        <View
          pointerEvents="box-none"
          style={[
            styles.editActionsFloating,
            { bottom: FLOATING_TAB_BAR_BOTTOM_OFFSET + insets.bottom },
          ]}
        >
          <View style={styles.editActionsShadow}>
            <View style={styles.editActionsClip}>
              <BlurView
                intensity={Platform.OS === "ios" ? 60 : 80}
                tint="dark"
                style={styles.editActionsBlur}
              >
                <View style={styles.editActionsOverlay}>
                  <View style={styles.editActionsRow}>
                    <TouchableOpacity
                      style={styles.editActionButton}
                      onPress={handleBulkDelete}
                      disabled={selectedConversations.size === 0}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={24}
                        color={
                          selectedConversations.size === 0
                            ? "rgba(255, 80, 80, 0.4)"
                            : colors.ui.error
                        }
                      />
                      <Text
                        style={[
                          styles.editActionText,
                          selectedConversations.size === 0 &&
                            styles.editActionTextDisabled,
                        ]}
                      >
                        Supprimer
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editActionButton}
                      onPress={handleBulkArchive}
                      disabled={selectedConversations.size === 0}
                    >
                      <Ionicons
                        name="archive-outline"
                        size={24}
                        color={
                          selectedConversations.size === 0
                            ? "rgba(255, 255, 255, 0.4)"
                            : colors.text.light
                        }
                      />
                      <Text
                        style={[
                          styles.editActionText,
                          selectedConversations.size === 0 &&
                            styles.editActionTextDisabled,
                        ]}
                      >
                        Archiver
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editActionButton}
                      onPress={handleSelectAll}
                    >
                      <Ionicons
                        name={
                          selectedConversations.size ===
                          filteredAndSortedConversations.length
                            ? "checkmark-done-outline"
                            : "checkmark-outline"
                        }
                        size={24}
                        color={colors.primary.main}
                      />
                      <Text style={styles.editActionText}>
                        {selectedConversations.size ===
                        filteredAndSortedConversations.length
                          ? "Désélec."
                          : "Tout sélec."}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </BlurView>
            </View>
          </View>
        </View>
      )}

      <NewConversationModal
        visible={showNewConversationModal}
        onClose={() => setShowNewConversationModal(false)}
        onConversationCreated={async (conversationId) => {
          setShowNewConversationModal(false);
          await fetchConversations();
          setTimeout(() => {
            navigation.navigate("Chat", { conversationId });
          }, 100);
        }}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
    // WHISPR-1254 — sur react-native-web, flex:1 seul ne propage pas la
    // hauteur disponible jusqu'aux enfants si l'ancêtre racine (#root) ne
    // borne pas son propre contenu. height:100% force le wrapper racine à
    // occuper exactement la hauteur du viewport.
    ...(Platform.OS === "web" ? { height: "100%" } : {}),
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
    // WHISPR-1254 — minHeight:0 est requis par CSS flexbox pour qu'un
    // enfant scrollable (FlatList) puisse overflow au lieu de pousser le
    // parent. Sans ça, les conversations dépassent le viewport.
    ...(Platform.OS === "web" ? { minHeight: 0 } : {}),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    backgroundColor: "transparent",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  headerButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  archiveIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  editButtonPill: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
  },
  editButton: {
    fontSize: 15,
    fontWeight: "500",
  },
  composeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "transparent",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  list: {
    flex: 1,
    backgroundColor: "transparent",
    // WHISPR-1254 — même raison que .container : permettre l'overflow
    // vertical natif côté react-native-web.
    ...(Platform.OS === "web" ? { minHeight: 0 } : {}),
  },
  listContent: {
    paddingVertical: 8,
    backgroundColor: "transparent",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  editActionsFloating: {
    position: "absolute",
    left: FLOATING_TAB_BAR_HORIZONTAL_MARGIN,
    right: FLOATING_TAB_BAR_HORIZONTAL_MARGIN,
  },
  editActionsShadow: {
    borderRadius: FLOATING_TAB_BAR_BORDER_RADIUS,
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    backgroundColor: "transparent",
  },
  editActionsClip: {
    borderRadius: FLOATING_TAB_BAR_BORDER_RADIUS,
    overflow: "hidden",
  },
  editActionsBlur: {
    borderRadius: FLOATING_TAB_BAR_BORDER_RADIUS,
  },
  editActionsOverlay: {
    borderRadius: FLOATING_TAB_BAR_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor:
      Platform.OS === "ios"
        ? "rgba(20, 25, 50, 0.35)"
        : "rgba(20, 25, 50, 0.7)",
  },
  editActionsRow: {
    flexDirection: "row",
    height: FLOATING_TAB_BAR_PILL_HEIGHT,
    paddingHorizontal: 4,
  },
  editActionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  editActionText: {
    color: colors.text.light,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  editActionTextDisabled: {
    color: "rgba(255, 255, 255, 0.4)",
  },
});
