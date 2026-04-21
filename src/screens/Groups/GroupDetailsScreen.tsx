/**
 * GroupDetailsScreen - Écran de détails et informations du groupe
 * WHISPR-212
 */

import React, { useState, useEffect, useCallback } from "react";
import { formatUsername } from "../../utils";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useRoute,
  useNavigation,
  type ParamListBase,
} from "@react-navigation/native";
import {
  StackScreenProps,
  type StackNavigationProp,
} from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeInDown,
  SlideInRight,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { colors, withOpacity } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Avatar } from "../../components/Chat/Avatar";
import { logger } from "../../utils/logger";
import {
  groupsAPI,
  GroupDetails,
  GroupMember,
  GroupStats,
  GroupLog,
  GroupSettings,
} from "../../services/groups/api";
import { messagingAPI } from "../../services/messaging/api";
import { contactsAPI } from "../../services/contacts/api";
import { Contact } from "../../types/contact";
import { AuthStackParamList } from "../../navigation/AuthNavigator";

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedView = Animated.createAnimatedComponent(View);

type GroupDetailsScreenRouteProp = StackScreenProps<
  AuthStackParamList,
  "GroupDetails"
>["route"];

export const GroupDetailsScreen: React.FC = () => {
  const route = useRoute<GroupDetailsScreenRouteProp>();
  // WHISPR-1074: the screen isn't scoped to a typed param list, so we reach
  // for the base stack signature rather than sprinkling `as any` on every
  // navigate() call.
  const navigation = useNavigation<StackNavigationProp<ParamListBase>>();
  const { userId } = useAuth();
  const CURRENT_USER_ID = userId ?? "";
  const { groupId, conversationId, conversationName } = route.params;

  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [logs, setLogs] = useState<GroupLog[]>([]);
  const [settings, setSettings] = useState<GroupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "info" | "members" | "stats" | "history" | "settings"
  >("info");
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTransferAdminModal, setShowTransferAdminModal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberActionFor, setMemberActionFor] = useState<GroupMember | null>(
    null,
  );
  const [memberActionLoading, setMemberActionLoading] = useState(false);

  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  // Animation values
  const headerOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.95);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 300 });
    contentScale.value = withSpring(1, { damping: 15, stiffness: 150 });
  }, []);

  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        groupsAPI.getGroupDetails(groupId),
        groupsAPI.getGroupMembers(groupId),
        groupsAPI.getGroupStats(groupId),
        groupsAPI.getGroupLogs(groupId),
        groupsAPI.getGroupSettings(groupId),
      ]);

      const [detailsR, membersR, statsR, logsR, settingsR] = results;

      if (detailsR.status === "fulfilled") {
        setGroupDetails(detailsR.value);
      } else {
        logger.warn(
          "GroupDetailsScreen",
          "getGroupDetails failed, falling back to route params",
          detailsR.reason,
        );
        // Fallback so the header can still render the group name when the
        // backend endpoint is unavailable (e.g. legacy /user/v1/groups/:id 404).
        setGroupDetails((prev) => {
          if (prev) return prev;
          const fallbackName = conversationName ?? "";
          return {
            id: groupId,
            name: fallbackName,
            created_by: "",
            created_at: "",
            updated_at: "",
            is_active: true,
            conversation_id: conversationId,
          } as GroupDetails;
        });
      }

      if (membersR.status === "fulfilled") {
        setMembers(membersR.value.members);
      } else {
        logger.warn(
          "GroupDetailsScreen",
          "getGroupMembers failed",
          membersR.reason,
        );
      }

      if (statsR.status === "fulfilled") {
        setStats(statsR.value);
      } else {
        logger.warn(
          "GroupDetailsScreen",
          "getGroupStats failed",
          statsR.reason,
        );
      }

      if (logsR.status === "fulfilled") {
        setLogs(logsR.value.logs);
      } else {
        logger.warn("GroupDetailsScreen", "getGroupLogs failed", logsR.reason);
      }

      if (settingsR.status === "fulfilled") {
        setSettings(settingsR.value);
      } else {
        logger.warn(
          "GroupDetailsScreen",
          "getGroupSettings failed",
          settingsR.reason,
        );
      }

      // If every call failed, surface a single user-facing error.
      if (results.every((r) => r.status === "rejected")) {
        logger.error(
          "GroupDetailsScreen",
          "All group data requests failed",
          results,
        );
        Alert.alert(
          "Erreur",
          "Impossible de charger les informations du groupe",
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, conversationId, conversationName]);

  useEffect(() => {
    loadGroupData();
  }, [loadGroupData]);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    loadGroupData();
  }, [loadGroupData]);

  const handleTabChange = useCallback((tab: typeof activeTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  const handleManageGroup = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("GroupManagement", { groupId, conversationId });
  }, [navigation, groupId, conversationId]);

  const currentUserMember = members.find((m) => m.user_id === CURRENT_USER_ID);
  const isAdmin = currentUserMember?.role === "admin";
  const adminCount = members.filter((m) => m.role === "admin").length;
  const isLastAdmin = isAdmin && adminCount === 1;
  const otherMembers = members.filter((m) => m.user_id !== CURRENT_USER_ID);

  const handleLeaveGroup = useCallback(async () => {
    if (isLastAdmin) {
      setShowLeaveModal(false);
      setShowTransferAdminModal(true);
      return;
    }

    try {
      setLeaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await groupsAPI.leaveGroup(groupId, CURRENT_USER_ID);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("ConversationsList");
    } catch (error: any) {
      logger.error("GroupDetailsScreen", "Error leaving group", error);
      Alert.alert("Erreur", error.message || "Impossible de quitter le groupe");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLeaving(false);
      setShowLeaveModal(false);
    }
  }, [groupId, isLastAdmin, navigation]);

  const handleDeleteGroup = useCallback(async () => {
    try {
      setDeleting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await groupsAPI.deleteGroup(groupId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Succès", "Le groupe a été supprimé");
      navigation.navigate("ConversationsList");
    } catch (error) {
      logger.error("GroupDetailsScreen", "Error deleting group", error);
      Alert.alert("Erreur", "Impossible de supprimer le groupe");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }, [groupId, navigation]);

  const handleTransferAndLeave = useCallback(
    async (newAdminId: string) => {
      try {
        setLeaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await groupsAPI.transferAdmin(groupId, newAdminId);
        await groupsAPI.leaveGroup(groupId, CURRENT_USER_ID);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.navigate("ConversationsList");
      } catch (error: any) {
        logger.error(
          "GroupDetailsScreen",
          "Error transferring and leaving",
          error,
        );
        Alert.alert(
          "Erreur",
          error.message || "Impossible de transférer et quitter le groupe",
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setLeaving(false);
        setShowTransferAdminModal(false);
      }
    },
    [groupId, navigation],
  );

  const loadContactsForPicker = useCallback(async () => {
    try {
      setLoadingContacts(true);
      const result = await contactsAPI.getContacts();
      setContacts(result.contacts);
    } catch (error) {
      logger.error("GroupDetailsScreen", "Error loading contacts", error);
      Alert.alert("Erreur", "Impossible de charger les contacts");
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const openAddMemberModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setContactSearch("");
    setShowAddMemberModal(true);
    if (contacts.length === 0) {
      loadContactsForPicker();
    }
  }, [contacts.length, loadContactsForPicker]);

  const existingMemberIds = React.useMemo(
    () => new Set(members.map((m) => m.user_id)),
    [members],
  );

  const pickerContacts = React.useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    return contacts.filter((c) => {
      const userId = c.contact_user?.id ?? c.contact_id;
      if (!userId || existingMemberIds.has(userId)) return false;
      if (!q) return true;
      const nick = c.nickname?.toLowerCase() || "";
      const uname = c.contact_user?.username?.toLowerCase() || "";
      const fn = c.contact_user?.first_name?.toLowerCase() || "";
      const ln = c.contact_user?.last_name?.toLowerCase() || "";
      return (
        nick.includes(q) ||
        uname.includes(q) ||
        fn.includes(q) ||
        ln.includes(q)
      );
    });
  }, [contacts, contactSearch, existingMemberIds]);

  const handlePickContact = useCallback(
    async (contact: Contact) => {
      const userId = contact.contact_user?.id ?? contact.contact_id;
      if (!userId) return;
      try {
        setAddingMember(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await messagingAPI.addGroupMembers(conversationId, [userId]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Membre ajouté", "Le membre a été ajouté au groupe.");
        setShowAddMemberModal(false);
        loadGroupData();
      } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (error?.status === 403) {
          Alert.alert(
            "Non autorisé",
            "Seul un administrateur peut ajouter un membre.",
          );
        } else {
          Alert.alert(
            "Erreur",
            error?.message || "Impossible d'ajouter ce membre",
          );
        }
      } finally {
        setAddingMember(false);
      }
    },
    [conversationId, loadGroupData],
  );

  const handleRemoveMember = useCallback(
    (member: GroupMember) => {
      Alert.alert(
        "Retirer du groupe",
        `Retirer ${member.display_name} du groupe ?`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Retirer",
            style: "destructive",
            onPress: async () => {
              try {
                setMemberActionLoading(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                await messagingAPI.removeGroupMember(
                  conversationId,
                  member.user_id,
                );
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                setMemberActionFor(null);
                loadGroupData();
              } catch (error: any) {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Error,
                );
                if (error?.status === 403) {
                  Alert.alert(
                    "Non autorisé",
                    "Seul un administrateur peut retirer un membre.",
                  );
                } else {
                  Alert.alert(
                    "Erreur",
                    error?.message || "Impossible de retirer ce membre",
                  );
                }
              } finally {
                setMemberActionLoading(false);
              }
            },
          },
        ],
      );
    },
    [conversationId, loadGroupData],
  );

  const handleChangeRole = useCallback(
    async (member: GroupMember, role: "admin" | "member") => {
      // Anti-self-lock: sole admin trying to demote self
      if (
        role === "member" &&
        member.user_id === CURRENT_USER_ID &&
        isLastAdmin
      ) {
        Alert.alert(
          "Action impossible",
          "Tu es le seul admin. Promeus quelqu'un d'autre avant de te rétrograder, ou quitte le groupe (un membre sera auto-promu).",
        );
        return;
      }
      try {
        setMemberActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await messagingAPI.updateGroupMemberRole(
          conversationId,
          member.user_id,
          role,
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMemberActionFor(null);
        loadGroupData();
      } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (error?.status === 403) {
          Alert.alert(
            "Non autorisé",
            "Seul un administrateur peut modifier les rôles.",
          );
        } else if (error?.status === 404 || error?.status === 405) {
          Alert.alert(
            "Fonctionnalité indisponible",
            "Le changement de rôle n'est pas encore disponible côté serveur.",
          );
        } else {
          Alert.alert(
            "Erreur",
            error?.message || "Impossible de changer le rôle",
          );
        }
      } finally {
        setMemberActionLoading(false);
      }
    },
    [CURRENT_USER_ID, conversationId, isLastAdmin, loadGroupData],
  );

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
  }));

  const renderHeader = () => (
    <Animated.View
      style={[styles.header, headerAnimatedStyle]}
      entering={FadeIn.duration(300)}
    >
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.goBack();
        }}
        style={styles.backButton}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text.light} />
      </TouchableOpacity>
      <Text
        style={[styles.headerTitle, { color: colors.text.light }]}
        numberOfLines={1}
      >
        {groupDetails?.name?.trim() || conversationName || "Détails du groupe"}
      </Text>
      <TouchableOpacity
        onPress={handleManageGroup}
        style={styles.manageButton}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={[colors.primary.main, colors.secondary.main]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.manageButtonGradient}
        >
          <Ionicons
            name="settings-outline"
            size={20}
            color={colors.text.light}
          />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderGroupInfo = () => (
    <Animated.View
      style={[styles.groupInfoSection, contentAnimatedStyle]}
      entering={FadeInDown.delay(100).springify()}
    >
      <View style={styles.groupPhotoContainer}>
        {groupDetails?.picture_url ? (
          <Image
            source={{ uri: groupDetails.picture_url }}
            style={styles.groupPhoto}
          />
        ) : (
          <View
            style={[
              styles.groupPhotoPlaceholder,
              { backgroundColor: colors.background.darkCard },
            ]}
          >
            <Ionicons
              name="people"
              size={48}
              color={withOpacity(colors.text.light, 0.5)}
            />
          </View>
        )}
      </View>
      <Text style={[styles.groupName, { color: colors.text.light }]}>
        {groupDetails?.name?.trim() || conversationName || "Groupe"}
      </Text>
      {groupDetails?.description && (
        <Text
          style={[
            styles.groupDescription,
            { color: withOpacity(colors.text.light, 0.7) },
          ]}
        >
          {groupDetails.description}
        </Text>
      )}
    </Animated.View>
  );

  const renderTabs = () => (
    <Animated.View
      style={styles.tabsContainer}
      entering={FadeInDown.delay(200).springify()}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScroll}
      >
        {(
          [
            {
              key: "info",
              label: "Informations",
              icon: "information-circle-outline",
            },
            { key: "members", label: "Membres", icon: "people-outline" },
            {
              key: "stats",
              label: "Statistiques",
              icon: "stats-chart-outline",
            },
            {
              key: "history",
              label: "Historique",
              icon: "time-outline",
            },
            {
              key: "settings",
              label: "Paramètres",
              icon: "settings-outline",
            },
          ] as const
        ).map((tab, index) => {
          const isActive = activeTab === tab.key;
          return (
            <AnimatedTouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive
                    ? colors.primary.main
                    : withOpacity(colors.background.darkCard, 0.8),
                },
              ]}
              onPress={() => handleTabChange(tab.key)}
              activeOpacity={0.7}
              entering={SlideInRight.delay(100 + index * 50).springify()}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={
                  isActive
                    ? colors.text.light
                    : withOpacity(colors.text.light, 0.6)
                }
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive
                      ? colors.text.light
                      : withOpacity(colors.text.light, 0.6),
                    fontWeight: isActive
                      ? typography.fontWeight.semiBold
                      : typography.fontWeight.regular,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </AnimatedTouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );

  const renderInfoTab = () => (
    <Animated.View entering={FadeIn.delay(100).duration(300)}>
      <View style={styles.infoCard}>
        <View
          style={[
            styles.infoRow,
            { borderBottomColor: withOpacity(colors.ui.divider, 0.3) },
          ]}
        >
          <View style={styles.infoRowLeft}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={withOpacity(colors.text.light, 0.7)}
            />
            <Text
              style={[
                styles.infoLabel,
                { color: withOpacity(colors.text.light, 0.7) },
              ]}
            >
              Créé le
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: colors.text.light }]}>
            {groupDetails?.created_at
              ? new Date(groupDetails.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "-"}
          </Text>
        </View>
        <View
          style={[
            styles.infoRow,
            { borderBottomColor: withOpacity(colors.ui.divider, 0.3) },
          ]}
        >
          <View style={styles.infoRowLeft}>
            <Ionicons
              name="time-outline"
              size={20}
              color={withOpacity(colors.text.light, 0.7)}
            />
            <Text
              style={[
                styles.infoLabel,
                { color: withOpacity(colors.text.light, 0.7) },
              ]}
            >
              Dernière activité
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: colors.text.light }]}>
            {stats?.lastActivity
              ? new Date(stats.lastActivity).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                })
              : "-"}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.infoRowLeft}>
            <Ionicons
              name="chatbubbles-outline"
              size={20}
              color={withOpacity(colors.text.light, 0.7)}
            />
            <Text
              style={[
                styles.infoLabel,
                { color: withOpacity(colors.text.light, 0.7) },
              ]}
            >
              Messages
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: colors.text.light }]}>
            {stats?.messageCount || 0}
          </Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderMembersTab = () => (
    <Animated.View entering={FadeIn.delay(100).duration(300)}>
      <View style={styles.membersCard}>
        <View style={styles.membersHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text.light }]}>
            Membres ({members.length})
          </Text>
          <Text
            style={[
              styles.sectionSubtitle,
              { color: withOpacity(colors.text.light, 0.7) },
            ]}
          >
            {stats?.adminCount || 0} administrateur
            {stats && stats.adminCount > 1 ? "s" : ""}
          </Text>
        </View>
        {isAdmin && (
          <TouchableOpacity
            style={[
              styles.addMemberButton,
              { backgroundColor: withOpacity(colors.primary.main, 0.15) },
            ]}
            onPress={openAddMemberModal}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Ajouter un membre"
          >
            <View
              style={[
                styles.addMemberIcon,
                { backgroundColor: colors.primary.main },
              ]}
            >
              <Ionicons name="person-add" size={18} color={colors.text.light} />
            </View>
            <Text style={[styles.addMemberText, { color: colors.text.light }]}>
              Ajouter un membre
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={withOpacity(colors.text.light, 0.5)}
            />
          </TouchableOpacity>
        )}
        {members.map((member, index) => (
          <AnimatedTouchableOpacity
            key={member.id}
            style={[
              styles.memberItem,
              { backgroundColor: withOpacity(colors.background.darkCard, 0.6) },
            ]}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("Profile", {
                userId:
                  member.user_id === CURRENT_USER_ID
                    ? CURRENT_USER_ID
                    : member.user_id,
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Ouvrir le profil de ${member.display_name}`}
            entering={FadeInDown.delay(150 + index * 50).springify()}
          >
            <Avatar
              uri={member.avatar_url}
              name={member.display_name}
              size={48}
              showOnlineBadge={false}
            />
            <View style={styles.memberInfo}>
              <View style={styles.memberNameRow}>
                <Text style={[styles.memberName, { color: colors.text.light }]}>
                  {member.display_name}
                </Text>
                {member.role === "admin" && (
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: colors.primary.main },
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark"
                      size={12}
                      color={colors.text.light}
                    />
                    <Text
                      style={[
                        styles.roleBadgeText,
                        { color: colors.text.light },
                      ]}
                    >
                      Admin
                    </Text>
                  </View>
                )}
                {member.role === "moderator" && (
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: colors.secondary.main },
                    ]}
                  >
                    <Ionicons
                      name="shield"
                      size={12}
                      color={colors.text.light}
                    />
                    <Text
                      style={[
                        styles.roleBadgeText,
                        { color: colors.text.light },
                      ]}
                    >
                      Modo
                    </Text>
                  </View>
                )}
              </View>
              {member.username && (
                <Text
                  style={[
                    styles.memberUsername,
                    { color: withOpacity(colors.text.light, 0.7) },
                  ]}
                >
                  {formatUsername(member.username)}
                </Text>
              )}
              <Text
                style={[
                  styles.memberJoined,
                  { color: withOpacity(colors.text.light, 0.5) },
                ]}
              >
                Rejoint le{" "}
                {new Date(member.joined_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                })}
              </Text>
            </View>
            {isAdmin && member.user_id !== CURRENT_USER_ID && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMemberActionFor(member);
                }}
                style={styles.memberActionButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Actions pour ${member.display_name}`}
              >
                <Ionicons
                  name="ellipsis-vertical"
                  size={20}
                  color={withOpacity(colors.text.light, 0.7)}
                />
              </TouchableOpacity>
            )}
          </AnimatedTouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderStatsTab = () => (
    <Animated.View entering={FadeIn.delay(100).duration(300)}>
      <View style={styles.statsCard}>
        <View style={styles.statsGrid}>
          <Animated.View
            style={[
              styles.statItem,
              { backgroundColor: withOpacity(colors.primary.main, 0.2) },
            ]}
            entering={FadeInDown.delay(150).springify()}
          >
            <LinearGradient
              colors={[colors.primary.main, colors.secondary.main]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statIconContainer}
            >
              <Ionicons name="people" size={24} color={colors.text.light} />
            </LinearGradient>
            <Text style={[styles.statValue, { color: colors.text.light }]}>
              {stats?.memberCount || 0}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: withOpacity(colors.text.light, 0.7) },
              ]}
            >
              Membres
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.statItem,
              { backgroundColor: withOpacity(colors.secondary.main, 0.2) },
            ]}
            entering={FadeInDown.delay(200).springify()}
          >
            <LinearGradient
              colors={[colors.secondary.main, colors.primary.main]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statIconContainer}
            >
              <Ionicons
                name="shield-checkmark"
                size={24}
                color={colors.text.light}
              />
            </LinearGradient>
            <Text style={[styles.statValue, { color: colors.text.light }]}>
              {stats?.adminCount || 0}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: withOpacity(colors.text.light, 0.7) },
              ]}
            >
              Admins
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.statItem,
              { backgroundColor: withOpacity(colors.primary.main, 0.2) },
            ]}
            entering={FadeInDown.delay(250).springify()}
          >
            <LinearGradient
              colors={[colors.primary.main, colors.secondary.main]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statIconContainer}
            >
              <Ionicons
                name="chatbubbles"
                size={24}
                color={colors.text.light}
              />
            </LinearGradient>
            <Text style={[styles.statValue, { color: colors.text.light }]}>
              {stats?.messageCount || 0}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: withOpacity(colors.text.light, 0.7) },
              ]}
            >
              Messages
            </Text>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );

  const renderHistoryTab = () => (
    <Animated.View entering={FadeIn.delay(100).duration(300)}>
      <View style={styles.historyCard}>
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="time-outline"
              size={48}
              color={withOpacity(colors.text.light, 0.5)}
            />
            <Text
              style={[
                styles.emptyText,
                { color: withOpacity(colors.text.light, 0.7) },
              ]}
            >
              Aucun historique disponible
            </Text>
          </View>
        ) : (
          logs.map((log, index) => (
            <Animated.View
              key={log.id}
              style={[
                styles.logItem,
                { borderBottomColor: withOpacity(colors.ui.divider, 0.3) },
              ]}
              entering={FadeInDown.delay(150 + index * 50).springify()}
            >
              <View style={styles.logIconContainer}>
                <Ionicons
                  name={
                    log.action_type === "group_created"
                      ? "add-circle"
                      : log.action_type === "member_added"
                        ? "person-add"
                        : log.action_type === "member_removed"
                          ? "person-remove"
                          : log.action_type === "role_changed"
                            ? "swap-horizontal"
                            : log.action_type === "admin_transferred"
                              ? "shield-checkmark"
                              : "settings"
                  }
                  size={20}
                  color={colors.primary.main}
                />
              </View>
              <View style={styles.logContent}>
                <Text style={[styles.logAction, { color: colors.text.light }]}>
                  {log.action_type === "group_created"
                    ? "Groupe créé"
                    : log.action_type === "member_added"
                      ? "Membre ajouté"
                      : log.action_type === "member_removed"
                        ? "Membre retiré"
                        : log.action_type === "role_changed"
                          ? "Rôle modifié"
                          : log.action_type === "admin_transferred"
                            ? "Administration transférée"
                            : "Paramètres modifiés"}
                </Text>
                <Text
                  style={[
                    styles.logActor,
                    { color: withOpacity(colors.text.light, 0.7) },
                  ]}
                >
                  par {log.actor_name}
                </Text>
                <Text
                  style={[
                    styles.logTime,
                    { color: withOpacity(colors.text.light, 0.5) },
                  ]}
                >
                  {new Date(log.timestamp).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </Animated.View>
          ))
        )}
      </View>
    </Animated.View>
  );

  const renderSettingsTab = () => (
    <Animated.View entering={FadeIn.delay(100).duration(300)}>
      <View style={styles.settingsCard}>
        <View style={styles.settingsSection}>
          <Text
            style={[styles.settingsSectionTitle, { color: colors.text.light }]}
          >
            Permissions de communication
          </Text>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons
                name="chatbubble-outline"
                size={20}
                color={withOpacity(colors.text.light, 0.7)}
              />
              <Text style={[styles.settingLabel, { color: colors.text.light }]}>
                Envoi de messages
              </Text>
            </View>
            <Text
              style={[
                styles.settingValue,
                { color: withOpacity(colors.text.light, 0.7) },
              ]}
            >
              {settings?.message_permission === "all_members"
                ? "Tous les membres"
                : settings?.message_permission === "moderators_plus"
                  ? "Modérateurs+"
                  : "Admins uniquement"}
            </Text>
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons
                name="image-outline"
                size={20}
                color={withOpacity(colors.text.light, 0.7)}
              />
              <Text style={[styles.settingLabel, { color: colors.text.light }]}>
                Envoi de médias
              </Text>
            </View>
            <Text
              style={[
                styles.settingValue,
                { color: withOpacity(colors.text.light, 0.7) },
              ]}
            >
              {settings?.media_permission === "all_members"
                ? "Tous les membres"
                : settings?.media_permission === "moderators_plus"
                  ? "Modérateurs+"
                  : "Admins uniquement"}
            </Text>
          </View>
        </View>
        <View style={styles.settingsSection}>
          <Text
            style={[styles.settingsSectionTitle, { color: colors.text.light }]}
          >
            Modération
          </Text>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons
                name="shield-outline"
                size={20}
                color={withOpacity(colors.text.light, 0.7)}
              />
              <Text style={[styles.settingLabel, { color: colors.text.light }]}>
                Niveau de modération
              </Text>
            </View>
            <Text
              style={[
                styles.settingValue,
                { color: withOpacity(colors.text.light, 0.7) },
              ]}
            >
              {settings?.moderation_level === "light"
                ? "Léger"
                : settings?.moderation_level === "medium"
                  ? "Modéré"
                  : "Strict"}
            </Text>
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons
                name="filter-outline"
                size={20}
                color={withOpacity(colors.text.light, 0.7)}
              />
              <Text style={[styles.settingLabel, { color: colors.text.light }]}>
                Filtre de contenu
              </Text>
            </View>
            <View
              style={[
                styles.toggleBadge,
                {
                  backgroundColor: settings?.content_filter_enabled
                    ? colors.primary.main
                    : colors.background.tertiary,
                },
              ]}
            >
              <Text
                style={[styles.toggleBadgeText, { color: colors.text.light }]}
              >
                {settings?.content_filter_enabled ? "Activé" : "Désactivé"}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.settingsSection}>
          <Text
            style={[styles.settingsSectionTitle, { color: colors.text.light }]}
          >
            Actions
          </Text>
          <AnimatedTouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowLeaveModal(true);
            }}
            activeOpacity={0.7}
            entering={FadeInDown.delay(200).duration(300)}
          >
            <View style={styles.actionButtonContent}>
              <View style={styles.actionIconContainer}>
                <LinearGradient
                  colors={[colors.primary.main, colors.primary.dark]}
                  style={styles.actionIconGradient}
                >
                  <Ionicons
                    name="exit-outline"
                    size={20}
                    color={colors.text.light}
                  />
                </LinearGradient>
              </View>
              <Text
                style={[styles.actionButtonText, { color: colors.text.light }]}
              >
                Quitter le groupe
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={withOpacity(colors.text.light, 0.4)}
            />
          </AnimatedTouchableOpacity>
          {isAdmin && (
            <AnimatedTouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setShowDeleteModal(true);
              }}
              activeOpacity={0.7}
              entering={FadeInDown.delay(250).duration(300)}
            >
              <View style={styles.actionButtonContent}>
                <View
                  style={[
                    styles.actionIconContainer,
                    styles.actionIconContainerDanger,
                  ]}
                >
                  <LinearGradient
                    colors={[colors.ui.error, "#E02D20"]}
                    style={styles.actionIconGradient}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={colors.text.light}
                    />
                  </LinearGradient>
                </View>
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: colors.text.light },
                  ]}
                >
                  Supprimer le groupe
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={withOpacity(colors.text.light, 0.4)}
              />
            </AnimatedTouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "info":
        return renderInfoTab();
      case "members":
        return renderMembersTab();
      case "stats":
        return renderStatsTab();
      case "history":
        return renderHistoryTab();
      case "settings":
        return renderSettingsTab();
      default:
        return renderInfoTab();
    }
  };

  const renderLeaveModal = () => (
    <Modal
      visible={showLeaveModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowLeaveModal(false)}
    >
      <View style={styles.modalOverlay}>
        <AnimatedView
          style={styles.modalContainer}
          entering={FadeInDown.duration(300).springify()}
        >
          <LinearGradient
            colors={colors.background.gradient.app}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalGradient}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <LinearGradient
                  colors={[colors.primary.main, colors.primary.dark]}
                  style={styles.modalIconGradient}
                >
                  <Ionicons
                    name="exit-outline"
                    size={28}
                    color={colors.text.light}
                  />
                </LinearGradient>
              </View>
              <Text style={styles.modalTitle}>Quitter le groupe</Text>
              <Text style={styles.modalDescription}>
                {isLastAdmin
                  ? "Vous êtes le dernier administrateur. Vous devez transférer l'administration avant de quitter le groupe, sinon le groupe sera supprimé."
                  : `Êtes-vous sûr de vouloir quitter "${groupDetails?.name}" ? Vous ne recevrez plus les messages de ce groupe.`}
              </Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowLeaveModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonConfirm}
                onPress={handleLeaveGroup}
                disabled={leaving}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.primary.main, colors.primary.dark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalButtonGradient}
                >
                  {leaving ? (
                    <ActivityIndicator size="small" color={colors.text.light} />
                  ) : (
                    <>
                      <Ionicons
                        name="exit-outline"
                        size={18}
                        color={colors.text.light}
                        style={styles.modalButtonIcon}
                      />
                      <Text style={styles.modalButtonConfirmText}>Quitter</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </AnimatedView>
      </View>
    </Modal>
  );

  const renderDeleteModal = () => (
    <Modal
      visible={showDeleteModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDeleteModal(false)}
    >
      <View style={styles.modalOverlay}>
        <AnimatedView
          style={styles.modalContainer}
          entering={FadeInDown.duration(300).springify()}
        >
          <LinearGradient
            colors={colors.background.gradient.app}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalGradient}
          >
            <View style={styles.modalHeader}>
              <View
                style={[
                  styles.modalIconContainer,
                  styles.modalIconContainerDanger,
                ]}
              >
                <LinearGradient
                  colors={[colors.ui.error, "#E02D20"]}
                  style={styles.modalIconGradient}
                >
                  <Ionicons
                    name="trash-outline"
                    size={28}
                    color={colors.text.light}
                  />
                </LinearGradient>
              </View>
              <Text style={styles.modalTitle}>Supprimer le groupe</Text>
              <Text style={styles.modalDescription}>
                Êtes-vous sûr de vouloir supprimer "{groupDetails?.name}" ?
                Cette action est irréversible après 7 jours. Tous les membres
                seront retirés et toutes les données seront supprimées.
              </Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowDeleteModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonDelete}
                onPress={handleDeleteGroup}
                disabled={deleting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.ui.error, "#E02D20"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalButtonGradient}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color={colors.text.light} />
                  ) : (
                    <>
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.text.light}
                        style={styles.modalButtonIcon}
                      />
                      <Text style={styles.modalButtonDeleteText}>
                        Supprimer
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </AnimatedView>
      </View>
    </Modal>
  );

  const renderTransferAdminModal = () => {
    const nonAdminMembers = otherMembers.filter((m) => m.role !== "admin");

    return (
      <Modal
        visible={showTransferAdminModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTransferAdminModal(false)}
      >
        <View style={styles.modalOverlay}>
          <AnimatedView
            style={styles.modalContainerLarge}
            entering={FadeInDown.duration(300).springify()}
          >
            <LinearGradient
              colors={colors.background.gradient.app}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <View
                  style={[
                    styles.modalIconContainer,
                    styles.modalIconContainerInfo,
                  ]}
                >
                  <LinearGradient
                    colors={[colors.secondary.main, colors.secondary.medium]}
                    style={styles.modalIconGradient}
                  >
                    <Ionicons
                      name="shield-checkmark"
                      size={28}
                      color={colors.text.light}
                    />
                  </LinearGradient>
                </View>
                <Text style={styles.modalTitle}>
                  Transférer l'administration
                </Text>
                <Text style={styles.modalDescription}>
                  Vous êtes le dernier administrateur. Sélectionnez un membre à
                  qui transférer l'administration, ou le groupe sera supprimé.
                </Text>
              </View>
              <ScrollView
                style={styles.membersList}
                showsVerticalScrollIndicator={false}
              >
                {nonAdminMembers.length === 0 ? (
                  <View style={styles.emptyMembersContainer}>
                    <Ionicons
                      name="people-outline"
                      size={48}
                      color={withOpacity(colors.text.light, 0.3)}
                    />
                    <Text style={styles.emptyMembersText}>
                      Aucun membre disponible
                    </Text>
                  </View>
                ) : (
                  nonAdminMembers.map((member, index) => (
                    <AnimatedTouchableOpacity
                      key={member.id}
                      style={styles.memberSelectItem}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        handleTransferAndLeave(member.user_id);
                      }}
                      activeOpacity={0.7}
                      entering={FadeInDown.delay(index * 50).duration(300)}
                    >
                      <Avatar
                        uri={member.avatar_url}
                        name={member.display_name}
                        size={50}
                        showOnlineBadge={false}
                      />
                      <View style={styles.memberSelectInfo}>
                        <Text style={styles.memberSelectName}>
                          {member.display_name}
                        </Text>
                        {member.username && (
                          <Text style={styles.memberSelectUsername}>
                            {formatUsername(member.username)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.memberSelectArrow}>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={withOpacity(colors.secondary.light, 0.7)}
                        />
                      </View>
                    </AnimatedTouchableOpacity>
                  ))
                )}
              </ScrollView>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButtonCancel}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowTransferAdminModal(false);
                    Alert.alert(
                      "Attention",
                      "Si vous quittez sans transférer l'administration, le groupe sera supprimé.",
                      [
                        { text: "Annuler", style: "cancel" },
                        {
                          text: "Quitter quand même",
                          style: "destructive",
                          onPress: () => {
                            setShowTransferAdminModal(false);
                            setShowLeaveModal(true);
                          },
                        },
                      ],
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalButtonCancelText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </AnimatedView>
        </View>
      </Modal>
    );
  };

  const renderAddMemberModal = () => (
    <Modal
      visible={showAddMemberModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowAddMemberModal(false)}
    >
      <View style={styles.modalOverlay}>
        <AnimatedView
          style={styles.modalContainerLarge}
          entering={FadeInDown.duration(300).springify()}
        >
          <LinearGradient
            colors={colors.background.gradient.app}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalGradient}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <LinearGradient
                  colors={[colors.primary.main, colors.secondary.main]}
                  style={styles.modalIconGradient}
                >
                  <Ionicons
                    name="person-add"
                    size={28}
                    color={colors.text.light}
                  />
                </LinearGradient>
              </View>
              <Text style={styles.modalTitle}>Ajouter un membre</Text>
              <Text style={styles.modalDescription}>
                Sélectionnez un contact à ajouter au groupe.
              </Text>
            </View>
            <View
              style={[
                styles.pickerSearchContainer,
                {
                  backgroundColor: withOpacity(colors.background.darkCard, 0.8),
                },
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color={withOpacity(colors.text.light, 0.6)}
              />
              <TextInput
                style={[styles.pickerSearchInput, { color: colors.text.light }]}
                placeholder="Rechercher un contact"
                placeholderTextColor={withOpacity(colors.text.light, 0.4)}
                value={contactSearch}
                onChangeText={setContactSearch}
              />
            </View>
            {loadingContacts ? (
              <View style={styles.pickerLoading}>
                <ActivityIndicator size="large" color={colors.primary.main} />
              </View>
            ) : (
              <FlatList
                data={pickerContacts}
                keyExtractor={(item) => item.id}
                style={styles.pickerList}
                ListEmptyComponent={
                  <Text style={styles.pickerEmptyText}>
                    Aucun contact disponible
                  </Text>
                }
                renderItem={({ item }) => {
                  const user = item.contact_user;
                  const displayName =
                    item.nickname ||
                    user?.first_name ||
                    user?.username ||
                    "Contact";
                  return (
                    <TouchableOpacity
                      style={styles.pickerItem}
                      onPress={() => handlePickContact(item)}
                      disabled={addingMember}
                      activeOpacity={0.7}
                    >
                      <Avatar
                        uri={user?.avatar_url}
                        name={displayName}
                        size={44}
                        showOnlineBadge={false}
                      />
                      <View style={styles.pickerItemInfo}>
                        <Text style={styles.pickerItemName}>{displayName}</Text>
                        {user?.username && (
                          <Text style={styles.pickerItemUsername}>
                            {formatUsername(user.username)}
                          </Text>
                        )}
                      </View>
                      {addingMember ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary.main}
                        />
                      ) : (
                        <Ionicons
                          name="add-circle"
                          size={26}
                          color={colors.primary.main}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowAddMemberModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonCancelText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </AnimatedView>
      </View>
    </Modal>
  );

  const renderMemberActionsModal = () => {
    const member = memberActionFor;
    if (!member) return null;
    const isSelf = member.user_id === CURRENT_USER_ID;

    return (
      <Modal
        visible={!!memberActionFor}
        transparent
        animationType="fade"
        onRequestClose={() => setMemberActionFor(null)}
      >
        <View style={styles.modalOverlay}>
          <AnimatedView
            style={styles.modalContainer}
            entering={FadeInDown.duration(250).springify()}
          >
            <LinearGradient
              colors={colors.background.gradient.app}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Avatar
                  uri={member.avatar_url}
                  name={member.display_name}
                  size={56}
                  showOnlineBadge={false}
                />
                <Text style={[styles.modalTitle, { marginTop: 12 }]}>
                  {member.display_name}
                </Text>
                <Text style={styles.modalDescription}>
                  {member.role === "admin"
                    ? "Administrateur"
                    : member.role === "moderator"
                      ? "Modérateur"
                      : "Membre"}
                </Text>
              </View>

              {memberActionLoading && (
                <ActivityIndicator
                  size="small"
                  color={colors.primary.main}
                  style={{ marginBottom: 12 }}
                />
              )}

              {member.role !== "admin" && !isSelf && (
                <TouchableOpacity
                  style={styles.memberActionRow}
                  onPress={() => handleChangeRole(member, "admin")}
                  disabled={memberActionLoading}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={20}
                    color={colors.primary.main}
                  />
                  <Text style={styles.memberActionRowText}>
                    Promouvoir en admin
                  </Text>
                </TouchableOpacity>
              )}

              {member.role === "admin" && !isSelf && (
                <TouchableOpacity
                  style={styles.memberActionRow}
                  onPress={() => handleChangeRole(member, "member")}
                  disabled={memberActionLoading}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="arrow-down-circle"
                    size={20}
                    color={colors.secondary.main}
                  />
                  <Text style={styles.memberActionRowText}>
                    Rétrograder en membre
                  </Text>
                </TouchableOpacity>
              )}

              {!isSelf && (
                <TouchableOpacity
                  style={styles.memberActionRow}
                  onPress={() => handleRemoveMember(member)}
                  disabled={memberActionLoading}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="person-remove"
                    size={20}
                    color={colors.ui.error}
                  />
                  <Text
                    style={[
                      styles.memberActionRowText,
                      { color: colors.ui.error },
                    ]}
                  >
                    Retirer du groupe
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButtonCancel}
                  onPress={() => setMemberActionFor(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalButtonCancelText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </AnimatedView>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <LinearGradient
        colors={colors.background.gradient.app}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.container} edges={["top"]}>
          {renderHeader()}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        {renderHeader()}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary.main}
              colors={[colors.primary.main]}
            />
          }
        >
          {renderGroupInfo()}
          {renderTabs()}
          <View style={styles.contentContainer}>{renderContent()}</View>
        </ScrollView>
        {renderLeaveModal()}
        {renderDeleteModal()}
        {renderTransferAdminModal()}
        {renderAddMemberModal()}
        {renderMemberActionsModal()}
      </SafeAreaView>
    </LinearGradient>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  manageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  manageButtonGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  groupInfoSection: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  groupPhotoContainer: {
    marginBottom: 16,
  },
  groupPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  groupPhotoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  groupName: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 8,
    textAlign: "center",
  },
  groupDescription: {
    fontSize: typography.fontSize.base,
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: typography.fontSize.base * 1.5,
  },
  tabsContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  tabLabel: {
    fontSize: typography.fontSize.sm,
  },
  contentContainer: {
    padding: 16,
  },
  infoCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  infoRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoLabel: {
    fontSize: typography.fontSize.base,
  },
  infoValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
  },
  membersCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  membersHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  memberName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  roleBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  memberUsername: {
    fontSize: typography.fontSize.sm,
    marginBottom: 4,
  },
  memberJoined: {
    fontSize: typography.fontSize.xs,
  },
  statsCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: "30%",
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    textAlign: "center",
  },
  historyCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  logItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  logIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  logContent: {
    flex: 1,
  },
  logAction: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
    marginBottom: 4,
  },
  logActor: {
    fontSize: typography.fontSize.sm,
    marginBottom: 4,
  },
  logTime: {
    fontSize: typography.fontSize.xs,
  },
  settingsCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  settingsSection: {
    marginBottom: 16,
  },
  settingsSectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: typography.fontSize.base,
  },
  settingValue: {
    fontSize: typography.fontSize.sm,
  },
  toggleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  toggleBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  emptyState: {
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    marginTop: 16,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: withOpacity(colors.background.darkCard, 0.3),
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(colors.ui.divider, 0.1),
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
  },
  actionIconContainerDanger: {
    // Style spécifique pour le danger
  },
  actionIconGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text.light,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    overflow: "hidden",
    boxShadow: "0px 10px 25px rgba(0, 0, 0, 0.5)",
    elevation: 15,
    borderWidth: 1,
    borderColor: withOpacity(colors.primary.main, 0.2),
  },
  modalContainerLarge: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    borderRadius: 24,
    overflow: "hidden",
    boxShadow: "0px 10px 25px rgba(0, 0, 0, 0.5)",
    elevation: 15,
    borderWidth: 1,
    borderColor: withOpacity(colors.secondary.main, 0.2),
  },
  modalGradient: {
    padding: 28,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 16,
    overflow: "hidden",
  },
  modalIconContainerDanger: {
    // Style spécifique pour le danger
  },
  modalIconContainerInfo: {
    // Style spécifique pour l'info
  },
  modalIconGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.light,
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  modalDescription: {
    fontSize: typography.fontSize.md,
    color: withOpacity(colors.text.light, 0.75),
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withOpacity(colors.background.dark, 0.4),
    borderWidth: 1.5,
    borderColor: withOpacity(colors.ui.divider, 0.3),
  },
  modalButtonConfirm: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: `0px 4px 8px ${withOpacity(colors.primary.main, 0.3)}`,
    elevation: 5,
  },
  modalButtonDelete: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: `0px 4px 8px ${withOpacity(colors.ui.error, 0.3)}`,
    elevation: 5,
  },
  modalButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  modalButtonIcon: {
    marginRight: 4,
  },
  modalButtonCancelText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
    color: withOpacity(colors.text.light, 0.9),
    letterSpacing: 0.3,
  },
  modalButtonConfirmText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.light,
    letterSpacing: 0.3,
  },
  modalButtonDeleteText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.light,
    letterSpacing: 0.3,
  },
  membersList: {
    maxHeight: 320,
    marginBottom: 20,
  },
  memberSelectItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: withOpacity(colors.background.dark, 0.3),
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: withOpacity(colors.secondary.main, 0.2),
  },
  memberSelectInfo: {
    flex: 1,
    marginLeft: 14,
  },
  memberSelectName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text.light,
    marginBottom: 4,
  },
  memberSelectUsername: {
    fontSize: typography.fontSize.sm,
    color: withOpacity(colors.text.light, 0.65),
    fontWeight: typography.fontWeight.regular,
  },
  memberSelectArrow: {
    marginLeft: 8,
  },
  emptyMembersContainer: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyMembersText: {
    fontSize: typography.fontSize.md,
    color: withOpacity(colors.text.light, 0.5),
    marginTop: 16,
    fontWeight: typography.fontWeight.medium,
  },
  addMemberButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  addMemberIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  addMemberText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
  },
  memberActionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 4,
  },
  pickerSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    padding: 0,
  },
  pickerList: {
    maxHeight: 320,
    marginBottom: 12,
  },
  pickerLoading: {
    paddingVertical: 32,
    alignItems: "center",
  },
  pickerEmptyText: {
    textAlign: "center",
    paddingVertical: 24,
    color: withOpacity(colors.text.light, 0.6),
    fontSize: typography.fontSize.sm,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: withOpacity(colors.background.dark, 0.3),
  },
  pickerItemInfo: {
    flex: 1,
  },
  pickerItemName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text.light,
  },
  pickerItemUsername: {
    fontSize: typography.fontSize.sm,
    color: withOpacity(colors.text.light, 0.6),
    marginTop: 2,
  },
  memberActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: withOpacity(colors.background.dark, 0.3),
    marginBottom: 8,
  },
  memberActionRowText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text.light,
  },
});
