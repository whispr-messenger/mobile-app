/**
 * BlockedUsersScreen - Screen for managing blocked users
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BlockedUser } from '../../types/contact';
import { contactsAPI } from '../../services/contacts/api';
import { Avatar } from '../../components/Chat/Avatar';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

export const BlockedUsersScreen: React.FC = () => {
  const navigation = useNavigation();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const loadBlockedUsers = useCallback(async () => {
    try {
      setLoading(true);
      const result = await contactsAPI.getBlockedUsers();
      setBlockedUsers(result.blocked);
    } catch (error) {
      console.error('[BlockedUsersScreen] Error loading blocked users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlockedUsers();
  }, [loadBlockedUsers]);

  const handleUnblock = useCallback(async (userId: string) => {
    Alert.alert(
      'Débloquer l\'utilisateur',
      'Êtes-vous sûr de vouloir débloquer cet utilisateur ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Débloquer',
          style: 'destructive',
          onPress: async () => {
            try {
              setUnblockingId(userId);
              await contactsAPI.unblockUser(userId);
              await loadBlockedUsers();
              Alert.alert('Succès', 'Utilisateur débloqué');
            } catch (error: any) {
              console.error('[BlockedUsersScreen] Error unblocking user:', error);
              Alert.alert('Erreur', error.message || 'Impossible de débloquer l\'utilisateur');
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ],
    );
  }, [loadBlockedUsers]);

  const renderBlockedUser = useCallback(
    ({ item }: { item: BlockedUser }) => {
      const user = item.blocked_user;
      if (!user) return null;

      const displayName = user.first_name || user.username || 'Utilisateur';
      const isUnblocking = unblockingId === item.blocked_user_id;

      return (
        <View
          style={[styles.blockedItem, { backgroundColor: themeColors.background.secondary }]}
        >
          <Avatar
            uri={user.avatar_url}
            name={displayName}
            size={48}
          />
          <View style={styles.userInfo}>
            <Text
              style={[styles.userName, { color: themeColors.text.primary }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text
              style={[styles.userUsername, { color: themeColors.text.secondary }]}
              numberOfLines={1}
            >
              @{user.username}
            </Text>
            {item.reason && (
              <Text
                style={[styles.blockReason, { color: themeColors.text.tertiary }]}
                numberOfLines={1}
              >
                Raison: {item.reason}
              </Text>
            )}
            <Text
              style={[styles.blockDate, { color: themeColors.text.tertiary }]}
              numberOfLines={1}
            >
              Bloqué le {new Date(item.blocked_at).toLocaleDateString('fr-FR')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.unblockButton}
            onPress={() => handleUnblock(item.blocked_user_id)}
            disabled={isUnblocking}
          >
            {isUnblocking ? (
              <ActivityIndicator size="small" color={colors.primary.main} />
            ) : (
              <>
                <Ionicons
                  name="ban-outline"
                  size={20}
                  color={colors.primary.main}
                />
                <Text style={[styles.unblockText, { color: colors.primary.main }]}>
                  Débloquer
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [unblockingId, handleUnblock, themeColors],
  );

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
            Utilisateurs bloqués
          </Text>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={[styles.loadingText, { color: themeColors.text.secondary }]}>
              Chargement...
            </Text>
          </View>
        ) : blockedUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="checkmark-circle-outline"
              size={64}
              color={themeColors.text.tertiary}
            />
            <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>
              Aucun utilisateur bloqué
            </Text>
            <Text style={[styles.emptySubtext, { color: themeColors.text.tertiary }]}>
              Les utilisateurs que vous bloquez n'apparaîtront pas ici
            </Text>
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            renderItem={renderBlockedUser}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
        )}
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
  placeholder: {
    width: 36,
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  blockedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userUsername: {
    fontSize: 14,
    marginTop: 2,
  },
  blockReason: {
    fontSize: 12,
    marginTop: 4,
  },
  blockDate: {
    fontSize: 12,
    marginTop: 2,
  },
  unblockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(254, 122, 92, 0.1)',
    gap: 6,
  },
  unblockText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

