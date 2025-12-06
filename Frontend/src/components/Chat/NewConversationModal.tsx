/**
 * NewConversationModal - Modal for creating new conversations or groups
 * WHISPR-211: Modal selection groupe
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { Contact } from '../../types/contact';
import { contactsAPI } from '../../services/contacts/api';
import { messagingAPI } from '../../services/messaging/api';
import { Avatar } from './Avatar';

interface NewConversationModalProps {
  visible: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
}

type ConversationType = 'direct' | 'group' | null;

export const NewConversationModal: React.FC<NewConversationModalProps> = ({
  visible,
  onClose,
  onConversationCreated,
}) => {
  const [conversationType, setConversationType] = useState<ConversationType>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  // Load contacts when modal opens
  useEffect(() => {
    if (visible && conversationType) {
      loadContacts();
    }
  }, [visible, conversationType]);

  const loadContacts = useCallback(async () => {
    try {
      setLoadingContacts(true);
      const result = await contactsAPI.getContacts();
      setContacts(result.contacts);
    } catch (error) {
      console.error('[NewConversationModal] Error loading contacts:', error);
      Alert.alert('Erreur', 'Impossible de charger les contacts');
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  // Filter contacts by search query
  const filteredContacts = React.useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    
    const query = searchQuery.toLowerCase();
    return contacts.filter(contact => {
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
        username.includes(query)
      );
    });
  }, [contacts, searchQuery]);

  // Handle type selection
  const handleTypeSelect = (type: 'direct' | 'group') => {
    setConversationType(type);
    setSelectedContact(null);
    setSelectedMembers(new Set());
    setGroupName('');
    setGroupDescription('');
    setGroupPhoto(null);
    setSearchQuery('');
  };

  // Handle contact selection for direct conversation
  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
  };

  // Handle member selection for group
  const handleMemberToggle = (contact: Contact) => {
    const userId = contact.contact_user?.id;
    if (!userId) return;

    setSelectedMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        // Limit to 50 members (as per spec)
        if (newSet.size >= 50) {
          Alert.alert('Limite atteinte', 'Un groupe peut contenir au maximum 50 membres');
          return prev;
        }
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Handle group photo selection
  const handleSelectPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire pour sélectionner une photo');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setGroupPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[NewConversationModal] Error selecting photo:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner la photo');
    }
  };

  // Handle take photo
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
        setGroupPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[NewConversationModal] Error taking photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo');
    }
  };

  // Handle create conversation
  const handleCreate = async () => {
    if (conversationType === 'direct') {
      if (!selectedContact) {
        Alert.alert('Contact requis', 'Veuillez sélectionner un contact');
        return;
      }

      try {
        setCreating(true);
        const userId = selectedContact.contact_user?.id;
        if (!userId) {
          throw new Error('Contact invalide');
        }

        // TODO: Replace with real API call
        const conversation = await messagingAPI.createDirectConversation(userId);
        onConversationCreated(conversation.id);
        handleClose();
      } catch (error: any) {
        console.error('[NewConversationModal] Error creating conversation:', error);
        Alert.alert('Erreur', error.message || 'Impossible de créer la conversation');
      } finally {
        setCreating(false);
      }
    } else if (conversationType === 'group') {
      // Validate group name (3-100 characters)
      if (!groupName.trim() || groupName.trim().length < 3) {
        Alert.alert('Nom invalide', 'Le nom du groupe doit contenir entre 3 et 100 caractères');
        return;
      }

      if (groupName.trim().length > 100) {
        Alert.alert('Nom invalide', 'Le nom du groupe ne peut pas dépasser 100 caractères');
        return;
      }

      // Validate at least one member selected
      if (selectedMembers.size === 0) {
        Alert.alert('Membres requis', 'Veuillez sélectionner au moins un membre');
        return;
      }

      try {
        setCreating(true);
        const memberIds = Array.from(selectedMembers);

        // TODO: Replace with real API call
        // For now, we'll create a group conversation directly
        // In production, this should call the groups API first, then create the conversation
        const conversation = await messagingAPI.createGroupConversation(
          groupName.trim(),
          memberIds,
          groupDescription.trim() || undefined,
          groupPhoto || undefined
        );
        
        onConversationCreated(conversation.id);
        handleClose();
      } catch (error: any) {
        console.error('[NewConversationModal] Error creating group:', error);
        Alert.alert('Erreur', error.message || 'Impossible de créer le groupe');
      } finally {
        setCreating(false);
      }
    }
  };

  // Handle close
  const handleClose = () => {
    setConversationType(null);
    setSelectedContact(null);
    setSelectedMembers(new Set());
    setGroupName('');
    setGroupDescription('');
    setGroupPhoto(null);
    setSearchQuery('');
    onClose();
  };

  // Render type selection screen
  const renderTypeSelection = () => (
    <View style={styles.typeSelectionContainer}>
      <Text style={[styles.screenTitle, { color: themeColors.text.primary }]}>
        Nouvelle conversation
      </Text>
      <Text style={[styles.screenSubtitle, { color: themeColors.text.secondary }]}>
        Choisissez le type de conversation
      </Text>

      <View style={styles.typeButtonsContainer}>
        <TouchableOpacity
          style={[styles.typeButton, { backgroundColor: themeColors.background.secondary }]}
          onPress={() => handleTypeSelect('direct')}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={[colors.primary.main, colors.secondary.main]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.typeButtonIcon}
          >
            <Ionicons name="person" size={32} color={colors.text.light} />
          </LinearGradient>
          <Text style={[styles.typeButtonTitle, { color: themeColors.text.primary }]}>
            Conversation directe
          </Text>
          <Text style={[styles.typeButtonSubtitle, { color: themeColors.text.secondary }]}>
            Discuter avec un contact
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeButton, { backgroundColor: themeColors.background.secondary }]}
          onPress={() => handleTypeSelect('group')}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={[colors.secondary.main, colors.primary.main]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.typeButtonIcon}
          >
            <Ionicons name="people" size={32} color={colors.text.light} />
          </LinearGradient>
          <Text style={[styles.typeButtonTitle, { color: themeColors.text.primary }]}>
            Groupe
          </Text>
          <Text style={[styles.typeButtonSubtitle, { color: themeColors.text.secondary }]}>
            Créer un groupe de discussion
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render direct conversation screen
  const renderDirectConversation = () => (
    <View style={styles.contentContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setConversationType(null)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: themeColors.text.primary }]}>
          Nouvelle conversation
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={themeColors.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: themeColors.text.primary }]}
          placeholder="Rechercher un contact..."
          placeholderTextColor={themeColors.text.tertiary}
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
          renderItem={({ item }) => {
            const user = item.contact_user;
            const displayName = item.nickname || user?.first_name || user?.username || 'Contact';
            const isSelected = selectedContact?.id === item.id;

            return (
              <TouchableOpacity
                style={[
                  styles.contactItem,
                  { backgroundColor: themeColors.background.secondary },
                  isSelected && { backgroundColor: colors.primary.main + '20' },
                ]}
                onPress={() => handleContactSelect(item)}
                activeOpacity={0.7}
              >
                <Avatar
                  uri={user?.avatar_url}
                  name={displayName}
                  size={48}
                  showOnlineBadge={false}
                />
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: themeColors.text.primary }]}>
                    {displayName}
                  </Text>
                  {user?.username && (
                    <Text style={[styles.contactUsername, { color: themeColors.text.secondary }]}>
                      @{user.username}
                    </Text>
                  )}
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary.main} />
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>
                Aucun contact trouvé
              </Text>
            </View>
          }
        />
      )}

      {selectedContact && (
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary.main }]}
          onPress={handleCreate}
          disabled={creating}
          activeOpacity={0.8}
        >
          {creating ? (
            <ActivityIndicator color={colors.text.light} />
          ) : (
            <Text style={[styles.createButtonText, { color: colors.text.light }]}>
              Créer la conversation
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  // Render group creation screen
  const renderGroupCreation = () => {
    const selectedContacts = contacts.filter(c => 
      c.contact_user?.id && selectedMembers.has(c.contact_user.id)
    );

    return (
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setConversationType(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: themeColors.text.primary }]}>
            Nouveau groupe
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Group Photo */}
          <View style={styles.photoSection}>
            <TouchableOpacity
              style={styles.photoContainer}
              onPress={handleSelectPhoto}
              activeOpacity={0.7}
            >
              {groupPhoto ? (
                <Image source={{ uri: groupPhoto }} style={styles.groupPhoto} />
              ) : (
                <View style={[styles.photoPlaceholder, { backgroundColor: themeColors.background.secondary }]}>
                  <Ionicons name="camera" size={40} color={themeColors.text.secondary} />
                </View>
              )}
              <View style={[styles.photoOverlay, { backgroundColor: colors.primary.main }]}>
                <Ionicons name="camera" size={20} color={colors.text.light} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.takePhotoButton}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <Text style={[styles.takePhotoText, { color: colors.primary.main }]}>
                Prendre une photo
              </Text>
            </TouchableOpacity>
          </View>

          {/* Group Name */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: themeColors.text.primary }]}>
              Nom du groupe *
            </Text>
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: themeColors.background.secondary,
                  color: themeColors.text.primary,
                  borderColor: groupName.trim().length > 0 && groupName.trim().length < 3
                    ? colors.ui.error
                    : 'transparent',
                },
              ]}
              placeholder="Nom du groupe (3-100 caractères)"
              placeholderTextColor={themeColors.text.tertiary}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={100}
            />
            {groupName.trim().length > 0 && groupName.trim().length < 3 && (
              <Text style={[styles.errorText, { color: colors.ui.error }]}>
                Le nom doit contenir au moins 3 caractères
              </Text>
            )}
            <Text style={[styles.helperText, { color: themeColors.text.secondary }]}>
              {groupName.length}/100
            </Text>
          </View>

          {/* Group Description */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: themeColors.text.primary }]}>
              Description (optionnel)
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { 
                  backgroundColor: themeColors.background.secondary,
                  color: themeColors.text.primary,
                },
              ]}
              placeholder="Description du groupe (max 500 caractères)"
              placeholderTextColor={themeColors.text.tertiary}
              value={groupDescription}
              onChangeText={setGroupDescription}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
            <Text style={[styles.helperText, { color: themeColors.text.secondary }]}>
              {groupDescription.length}/500
            </Text>
          </View>

          {/* Members Selection */}
          <View style={styles.membersSection}>
            <View style={styles.membersHeader}>
              <Text style={[styles.inputLabel, { color: themeColors.text.primary }]}>
                Membres ({selectedMembers.size}/50)
              </Text>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={themeColors.text.secondary} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: themeColors.text.primary }]}
                  placeholder="Rechercher des contacts..."
                  placeholderTextColor={themeColors.text.tertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            {/* Selected Members Preview */}
            {selectedContacts.length > 0 && (
              <View style={styles.selectedMembersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedContacts.map(contact => {
                    const user = contact.contact_user;
                    const displayName = contact.nickname || user?.first_name || user?.username || 'Contact';
                    return (
                      <View key={contact.id} style={styles.selectedMemberChip}>
                        <Avatar
                          uri={user?.avatar_url}
                          name={displayName}
                          size={32}
                          showOnlineBadge={false}
                        />
                        <TouchableOpacity
                          style={styles.removeMemberButton}
                          onPress={() => handleMemberToggle(contact)}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.ui.error} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Contacts List */}
            {loadingContacts ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary.main} />
              </View>
            ) : (
              <FlatList
                data={filteredContacts}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const user = item.contact_user;
                  const userId = user?.id;
                  const displayName = item.nickname || user?.first_name || user?.username || 'Contact';
                  const isSelected = userId ? selectedMembers.has(userId) : false;

                  if (!userId) return null;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.contactItem,
                        { backgroundColor: themeColors.background.secondary },
                        isSelected && { backgroundColor: colors.primary.main + '20' },
                      ]}
                      onPress={() => handleMemberToggle(item)}
                      activeOpacity={0.7}
                    >
                      <Avatar
                        uri={user?.avatar_url}
                        name={displayName}
                        size={48}
                        showOnlineBadge={false}
                      />
                      <View style={styles.contactInfo}>
                        <Text style={[styles.contactName, { color: themeColors.text.primary }]}>
                          {displayName}
                        </Text>
                        {user?.username && (
                          <Text style={[styles.contactUsername, { color: themeColors.text.secondary }]}>
                            @{user.username}
                          </Text>
                        )}
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={24} color={colors.primary.main} />
                      ) : (
                        <View style={[styles.checkbox, { borderColor: themeColors.text.tertiary }]} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>
                      Aucun contact trouvé
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </ScrollView>

        {/* Create Button */}
        <TouchableOpacity
          style={[
            styles.createButton,
            { 
              backgroundColor: 
                groupName.trim().length >= 3 && selectedMembers.size > 0
                  ? colors.primary.main
                  : themeColors.background.tertiary,
            },
          ]}
          onPress={handleCreate}
          disabled={creating || groupName.trim().length < 3 || selectedMembers.size === 0}
          activeOpacity={0.8}
        >
          {creating ? (
            <ActivityIndicator color={colors.text.light} />
          ) : (
            <Text style={[styles.createButtonText, { color: colors.text.light }]}>
              Créer le groupe
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView 
        style={[styles.container, { backgroundColor: themeColors.background.primary }]}
        edges={['top']}
      >
        {!conversationType && renderTypeSelection()}
        {conversationType === 'direct' && renderDirectConversation()}
        {conversationType === 'group' && renderGroupCreation()}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  typeSelectionContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  screenSubtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  typeButtonsContainer: {
    gap: 16,
  },
  typeButton: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  typeButtonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeButtonTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  typeButtonSubtitle: {
    fontSize: 14,
  },
  contentContainer: {
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
  placeholder: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 12,
    position: 'relative',
  },
  groupPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  takePhotoButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  takePhotoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  membersSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  membersHeader: {
    marginBottom: 12,
  },
  selectedMembersContainer: {
    marginBottom: 16,
    paddingVertical: 8,
  },
  selectedMemberChip: {
    marginRight: 8,
    position: 'relative',
  },
  removeMemberButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  contactUsername: {
    fontSize: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  createButton: {
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

