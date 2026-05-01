/**
 * ArchivedConversationsScreen — listing paginé des conversations archivées
 * pour l'utilisateur courant (per-user, multi-device sync via WebSocket).
 *
 * UX :
 *  - Charge la première page au mount.
 *  - Pagination infinie via FlatList.onEndReached.
 *  - Swipe sur un item → "Désarchiver" (la conv revient dans la liste principale).
 *  - Tap sur un item → ouvre le ChatScreen normal.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";

import { Conversation } from "../../types/messaging";
import { useConversationsStore } from "../../store/conversationsStore";
import { AuthStackParamList } from "../../navigation/AuthNavigator";
import { colors } from "../../theme/colors";
import ConversationItem from "../../components/Chat/ConversationItem";
import { ConversationSkeleton } from "../../components/Chat/SkeletonLoader";
import Toast from "../../components/Toast/Toast";

type NavigationProp = StackNavigationProp<
  AuthStackParamList,
  "ArchivedConversations"
>;

const SWIPE_BUTTON_SIZE = 52;
const SWIPE_BUTTON_GAP = 12;

interface SwipeableArchivedItemProps {
  conversation: Conversation;
  onPress: (id: string) => void;
  onUnarchive: (id: string) => void;
  index: number;
}

const SwipeableArchivedItem: React.FC<SwipeableArchivedItemProps> = ({
  conversation,
  onPress,
  onUnarchive,
  index,
}) => {
  const swipeRef = useRef<Swipeable>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
  ) => {
    if (!isSwiping) return <View />;
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1],
      extrapolate: "clamp",
    });
    return (
      <View style={styles.swipeActions}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            style={[styles.swipeButton, styles.unarchiveButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onUnarchive(conversation.id);
              swipeRef.current?.close();
            }}
            accessibilityLabel="Désarchiver"
          >
            <Ionicons
              name="arrow-up-circle-outline"
              size={24}
              color={colors.text.light}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      friction={2}
      overshootRight={false}
      onSwipeableOpenStartDrag={() => setIsSwiping(true)}
      onSwipeableWillOpen={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onSwipeableClose={() => setIsSwiping(false)}
    >
      <View
        style={[styles.itemWrapper, isSwiping && styles.itemWrapperSwiping]}
      >
        <ConversationItem
          conversation={conversation}
          onPress={onPress}
          index={index}
        />
      </View>
    </Swipeable>
  );
};

export const ArchivedConversationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const archived = useConversationsStore((s) => s.archived);
  const fetchArchived = useConversationsStore(
    (s) => s.fetchArchivedConversations,
  );
  const loadMoreArchived = useConversationsStore(
    (s) => s.loadMoreArchivedConversations,
  );
  const unarchiveConversation = useConversationsStore(
    (s) => s.unarchiveConversation,
  );

  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  }>({ visible: false, message: "", type: "info" });

  useEffect(() => {
    fetchArchived();
  }, [fetchArchived]);

  const handlePress = useCallback(
    (conversationId: string) => {
      navigation.navigate("Chat", { conversationId });
    },
    [navigation],
  );

  const handleUnarchive = useCallback(
    async (conversationId: string) => {
      try {
        await unarchiveConversation(conversationId);
        setToast({
          visible: true,
          message: "Conversation désarchivée",
          type: "success",
        });
      } catch {
        setToast({
          visible: true,
          message: "Impossible de désarchiver la conversation",
          type: "error",
        });
      }
    },
    [unarchiveConversation],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchArchived();
    setRefreshing(false);
  }, [fetchArchived]);

  const renderItem = useCallback(
    ({ item, index }: { item: Conversation; index: number }) => (
      <SwipeableArchivedItem
        conversation={item}
        onPress={handlePress}
        onUnarchive={handleUnarchive}
        index={index}
      />
    ),
    [handlePress, handleUnarchive],
  );

  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  const renderFooter = () => {
    if (!archived.loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.text.light} />
      </View>
    );
  };

  const renderContent = () => {
    if (archived.status === "loading" && archived.items.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          {[...Array(5)].map((_, i) => (
            <ConversationSkeleton key={i} />
          ))}
        </View>
      );
    }

    if (archived.status === "error" && archived.items.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color="rgba(255, 255, 255, 0.5)"
          />
          <Text style={styles.emptyTitle}>Erreur de chargement</Text>
          <Text style={styles.emptySubtitle}>
            Vérifiez votre connexion puis réessayez.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchArchived()}
          >
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (archived.status === "loaded" && archived.items.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="archive-outline"
            size={48}
            color="rgba(255, 255, 255, 0.5)"
          />
          <Text style={styles.emptyTitle}>Aucune conversation archivée</Text>
          <Text style={styles.emptySubtitle}>
            Les conversations que vous archivez apparaîtront ici.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={archived.items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        style={styles.list}
        onEndReached={() => {
          if (archived.hasMore && !archived.loadingMore) {
            loadMoreArchived();
          }
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
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
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
            style={styles.headerButton}
            accessibilityLabel="Retour"
          >
            <Ionicons name="chevron-back" size={28} color={colors.text.light} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Archivées</Text>
          <View style={styles.headerButton} />
        </View>

        {renderContent()}

        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast({ ...toast, visible: false })}
        />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flex: 1, backgroundColor: "transparent" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.light,
  },
  itemWrapper: {
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  itemWrapperSwiping: {
    backgroundColor: "#1A1F3A",
    borderRadius: 16,
  },
  swipeActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: SWIPE_BUTTON_GAP,
    gap: SWIPE_BUTTON_GAP,
    backgroundColor: "transparent",
  },
  swipeButton: {
    width: SWIPE_BUTTON_SIZE,
    height: SWIPE_BUTTON_SIZE,
    borderRadius: SWIPE_BUTTON_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  unarchiveButton: {
    backgroundColor: "#5B66B8",
  },
  list: { flex: 1, backgroundColor: "transparent" },
  listContent: {
    paddingVertical: 8,
    flexGrow: 1,
    backgroundColor: "transparent",
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: colors.text.light,
    fontSize: 17,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  retryButtonText: {
    color: colors.text.light,
    fontSize: 15,
    fontWeight: "500",
  },
  footerLoader: {
    paddingVertical: 24,
    alignItems: "center",
  },
});
