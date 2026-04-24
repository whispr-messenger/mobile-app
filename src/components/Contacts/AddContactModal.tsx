/**
 * AddContactModal - Modal for adding new contacts
 * Supports search by username or phone number
 */

import React, { useState, useCallback, useRef } from "react";
import { formatUsername } from "../../utils";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { UserSearchResult } from "../../types/contact";
import { contactsAPI } from "../../services/contacts/api";
import { messagingAPI } from "../../services/messaging/api";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { Avatar } from "../Chat/Avatar";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../theme/colors";

interface AddContactModalProps {
  visible: boolean;
  onClose: () => void;
  onContactAdded: () => void;
  onMessageUser?: (conversationId: string) => void;
}

export const AddContactModal: React.FC<AddContactModalProps> = ({
  visible,
  onClose,
  onContactAdded,
  onMessageUser,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingContactId, setAddingContactId] = useState<string | null>(null);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(
    null,
  );
  const [doingBoth, setDoingBoth] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigation =
    useNavigation<StackNavigationProp<AuthStackParamList, "Contacts">>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const { userId: currentUserId } = useAuth();

  const openQrScanner = useCallback(() => {
    onClose();
    setTimeout(() => navigation.navigate("QRCodeScanner"), 300);
  }, [navigation, onClose]);

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (!query.trim()) {
        setSearchResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await contactsAPI.searchUsers({
            username: query.trim(),
          });
          const filtered = currentUserId
            ? results.filter((r) => r.user.id !== currentUserId)
            : results;
          setSearchResults(filtered);
        } catch (error) {
          console.error("[AddContactModal] Error searching users:", error);
          setSearchResults([]);
        } finally {
          setLoading(false);
        }
      }, 350);
    },
    [currentUserId],
  );

  const handleAddContact = useCallback(
    async (user: UserSearchResult) => {
      if (currentUserId && user.user.id === currentUserId) {
        Alert.alert(
          "Info",
          "Vous ne pouvez pas vous ajouter vous-même comme contact.",
        );
        return;
      }
      if (user.is_blocked) {
        Alert.alert(
          "Contact bloqué",
          "Cet utilisateur est bloqué. Vous ne pouvez pas l'ajouter comme contact.",
        );
        return;
      }

      try {
        setAddingContactId(user.user.id);
        await contactsAPI.sendContactRequest(user.user.id);

        if (Platform.OS === "web") {
          onContactAdded();
          setSelectedUser(null);
          Alert.alert("Succès", "Demande de contact envoyée");
        } else {
          Alert.alert("Succès", "Demande de contact envoyée", [
            {
              text: "OK",
              onPress: () => {
                onContactAdded();
                setSelectedUser(null);
              },
            },
          ]);
        }
      } catch (error: any) {
        console.error("[AddContactModal] Error adding contact:", error);
        const status = (error?.status as number) ?? 0;
        if (
          status === 409 ||
          `${error?.message ?? ""}`.toLowerCase().includes("already exists")
        ) {
          Alert.alert(
            "Info",
            "Ce contact est déjà dans ta liste (ou une demande est en attente).",
          );
          onContactAdded();
          setSelectedUser(null);
          return;
        }
        Alert.alert(
          "Erreur",
          error.message || "Impossible d'ajouter ce contact",
        );
      } finally {
        setAddingContactId(null);
      }
    },
    [onContactAdded, currentUserId],
  );

  const handleMessageUser = useCallback(
    async (user: UserSearchResult) => {
      if (!onMessageUser) return;
      if (currentUserId && user.user.id === currentUserId) {
        Alert.alert(
          "Info",
          "Vous ne pouvez pas ouvrir une conversation avec vous-même.",
        );
        return;
      }
      if (user.is_blocked) {
        Alert.alert(
          "Contact bloqué",
          "Cet utilisateur est bloqué. Vous ne pouvez pas lui envoyer de message.",
        );
        return;
      }

      try {
        setMessagingUserId(user.user.id);
        const conversation = await messagingAPI.createDirectConversation(
          user.user.id,
        );
        handleClose();
        onMessageUser(conversation.id);
      } catch (error: any) {
        console.error("[AddContactModal] Error creating conversation:", error);
        Alert.alert(
          "Erreur",
          error.message || "Impossible de créer la conversation",
        );
      } finally {
        setMessagingUserId(null);
      }
    },
    [onMessageUser, currentUserId],
  );

  const handleAddAndMessage = useCallback(
    async (user: UserSearchResult) => {
      if (!onMessageUser || user.is_blocked) return;
      if (currentUserId && user.user.id === currentUserId) {
        Alert.alert(
          "Info",
          "Vous ne pouvez pas vous ajouter vous-même comme contact.",
        );
        return;
      }
      try {
        setDoingBoth(true);
        // Send contact request first (fire and forget errors)
        try {
          await contactsAPI.sendContactRequest(user.user.id);
        } catch {
          // Ignore — may already be pending or contacts
        }
        onContactAdded();
        // Then create conversation
        const conversation = await messagingAPI.createDirectConversation(
          user.user.id,
        );
        handleClose();
        onMessageUser(conversation.id);
      } catch (error: any) {
        console.error(
          "[AddContactModal] Error adding contact and messaging:",
          error,
        );
        Alert.alert(
          "Erreur",
          error.message || "Impossible de créer la conversation",
        );
      } finally {
        setDoingBoth(false);
        setSelectedUser(null);
      }
    },
    [onMessageUser, onContactAdded, currentUserId],
  );

  const handleClose = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedUser(null);
    onClose();
  }, [onClose]);

  const renderSearchResult = useCallback(
    ({ item }: { item: UserSearchResult }) => {
      const { user, is_blocked } = item;
      const displayName = user.first_name || user.username || "Utilisateur";

      return (
        <TouchableOpacity
          style={[
            styles.resultItem,
            { backgroundColor: themeColors.background.secondary },
            is_blocked && styles.resultItemBlocked,
          ]}
          activeOpacity={0.7}
          onPress={() => {
            if (!is_blocked) setSelectedUser(item);
          }}
        >
          <Avatar uri={user.avatar_url} name={displayName} size={48} />
          <View style={styles.resultInfo}>
            <Text
              style={[styles.resultName, { color: themeColors.text.primary }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text
              style={[
                styles.resultUsername,
                { color: themeColors.text.secondary },
              ]}
              numberOfLines={1}
            >
              {formatUsername(user.username)}
            </Text>
          </View>
          <View style={styles.resultActions}>
            {is_blocked ? (
              <Ionicons name="ban" size={20} color={colors.ui.error} />
            ) : item.is_contact ? (
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={colors.status.online}
              />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={themeColors.text.tertiary}
              />
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [themeColors],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <LinearGradient
        colors={colors.background.gradient.app}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.container} edges={["top"]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: "transparent" }]}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons
                name="close"
                size={24}
                color={themeColors.text.primary}
              />
            </TouchableOpacity>
            <Text
              style={[styles.headerTitle, { color: themeColors.text.primary }]}
            >
              Ajouter un contact
            </Text>
            <View style={styles.placeholder} />
          </View>

          {/* Search Bar + scan QR */}
          <View style={styles.searchContainer}>
            <View style={styles.searchRow}>
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
                  placeholder="Rechercher par nom d'utilisateur..."
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => handleSearch("")}
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
              <TouchableOpacity
                style={[
                  styles.qrScanButton,
                  { backgroundColor: "rgba(255, 255, 255, 0.2)" },
                ]}
                onPress={openQrScanner}
                accessibilityLabel="Scanner un QR code"
              >
                <Ionicons
                  name="qr-code-outline"
                  size={26}
                  color={colors.text.light}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Results */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary.main} />
              <Text
                style={[
                  styles.loadingText,
                  { color: themeColors.text.secondary },
                ]}
              >
                Recherche en cours...
              </Text>
            </View>
          ) : searchQuery.trim() && searchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="search-outline"
                size={64}
                color={themeColors.text.tertiary}
              />
              <Text
                style={[
                  styles.emptyText,
                  { color: themeColors.text.secondary },
                ]}
              >
                Aucun utilisateur trouvé
              </Text>
              <Text
                style={[
                  styles.emptySubtext,
                  { color: themeColors.text.tertiary },
                ]}
              >
                Essayez avec un autre nom, username ou numéro
              </Text>
            </View>
          ) : !searchQuery.trim() ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="person-add-outline"
                size={64}
                color={themeColors.text.tertiary}
              />
              <Text
                style={[
                  styles.emptyText,
                  { color: themeColors.text.secondary },
                ]}
              >
                Rechercher un utilisateur
              </Text>
              <Text
                style={[
                  styles.emptySubtext,
                  { color: themeColors.text.tertiary },
                ]}
              >
                Entrez un nom, username ou numéro de téléphone
              </Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.user.id}
              contentContainerStyle={styles.resultsList}
            />
          )}
        </SafeAreaView>

        {/* User action card */}
        {selectedUser && (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => setSelectedUser(null)}
          >
            <TouchableOpacity
              style={styles.overlay}
              activeOpacity={1}
              onPress={() => setSelectedUser(null)}
            >
              <View
                style={[
                  styles.actionCard,
                  { backgroundColor: themeColors.background.secondary },
                ]}
              >
                <View style={styles.actionCardHeader}>
                  <Avatar
                    uri={selectedUser.user.avatar_url}
                    name={
                      selectedUser.user.first_name ||
                      selectedUser.user.username ||
                      "Utilisateur"
                    }
                    size={56}
                  />
                  <View style={styles.actionCardInfo}>
                    <Text
                      style={[
                        styles.actionCardName,
                        { color: themeColors.text.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedUser.user.first_name ||
                        selectedUser.user.username ||
                        "Utilisateur"}
                    </Text>
                    {selectedUser.user.username && (
                      <Text
                        style={[
                          styles.actionCardUsername,
                          { color: themeColors.text.secondary },
                        ]}
                        numberOfLines={1}
                      >
                        {formatUsername(selectedUser.user.username)}
                      </Text>
                    )}
                  </View>
                </View>

                {!selectedUser.is_contact && (
                  <TouchableOpacity
                    style={[
                      styles.actionCardButton,
                      { backgroundColor: colors.primary.main },
                    ]}
                    onPress={() => {
                      const user = selectedUser;
                      setSelectedUser(null);
                      handleAddContact(user);
                    }}
                    disabled={addingContactId === selectedUser.user.id}
                  >
                    {addingContactId === selectedUser.user.id ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.text.light}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="person-add"
                          size={18}
                          color={colors.text.light}
                        />
                        <Text style={styles.actionCardButtonText}>
                          Ajouter en ami
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {onMessageUser && selectedUser.is_contact && (
                  <TouchableOpacity
                    style={[
                      styles.actionCardButton,
                      { backgroundColor: colors.secondary.main },
                    ]}
                    onPress={() => {
                      const user = selectedUser;
                      setSelectedUser(null);
                      handleMessageUser(user);
                    }}
                    disabled={
                      messagingUserId === selectedUser.user.id || doingBoth
                    }
                  >
                    {messagingUserId === selectedUser.user.id ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.text.light}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="chatbubble-ellipses"
                          size={18}
                          color={colors.text.light}
                        />
                        <Text style={styles.actionCardButtonText}>
                          Envoyer un message
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {!selectedUser.is_contact && onMessageUser && (
                  <TouchableOpacity
                    style={[
                      styles.actionCardButton,
                      {
                        backgroundColor: "transparent",
                        borderWidth: 1,
                        borderColor: colors.primary.main,
                      },
                    ]}
                    onPress={() => handleAddAndMessage(selectedUser)}
                    disabled={doingBoth}
                  >
                    {doingBoth ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary.main}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="people"
                          size={18}
                          color={colors.primary.main}
                        />
                        <Text
                          style={[
                            styles.actionCardButtonText,
                            { color: colors.primary.main },
                          ]}
                        >
                          Ajouter et envoyer un message
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.actionCardCancel}
                  onPress={() => setSelectedUser(null)}
                >
                  <Text
                    style={[
                      styles.actionCardCancelText,
                      { color: themeColors.text.secondary },
                    ]}
                  >
                    Annuler
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  placeholder: {
    width: 32,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  qrScanButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
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
  resultsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  resultItemBlocked: {
    opacity: 0.5,
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 16,
    fontWeight: "600",
  },
  resultUsername: {
    fontSize: 14,
    marginTop: 2,
  },
  resultActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  actionCard: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  actionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  actionCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  actionCardName: {
    fontSize: 18,
    fontWeight: "600",
  },
  actionCardUsername: {
    fontSize: 14,
    marginTop: 2,
  },
  actionCardButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionCardButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  actionCardCancel: {
    alignItems: "center",
    paddingVertical: 8,
  },
  actionCardCancelText: {
    fontSize: 15,
  },
});
