import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";
import { Contact } from "../../types/contact";
import { contactsAPI } from "../../services/contacts/api";
import { messagingAPI } from "../../services/messaging/api";
import { Avatar } from "./Avatar";
import { logger } from "../../utils/logger";
import { formatUsername } from "../../utils";

interface NewConversationModalProps {
  visible: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
}

const getContactUserId = (contact: Contact): string | undefined =>
  contact.contact_id || contact.contact_user?.id;

const getContactDisplayName = (contact: Contact): string => {
  if (contact.nickname) return contact.nickname;
  const user = contact.contact_user;
  if (!user) return "Contact";
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return fullName || formatUsername(user.username) || "Contact";
};

export const NewConversationModal: React.FC<NewConversationModalProps> = ({
  visible,
  onClose,
  onConversationCreated,
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupNameTouched, setGroupNameTouched] = useState(false);
  const insets = useSafeAreaInsets();

  const resetState = useCallback(() => {
    setSearchQuery("");
    setSelectedIds(new Set());
    setGroupName("");
    setGroupNameTouched(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await contactsAPI.getContacts();
        if (!cancelled) setContacts(result.contacts);
      } catch (error) {
        logger.error("NewConversationModal", "Error loading contacts", error);
        if (!cancelled) {
          Alert.alert("Erreur", "Impossible de charger les contacts");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => {
      const user = contact.contact_user;
      const nickname = contact.nickname?.toLowerCase() ?? "";
      const username = user?.username?.toLowerCase() ?? "";
      const firstName = user?.first_name?.toLowerCase() ?? "";
      const lastName = user?.last_name?.toLowerCase() ?? "";
      return (
        nickname.includes(query) ||
        username.includes(query) ||
        firstName.includes(query) ||
        lastName.includes(query)
      );
    });
  }, [contacts, searchQuery]);

  const selectedContacts = useMemo(
    () =>
      contacts.filter((c) => {
        const id = getContactUserId(c);
        return id ? selectedIds.has(id) : false;
      }),
    [contacts, selectedIds],
  );

  const defaultGroupName = useMemo(() => {
    if (selectedContacts.length < 2) return "";
    const firstNames = selectedContacts
      .slice(0, 3)
      .map((c) => {
        const display = getContactDisplayName(c);
        return display.split(" ")[0];
      })
      .filter(Boolean);
    return firstNames.join(", ");
  }, [selectedContacts]);

  useEffect(() => {
    if (!groupNameTouched) {
      setGroupName(defaultGroupName);
    }
  }, [defaultGroupName, groupNameTouched]);

  const toggleContact = useCallback((contact: Contact) => {
    const userId = getContactUserId(contact);
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        if (next.size >= 49) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            "Limite atteinte",
            "Un groupe peut contenir au maximum 50 membres (créateur inclus)",
          );
          return prev;
        }
        next.add(userId);
      }
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetState();
    onClose();
  }, [onClose, resetState]);

  const createDirect = useCallback(
    async (userId: string) => {
      try {
        setCreating(true);
        const conversation =
          await messagingAPI.createDirectConversation(userId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onConversationCreated(conversation.id);
        resetState();
      } catch (error: unknown) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const message =
          error instanceof Error
            ? error.message
            : "Impossible de créer la conversation";
        Alert.alert("Erreur", message);
      } finally {
        setCreating(false);
      }
    },
    [onConversationCreated, resetState],
  );

  const createGroup = useCallback(
    async (name: string, memberIds: string[]) => {
      try {
        setCreating(true);
        const conversation = await messagingAPI.createGroupConversation(
          name,
          memberIds,
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onConversationCreated(conversation.id);
        resetState();
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Erreur", "Impossible de créer le groupe");
      } finally {
        setCreating(false);
      }
    },
    [onConversationCreated, resetState],
  );

  const handlePrimaryAction = useCallback(() => {
    const memberIds = Array.from(selectedIds);
    if (memberIds.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (memberIds.length === 1) {
      createDirect(memberIds[0]);
      return;
    }
    const trimmed = groupName.trim();
    if (trimmed.length < 3) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        "Nom invalide",
        "Le nom du groupe doit contenir au moins 3 caractères",
      );
      return;
    }
    if (trimmed.length > 100) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        "Nom invalide",
        "Le nom du groupe ne peut pas dépasser 100 caractères",
      );
      return;
    }
    createGroup(trimmed, memberIds);
  }, [selectedIds, groupName, createDirect, createGroup]);

  const renderContact = useCallback(
    ({ item }: { item: Contact }) => {
      const userId = getContactUserId(item);
      const selected = userId ? selectedIds.has(userId) : false;
      const displayName = getContactDisplayName(item);
      return (
        <TouchableOpacity
          style={styles.contactRow}
          onPress={() => toggleContact(item)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.checkbox,
              selected && styles.checkboxSelected,
              {
                borderColor: selected
                  ? colors.primary.main
                  : "rgba(255, 255, 255, 0.5)",
              },
            ]}
          >
            {selected && (
              <Ionicons name="checkmark" size={16} color={colors.text.light} />
            )}
          </View>
          <Avatar
            size={44}
            uri={item.contact_user?.avatar_url}
            name={displayName}
          />
          <View style={styles.contactText}>
            <Text style={styles.contactName} numberOfLines={1}>
              {displayName}
            </Text>
            {item.contact_user?.username ? (
              <Text style={styles.contactUsername} numberOfLines={1}>
                {formatUsername(item.contact_user.username)}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [selectedIds, toggleContact],
  );

  const keyExtractor = useCallback(
    (item: Contact) => getContactUserId(item) ?? item.id,
    [],
  );

  const primaryButtonLabel =
    selectedIds.size <= 1 ? "Créer la conversation" : "Créer le groupe";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <LinearGradient
        colors={colors.background.gradient.app}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.container} edges={["top"]}>
          <View style={[styles.header, { marginTop: insets.top }]}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={colors.text.light} />
            </TouchableOpacity>
            {selectedIds.size >= 2 ? (
              <View style={styles.headerTitleEditable}>
                <TextInput
                  style={styles.headerTitleInput}
                  value={groupName}
                  onChangeText={(text) => {
                    setGroupName(text);
                    setGroupNameTouched(true);
                  }}
                  placeholder="Nom du groupe"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  maxLength={100}
                  returnKeyType="done"
                />
                <Ionicons
                  name="pencil"
                  size={14}
                  color="rgba(255, 255, 255, 0.6)"
                  style={styles.headerTitleEditIcon}
                />
              </View>
            ) : (
              <Text style={styles.headerTitle}>Nouvelle conversation</Text>
            )}
            <View style={styles.headerButton} />
          </View>

          <View style={styles.searchBar}>
            <Ionicons
              name="search-outline"
              size={20}
              color="rgba(255, 255, 255, 0.7)"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un contact"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
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

          {selectedContacts.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsRow}
              contentContainerStyle={styles.chipsContent}
            >
              {selectedContacts.map((contact) => {
                const userId = getContactUserId(contact);
                if (!userId) return null;
                return (
                  <TouchableOpacity
                    key={userId}
                    style={styles.chip}
                    onPress={() => toggleContact(contact)}
                    activeOpacity={0.7}
                  >
                    <Avatar
                      size={24}
                      uri={contact.contact_user?.avatar_url}
                      name={getContactDisplayName(contact)}
                    />
                    <Text style={styles.chipText} numberOfLines={1}>
                      {getContactDisplayName(contact)}
                    </Text>
                    <Ionicons
                      name="close"
                      size={14}
                      color="rgba(255, 255, 255, 0.8)"
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary.main} />
            </View>
          ) : filteredContacts.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? "Aucun contact trouvé"
                  : "Aucun contact disponible"}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              renderItem={renderContact}
              keyExtractor={keyExtractor}
              contentContainerStyle={[
                styles.listContent,
                {
                  paddingBottom:
                    insets.bottom + (selectedIds.size > 0 ? 96 : 24),
                },
              ]}
              keyboardShouldPersistTaps="handled"
            />
          )}

          {selectedIds.size > 0 && (
            <View style={[styles.bottomBar, { bottom: 16 + insets.bottom }]}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  creating && styles.primaryButtonDisabled,
                ]}
                onPress={handlePrimaryAction}
                disabled={creating}
                activeOpacity={0.8}
              >
                {creating ? (
                  <ActivityIndicator color={colors.text.light} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {primaryButtonLabel}
                    {selectedIds.size > 1 ? ` (${selectedIds.size})` : ""}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
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
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  headerTitle: {
    color: colors.text.light,
    fontSize: 17,
    fontWeight: "600",
  },
  headerTitleEditable: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    marginHorizontal: 8,
  },
  headerTitleInput: {
    color: colors.text.light,
    fontSize: 17,
    fontWeight: "600",
    padding: 0,
    textAlign: "center",
    flexShrink: 1,
  },
  headerTitleEditIcon: {
    marginLeft: 6,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.light,
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  chipsRow: {
    maxHeight: 48,
    marginBottom: 8,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 4,
    paddingRight: 10,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    gap: 8,
  },
  chipText: {
    color: colors.text.light,
    fontSize: 13,
    fontWeight: "500",
    maxWidth: 120,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: colors.primary.main,
  },
  contactText: {
    flex: 1,
  },
  contactName: {
    color: colors.text.light,
    fontSize: 16,
    fontWeight: "600",
  },
  contactUsername: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 13,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 15,
    textAlign: "center",
  },
  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
  },
  primaryButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary.main,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.text.light,
    fontSize: 16,
    fontWeight: "600",
  },
});
