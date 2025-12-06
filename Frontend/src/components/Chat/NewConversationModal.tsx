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
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { colors, withOpacity } from '../../theme/colors';
import { typography, textStyles } from '../../theme/typography';
import { Contact } from '../../types/contact';
import { contactsAPI } from '../../services/contacts/api';
import { messagingAPI } from '../../services/messaging/api';
import { Avatar } from './Avatar';
import { logger } from '../../utils/logger';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedView = Animated.createAnimatedComponent(View);

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
      logger.error('NewConversationModal', 'Error loading contacts', error);
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

  // Animation values
  const slideAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(1);
  const fadeAnim = useSharedValue(1);

  // Handle type selection with animation and haptics
  const handleTypeSelect = (type: 'direct' | 'group') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    slideAnim.value = withSpring(-300, { damping: 15, stiffness: 150 });
    fadeAnim.value = withTiming(0, { duration: 200 });
    
    setTimeout(() => {
      setConversationType(type);
      setSelectedContact(null);
      setSelectedMembers(new Set());
      setGroupName('');
      setGroupDescription('');
      setGroupPhoto(null);
      setSearchQuery('');
      slideAnim.value = 300;
      fadeAnim.value = 0;
      setTimeout(() => {
        slideAnim.value = withSpring(0, { damping: 15, stiffness: 150 });
        fadeAnim.value = withTiming(1, { duration: 200 });
      }, 50);
    }, 200);
  };

  // Handle contact selection for direct conversation with haptics
  const handleContactSelect = (contact: Contact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedContact(contact);
  };

  // Handle member selection for group with haptics
  const handleMemberToggle = (contact: Contact) => {
    const userId = contact.contact_user?.id;
    if (!userId) return;

    setSelectedMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        newSet.delete(userId);
      } else {
        // Limit to 49 members (50 total with creator included automatically as per spec)
        if (newSet.size >= 49) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Limite atteinte', 'Un groupe peut contenir au maximum 50 membres (créateur inclus)');
          return prev;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Handle group photo selection with haptics
  const handleSelectPhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setGroupPhoto(result.assets[0].uri);
      }
    } catch (error) {
      // Error handled by Alert
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Impossible de sélectionner la photo');
    }
  };

  // Handle take photo with haptics
  const handleTakePhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Permission requise', 'L\'accès à la caméra est nécessaire pour prendre une photo');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setGroupPhoto(result.assets[0].uri);
      }
    } catch (error) {
      // Error handled by Alert
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Impossible de prendre la photo');
    }
  };

  // Handle create conversation with haptics and animations
  const handleCreate = async () => {
    if (conversationType === 'direct') {
      if (!selectedContact) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Contact requis', 'Veuillez sélectionner un contact');
        return;
      }

      try {
        setCreating(true);
        scaleAnim.value = withSequence(
          withTiming(0.95, { duration: 100 }),
          withSpring(1, { damping: 10, stiffness: 200 })
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        const userId = selectedContact.contact_user?.id;
        if (!userId) {
          throw new Error('Contact invalide');
        }

        const conversation = await messagingAPI.createDirectConversation(userId);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onConversationCreated(conversation.id);
        handleClose();
      } catch (error: any) {
        // Error handled by Alert
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Erreur', error.message || 'Impossible de créer la conversation');
      } finally {
        setCreating(false);
      }
    } else if (conversationType === 'group') {
      // Validate group name (3-100 characters)
      if (!groupName.trim() || groupName.trim().length < 3) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Nom invalide', 'Le nom du groupe doit contenir entre 3 et 100 caractères');
        return;
      }

      if (groupName.trim().length > 100) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Nom invalide', 'Le nom du groupe ne peut pas dépasser 100 caractères');
        return;
      }

      // Validate at least one member selected
      if (selectedMembers.size === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Membres requis', 'Veuillez sélectionner au moins un membre');
        return;
      }

      try {
        setCreating(true);
        scaleAnim.value = withSequence(
          withTiming(0.95, { duration: 100 }),
          withSpring(1, { damping: 10, stiffness: 200 })
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        
        const memberIds = Array.from(selectedMembers);

        const conversation = await messagingAPI.createGroupConversation(
          groupName.trim(),
          memberIds,
          groupDescription.trim() || undefined,
          groupPhoto || undefined
        );
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onConversationCreated(conversation.id);
        handleClose();
      } catch (error: any) {
        // Error handled by Alert
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Erreur', error.message || 'Impossible de créer le groupe');
      } finally {
        setCreating(false);
      }
    }
  };

  // Handle close with animation
  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fadeAnim.value = withTiming(0, { duration: 200 });
    setTimeout(() => {
      setConversationType(null);
      setSelectedContact(null);
      setSelectedMembers(new Set());
      setGroupName('');
      setGroupDescription('');
      setGroupPhoto(null);
      setSearchQuery('');
      slideAnim.value = 0;
      fadeAnim.value = 1;
      onClose();
    }, 200);
  };

  // Animated styles
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideAnim.value }],
    opacity: fadeAnim.value,
  }));

  const buttonScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  // Render type selection screen with animations
  const renderTypeSelection = () => (
    <Animated.View 
      style={[styles.typeSelectionContainer, slideStyle]}
      entering={FadeIn.duration(300).springify()}
    >
      <Animated.Text 
        style={[
          styles.screenTitle, 
          { 
            color: colors.text.light,
            fontSize: typography.fontSize.xxxl,
            fontWeight: typography.fontWeight.bold,
            letterSpacing: typography.letterSpacing.tight,
          }
        ]}
        entering={FadeIn.delay(100).duration(400)}
      >
        Nouvelle conversation
      </Animated.Text>
      <Animated.Text 
        style={[
          styles.screenSubtitle, 
          { 
            color: colors.text.secondary,
            fontSize: typography.fontSize.md,
            fontWeight: typography.fontWeight.regular,
          }
        ]}
        entering={FadeIn.delay(200).duration(400)}
      >
        Choisissez le type de conversation
      </Animated.Text>

      <View style={styles.typeButtonsContainer}>
        <AnimatedTouchableOpacity
          style={[
            styles.typeButton, 
            { backgroundColor: colors.background.darkCard },
          ]}
          onPress={() => handleTypeSelect('direct')}
          activeOpacity={0.8}
          entering={FadeIn.delay(300).springify()}
        >
          <LinearGradient
            colors={[colors.primary.main, colors.secondary.main]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.typeButtonIcon}
          >
            <Ionicons name="person" size={32} color={colors.text.light} />
          </LinearGradient>
          <Text style={[
            styles.typeButtonTitle, 
            { 
              color: colors.text.light,
              fontSize: typography.fontSize.xl,
              fontWeight: typography.fontWeight.semiBold,
            }
          ]}>
            Conversation directe
          </Text>
          <Text style={[
            styles.typeButtonSubtitle, 
            { 
              color: colors.text.secondary,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.regular,
            }
          ]}>
            Discuter avec un contact
          </Text>
        </AnimatedTouchableOpacity>

        <AnimatedTouchableOpacity
          style={[
            styles.typeButton, 
            { backgroundColor: colors.background.darkCard },
          ]}
          onPress={() => handleTypeSelect('group')}
          activeOpacity={0.8}
          entering={FadeIn.delay(400).springify()}
        >
          <LinearGradient
            colors={[colors.secondary.main, colors.primary.main]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.typeButtonIcon}
          >
            <Ionicons name="people" size={32} color={colors.text.light} />
          </LinearGradient>
          <Text style={[
            styles.typeButtonTitle, 
            { 
              color: colors.text.light,
              fontSize: typography.fontSize.xl,
              fontWeight: typography.fontWeight.semiBold,
            }
          ]}>
            Groupe
          </Text>
          <Text style={[
            styles.typeButtonSubtitle, 
            { 
              color: colors.text.secondary,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.regular,
            }
          ]}>
            Créer un groupe de discussion
          </Text>
        </AnimatedTouchableOpacity>
      </View>
    </Animated.View>
  );

  // Render direct conversation screen with animations
  const renderDirectConversation = () => (
    <Animated.View 
      style={[styles.contentContainer, slideStyle]}
      entering={SlideInDown.springify()}
    >
      <View style={[styles.header, { borderBottomColor: withOpacity(colors.ui.divider, 0.3) }]}>
        <TouchableOpacity 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setConversationType(null);
          }} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.light} />
        </TouchableOpacity>
        <Text style={[
          styles.screenTitle, 
          { 
            color: colors.text.light,
            fontSize: typography.fontSize.xxl,
            fontWeight: typography.fontWeight.bold,
          }
        ]}>
          Nouvelle conversation
        </Text>
        <View style={styles.placeholder} />
      </View>

      <Animated.View 
        style={[styles.searchContainer, { backgroundColor: withOpacity(colors.background.darkCard, 0.8) }]}
        entering={FadeIn.delay(100).duration(300)}
      >
        <Ionicons name="search" size={20} color={colors.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={[
            styles.searchInput, 
            { 
              color: colors.text.light,
              fontSize: typography.fontSize.base,
              fontWeight: typography.fontWeight.regular,
            }
          ]}
          placeholder="Rechercher un contact..."
          placeholderTextColor={colors.text.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </Animated.View>

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
              <AnimatedTouchableOpacity
                key={item.id}
                style={[
                  styles.contactItem,
                  { backgroundColor: colors.background.darkCard },
                  isSelected && { backgroundColor: withOpacity(colors.primary.main, 0.2) },
                ]}
                onPress={() => handleContactSelect(item)}
                activeOpacity={0.7}
                entering={FadeIn.duration(200)}
              >
                <Avatar
                  uri={user?.avatar_url}
                  name={displayName}
                  size={48}
                  showOnlineBadge={false}
                />
                <View style={styles.contactInfo}>
                  <Text style={[
                    styles.contactName, 
                    { 
                      color: colors.text.light,
                      fontSize: typography.fontSize.base,
                      fontWeight: typography.fontWeight.semiBold,
                    }
                  ]}>
                    {displayName}
                  </Text>
                  {user?.username && (
                    <Text style={[
                      styles.contactUsername, 
                      { 
                        color: colors.text.secondary,
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.regular,
                      }
                    ]}>
                      @{user.username}
                    </Text>
                  )}
                </View>
                {isSelected && (
                  <Animated.View entering={FadeIn.springify()}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary.main} />
                  </Animated.View>
                )}
              </AnimatedTouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                Aucun contact trouvé
              </Text>
            </View>
          }
        />
      )}

      {selectedContact && (
        <AnimatedTouchableOpacity
          style={[
            styles.createButton, 
            { backgroundColor: colors.primary.main },
            buttonScaleStyle,
          ]}
          onPress={handleCreate}
          disabled={creating}
          activeOpacity={0.8}
          entering={FadeIn.delay(200).springify()}
        >
          {creating ? (
            <ActivityIndicator color={colors.text.light} size="small" />
          ) : (
            <Text style={[
              styles.createButtonText, 
              { 
                color: colors.text.light,
                fontSize: typography.fontSize.base,
                fontWeight: typography.fontWeight.semiBold,
              }
            ]}>
              Créer la conversation
            </Text>
          )}
        </AnimatedTouchableOpacity>
      )}
    </Animated.View>
  );

  // Render group creation screen with animations
  const renderGroupCreation = () => {
    const selectedContacts = contacts.filter(c => 
      c.contact_user?.id && selectedMembers.has(c.contact_user.id)
    );

    return (
      <Animated.View 
        style={[styles.contentContainer, slideStyle]}
        entering={SlideInDown.springify()}
      >
        <View style={[styles.header, { borderBottomColor: withOpacity(colors.ui.divider, 0.3) }]}>
          <TouchableOpacity 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setConversationType(null);
            }} 
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.light} />
          </TouchableOpacity>
          <Text style={[
            styles.screenTitle, 
            { 
              color: colors.text.light,
              fontSize: typography.fontSize.xxl,
              fontWeight: typography.fontWeight.bold,
            }
          ]}>
            Nouveau groupe
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Group Photo */}
          <Animated.View 
            style={styles.photoSection}
            entering={FadeIn.delay(100).duration(300)}
          >
            <TouchableOpacity
              style={styles.photoContainer}
              onPress={handleSelectPhoto}
              activeOpacity={0.8}
            >
              {groupPhoto ? (
                <Image source={{ uri: groupPhoto }} style={styles.groupPhoto} />
              ) : (
                <View style={[styles.photoPlaceholder, { backgroundColor: colors.background.darkCard }]}>
                  <Ionicons name="camera" size={40} color={colors.text.secondary} />
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
              <Text style={[
                styles.takePhotoText, 
                { 
                  color: colors.primary.main,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semiBold,
                }
              ]}>
                Prendre une photo
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Group Name */}
          <Animated.View 
            style={styles.inputSection}
            entering={FadeIn.delay(200).duration(300)}
          >
            <Text style={[
              styles.inputLabel, 
              { 
                color: colors.text.light,
                fontSize: typography.fontSize.md,
                fontWeight: typography.fontWeight.semiBold,
              }
            ]}>
              Nom du groupe *
            </Text>
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: colors.background.darkCard,
                  color: colors.text.light,
                  borderColor: groupName.trim().length > 0 && groupName.trim().length < 3
                    ? colors.ui.error
                    : 'transparent',
                  fontSize: typography.fontSize.base,
                  fontWeight: typography.fontWeight.regular,
                },
              ]}
              placeholder="Nom du groupe (3-100 caractères)"
              placeholderTextColor={colors.text.tertiary}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={100}
            />
            {groupName.trim().length > 0 && groupName.trim().length < 3 && (
              <Animated.Text 
                style={[
                  styles.errorText, 
                  { 
                    color: colors.ui.error,
                    fontSize: typography.fontSize.xs,
                    fontWeight: typography.fontWeight.regular,
                  }
                ]}
                entering={FadeIn.duration(200)}
              >
                Le nom doit contenir au moins 3 caractères
              </Animated.Text>
            )}
            <Text style={[
              styles.helperText, 
              { 
                color: colors.text.secondary,
                fontSize: typography.fontSize.xs,
                fontWeight: typography.fontWeight.regular,
              }
            ]}>
              {groupName.length}/100
            </Text>
          </Animated.View>

          {/* Group Description */}
          <Animated.View 
            style={styles.inputSection}
            entering={FadeIn.delay(300).duration(300)}
          >
            <Text style={[
              styles.inputLabel, 
              { 
                color: colors.text.light,
                fontSize: typography.fontSize.md,
                fontWeight: typography.fontWeight.semiBold,
              }
            ]}>
              Description (optionnel)
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { 
                  backgroundColor: colors.background.darkCard,
                  color: colors.text.light,
                  fontSize: typography.fontSize.base,
                  fontWeight: typography.fontWeight.regular,
                },
              ]}
              placeholder="Description du groupe (max 500 caractères)"
              placeholderTextColor={colors.text.tertiary}
              value={groupDescription}
              onChangeText={setGroupDescription}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
            <Text style={[
              styles.helperText, 
              { 
                color: colors.text.secondary,
                fontSize: typography.fontSize.xs,
                fontWeight: typography.fontWeight.regular,
              }
            ]}>
              {groupDescription.length}/500
            </Text>
          </Animated.View>

          {/* Members Selection */}
          <Animated.View 
            style={styles.membersSection}
            entering={FadeIn.delay(400).duration(300)}
          >
            <View style={styles.membersHeader}>
              <Text style={[
                styles.inputLabel, 
                { 
                  color: colors.text.light,
                  fontSize: typography.fontSize.md,
                  fontWeight: typography.fontWeight.semiBold,
                }
              ]}>
                Membres ({selectedMembers.size}/50)
              </Text>
              <View style={[styles.searchContainer, { backgroundColor: withOpacity(colors.background.darkCard, 0.8) }]}>
                <Ionicons name="search" size={20} color={colors.text.secondary} style={styles.searchIcon} />
                <TextInput
                  style={[
                    styles.searchInput, 
                    { 
                      color: colors.text.light,
                      fontSize: typography.fontSize.base,
                      fontWeight: typography.fontWeight.regular,
                    }
                  ]}
                  placeholder="Rechercher des contacts..."
                  placeholderTextColor={colors.text.tertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            {/* Selected Members Preview */}
            {selectedContacts.length > 0 && (
              <Animated.View 
                style={styles.selectedMembersContainer}
                entering={FadeIn.duration(300)}
              >
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedContacts.map((contact, index) => {
                    const user = contact.contact_user;
                    const displayName = contact.nickname || user?.first_name || user?.username || 'Contact';
                    return (
                      <Animated.View 
                        key={contact.id} 
                        style={styles.selectedMemberChip}
                        entering={FadeIn.delay(index * 50).springify()}
                      >
                        <Avatar
                          uri={user?.avatar_url}
                          name={displayName}
                          size={32}
                          showOnlineBadge={false}
                        />
                        <TouchableOpacity
                          style={styles.removeMemberButton}
                          onPress={() => handleMemberToggle(contact)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.ui.error} />
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  })}
                </ScrollView>
              </Animated.View>
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
                    <AnimatedTouchableOpacity
                      key={item.id}
                      style={[
                        styles.contactItem,
                        { backgroundColor: colors.background.darkCard },
                        isSelected && { backgroundColor: withOpacity(colors.primary.main, 0.2) },
                      ]}
                      onPress={() => handleMemberToggle(item)}
                      activeOpacity={0.7}
                      entering={FadeIn.duration(200)}
                    >
                      <Avatar
                        uri={user?.avatar_url}
                        name={displayName}
                        size={48}
                        showOnlineBadge={false}
                      />
                      <View style={styles.contactInfo}>
                        <Text style={[
                          styles.contactName, 
                          { 
                            color: colors.text.light,
                            fontSize: typography.fontSize.base,
                            fontWeight: typography.fontWeight.semiBold,
                          }
                        ]}>
                          {displayName}
                        </Text>
                        {user?.username && (
                          <Text style={[
                            styles.contactUsername, 
                            { 
                              color: colors.text.secondary,
                              fontSize: typography.fontSize.sm,
                              fontWeight: typography.fontWeight.regular,
                            }
                          ]}>
                            @{user.username}
                          </Text>
                        )}
                      </View>
                      {isSelected ? (
                        <Animated.View entering={FadeIn.springify()}>
                          <Ionicons name="checkmark-circle" size={24} color={colors.primary.main} />
                        </Animated.View>
                      ) : (
                        <View style={[styles.checkbox, { borderColor: colors.text.tertiary }]} />
                      )}
                    </AnimatedTouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                      Aucun contact trouvé
                    </Text>
                  </View>
                }
              />
            )}
          </Animated.View>
        </ScrollView>

        {/* Create Button */}
        <AnimatedTouchableOpacity
          style={[
            styles.createButton,
            { 
              backgroundColor: 
                groupName.trim().length >= 3 && selectedMembers.size > 0
                  ? colors.primary.main
                  : colors.background.tertiary,
            },
            buttonScaleStyle,
          ]}
          onPress={handleCreate}
          disabled={creating || groupName.trim().length < 3 || selectedMembers.size === 0}
          activeOpacity={0.8}
          entering={FadeIn.delay(500).springify()}
        >
          {creating ? (
            <ActivityIndicator color={colors.text.light} size="small" />
          ) : (
            <Text style={[
              styles.createButtonText, 
              { 
                color: colors.text.light,
                fontSize: typography.fontSize.base,
                fontWeight: typography.fontWeight.semiBold,
              }
            ]}>
              Créer le groupe
            </Text>
          )}
        </AnimatedTouchableOpacity>
      </Animated.View>
    );
  };

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
        <SafeAreaView 
          style={styles.container}
          edges={['top']}
        >
          {!conversationType && renderTypeSelection()}
          {conversationType === 'direct' && renderDirectConversation()}
          {conversationType === 'group' && renderGroupCreation()}
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
    backgroundColor: 'transparent',
  },
  typeSelectionContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  screenTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  screenSubtitle: {
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
    marginBottom: 4,
  },
  typeButtonSubtitle: {
    // Typography applied inline
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

