/**
 * @danger-zone-mobile-layout
 *
 * DANGER ZONE - Layout web/iOS critique
 *
 * Bug historique : scroll bottom inaccessible sur Safari iOS PWA si la chaine flex
 * ne porte pas le pattern WHISPR-1254 (height:100% + minHeight:0 web).
 *
 * AVANT TOUTE MODIF :
 * 1. Tester live sur Safari iOS PWA (whispr-preprod.roadmvn.com).
 * 2. Verifier scroll vers le bas + boutons visibles + retour fonctionnel.
 * 3. Preserver les Platform.OS === 'web' ? minHeight:0 sur containers/scroll.
 *
 * Tickets historiques : WHISPR-1254, WHISPR-1291, WHISPR-1313, WHISPR-1335
 *
 * Tag parsable : @danger-zone-mobile-layout (utilise par script CI grep pour detection).
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { formatUsername } from "../../utils";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { FLOATING_TAB_BAR_RESERVED_SPACE } from "../../components/Navigation/floatingTabBarLayout";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { Ionicons } from "@expo/vector-icons";
import {
  Contact,
  ContactSearchParams,
  ContactRequest,
} from "../../types/contact";
import { contactsAPI } from "../../services/contacts/api";
import { messagingAPI } from "../../services/messaging/api";
import { TokenService } from "../../services/TokenService";
import { ContactItem } from "../../components/Contacts/ContactItem";
import { AddContactModal } from "../../components/Contacts/AddContactModal";
import { EditContactModal } from "../../components/Contacts/EditContactModal";
import { SyncContactsModal } from "../../components/Contacts/SyncContactsModal";
import { DeleteContactModal } from "../../components/Contacts/DeleteContactModal";
import { useTheme } from "../../context/ThemeContext";
import { colors, withOpacity } from "../../theme/colors";
import { useAuth } from "../../context/AuthContext";
import { useWebSocket } from "../../hooks/useWebSocket";
import {
  getFavoriteIds,
  toggleFavorite,
} from "../../services/contacts/favorites";
import { filterAndSortContacts } from "../../utils/contactsFilter";
import { ContactItemSkeleton } from "../../components/Chat/SkeletonLoader";
import { BellIcon } from "../../components/Common/BellIcon";
import { InboxPanel } from "../../components/Common/InboxPanel";
import { useInboxStore } from "../../store/inboxStore";

declare module "@expo/vector-icons";

// hauteur d'une row ContactItem (avatar 52 + padding vertical 14*2 + marginBottom 12)
const CONTACT_ITEM_HEIGHT = 98;

export const ContactsScreen: React.FC = () => {
  const navigation =
    useNavigation<StackNavigationProp<AuthStackParamList, "Contacts">>();
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<ContactSearchParams["sort"]>("name");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const { userId: rawUserId } = useAuth();
  const userId = rawUserId ?? "";
  const [token, setToken] = useState<string>("");
  const lastRefreshAtRef = useRef<number>(0);

  const inboxUnreadCount = useInboxStore((s) => s.unread_count);
  const hydrateInbox = useInboxStore((s) => s.hydrate);
  const [inboxPanelOpen, setInboxPanelOpen] = useState(false);

  useEffect(() => {
    if (userId) hydrateInbox();
  }, [userId, hydrateInbox]);

  useEffect(() => {
    if (!userId) {
      setToken("");
      return;
    }
    TokenService.getAccessToken().then((t) => setToken(t ?? ""));
  }, [userId]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const [result, favIds] = await Promise.all([
        contactsAPI.getContacts(),
        getFavoriteIds(),
      ]);
      setContacts(
        result.contacts.map((c) => ({ ...c, is_favorite: favIds.has(c.id) })),
      );
    } catch (error) {
      console.error("[ContactsScreen] Error loading contacts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContactRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      const requests = await contactsAPI.getContactRequests();
      setContactRequests(requests);
    } catch (error) {
      console.error("[ContactsScreen] Error loading contact requests:", error);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadContacts(), loadContactRequests()]);
    lastRefreshAtRef.current = Date.now();
  }, [loadContacts, loadContactRequests]);

  useWebSocket({
    userId,
    token,
    onContactRequest: (request: ContactRequest) => {
      setContactRequests((prev) => {
        const exists = prev.some((r) => r.id === request.id);
        if (exists) {
          return prev.map((r) => (r.id === request.id ? request : r));
        }
        return [request, ...prev];
      });
      void loadContacts();
    },
  });

  useFocusEffect(
    useCallback(() => {
      if (!userId) return undefined;
      if (Date.now() - lastRefreshAtRef.current > 30_000) {
        void refreshAll();
      }
      const interval = setInterval(() => {
        if (Date.now() - lastRefreshAtRef.current > 30_000) {
          void refreshAll();
        }
      }, 30_000);
      return () => clearInterval(interval);
    }, [userId, refreshAll]),
  );
  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }, [refreshAll]);

  const handleAcceptRequest = useCallback(
    async (request: ContactRequest) => {
      try {
        await contactsAPI.acceptContactRequest(request.id);
        await Promise.all([loadContacts(), loadContactRequests()]);
      } catch (error) {
        console.error(
          "[ContactsScreen] Error accepting contact request:",
          error,
        );
      }
    },
    [loadContacts, loadContactRequests],
  );

  const handleRefuseRequest = useCallback(
    async (request: ContactRequest) => {
      try {
        await contactsAPI.refuseContactRequest(request.id);
        await loadContactRequests();
      } catch (error) {
        console.error(
          "[ContactsScreen] Error refusing contact request:",
          error,
        );
      }
    },
    [loadContactRequests],
  );

  // Handle contact press — create or open a direct conversation
  const handleContactPress = useCallback(
    async (contact: Contact) => {
      const otherUserId = contact.contact_user?.id ?? contact.contact_id;
      if (!otherUserId) {
        Alert.alert("Erreur", "Impossible d'identifier ce contact");
        return;
      }

      try {
        const conversation =
          await messagingAPI.createDirectConversation(otherUserId);
        navigation.navigate("Chat", { conversationId: conversation.id });
      } catch (error: any) {
        console.error("[ContactsScreen] Error creating conversation:", error);
        Alert.alert(
          "Erreur",
          error.message || "Impossible de créer la conversation",
        );
      }
    },
    [navigation],
  );

  // Handle contact long press
  const handleContactLongPress = useCallback((contact: Contact) => {
    setEditingContact(contact);
  }, []);

  // Handle contact delete request
  const handleContactDelete = useCallback((contact: Contact) => {
    setDeletingContact(contact);
  }, []);

  // Handle favorite toggle (client-side via AsyncStorage)
  const handleToggleFavorite = useCallback(async (contact: Contact) => {
    const newFavorite = await toggleFavorite(contact.id);
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contact.id ? { ...c, is_favorite: newFavorite } : c,
      ),
    );
  }, []);

  // Filtered and sorted contacts
  const filteredContacts = useMemo(
    () =>
      filterAndSortContacts(contacts, searchQuery, sortBy, showFavoritesOnly),
    [contacts, searchQuery, showFavoritesOnly, sortBy],
  );

  const pendingRequests = useMemo(() => {
    if (!userId) {
      return [];
    }

    return contactRequests.filter(
      (request) =>
        request.status === "pending" && request.recipient_id === userId,
    );
  }, [contactRequests, userId]);

  const renderContact = useCallback(
    ({ item }: { item: Contact }) => (
      <ContactItem
        contact={item}
        onPress={handleContactPress}
        onLongPress={handleContactLongPress}
        onDelete={handleContactDelete}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [
      handleContactPress,
      handleContactLongPress,
      handleContactDelete,
      handleToggleFavorite,
    ],
  );

  const keyExtractor = useCallback((item: Contact) => item.id, []);

  // hauteur fixe d'une ContactItem (avatar 52 + padding 14*2 + marginBottom 12)
  const getItemLayout = useCallback(
    (_data: ArrayLike<Contact> | null | undefined, index: number) => ({
      length: CONTACT_ITEM_HEIGHT,
      offset: CONTACT_ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.topSection}>
          <BlurView intensity={40} tint="dark" style={styles.headerBlur}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text
                  style={[
                    styles.headerTitle,
                    { color: themeColors.text.primary },
                  ]}
                >
                  Contacts
                </Text>
                <Text style={styles.headerSubtitle}>Vos contact Whispr.</Text>
              </View>
              <View style={styles.headerActions}>
                <BellIcon
                  unreadCount={inboxUnreadCount}
                  onPress={() => setInboxPanelOpen(true)}
                />
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => navigation.navigate("MyQRCode")}
                  accessibilityLabel="Mon QR code"
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={22}
                    color={themeColors.text.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => setShowAddModal(true)}
                  accessibilityLabel="Ajouter un contact"
                >
                  <Ionicons
                    name="add"
                    size={22}
                    color={themeColors.text.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>

          <BlurView intensity={34} tint="dark" style={styles.searchShell}>
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color="rgba(255, 255, 255, 0.7)"
                  style={styles.searchIcon}
                />
                <TextInput
                  style={[styles.searchInput, { color: colors.text.light }]}
                  placeholder="Rechercher un contact"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => handleSearchChange("")}
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
          </BlurView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
          >
            <TouchableOpacity
              style={[
                styles.filterButton,
                sortBy === "name" && styles.filterButtonActivePrimary,
              ]}
              onPress={() => setSortBy("name")}
            >
              <Ionicons
                name="text-outline"
                size={16}
                color={
                  sortBy === "name"
                    ? colors.text.light
                    : themeColors.text.secondary
                }
              />
              <Text
                style={[
                  styles.filterText,
                  sortBy === "name" && styles.filterTextActive,
                  sortBy !== "name" && {
                    color: themeColors.text.secondary,
                  },
                ]}
              >
                A-Z
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                sortBy === "added_at" && styles.filterButtonActivePrimary,
              ]}
              onPress={() => setSortBy("added_at")}
            >
              <Ionicons
                name="time-outline"
                size={16}
                color={
                  sortBy === "added_at"
                    ? colors.text.light
                    : themeColors.text.secondary
                }
              />
              <Text
                style={[
                  styles.filterText,
                  sortBy === "added_at" && styles.filterTextActive,
                  sortBy !== "added_at" && {
                    color: themeColors.text.secondary,
                  },
                ]}
              >
                Récent
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                sortBy === "last_seen" && styles.filterButtonActivePrimary,
              ]}
              onPress={() => setSortBy("last_seen")}
            >
              <Ionicons
                name="pulse-outline"
                size={16}
                color={
                  sortBy === "last_seen"
                    ? colors.text.light
                    : themeColors.text.secondary
                }
              />
              <Text
                style={[
                  styles.filterText,
                  sortBy === "last_seen" && styles.filterTextActive,
                  sortBy !== "last_seen" && {
                    color: themeColors.text.secondary,
                  },
                ]}
              >
                Actif
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                showFavoritesOnly && styles.filterButtonActivePrimary,
              ]}
              onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
            >
              <Ionicons
                name="star"
                size={16}
                color={
                  showFavoritesOnly
                    ? colors.text.light
                    : themeColors.text.secondary
                }
              />
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowSyncModal(true)}
            >
              <Ionicons
                name="sync"
                size={16}
                color={themeColors.text.secondary}
              />
              <Text
                style={[
                  styles.filterText,
                  { color: themeColors.text.secondary },
                ]}
              >
                Synchroniser
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => {
                navigation.navigate("BlockedUsers");
              }}
            >
              <Ionicons
                name="ban-outline"
                size={16}
                color={themeColors.text.secondary}
              />
              <Text
                style={[
                  styles.filterText,
                  { color: themeColors.text.secondary },
                ]}
              >
                Bloqués
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contact Requests */}
        {loadingRequests &&
        pendingRequests.length === 0 ? null : pendingRequests.length > 0 ? (
          <BlurView intensity={34} tint="dark" style={styles.requestsBlur}>
            <View style={styles.requestsContainer}>
              <Text
                style={[
                  styles.requestsTitle,
                  { color: themeColors.text.primary },
                ]}
              >
                Demandes de contact
              </Text>
              {pendingRequests.map((request) => {
                const isIncoming = request.recipient_id === userId;
                const user = isIncoming
                  ? request.requester_user
                  : request.recipient_user;
                const displayName =
                  user?.first_name || user?.username || "Utilisateur";

                return (
                  <View key={request.id} style={styles.requestItem}>
                    <View style={styles.requestInfo}>
                      <Text
                        style={[
                          styles.requestName,
                          { color: themeColors.text.primary },
                        ]}
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>
                      {user?.username && (
                        <Text
                          style={[
                            styles.requestSubtitle,
                            { color: themeColors.text.secondary },
                          ]}
                          numberOfLines={1}
                        >
                          {formatUsername(user.username)}
                        </Text>
                      )}
                    </View>
                    {isIncoming && (
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={[
                            styles.requestButton,
                            styles.requestAcceptButton,
                          ]}
                          onPress={() => handleAcceptRequest(request)}
                        >
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={colors.text.light}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.requestButton,
                            styles.requestRefuseButton,
                          ]}
                          onPress={() => handleRefuseRequest(request)}
                        >
                          <Ionicons
                            name="close"
                            size={16}
                            color={colors.text.light}
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </BlurView>
        ) : null}

        {/* Contacts List */}
        {loading && contacts.length === 0 ? (
          <View style={styles.skeletonContainer}>
            {[...Array(6)].map((_, i) => (
              <ContactItemSkeleton key={i} />
            ))}
          </View>
        ) : filteredContacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="people-outline"
              size={64}
              color={themeColors.text.tertiary}
            />
            <Text
              style={[styles.emptyText, { color: themeColors.text.secondary }]}
            >
              {searchQuery ? "Aucun contact trouvé" : "Aucun contact"}
            </Text>
            {!searchQuery && (
              <Text
                style={[
                  styles.emptySubtext,
                  { color: themeColors.text.tertiary },
                ]}
              >
                Appuyez sur + pour ajouter un contact
              </Text>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            renderItem={renderContact}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            style={styles.list}
            showsVerticalScrollIndicator={Platform.OS === "web"}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.text.light}
              />
            }
            contentContainerStyle={[
              styles.listContent,
              {
                paddingTop: 8,
                paddingBottom: insets.bottom + FLOATING_TAB_BAR_RESERVED_SPACE,
              },
            ]}
          />
        )}

        {/* Add Contact Modal */}
        <AddContactModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onContactAdded={() => {
            loadContacts();
            loadContactRequests();
          }}
          onMessageUser={(conversationId) => {
            setShowAddModal(false);
            navigation.navigate("Chat", { conversationId });
          }}
        />

        {/* Edit Contact Modal */}
        <EditContactModal
          visible={!!editingContact}
          contact={editingContact}
          onClose={() => setEditingContact(null)}
          onContactUpdated={loadContacts}
        />

        {/* Delete Contact Modal */}
        <DeleteContactModal
          visible={!!deletingContact}
          contact={deletingContact}
          onClose={() => setDeletingContact(null)}
          onContactDeleted={loadContacts}
        />

        {/* Sync Contacts Modal */}
        <SyncContactsModal
          visible={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          onContactsSynced={loadContacts}
        />
      </SafeAreaView>

      <InboxPanel
        visible={inboxPanelOpen}
        onClose={() => setInboxPanelOpen(false)}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
    // WHISPR-1254 - sur react-native-web, flex:1 seul ne propage pas la
    // hauteur disponible jusqu'aux enfants si l'ancetre racine (#root) ne
    // borne pas son propre contenu. height:100% force le wrapper racine a
    // occuper exactement la hauteur du viewport.
    ...(Platform.OS === "web" ? { height: "100%" } : {}),
  },
  container: {
    flex: 1,
    // WHISPR-1254 - minHeight:0 est requis par CSS flexbox pour qu'un
    // enfant scrollable (FlatList) puisse overflow au lieu de pousser le
    // parent. Sans ca, les contacts depassent le viewport.
    ...(Platform.OS === "web" ? { minHeight: 0 } : {}),
  },
  list: {
    flex: 1,
    // WHISPR-1254 - meme raison que .container : permettre l'overflow
    // vertical natif cote react-native-web.
    ...(Platform.OS === "web" ? { minHeight: 0 } : {}),
  },
  topSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerBlur: {
    borderRadius: 28,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 28,
    backgroundColor: "rgba(11,17,36,0.2)",
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
  },
  headerSubtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  searchShell: {
    marginTop: 14,
    borderRadius: 22,
    overflow: "hidden",
  },
  searchContainer: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(11,17,36,0.18)",
    borderRadius: 22,
    padding: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  clearButton: {
    marginLeft: 8,
  },
  filtersContainer: {
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
    paddingRight: 16,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  filterButtonActive: {
    // Active state handled by backgroundColor
  },
  filterButtonActivePrimary: {
    backgroundColor: withOpacity(colors.primary.main, 0.92),
    borderColor: withOpacity(colors.primary.light, 0.34),
  },
  filterText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  filterTextActive: {
    color: colors.text.light,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 4,
    paddingBottom: 10,
  },
  listContent: {
    paddingBottom: 16,
  },
  skeletonContainer: {
    flex: 1,
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  requestsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(11,17,36,0.18)",
    borderRadius: 24,
  },
  requestsBlur: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 24,
    overflow: "hidden",
  },
  requestsTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
  },
  requestItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  requestInfo: {
    flex: 1,
    marginRight: 8,
  },
  requestName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  requestSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  requestActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  requestButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  requestAcceptButton: {
    backgroundColor: colors.ui.success,
  },
  requestRefuseButton: {
    backgroundColor: colors.ui.error,
  },
});
