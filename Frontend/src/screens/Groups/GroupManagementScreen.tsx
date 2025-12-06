/**
 * GroupManagementScreen - Écran de gestion de groupe
 * WHISPR-213: Gestion de groupe (ajout/suppression membres, transfert admin, modification infos)
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  TextInput,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  FadeIn,
  FadeInDown,
  SlideInRight,
  SlideOutRight,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { colors, withOpacity } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Avatar } from '../../components/Chat/Avatar';
import { logger } from '../../utils/logger';
import { groupsAPI, GroupDetails, GroupMember } from '../../services/groups/api';
import { contactsAPI, Contact } from '../../services/contacts/api';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedView = Animated.createAnimatedComponent(View);

type GroupManagementScreenRouteProp = StackScreenProps<AuthStackParamList, 'GroupManagement'>['route'];

const CURRENT_USER_ID = 'user-1';

export const GroupManagementScreen: React.FC = () => {
  const route = useRoute<GroupManagementScreenRouteProp>();
  const navigation = useNavigation();
  const { groupId, conversationId } = route.params;

  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const headerOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.95);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 300 });
    contentScale.value = withSpring(1, { damping: 15, stiffness: 150 });
  }, []);

  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);
      const [details, membersData] = await Promise.all([
        groupsAPI.getGroupDetails(groupId, conversationId),
        groupsAPI.getGroupMembers(groupId),
      ]);

      setGroupDetails(details);
      setMembers(membersData.members);
      setNewName(details.name);
      setNewDescription(details.description || '');
    } catch (error) {
      logger.error('GroupManagementScreen', 'Error loading group data', error);
      Alert.alert('Erreur', 'Impossible de charger les informations du groupe');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, conversationId]);

  useEffect(() => {
    loadGroupData();
  }, [loadGroupData]);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    loadGroupData();
  }, [loadGroupData]);

  const isAdmin = members.find(m => m.user_id === CURRENT_USER_ID)?.role === 'admin';

  const handleEditName = useCallback(() => {
    if (!isAdmin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingName(true);
  }, [isAdmin]);

  const handleSaveName = useCallback(async () => {
    if (!newName.trim() || !isAdmin) return;
    
    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const updated = await groupsAPI.updateGroup(groupId, { name: newName.trim() });
      setGroupDetails(updated);
      setEditingName(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      logger.error('GroupManagementScreen', 'Error updating group name', error);
      Alert.alert('Erreur', 'Impossible de modifier le nom du groupe');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [groupId, newName, isAdmin]);

  const handleEditDescription = useCallback(() => {
    if (!isAdmin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingDescription(true);
  }, [isAdmin]);

  const handleSaveDescription = useCallback(async () => {
    if (!isAdmin) return;
    
    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const updated = await groupsAPI.updateGroup(groupId, { description: newDescription.trim() || undefined });
      setGroupDetails(updated);
      setEditingDescription(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      logger.error('GroupManagementScreen', 'Error updating group description', error);
      Alert.alert('Erreur', 'Impossible de modifier la description du groupe');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [groupId, newDescription, isAdmin]);

  const handleChangePhoto = useCallback(async () => {
    if (!isAdmin) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Alert.alert(
      'Changer la photo',
      'Choisissez une option',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Galerie',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire');
                return;
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                setSaving(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const updated = await groupsAPI.updateGroup(groupId, { picture_url: result.assets[0].uri });
                setGroupDetails(updated);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              logger.error('GroupManagementScreen', 'Error selecting photo', error);
              Alert.alert('Erreur', 'Impossible de sélectionner la photo');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setSaving(false);
            }
          },
        },
        {
          text: 'Appareil photo',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission requise', 'L\'accès à l\'appareil photo est nécessaire');
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                setSaving(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const updated = await groupsAPI.updateGroup(groupId, { picture_url: result.assets[0].uri });
                setGroupDetails(updated);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              logger.error('GroupManagementScreen', 'Error taking photo', error);
              Alert.alert('Erreur', 'Impossible de prendre la photo');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setSaving(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [groupId, isAdmin]);

  const handleRemoveMember = useCallback((member: GroupMember) => {
    if (!isAdmin || member.user_id === CURRENT_USER_ID) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Retirer le membre',
      `Êtes-vous sûr de vouloir retirer ${member.display_name} du groupe ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await groupsAPI.removeMember(groupId, member.id);
              await loadGroupData();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              logger.error('GroupManagementScreen', 'Error removing member', error);
              Alert.alert('Erreur', 'Impossible de retirer le membre');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }, [groupId, isAdmin, loadGroupData]);

  const handleTransferAdmin = useCallback((member: GroupMember) => {
    // Permettre le transfert même si le membre est déjà admin (pour récupérer les droits)
    if (!isAdmin || member.user_id === CURRENT_USER_ID) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const isTransferringToAdmin = member.role === 'admin';
    const message = isTransferringToAdmin
      ? `Voulez-vous récupérer les droits d'administration depuis ${member.display_name} ?`
      : `Voulez-vous transférer les droits d'administration à ${member.display_name} ? Vous deviendrez membre du groupe.`;
    
    Alert.alert(
      isTransferringToAdmin ? 'Récupérer l\'administration' : 'Transférer l\'administration',
      message,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: isTransferringToAdmin ? 'Récupérer' : 'Transférer',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await groupsAPI.transferAdmin(groupId, member.user_id);
              await loadGroupData();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Succès', isTransferringToAdmin ? 'Vous avez récupéré les droits d\'administration' : 'L\'administration a été transférée avec succès');
            } catch (error) {
              logger.error('GroupManagementScreen', 'Error transferring admin', error);
              Alert.alert('Erreur', 'Impossible de transférer l\'administration');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }, [groupId, isAdmin, loadGroupData]);

  const handleAddMembers = useCallback(() => {
    if (!isAdmin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowAddMembersModal(true);
    loadAvailableContacts();
  }, [isAdmin]);

  const loadAvailableContacts = useCallback(async () => {
    try {
      setLoadingContacts(true);
      const result = await contactsAPI.getContacts();
      const memberUserIds = new Set(members.map(m => m.user_id));
      const available = result.contacts.filter(c => {
        const userId = c.contact_user?.id;
        return userId && !memberUserIds.has(userId);
      });
      setAvailableContacts(available);
    } catch (error) {
      logger.error('GroupManagementScreen', 'Error loading contacts', error);
      Alert.alert('Erreur', 'Impossible de charger les contacts');
    } finally {
      setLoadingContacts(false);
    }
  }, [members]);

  const toggleContactSelection = useCallback((contactId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        if (members.length + next.size >= 50) {
          Alert.alert('Limite atteinte', 'Un groupe ne peut pas contenir plus de 50 membres');
          return prev;
        }
        next.add(contactId);
      }
      return next;
    });
  }, [members.length]);

  const handleConfirmAddMembers = useCallback(async () => {
    if (selectedContacts.size === 0) {
      setShowAddMembersModal(false);
      return;
    }

    try {
      setAddingMembers(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const userIds = Array.from(selectedContacts).map(contactId => {
        const contact = availableContacts.find(c => c.id === contactId);
        return contact?.contact_user?.id;
      }).filter(Boolean) as string[];

      if (userIds.length === 0) {
        Alert.alert('Erreur', 'Aucun contact valide sélectionné');
        return;
      }

      const memberInfo = userIds.map(userId => {
        const contact = availableContacts.find(c => c.contact_user?.id === userId);
        return {
          userId,
          displayName: contact?.nickname || contact?.contact_user?.first_name || `User ${userId}`,
          username: contact?.contact_user?.username,
          avatarUrl: contact?.contact_user?.profile_picture,
        };
      });

      await groupsAPI.addMembers(groupId, userIds, memberInfo);
      await loadGroupData();
      setSelectedContacts(new Set());
      setShowAddMembersModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      logger.error('GroupManagementScreen', 'Error adding members', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter les membres');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAddingMembers(false);
    }
  }, [selectedContacts, availableContacts, groupId, loadGroupData]);

  const filteredContacts = React.useMemo(() => {
    if (!searchQuery.trim()) return availableContacts;
    
    const query = searchQuery.toLowerCase();
    return availableContacts.filter(contact => {
      const user = contact.contact_user;
      if (!user) return false;
      
      const nickname = contact.nickname?.toLowerCase() || '';
      const firstName = user.first_name?.toLowerCase() || '';
      const lastName = user.last_name?.toLowerCase() || '';
      const username = user.username?.toLowerCase() || '';
      
      return (
        nickname.includes(query) ||
        firstName.includes(query) ||
        lastName.includes(query) ||
        username.includes(query) ||
        `${firstName} ${lastName}`.trim().includes(query)
      );
    });
  }, [availableContacts, searchQuery]);

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
  }));

  const renderHeader = () => (
    <Animated.View style={[styles.header, headerAnimatedStyle]} entering={FadeIn.duration(300)}>
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
      <Text style={[styles.headerTitle, { color: colors.text.light }]}>
        Gestion du groupe
      </Text>
      <View style={styles.headerRight} />
    </Animated.View>
  );

  const renderGroupInfo = () => {
    if (!groupDetails) return null;

    return (
      <AnimatedView
        style={[styles.section, contentAnimatedStyle]}
        entering={FadeInDown.delay(100).duration(400)}
      >
        <View style={styles.groupHeader}>
          <TouchableOpacity
            onPress={handleChangePhoto}
            disabled={!isAdmin || saving}
            style={styles.avatarContainer}
            activeOpacity={0.7}
          >
            {groupDetails.picture_url ? (
              <Image source={{ uri: groupDetails.picture_url }} style={styles.groupAvatar} />
            ) : (
              <View style={[styles.groupAvatar, styles.groupAvatarPlaceholder]}>
                <Ionicons name="people" size={40} color={colors.primary.main} />
              </View>
            )}
            {isAdmin && (
              <View style={styles.editPhotoBadge}>
                <Ionicons name="camera" size={16} color={colors.text.light} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.groupInfo}>
            {editingName ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.editInput}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Nom du groupe"
                  placeholderTextColor={withOpacity(colors.text.light, 0.5)}
                  autoFocus
                  maxLength={50}
                />
                <TouchableOpacity
                  onPress={handleSaveName}
                  disabled={saving || !newName.trim()}
                  style={styles.saveButton}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.primary.main} />
                  ) : (
                    <Ionicons name="checkmark" size={20} color={colors.primary.main} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setEditingName(false);
                    setNewName(groupDetails.name);
                  }}
                  style={styles.cancelButton}
                >
                  <Ionicons name="close" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleEditName}
                disabled={!isAdmin}
                style={styles.nameContainer}
                activeOpacity={isAdmin ? 0.7 : 1}
              >
                <Text style={styles.groupName} numberOfLines={1}>
                  {groupDetails.name}
                </Text>
                {isAdmin && (
                  <Ionicons name="pencil" size={16} color={withOpacity(colors.text.light, 0.7)} style={styles.editIcon} />
                )}
              </TouchableOpacity>
            )}

            {editingDescription ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={[styles.editInput, styles.descriptionInput]}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder="Description (optionnelle)"
                  placeholderTextColor={withOpacity(colors.text.light, 0.5)}
                  multiline
                  maxLength={200}
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    onPress={handleSaveDescription}
                    disabled={saving}
                    style={styles.saveButton}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={colors.primary.main} />
                    ) : (
                      <Ionicons name="checkmark" size={20} color={colors.primary.main} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingDescription(false);
                      setNewDescription(groupDetails.description || '');
                    }}
                    style={styles.cancelButton}
                  >
                    <Ionicons name="close" size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleEditDescription}
                disabled={!isAdmin}
                style={styles.descriptionContainer}
                activeOpacity={isAdmin ? 0.7 : 1}
              >
                <Text style={styles.groupDescription} numberOfLines={2}>
                  {groupDetails.description || 'Aucune description'}
                </Text>
                {isAdmin && (
                  <Ionicons name="pencil" size={14} color={withOpacity(colors.text.light, 0.7)} style={styles.editIcon} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </AnimatedView>
    );
  };

  const renderMembers = () => {
    const currentUserMember = members.find(m => m.user_id === CURRENT_USER_ID);
    const otherMembers = members.filter(m => m.user_id !== CURRENT_USER_ID);
    const hasOtherAdmins = otherMembers.some(m => m.role === 'admin');

    return (
      <AnimatedView
        style={[styles.section, contentAnimatedStyle]}
        entering={FadeInDown.delay(200).duration(400)}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Membres ({members.length})</Text>
          {isAdmin && (
            <TouchableOpacity
              onPress={handleAddMembers}
              style={styles.addButton}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[colors.primary.main, colors.secondary.main]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addButtonGradient}
              >
                <Ionicons name="add" size={20} color={colors.text.light} />
                <Text style={styles.addButtonText}>Ajouter</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {!isAdmin && hasOtherAdmins && (
          <AnimatedView 
            style={styles.infoBanner}
            entering={FadeInDown.delay(250).duration(400)}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.secondary.light} />
            <Text style={styles.infoBannerText}>
              Pour récupérer les droits d'administration, demandez à un administrateur de vous les redonner.
            </Text>
          </AnimatedView>
        )}

        {currentUserMember && (
          <AnimatedView entering={SlideInRight.delay(100)}>
            <View style={styles.memberItem}>
              <Avatar
                userId={currentUserMember.user_id}
                displayName={currentUserMember.display_name}
                avatarUrl={currentUserMember.avatar_url}
                size={50}
              />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{currentUserMember.display_name}</Text>
                <View style={styles.memberRoleBadge}>
                  <Text style={styles.memberRoleText}>
                    {currentUserMember.role === 'admin' ? 'Administrateur' : 'Membre'}
                  </Text>
                </View>
              </View>
              <View style={styles.memberActions}>
                {currentUserMember.role === 'admin' && (
                  <View style={styles.adminBadge}>
                    <Ionicons name="shield-checkmark" size={16} color={colors.primary.main} />
                  </View>
                )}
              </View>
            </View>
          </AnimatedView>
        )}

        {otherMembers.map((member, index) => (
          <AnimatedView key={member.id} entering={SlideInRight.delay(150 + index * 50)}>
            <View style={styles.memberItem}>
              <Avatar
                userId={member.user_id}
                displayName={member.display_name}
                avatarUrl={member.avatar_url}
                size={50}
              />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.display_name}</Text>
                <View style={styles.memberRoleBadge}>
                  <Text style={styles.memberRoleText}>
                    {member.role === 'admin' ? 'Administrateur' : 'Membre'}
                  </Text>
                </View>
              </View>
              {isAdmin && (
                <View style={styles.memberActions}>
                  <TouchableOpacity
                    onPress={() => handleTransferAdmin(member)}
                    style={styles.actionButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={member.role === 'admin' ? "shield" : "shield-outline"} 
                      size={20} 
                      color={member.role === 'admin' ? colors.primary.main : colors.secondary.main} 
                    />
                  </TouchableOpacity>
                  {member.role !== 'admin' && (
                    <TouchableOpacity
                      onPress={() => handleRemoveMember(member)}
                      style={styles.actionButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="person-remove-outline" size={20} color={colors.ui.error} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </AnimatedView>
        ))}
      </AnimatedView>
    );
  };

  const renderAddMembersModal = () => (
    <Modal
      visible={showAddMembersModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        setShowAddMembersModal(false);
        setSelectedContacts(new Set());
        setSearchQuery('');
      }}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top']}>
        <LinearGradient
          colors={colors.background.gradient.app}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View 
          style={styles.modalHeader}
          entering={FadeIn.duration(200)}
        >
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAddMembersModal(false);
              setSelectedContacts(new Set());
              setSearchQuery('');
            }}
            style={styles.modalCloseButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color={colors.text.light} />
          </TouchableOpacity>
          <View style={styles.modalTitleContainer}>
            <Text style={styles.modalTitle} numberOfLines={1}>Ajouter des membres</Text>
          </View>
          <TouchableOpacity
            onPress={handleConfirmAddMembers}
            disabled={selectedContacts.size === 0 || addingMembers}
            style={styles.modalConfirmButton}
            activeOpacity={0.7}
          >
            {addingMembers ? (
              <ActivityIndicator size="small" color={colors.text.light} />
            ) : (
              <Text style={[styles.modalConfirmText, selectedContacts.size === 0 && styles.modalConfirmTextDisabled]}>
                Ajouter ({selectedContacts.size})
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={withOpacity(colors.text.light, 0.7)} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un contact..."
            placeholderTextColor={withOpacity(colors.text.light, 0.5)}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loadingContacts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const isSelected = selectedContacts.has(item.id);
              const user = item.contact_user;
              const displayName = item.nickname || user?.first_name || 'Contact';

              return (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => toggleContactSelection(item.id)}
                  activeOpacity={0.7}
                >
                  <Avatar
                    userId={user?.id || ''}
                    displayName={displayName}
                    avatarUrl={user?.profile_picture}
                    size={50}
                  />
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{displayName}</Text>
                    {user?.username && (
                      <Text style={styles.contactUsername}>@{user.username}</Text>
                    )}
                  </View>
                  <View style={styles.contactCheckbox}>
                    {isSelected ? (
                      <LinearGradient
                        colors={[colors.primary.main, colors.secondary.main]}
                        style={styles.checkboxSelected}
                      >
                        <Ionicons name="checkmark" size={16} color={colors.text.light} />
                      </LinearGradient>
                    ) : (
                      <View style={styles.checkboxUnselected} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color={withOpacity(colors.text.light, 0.3)} />
                <Text style={styles.emptyText}>Aucun contact disponible</Text>
              </View>
            }
            contentContainerStyle={styles.contactsList}
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <LinearGradient colors={colors.background.gradient.app} style={styles.container}>
        <SafeAreaView style={styles.container} edges={['top']}>
          {renderHeader()}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={colors.background.gradient.app} style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary.main}
            />
          }
        >
          {renderGroupInfo()}
          {renderMembers()}
        </ScrollView>
        {renderAddMembersModal()}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withOpacity(colors.background.darkCard, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: withOpacity(colors.background.darkCard, 0.1),
    borderRadius: 16,
    padding: 16,
  },
  groupHeader: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  groupAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: withOpacity(colors.background.darkCard, 0.3),
  },
  groupAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPhotoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background.dark,
  },
  groupInfo: {
    width: '100%',
    alignItems: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.light,
    textAlign: 'center',
  },
  editIcon: {
    marginLeft: 8,
  },
  descriptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  groupDescription: {
    fontSize: typography.fontSize.md,
    color: withOpacity(colors.text.light, 0.7),
    textAlign: 'center',
    flex: 1,
  },
  editContainer: {
    width: '100%',
    marginTop: 8,
  },
  editInput: {
    backgroundColor: withOpacity(colors.background.darkCard, 0.2),
    borderRadius: 12,
    padding: 12,
    color: colors.text.light,
    fontSize: typography.fontSize.base,
    borderWidth: 1,
    borderColor: withOpacity(colors.primary.main, 0.3),
  },
  descriptionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  saveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withOpacity(colors.primary.main, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withOpacity(colors.background.darkCard, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.light,
  },
  addButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  addButtonText: {
    color: colors.text.light,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(colors.ui.divider, 0.1),
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.light,
    marginBottom: 4,
  },
  memberRoleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: withOpacity(colors.secondary.main, 0.2),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  memberRoleText: {
    fontSize: typography.fontSize.xs,
    color: colors.secondary.light,
    fontWeight: typography.fontWeight.medium,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withOpacity(colors.background.darkCard, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withOpacity(colors.primary.main, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 20,
    minHeight: 56,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withOpacity(colors.background.darkCard, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.light,
    textAlign: 'center',
  },
  modalConfirmButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalConfirmText: {
    color: colors.text.light,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
  },
  modalConfirmTextDisabled: {
    opacity: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: withOpacity(colors.background.darkCard, 0.2),
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text.light,
    fontSize: typography.fontSize.base,
  },
  contactsList: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(colors.ui.divider, 0.1),
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.light,
    marginBottom: 2,
  },
  contactUsername: {
    fontSize: typography.fontSize.sm,
    color: withOpacity(colors.text.light, 0.6),
  },
  contactCheckbox: {
    width: 24,
    height: 24,
  },
  checkboxSelected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxUnselected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: withOpacity(colors.text.light, 0.3),
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: typography.fontSize.md,
    color: withOpacity(colors.text.light, 0.5),
    marginTop: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: withOpacity(colors.secondary.main, 0.15),
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: withOpacity(colors.text.light, 0.8),
    lineHeight: 20,
  },
});
