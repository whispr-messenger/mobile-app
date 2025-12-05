/**
 * SyncContactsModal - Modal for syncing phone contacts
 * Imports contacts from device phone book
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { UserSearchResult, PhoneContact } from '../../types/contact';
import { contactsAPI } from '../../services/contacts/api';
import { Avatar } from '../Chat/Avatar';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { normalizePhoneToE164, hashPhoneNumber } from '../../utils/phoneUtils';

interface SyncContactsModalProps {
  visible: boolean;
  onClose: () => void;
  onContactsSynced: () => void;
}

export const SyncContactsModal: React.FC<SyncContactsModalProps> = ({
  visible,
  onClose,
  onContactsSynced,
}) => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [matches, setMatches] = useState<UserSearchResult[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  useEffect(() => {
    if (visible) {
      requestPermissionAndLoad();
    } else {
      // Reset state when modal closes
      setMatches([]);
      setSelectedContacts(new Set());
    }
  }, [visible]);

  const requestPermissionAndLoad = async () => {
    try {
      setLoading(true);
      
      // Check current permission status first
      const { status: currentStatus } = await Contacts.getPermissionsAsync();
      
      // If permission was denied, don't ask again
      if (currentStatus === 'denied') {
        Alert.alert(
          'Permission refusée',
          'L\'accès aux contacts a été refusé. Pour activer la synchronisation, allez dans les paramètres de l\'application et autorisez l\'accès aux contacts.',
          [
            { text: 'Annuler', style: 'cancel', onPress: onClose },
            {
              text: 'Ouvrir les paramètres',
              onPress: async () => {
                try {
                  if (Platform.OS === 'ios') {
                    await Linking.openURL('app-settings:');
                  } else {
                    await Linking.openSettings();
                  }
                } catch (error) {
                  console.error('[SyncContactsModal] Error opening settings:', error);
                  Alert.alert('Erreur', 'Impossible d\'ouvrir les paramètres');
                }
                onClose();
              },
            },
          ],
        );
        return;
      }
      
      // Request permission only if not already granted
      if (currentStatus !== 'granted') {
        const { status } = await Contacts.requestPermissionsAsync();
        
        if (status !== 'granted') {
          Alert.alert(
            'Permission requise',
            'L\'accès aux contacts est nécessaire pour synchroniser vos contacts.',
            [{ text: 'OK', onPress: onClose }],
          );
          return;
        }
      }

      // Load contacts
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      // Filter contacts with phone numbers
      const phoneContacts: PhoneContact[] = data
        .filter(contact => contact.phoneNumbers && contact.phoneNumbers.length > 0)
        .map(contact => {
          const phoneNumber = contact.phoneNumbers?.[0]?.number || '';
          // Normalize phone number (remove spaces, dashes, etc.)
          const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');
          
          // Simple hash simulation (in real app, would use proper hash)
          const phoneHash = normalized; // Simplified for mock
          
          return {
            name: contact.name || 'Contact',
            phoneNumber: normalized,
            phoneHash,
          };
        });

      // Match with users
      const matched = await contactsAPI.importPhoneContacts(phoneContacts);
      setMatches(matched);
    } catch (error) {
      console.error('[SyncContactsModal] Error loading contacts:', error);
      Alert.alert('Erreur', 'Impossible de charger les contacts');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (userId: string) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleSync = async () => {
    if (selectedContacts.size === 0) {
      Alert.alert('Aucun contact sélectionné', 'Sélectionnez au moins un contact à ajouter');
      return;
    }

    try {
      setSyncing(true);
      let successCount = 0;
      let errorCount = 0;

      for (const userId of selectedContacts) {
        try {
          await contactsAPI.addContact({ contactId: userId });
          successCount++;
        } catch (error) {
          console.error('[SyncContactsModal] Error adding contact:', error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        Alert.alert(
          'Synchronisation terminée',
          `${successCount} contact(s) ajouté(s)${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`,
          [
            {
              text: 'OK',
              onPress: () => {
                onContactsSynced();
                handleClose();
              },
            },
          ],
        );
      } else {
        Alert.alert('Erreur', 'Aucun contact n\'a pu être ajouté');
      }
    } catch (error) {
      console.error('[SyncContactsModal] Error syncing contacts:', error);
      Alert.alert('Erreur', 'Impossible de synchroniser les contacts');
    } finally {
      setSyncing(false);
    }
  };

  const handleClose = () => {
    setMatches([]);
    setSelectedContacts(new Set());
    onClose();
  };

  const renderMatch = ({ item }: { item: UserSearchResult }) => {
    const { user, is_blocked } = item;
    const isSelected = selectedContacts.has(user.id);
    const displayName = user.first_name || user.username || 'Utilisateur';

    if (is_blocked) return null;

    return (
      <TouchableOpacity
        style={[
          styles.matchItem,
          { backgroundColor: themeColors.background.secondary },
          isSelected && styles.matchItemSelected,
        ]}
        onPress={() => toggleSelection(user.id)}
        activeOpacity={0.7}
      >
        <Avatar
          uri={user.avatar_url}
          name={displayName}
          size={48}
        />
        <View style={styles.matchInfo}>
          <Text
            style={[styles.matchName, { color: themeColors.text.primary }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text
            style={[styles.matchUsername, { color: themeColors.text.secondary }]}
            numberOfLines={1}
          >
            @{user.username}
          </Text>
        </View>
        {isSelected && (
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={colors.primary.main}
          />
        )}
      </TouchableOpacity>
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
              Synchroniser les contacts
            </Text>
            <View style={styles.placeholder} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary.main} />
              <Text style={[styles.loadingText, { color: themeColors.text.secondary }]}>
                Recherche de correspondances...
              </Text>
            </View>
          ) : matches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="people-outline"
                size={64}
                color={themeColors.text.tertiary}
              />
              <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>
                Aucune correspondance trouvée
              </Text>
              <Text style={[styles.emptySubtext, { color: themeColors.text.tertiary }]}>
                Aucun de vos contacts téléphoniques n'utilise Whispr
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.infoContainer}>
                <Text style={[styles.infoText, { color: themeColors.text.secondary }]}>
                  {matches.length} correspondance(s) trouvée(s)
                </Text>
                <Text style={[styles.infoSubtext, { color: themeColors.text.tertiary }]}>
                  Sélectionnez les contacts à ajouter
                </Text>
              </View>

              <FlatList
                data={matches}
                renderItem={renderMatch}
                keyExtractor={(item) => item.user.id}
                contentContainerStyle={styles.matchesList}
              />

              {selectedContacts.size > 0 && (
                <View style={styles.footer}>
                  <TouchableOpacity
                    style={styles.syncButton}
                    onPress={handleSync}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <ActivityIndicator size="small" color={colors.text.light} />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={colors.text.light}
                        />
                        <Text style={styles.syncButtonText}>
                          Ajouter {selectedContacts.size} contact(s)
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
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
  infoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  matchesList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  matchItemSelected: {
    borderWidth: 2,
    borderColor: colors.primary.main,
  },
  matchInfo: {
    flex: 1,
    marginLeft: 12,
  },
  matchName: {
    fontSize: 16,
    fontWeight: '600',
  },
  matchUsername: {
    fontSize: 14,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  syncButtonText: {
    color: colors.text.light,
    fontSize: 16,
    fontWeight: '600',
  },
});

