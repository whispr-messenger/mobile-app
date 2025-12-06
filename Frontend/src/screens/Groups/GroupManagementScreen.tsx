/**
 * GroupManagementScreen - Écran de gestion de groupe
 * WHISPR-213
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
  FadeIn,
  FadeInDown,
  SlideInRight,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { colors, withOpacity } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Avatar } from '../../components/Chat/Avatar';
import { logger } from '../../utils/logger';
import { groupsAPI, GroupMember, GroupDetails } from '../../services/groups/api';
import { contactsAPI, Contact } from '../../services/contacts/api';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedModal = Animated.createAnimatedComponent(Modal);

type GroupManagementScreenRouteProp = StackScreenProps<AuthStackParamList, 'GroupManagement'>['route'];

export const GroupManagementScreen: React.FC = () => {
  const route = useRoute<GroupManagementScreenRouteProp>();
  const navigation = useNavigation();
  const { groupId, conversationId } = route.params;

  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showTransferAdminModal, setShowTransferAdminModal] = useState(false);
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [editGroupPhoto, setEditGroupPhoto] = useState<string | null>(null);
  
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);

  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const headerOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.95);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 300 });
    contentScale.value = withSpring(1, { damping: 15, stiffness: 150 });
    loadGroupData();
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
      setEditGroupName(details.name);
      setEditGroupDescription(details.description || '');
      setEditGroupPhoto(details.picture_url || null);
    } catch (error) {
      logger.error('GroupManagementScreen', 'Error loading group data', error);
      Alert.alert('Erreur', 'Impossible de charger les informations du groupe');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, conversationId]);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    loadGroupData();
  }, [loadGroupData]);

  const loadContacts = useCallback(async () => {
    try {
      const result = await contactsAPI.getContacts();
      const existingMemberIds = new Set(members.map(m => m.user_id));
      const availableContacts = result.contacts.filter(
        c => c.contact_user?.id && !existingMemberIds.has(c.contact_user.id)
      );
      setContacts(availableContacts);
    } catch (error) {
      logger.error('GroupManagementScreen', 'Error loading contacts', error);
      Alert.alert('Erreur', 'Impossible de charger les contacts');
    }
  }, [members]);

  const handleAddMembers = useCallback(async () => {
    if (selectedContacts.size === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Aucun contact sélectionné', 'Veuillez sélectionner au moins un contact à ajouter');
      return;
    }

    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const userIds = Array.from(selectedContacts);
      
      for (const userId of userIds) {
        const contact = contacts.find(c => c.contact_user?.id === userId);
        if (contact) {
          const newMember: GroupMember = {
            id: `member-${Date.now()}-${userId}`,
            user_id: userId,
            display_name: contact.display_name || contact.name,
            username: contact.contact_user?.username,
            avatar_url: contact.avatar_url,
            role: 'member',
            joined_at: new Date().toISOString(),
            is_active: true,
          };
          setMembers(prev => [...prev, newMember]);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAddMembersModal(false);
      setSelectedContacts(new Set());
      setSearchQuery('');
      await loadGroupData();
    } catch (error) {
      logger.error('GroupManagementScreen', 'Error adding members', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Impossible d\'ajouter les membres');
    } finally {
      setSaving(false);
    }
  }, [selectedContacts, contacts, loadGroupData]);

  const handleRemoveMember = useCallback((member: GroupMember) => {
    if (member.role === 'admin') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Impossible', 'Vous ne pouvez pas retirer un administrateur. Transférez d\'abord les droits d\'administration.');
      return;
    }

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
              setMembers(prev => prev.filter(m => m.id !== member.id));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await loadGroupData();
            } catch (error) {
              logger.error('GroupManagementScreen', 'Error removing member', error);
              Alert.alert('Erreur', 'Impossible de retirer le membre');
            }
          },
        },
      ]
    );
  }, [loadGroupData]);

  const handleTransferAdmin = useCallback(async () => {
    if (!selectedAdminId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Aucun membre sélectionné', 'Veuillez sélectionner un membre pour lui transférer l\'administration');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Transférer l\'administration',
      'Êtes-vous sûr de vouloir transférer les droits d\'administration ? Vous perdrez vos privilèges d\'administrateur.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Transférer',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              setMembers(prev => prev.map(m => {
                if (m.user_id === selectedAdminId) {
                  return { ...m, role: 'admin' as const };
                }
                if (m.role === 'admin') {
                  return { ...m, role: 'member' as const };
                }
                return m;
              }));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setShowTransferAdminModal(false);
              setSelectedAdminId(null);
              await loadGroupData();
            } catch (error) {
              logger.error('GroupManagementScreen', 'Error transferring admin', error);
              Alert.alert('Erreur', 'Impossible de transférer l\'administration');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }, [selectedAdminId, loadGroupData]);

  const handleSaveGroupChanges = useCallback(async () => {
    if (!editGroupName.trim() || editGroupName.trim().length < 3) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Nom invalide', 'Le nom du groupe doit contenir entre 3 et 100 caractères');
      return;
    }

    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (groupDetails) {
        setGroupDetails({
          ...groupDetails,
          name: editGroupName.trim(),
          description: editGroupDescription.trim() || undefined,
          picture_url: editGroupPhoto || undefined,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowEditGroupModal(false);
      await loadGroupData();
    } catch (error) {
      logger.error('GroupManagementScreen', 'Error saving group changes', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les modifications');
    } finally {
      setSaving(false);
    }
  }, [editGroupName, editGroupDescription, editGroupPhoto, groupDetails, loadGroupData]);

  const handleSelectPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire pour sélectionner une photo');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setEditGroupPhoto(result.assets[0].uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      logger.error('GroupManagementScreen', 'Error selecting photo', error);
      Alert.alert('Erreur', 'Impossible de sélectionner la photo');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'L\'accès à la caméra est nécessaire pour prendre une photo');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setEditGroupPhoto(result.assets[0].uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      logger.error('GroupManagementScreen', 'Error taking photo', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo');
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const searchLower = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(searchLower) ||
      contact.display_name?.toLowerCase().includes(searchLower) ||
      contact.contact_user?.username?.toLowerCase().includes(searchLower)
    );
  });

  const currentUserIsAdmin = members.some(m => m.role === 'admin' && m.display_name === 'Vous');
  const adminMembers = members.filter(m => m.role === 'admin');
  const regularMembers = members.filter(m => m.role !== 'admin');

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
        Gérer le groupe
      </Text>
      <View style={styles.placeholder} />
    </Animated.View>
  );

  const renderActionButton = (
    icon: string,
    label: string,
    onPress: () => void,
    color: string = colors.primary.main,
    disabled: boolean = false
  ) => (
    <AnimatedTouchableOpacity
      style={[
        styles.actionButton,
        { backgroundColor: withOpacity(color, 0.2), borderColor: withOpacity(color, 0.3) },
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      entering={FadeInDown.springify()}
    >
      <LinearGradient
        colors={[color, color]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.actionButtonIcon}
      >
        <Ionicons name={icon as any} size={24} color={colors.text.light} />
      </LinearGradient>
      <Text style={[styles.actionButtonLabel, { color: colors.text.light }]}>
        {label}
      </Text>
    </AnimatedTouchableOpacity>
  );

  const renderMemberItem = (member: GroupMember, index: number) => {
    const canRemove = currentUserIsAdmin && member.role !== 'admin' && member.display_name !== 'Vous';
    const canTransfer = currentUserIsAdmin && member.role !== 'admin' && member.display_name !== 'Vous';

    return (
      <Animated.View
        key={member.id}
        style={[styles.memberItem, { backgroundColor: withOpacity(colors.background.darkCard, 0.6) }]}
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
            {member.role === 'admin' && (
              <View style={[styles.roleBadge, { backgroundColor: colors.primary.main }]}>
                <Ionicons name="shield-checkmark" size={12} color={colors.text.light} />
                <Text style={[styles.roleBadgeText, { color: colors.text.light }]}>Admin</Text>
              </View>
            )}
            {member.role === 'moderator' && (
              <View style={[styles.roleBadge, { backgroundColor: colors.secondary.main }]}>
                <Ionicons name="shield" size={12} color={colors.text.light} />
                <Text style={[styles.roleBadgeText, { color: colors.text.light }]}>Modo</Text>
              </View>
            )}
          </View>
          {member.username && (
            <Text style={[styles.memberUsername, { color: withOpacity(colors.text.light, 0.7) }]}>
              @{member.username}
            </Text>
          )}
        </View>
        {canRemove && (
          <TouchableOpacity
            onPress={() => handleRemoveMember(member)}
            style={styles.memberActionButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={24} color={colors.ui.error} />
          </TouchableOpacity>
        )}
        {canTransfer && (
          <TouchableOpacity
            onPress={() => {
              setSelectedAdminId(member.user_id);
              setShowTransferAdminModal(true);
            }}
            style={styles.memberActionButton}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary.main} />
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  const renderAddMembersModal = () => (
    <Modal
      visible={showAddMembersModal}
      transparent
      animationType="none"
      onRequestClose={() => {
        setShowAddMembersModal(false);
        setSelectedContacts(new Set());
        setSearchQuery('');
      }}
    >
      <Animated.View
        style={styles.modalOverlay}
        entering={FadeIn.duration(200)}
        exiting={FadeIn.duration(200).reverse()}
      >
        <Animated.View
          style={[styles.modalContent, { backgroundColor: colors.background.darkCard }]}
          entering={SlideInDown.springify()}
          exiting={SlideOutDown.springify()}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text.light }]}>
              Ajouter des membres
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddMembersModal(false);
                setSelectedContacts(new Set());
                setSearchQuery('');
              }}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.text.light} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchContainer, { backgroundColor: withOpacity(colors.background.darkCard, 0.8) }]}>
            <Ionicons name="search" size={20} color={withOpacity(colors.text.light, 0.7)} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text.light }]}
              placeholder="Rechercher un contact..."
              placeholderTextColor={withOpacity(colors.text.light, 0.5)}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item.contact_user?.id || item.id}
            renderItem={({ item, index }) => {
              const isSelected = item.contact_user?.id && selectedContacts.has(item.contact_user.id);
              return (
                <AnimatedTouchableOpacity
                  style={[
                    styles.contactItem,
                    { backgroundColor: withOpacity(colors.background.darkCard, 0.6) },
                    isSelected && { backgroundColor: withOpacity(colors.primary.main, 0.3) },
                  ]}
                  onPress={() => {
                    if (item.contact_user?.id) {
                      setSelectedContacts(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(item.contact_user!.id!)) {
                          newSet.delete(item.contact_user!.id!);
                        } else {
                          newSet.add(item.contact_user!.id!);
                        }
                        return newSet;
                      });
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  activeOpacity={0.7}
                  entering={FadeInDown.delay(100 + index * 30).springify()}
                >
                  <Avatar
                    uri={item.avatar_url}
                    name={item.display_name || item.name}
                    size={40}
                    showOnlineBadge={false}
                  />
                  <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, { color: colors.text.light }]}>
                      {item.display_name || item.name}
                    </Text>
                    {item.contact_user?.username && (
                      <Text style={[styles.contactUsername, { color: withOpacity(colors.text.light, 0.7) }]}>
                        @{item.contact_user.username}
                      </Text>
                    )}
                  </View>
                  {isSelected && (
                    <View style={[styles.checkbox, { backgroundColor: colors.primary.main }]}>
                      <Ionicons name="checkmark" size={16} color={colors.text.light} />
                    </View>
                  )}
                </AnimatedTouchableOpacity>
              );
            }}
            style={styles.contactsList}
            contentContainerStyle={styles.contactsListContent}
          />

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: withOpacity(colors.background.tertiary, 0.3) }]}
              onPress={() => {
                setShowAddMembersModal(false);
                setSelectedContacts(new Set());
                setSearchQuery('');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text.light }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: selectedContacts.size > 0 ? colors.primary.main : colors.background.tertiary },
              ]}
              onPress={handleAddMembers}
              disabled={selectedContacts.size === 0 || saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color={colors.text.light} size="small" />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.text.light }]}>
                  Ajouter ({selectedContacts.size})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );

  const renderEditGroupModal = () => (
    <Modal
      visible={showEditGroupModal}
      transparent
      animationType="none"
      onRequestClose={() => setShowEditGroupModal(false)}
    >
      <Animated.View
        style={styles.modalOverlay}
        entering={FadeIn.duration(200)}
        exiting={FadeIn.duration(200).reverse()}
      >
        <Animated.View
          style={[styles.modalContent, styles.editGroupModalContent, { backgroundColor: colors.background.darkCard }]}
          entering={SlideInDown.springify()}
          exiting={SlideOutDown.springify()}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text.light }]}>
              Modifier le groupe
            </Text>
            <TouchableOpacity
              onPress={() => setShowEditGroupModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.text.light} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editGroupScroll} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={styles.photoSelector}
              onPress={() => {
                Alert.alert(
                  'Photo du groupe',
                  'Choisir une option',
                  [
                    { text: 'Galerie', onPress: handleSelectPhoto },
                    { text: 'Caméra', onPress: handleTakePhoto },
                    { text: 'Annuler', style: 'cancel' },
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              {editGroupPhoto ? (
                <Image source={{ uri: editGroupPhoto }} style={styles.groupPhotoPreview} />
              ) : (
                <View style={[styles.groupPhotoPlaceholder, { backgroundColor: withOpacity(colors.background.tertiary, 0.3) }]}>
                  <Ionicons name="camera" size={32} color={withOpacity(colors.text.light, 0.7)} />
                </View>
              )}
              <View style={[styles.photoEditBadge, { backgroundColor: colors.primary.main }]}>
                <Ionicons name="pencil" size={16} color={colors.text.light} />
              </View>
            </TouchableOpacity>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: withOpacity(colors.text.light, 0.7) }]}>
                Nom du groupe
              </Text>
              <TextInput
                style={[styles.input, { color: colors.text.light, borderColor: withOpacity(colors.ui.divider, 0.3) }]}
                placeholder="Nom du groupe"
                placeholderTextColor={withOpacity(colors.text.light, 0.5)}
                value={editGroupName}
                onChangeText={setEditGroupName}
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: withOpacity(colors.text.light, 0.7) }]}>
                Description (optionnel)
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  { color: colors.text.light, borderColor: withOpacity(colors.ui.divider, 0.3) },
                ]}
                placeholder="Description du groupe"
                placeholderTextColor={withOpacity(colors.text.light, 0.5)}
                value={editGroupDescription}
                onChangeText={setEditGroupDescription}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: withOpacity(colors.background.tertiary, 0.3) }]}
              onPress={() => setShowEditGroupModal(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text.light }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: editGroupName.trim().length >= 3 ? colors.primary.main : colors.background.tertiary },
              ]}
              onPress={handleSaveGroupChanges}
              disabled={editGroupName.trim().length < 3 || saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color={colors.text.light} size="small" />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.text.light }]}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );

  const renderTransferAdminModal = () => {
    const eligibleMembers = members.filter(m => m.role !== 'admin' && m.display_name !== 'Vous');

    return (
      <Modal
        visible={showTransferAdminModal}
        transparent
        animationType="none"
        onRequestClose={() => {
          setShowTransferAdminModal(false);
          setSelectedAdminId(null);
        }}
      >
        <Animated.View
          style={styles.modalOverlay}
          entering={FadeIn.duration(200)}
          exiting={FadeIn.duration(200).reverse()}
        >
          <Animated.View
            style={[styles.modalContent, { backgroundColor: colors.background.darkCard }]}
            entering={SlideInDown.springify()}
            exiting={SlideOutDown.springify()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.light }]}>
                Transférer l'administration
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowTransferAdminModal(false);
                  setSelectedAdminId(null);
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text.light} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDescription, { color: withOpacity(colors.text.light, 0.7) }]}>
              Sélectionnez un membre pour lui transférer les droits d'administration. Vous perdrez vos privilèges d'administrateur.
            </Text>

            <FlatList
              data={eligibleMembers}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => {
                const isSelected = selectedAdminId === item.user_id;
                return (
                  <AnimatedTouchableOpacity
                    style={[
                      styles.contactItem,
                      { backgroundColor: withOpacity(colors.background.darkCard, 0.6) },
                      isSelected && { backgroundColor: withOpacity(colors.primary.main, 0.3) },
                    ]}
                    onPress={() => {
                      setSelectedAdminId(item.user_id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.7}
                    entering={FadeInDown.delay(100 + index * 30).springify()}
                  >
                    <Avatar
                      uri={item.avatar_url}
                      name={item.display_name}
                      size={40}
                      showOnlineBadge={false}
                    />
                    <View style={styles.contactInfo}>
                      <Text style={[styles.contactName, { color: colors.text.light }]}>
                        {item.display_name}
                      </Text>
                      {item.username && (
                        <Text style={[styles.contactUsername, { color: withOpacity(colors.text.light, 0.7) }]}>
                          @{item.username}
                        </Text>
                      )}
                    </View>
                    {isSelected && (
                      <View style={[styles.checkbox, { backgroundColor: colors.primary.main }]}>
                        <Ionicons name="checkmark" size={16} color={colors.text.light} />
                      </View>
                    )}
                  </AnimatedTouchableOpacity>
                );
              }}
              style={styles.contactsList}
              contentContainerStyle={styles.contactsListContent}
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: withOpacity(colors.background.tertiary, 0.3) }]}
                onPress={() => {
                  setShowTransferAdminModal(false);
                  setSelectedAdminId(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text.light }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: selectedAdminId ? colors.primary.main : colors.background.tertiary },
                ]}
                onPress={handleTransferAdmin}
                disabled={!selectedAdminId || saving}
                activeOpacity={0.7}
              >
                {saving ? (
                  <ActivityIndicator color={colors.text.light} size="small" />
                ) : (
                  <Text style={[styles.saveButtonText, { color: colors.text.light }]}>Transférer</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
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
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
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
          <Animated.View style={contentAnimatedStyle}>
            <View style={styles.contentContainer}>
              {currentUserIsAdmin && (
                <View style={styles.actionsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text.light }]}>
                    Actions d'administration
                  </Text>
                  <View style={styles.actionsGrid}>
                    {renderActionButton(
                      'person-add',
                      'Ajouter des membres',
                      () => {
                        loadContacts();
                        setShowAddMembersModal(true);
                      },
                      colors.primary.main
                    )}
                    {renderActionButton(
                      'create',
                      'Modifier le groupe',
                      () => setShowEditGroupModal(true),
                      colors.secondary.main
                    )}
                    {renderActionButton(
                      'shield-checkmark',
                      'Transférer admin',
                      () => setShowTransferAdminModal(true),
                      colors.ui.warning,
                      adminMembers.length === 1
                    )}
                  </View>
                </View>
              )}

              <View style={styles.membersSection}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text.light }]}>
                    Administrateurs ({adminMembers.length})
                  </Text>
                </View>
                {adminMembers.map((member, index) => renderMemberItem(member, index))}
              </View>

              <View style={styles.membersSection}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text.light }]}>
                    Membres ({regularMembers.length})
                  </Text>
                </View>
                {regularMembers.length > 0 ? (
                  regularMembers.map((member, index) => renderMemberItem(member, adminMembers.length + index))
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={48} color={withOpacity(colors.text.light, 0.5)} />
                    <Text style={[styles.emptyText, { color: withOpacity(colors.text.light, 0.7) }]}>
                      Aucun membre
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {renderAddMembersModal()}
      {renderEditGroupModal()}
      {renderTransferAdminModal()}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
    flex: 1,
  },
  membersSection: {
    marginBottom: 32,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  memberName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
  },
  memberUsername: {
    fontSize: typography.fontSize.sm,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  roleBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  memberActionButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 32,
  },
  editGroupModalContent: {
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
  },
  modalDescription: {
    fontSize: typography.fontSize.base,
    paddingHorizontal: 16,
    paddingVertical: 12,
    lineHeight: typography.fontSize.base * 1.5,
  },
  closeButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
  },
  contactsList: {
    maxHeight: 400,
  },
  contactsListContent: {
    paddingHorizontal: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
    marginBottom: 4,
  },
  contactUsername: {
    fontSize: typography.fontSize.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
  },
  editGroupScroll: {
    paddingHorizontal: 16,
  },
  photoSelector: {
    alignSelf: 'center',
    marginVertical: 24,
    position: 'relative',
  },
  groupPhotoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  groupPhotoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background.darkCard,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: typography.fontSize.base,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: typography.fontSize.base,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});

