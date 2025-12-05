/**
 * ContactsScreen - Contacts list screen
 * Displays list of contacts with search and filters
 */

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
import { Contact, ContactSearchParams } from '../../types/contact';
import { contactsAPI } from '../../services/contacts/api';
import { ContactItem } from '../../components/Contacts/ContactItem';
import { AddContactModal } from '../../components/Contacts/AddContactModal';
import { EditContactModal } from '../../components/Contacts/EditContactModal';
import { SyncContactsModal } from '../../components/Contacts/SyncContactsModal';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

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
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

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

  // Initial load
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadContacts();
    setRefreshing(false);
  }, [loadContacts]);

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
        </View>

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
            onContactAdded={loadContacts}
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
});

