/**
 * EditContactModal - Modal for editing contact details
 * Allows editing nickname and favorite status
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Contact } from '../../types/contact';
import { contactsAPI } from '../../services/contacts/api';
import { Avatar } from '../Chat/Avatar';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { useNavigation } from '@react-navigation/native';

interface EditContactModalProps {
  visible: boolean;
  contact: Contact | null;
  onClose: () => void;
  onContactUpdated: () => void;
}

export const EditContactModal: React.FC<EditContactModalProps> = ({
  visible,
  contact,
  onClose,
  onContactUpdated,
}) => {
  const [nickname, setNickname] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const navigation = useNavigation();

  useEffect(() => {
    if (contact) {
      setNickname(contact.nickname || '');
      setIsFavorite(contact.is_favorite);
    }
  }, [contact]);

  const handleSave = async () => {
    if (!contact) return;

    try {
      setSaving(true);
      await contactsAPI.updateContact(contact.id, {
        nickname: nickname.trim() || undefined,
        isFavorite,
      });
      Alert.alert('Succès', 'Contact mis à jour avec succès', [
        {
          text: 'OK',
          onPress: () => {
            onContactUpdated();
            handleClose();
          },
        },
      ]);
    } catch (error: any) {
      console.error('[EditContactModal] Error updating contact:', error);
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour le contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!contact) return;

    Alert.alert(
      'Supprimer le contact',
      'Êtes-vous sûr de vouloir supprimer ce contact ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await contactsAPI.deleteContact(contact.id);
              Alert.alert('Succès', 'Contact supprimé', [
                {
                  text: 'OK',
                  onPress: () => {
                    onContactUpdated();
                    handleClose();
                  },
                },
              ]);
            } catch (error: any) {
              console.error('[EditContactModal] Error deleting contact:', error);
              Alert.alert('Erreur', error.message || 'Impossible de supprimer le contact');
            }
          },
        },
      ],
    );
  };

  const handleClose = () => {
    if (contact) {
      setNickname(contact.nickname || '');
      setIsFavorite(contact.is_favorite);
    }
    onClose();
  };

  if (!contact) return null;

  const user = contact.contact_user;
  const displayName = contact.nickname || user?.first_name || user?.username || 'Contact';

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
              Modifier le contact
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={styles.saveButton}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary.main} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.primary.main }]}>
                  Enregistrer
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Contact Info */}
          <View style={styles.contactInfo}>
            <Avatar
              uri={user?.avatar_url}
              name={displayName}
              size={80}
            />
            <Text style={[styles.contactName, { color: themeColors.text.primary }]}>
              {user?.first_name || user?.username || 'Contact'}
            </Text>
            <Text style={[styles.contactUsername, { color: themeColors.text.secondary }]}>
              @{user?.username}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Nickname */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: themeColors.text.secondary }]}>
                Surnom
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: themeColors.text.primary,
                  },
                ]}
                placeholder="Surnom personnalisé"
                placeholderTextColor={themeColors.text.tertiary}
                value={nickname}
                onChangeText={setNickname}
                maxLength={50}
              />
              <Text style={[styles.hint, { color: themeColors.text.tertiary }]}>
                Visible uniquement par vous
              </Text>
            </View>

            {/* Favorite */}
            <View style={styles.field}>
              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Ionicons
                    name="star"
                    size={20}
                    color={isFavorite ? colors.primary.main : themeColors.text.secondary}
                  />
                  <Text style={[styles.switchLabel, { color: themeColors.text.primary }]}>
                    Favori
                  </Text>
                </View>
                <Switch
                  value={isFavorite}
                  onValueChange={setIsFavorite}
                  trackColor={{
                    false: 'rgba(255, 255, 255, 0.2)',
                    true: colors.primary.main,
                  }}
                  thumbColor={colors.text.light}
                />
              </View>
              <Text style={[styles.hint, { color: themeColors.text.tertiary }]}>
                Les favoris apparaissent en haut de la liste
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={[styles.actionButton, styles.blockButton]}
              onPress={async () => {
                if (!contact?.contact_user) return;
                Alert.alert(
                  'Bloquer l\'utilisateur',
                  'Êtes-vous sûr de vouloir bloquer cet utilisateur ?',
                  [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Bloquer',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await contactsAPI.blockUser(contact.contact_user!.id);
                          Alert.alert('Succès', 'Utilisateur bloqué', [
                            {
                              text: 'OK',
                              onPress: () => {
                                onContactUpdated();
                                handleClose();
                              },
                            },
                          ]);
                        } catch (error: any) {
                          console.error('[EditContactModal] Error blocking user:', error);
                          Alert.alert('Erreur', error.message || 'Impossible de bloquer l\'utilisateur');
                        }
                      },
                    },
                  ],
                );
              }}
            >
              <Ionicons
                name="ban-outline"
                size={20}
                color={colors.primary.main}
              />
              <Text style={[styles.actionButtonText, { color: colors.primary.main }]}>
                Bloquer l'utilisateur
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={colors.primary.dark}
              />
              <Text style={[styles.actionButtonText, { color: colors.primary.dark }]}>
                Supprimer le contact
              </Text>
            </TouchableOpacity>
          </View>
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
  saveButton: {
    padding: 4,
    minWidth: 80,
    alignItems: 'flex-end',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  contactInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  contactName: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 12,
  },
  contactUsername: {
    fontSize: 16,
    marginTop: 4,
  },
  form: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionsSection: {
    marginTop: 'auto',
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  blockButton: {
    backgroundColor: 'rgba(254, 122, 92, 0.15)',
  },
  deleteButton: {
    backgroundColor: 'rgba(249, 102, 69, 0.15)',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

