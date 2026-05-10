/**
 * InboxPanel - Panel bottom-sheet (75% mobile, modal centre web) pour l'inbox
 * de notifications. (WHISPR-1437)
 *
 * - Liste les 20 derniers InboxItem avec pagination cursor.
 * - Mark item read au clic + navigation vers le screen pertinent.
 * - "Tout marquer lu" dans le header.
 */

import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { useInboxStore } from "../../store/inboxStore";
import { colors, withOpacity } from "../../theme/colors";
import { Avatar } from "../Chat/Avatar";
import type {
  InboxItem,
  MentionPayload,
  ReplyPayload,
  ContactRequestPayload,
  MissedCallPayload,
} from "../../types/inbox";

type NavProp = StackNavigationProp<AuthStackParamList>;

// --- helpers ---

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "a l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

function getEventIcon(
  eventType: InboxItem["event_type"],
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (eventType) {
    case "mention":
      return "at-outline";
    case "reply":
      return "return-down-back-outline";
    case "contact_request":
      return "person-add-outline";
    case "missed_call":
      return "call-outline";
  }
}

function getFromUsername(item: InboxItem): string {
  const p = item.payload as
    | MentionPayload
    | ReplyPayload
    | ContactRequestPayload
    | MissedCallPayload;
  return p.from_username;
}

function getPreviewLine(item: InboxItem): string {
  switch (item.event_type) {
    case "mention": {
      const p = item.payload as MentionPayload;
      return (
        p.preview ||
        `Vous a mentionne dans ${p.conversation_name ?? "une conversation"}`
      );
    }
    case "reply": {
      const p = item.payload as ReplyPayload;
      return p.preview || "A repondu a votre message";
    }
    case "contact_request":
      return "Demande de contact";
    case "missed_call": {
      const p = item.payload as MissedCallPayload;
      return `Appel ${p.call_type === "video" ? "video" : "audio"} manque`;
    }
  }
}

// --- sub-components ---

interface ItemRowProps {
  item: InboxItem;
  onPress: (item: InboxItem) => void;
}

