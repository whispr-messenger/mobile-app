import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Contact, ContactSearchParams, ContactRequest } from '../../types/contact';
import { contactsAPI } from '../../services/contacts/api';
import { ContactItem } from '../../components/Contacts/ContactItem';
import { AddContactModal } from '../../components/Contacts/AddContactModal';
import { EditContactModal } from '../../components/Contacts/EditContactModal';
import { SyncContactsModal } from '../../components/Contacts/SyncContactsModal';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import AuthService from '../../services/AuthService';
import { useWebSocket } from '../../hooks/useWebSocket';

declare module '@expo/vector-icons';

export const ContactsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<ContactSearchParams['sort']>('name');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const auth = AuthService.getInstance();
  const currentUser = auth.getCurrentUser();
  const userId = currentUser?.userId || '';
  const token = currentUser ? `token-${currentUser.userId}` : '';

  const { joinUserChannel } = useWebSocket({
    userId,
    token,
    onContactRequest: (request: ContactRequest) => {
      setContactRequests(prev => {
        const exists = prev.some(r => r.id === request.id);
        if (exists) {
          return prev.map(r => (r.id === request.id ? request : r));
        }
        return [request, ...prev];
      });
    },
  });

  // Load contacts
  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const params: ContactSearchParams = {
        search: searchQuery || undefined,
        sort: sortBy,
        favorites: showFavoritesOnly || undefined,
      };
      const result = await contactsAPI.getContacts(params);
      setContacts(result.contacts);
    } catch (error) {
      console.error('[ContactsScreen] Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sortBy, showFavoritesOnly]);

  const loadContactRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      const requests = await contactsAPI.getContactRequests();
      setContactRequests(requests);
    } catch (error) {
      console.error('[ContactsScreen] Error loading contact requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (!userId || !token) {
      return;
    }
    joinUserChannel();
  }, [userId, token, joinUserChannel]);

  // Initial load
  useEffect(() => {
    loadContacts();
    loadContactRequests();
  }, [loadContacts, loadContactRequests]);

  useEffect(() => {
    if (!userId || !token) {
      return;
    }
    joinUserChannel();
  }, [userId, token, joinUserChannel]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadContacts(), loadContactRequests()]);
    setRefreshing(false);
  }, [loadContacts, loadContactRequests]);

  const handleAcceptRequest = useCallback(
    async (request: ContactRequest) => {
      try {
        await contactsAPI.acceptContactRequest(request.id);
        await Promise.all([loadContacts(), loadContactRequests()]);
      } catch (error) {
        console.error('[ContactsScreen] Error accepting contact request:', error);
      }
    },
    [loadContacts, loadContactRequests]
  );

  const handleRefuseRequest = useCallback(
    async (request: ContactRequest) => {
      try {
        await contactsAPI.refuseContactRequest(request.id);
        await loadContactRequests();
      } catch (error) {
        console.error('[ContactsScreen] Error refusing contact request:', error);
      }
    },
    [loadContactRequests]
  );

  // Handle contact press
  const handleContactPress = useCallback((contact: Contact) => {
    // TODO: Navigate to contact details or start conversation
    console.log('[ContactsScreen] Contact pressed:', contact.id);
  }, []);

  // Handle contact long press
  const handleContactLongPress = useCallback((contact: Contact) => {
    setEditingContact(contact);
  }, []);

  // Filtered and sorted contacts
  const filteredContacts = useMemo(() => {
    return contacts;
  }, [contacts]);

  const pendingRequests = useMemo(() => {
    if (!userId) {
      return [];
    }

    return contactRequests.filter(
      (request) =>
        request.status === 'pending' &&
        (request.requester_id === userId || request.recipient_id === userId)
    );
  }, [contactRequests, userId]);

  const renderContact = useCallback(
    ({ item }: { item: Contact }) => (
      <ContactItem
        contact={item}
        onPress={handleContactPress}
        onLongPress={handleContactLongPress}
      />
    ),
    [handleContactPress, handleContactLongPress]
  );

  const keyExtractor = useCallback((item: Contact) => item.id, []);

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={themeColors.text.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
            Contacts
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons
              name="add"
              size={24}
              color={themeColors.text.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
            <Ionicons
              name="search-outline"
              size={20}
              color="rgba(255, 255, 255, 0.7)"
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text.light }]}
              placeholder="Rechercher un contact..."
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
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

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              showFavoritesOnly && styles.filterButtonActive,
              { backgroundColor: showFavoritesOnly ? colors.primary.main : 'rgba(255, 255, 255, 0.1)' },
            ]}
            onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
          >
            <Ionicons
              name="star"
              size={16}
              color={showFavoritesOnly ? colors.text.light : themeColors.text.secondary}
            />
            <Text
              style={[
                styles.filterText,
                { color: showFavoritesOnly ? colors.text.light : themeColors.text.secondary },
              ]}
            >
              Favoris
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
            ]}
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
            style={[
              styles.filterButton,
              { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
            ]}
            onPress={() => {
              // @ts-ignore - navigation type will be fixed later
              navigation.navigate('BlockedUsers');
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

        {/* Contact Requests */}
        {loadingRequests && pendingRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>
              Chargement des demandes...
            </Text>
          </View>
        ) : pendingRequests.length > 0 ? (
          <View style={styles.requestsContainer}>
            <Text style={[styles.requestsTitle, { color: themeColors.text.primary }]}>
              Demandes de contact
            </Text>
            {pendingRequests.map((request) => {
              const isIncoming = request.recipient_id === userId;
              const user = isIncoming ? request.requester_user : request.recipient_user;
              const displayName =
                user?.first_name || user?.username || 'Utilisateur';

              return (
                <View
                  key={request.id}
                  style={[
                    styles.requestItem,
                    { backgroundColor: themeColors.background.secondary },
                  ]}
                >
                  <View style={styles.requestInfo}>
                    <Text
                      style={[styles.requestName, { color: themeColors.text.primary }]}
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
                        @{user.username}
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
        ) : null}

        {/* Contacts List */}
        {loading && contacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>
              Chargement...
            </Text>
          </View>
        ) : filteredContacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="people-outline"
              size={64}
              color={themeColors.text.tertiary}
            />
            <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>
              {searchQuery ? 'Aucun contact trouvé' : 'Aucun contact'}
            </Text>
            {!searchQuery && (
              <Text style={[styles.emptySubtext, { color: themeColors.text.tertiary }]}>
                Appuyez sur + pour ajouter un contact
              </Text>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            renderItem={renderContact}
            keyExtractor={keyExtractor}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.text.light}
              />
            }
            contentContainerStyle={styles.listContent}
            />
          )}

          {/* Add Contact Modal */}
          <AddContactModal
            visible={showAddModal}
            onClose={() => setShowAddModal(false)}
            onContactAdded={() => {
              loadContactRequests();
            }}
          />

          {/* Edit Contact Modal */}
          <EditContactModal
            visible={!!editingContact}
            contact={editingContact}
            onClose={() => setEditingContact(null)}
            onContactUpdated={loadContacts}
          />

          {/* Sync Contacts Modal */}
          <SyncContactsModal
            visible={showSyncModal}
            onClose={() => setShowSyncModal(false)}
            onContactsSynced={loadContacts}
          />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
  },
  addButton: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  filterButtonActive: {
    // Active state handled by backgroundColor
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  requestsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  requestsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  requestInfo: {
    flex: 1,
    marginRight: 8,
  },
  requestName: {
    fontSize: 15,
    fontWeight: '600',
  },
  requestSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  requestAcceptButton: {
    backgroundColor: colors.ui.success,
  },
  requestRefuseButton: {
    backgroundColor: colors.ui.error,
  },
});
