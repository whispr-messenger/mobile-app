/**
 * AddContactModal - Modal for adding new contacts
 * Supports search by username or phone number
 */

import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserSearchResult } from '../../types/contact';
import { contactsAPI } from '../../services/contacts/api';
import { Avatar } from '../Chat/Avatar';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

interface AddContactModalProps {
  visible: boolean;
  onClose: () => void;
  onContactAdded: () => void;
}

export const AddContactModal: React.FC<AddContactModalProps> = ({
  visible,
  onClose,
  onContactAdded,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingContactId, setAddingContactId] = useState<string | null>(null);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const results = await contactsAPI.searchUsers({
        username: query.trim(),
      });
      setSearchResults(results);
    } catch (error) {
      console.error('[AddContactModal] Error searching users:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddContact = useCallback(async (user: UserSearchResult) => {
    if (user.is_blocked) {
      Alert.alert(
        'Contact bloqué',
        'Cet utilisateur est bloqué. Vous ne pouvez pas l\'ajouter comme contact.',
      );
      return;
    }

    try {
      setAddingContactId(user.user.id);
      await contactsAPI.addContact({
        contactId: user.user.id,
      });
      Alert.alert('Succès', 'Contact ajouté avec succès', [
        {
          text: 'OK',
          onPress: () => {
            onContactAdded();
            handleClose();
          },
        },
      ]);
    } catch (error: any) {
      console.error('[AddContactModal] Error adding contact:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible d\'ajouter ce contact',
      );
    } finally {
      setAddingContactId(null);
    }
  }, [onContactAdded]);

  const handleClose = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  }, [onClose]);

  const renderSearchResult = useCallback(
    ({ item }: { item: UserSearchResult }) => {
      const { user, is_blocked } = item;
      const displayName = user.first_name || user.username || 'Utilisateur';
      const isAdding = addingContactId === user.id;

      return (
        <TouchableOpacity
          style={[
            styles.resultItem,
            { backgroundColor: themeColors.background.secondary },
            is_blocked && styles.resultItemBlocked,
          ]}
          onPress={() => !is_blocked && handleAddContact(item)}
          disabled={is_blocked || isAdding}
          activeOpacity={0.7}
        >
          <Avatar
            uri={user.avatar_url}
            name={displayName}
            size={48}
          />
          <View style={styles.resultInfo}>
            <Text
              style={[styles.resultName, { color: themeColors.text.primary }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text
              style={[styles.resultUsername, { color: themeColors.text.secondary }]}
              numberOfLines={1}
            >
              @{user.username}
            </Text>
          </View>
          {is_blocked ? (
            <Ionicons
              name="ban"
              size={20}
              color={colors.ui.error}
            />
          ) : isAdding ? (
            <ActivityIndicator size="small" color={colors.primary.main} />
          ) : (
            <Ionicons
              name="add-circle"
              size={24}
              color={colors.primary.main}
            />
          )}
        </TouchableOpacity>
      );
    },
    [addingContactId, handleAddContact, themeColors],
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
        <SafeAreaView style={styles.container} edges={['top']}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: 'transparent' }]}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons
                name="close"
                size={24}
                color={themeColors.text.primary}
              />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
              Ajouter un contact
            </Text>
            <View style={styles.placeholder} />
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
                  onPress={() => handleSearch('')}
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

          {/* Results */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary.main} />
              <Text style={[styles.loadingText, { color: themeColors.text.secondary }]}>
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
              <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>
                Aucun utilisateur trouvé
              </Text>
              <Text style={[styles.emptySubtext, { color: themeColors.text.tertiary }]}>
                Essayez avec un autre nom d'utilisateur
              </Text>
            </View>
          ) : !searchQuery.trim() ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="person-add-outline"
                size={64}
                color={themeColors.text.tertiary}
              />
              <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>
                Rechercher un utilisateur
              </Text>
              <Text style={[styles.emptySubtext, { color: themeColors.text.tertiary }]}>
                Entrez un nom d'utilisateur pour commencer
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
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
  resultsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
  },
  resultUsername: {
    fontSize: 14,
    marginTop: 2,
  },
});