const ItemRow = React.memo<ItemRowProps>(({ item, onPress }) => {
  const isUnread = item.read_at === null;

  return (
    <TouchableOpacity
      style={[styles.itemRow, isUnread && styles.itemRowUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      <View style={styles.itemAvatar}>
        <Avatar name={getFromUsername(item)} size={44} />
        <View style={styles.eventIconBadge}>
          <Ionicons
            name={getEventIcon(item.event_type)}
            size={12}
            color={colors.text.light}
          />
        </View>
      </View>
      <View style={styles.itemContent}>
        <View style={styles.itemContentRow}>
          <Text style={styles.itemUsername} numberOfLines={1}>
            {getFromUsername(item)}
          </Text>
          <Text style={styles.itemTime}>
            {formatRelativeTime(item.created_at)}
          </Text>
        </View>
        <Text style={styles.itemPreview} numberOfLines={2}>
          {getPreviewLine(item)}
        </Text>
      </View>
      {isUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
});
ItemRow.displayName = "InboxItemRow";

const EmptyState = () => (
  <View style={styles.emptyContainer}>
    <Ionicons
      name="notifications-off-outline"
      size={48}
      color={withOpacity(colors.text.light, 0.3)}
    />
    <Text style={styles.emptyText}>Pas encore de notifications</Text>
  </View>
);

// --- main component ---

interface InboxPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const InboxPanel: React.FC<InboxPanelProps> = ({ visible, onClose }) => {
  const navigation = useNavigation<NavProp>();
  const {
    items,
    unread_count,
    loading,
    has_more,
    loadMore,
    markAllRead,
    markRead,
    hydrate,
  } = useInboxStore();

  // Recharge quand le panel s'ouvre
  const hydrated = useRef(false);
  useEffect(() => {
    if (visible && !hydrated.current) {
      hydrated.current = true;
      hydrate();
    }
    if (!visible) hydrated.current = false;
  }, [visible, hydrate]);

  const handleItemPress = useCallback(
    (item: InboxItem) => {
      markRead(item.id);
      onClose();
      switch (item.event_type) {
        case "mention":
        case "reply": {
          const p = item.payload as MentionPayload | ReplyPayload;
          navigation.navigate("Chat", { conversationId: p.conversation_id });
          break;
        }
        case "contact_request":
          navigation.navigate("Contacts");
          break;
        case "missed_call":
          navigation.navigate("Calls");
          break;
      }
    },
    [markRead, onClose, navigation],
  );

  const handleLoadMore = useCallback(() => {
    if (has_more && !loading) loadMore();
  }, [has_more, loading, loadMore]);

  const renderItem = useCallback(
    ({ item }: { item: InboxItem }) => (
      <ItemRow item={item} onPress={handleItemPress} />
    ),
    [handleItemPress],
  );

  const keyExtractor = useCallback((item: InboxItem) => item.id, []);

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary.main} />
      </View>
    );
  };

  // Sur web on centre la modal, sur mobile on fait un bottom-sheet 75%
  const isWeb = Platform.OS === "web";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={isWeb ? styles.webRoot : styles.mobileRoot}>
        <Pressable
          style={isWeb ? styles.webBackdrop : styles.mobileBackdrop}
          onPress={onClose}
        />
        <View style={isWeb ? styles.webSheet : styles.mobileSheet}>
          {/* Handle (mobile only) */}
          {!isWeb && <View style={styles.handle} />}

          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Notifications</Text>
            <TouchableOpacity
              onPress={markAllRead}
              disabled={unread_count === 0}
              style={[
                styles.markAllButton,
                unread_count === 0 && styles.markAllButtonDisabled,
              ]}
              accessibilityLabel="Tout marquer comme lu"
            >
              <Text
                style={[
                  styles.markAllText,
                  unread_count === 0 && styles.markAllTextDisabled,
                ]}
              >
                Tout marquer lu
              </Text>
            </TouchableOpacity>
          </View>

          {/* List */}
          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={loading ? null : <EmptyState />}
            ListFooterComponent={renderFooter}
            contentContainerStyle={
              items.length === 0 ? styles.listEmpty : undefined
            }
            showsVerticalScrollIndicator={false}
          />

          {/* Close button web */}
          {isWeb && (
            <TouchableOpacity style={styles.webCloseBtn} onPress={onClose}>
              <Ionicons
                name="close-outline"
                size={24}
                color={colors.text.light}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const SHEET_BG = "rgba(20, 25, 50, 0.97)";

const styles = StyleSheet.create({
  // mobile
  mobileRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  mobileBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 17, 36, 0.6)",
  },
  mobileSheet: {
    height: "75%",
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 20,
  },
  // web
  webRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  webBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 17, 36, 0.6)",
  },
  webSheet: {
    width: "90%",
    maxWidth: 480,
    maxHeight: "80%",
    backgroundColor: SHEET_BG,
    borderRadius: 22,
    paddingBottom: 16,
    overflow: "hidden",
  },
  webCloseBtn: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  // common
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: withOpacity(colors.text.light, 0.2),
    marginTop: 8,
    marginBottom: 4,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(colors.text.light, 0.1),
  },
  panelTitle: {
    color: colors.text.light,
    fontSize: 17,
    fontWeight: "700",
  },
  markAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: withOpacity(colors.primary.main, 0.15),
  },
  markAllButtonDisabled: {
    backgroundColor: "transparent",
  },
  markAllText: {
    color: colors.primary.main,
    fontSize: 13,
    fontWeight: "600",
  },
  markAllTextDisabled: {
    color: withOpacity(colors.text.light, 0.3),
  },
  // item
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withOpacity(colors.text.light, 0.08),
  },
  itemRowUnread: {
    backgroundColor: withOpacity(colors.primary.main, 0.07),
  },
  itemAvatar: {
    position: "relative",
    marginRight: 12,
  },
  eventIconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.secondary.main,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: SHEET_BG,
  },
  itemContent: {
    flex: 1,
  },
  itemContentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  itemUsername: {
    color: colors.text.light,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  itemTime: {
    color: withOpacity(colors.text.light, 0.45),
    fontSize: 11,
    flexShrink: 0,
  },
  itemPreview: {
    color: withOpacity(colors.text.light, 0.65),
    fontSize: 13,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.main,
    marginLeft: 8,
    flexShrink: 0,
  },
  // empty
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 16,
  },
  emptyText: {
    color: withOpacity(colors.text.light, 0.4),
    fontSize: 15,
    textAlign: "center",
  },
  listEmpty: {
    flex: 1,
  },
  // footer loader
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
