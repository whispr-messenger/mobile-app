/**
 * DeleteContactModal - confirmation de suppression d'un contact
 *
 * Utilise DangerConfirmModal : l'user doit taper "SUPPRIMER" pour activer
 * le bouton, ce qui evite les suppressions accidentelles.
 */

import React, { useState } from "react";
import { Contact } from "../../types/contact";
import { useTheme } from "../../context/ThemeContext";
import { contactsAPI } from "../../services/contacts/api";
import { DangerConfirmModal } from "../Common/DangerConfirmModal";

interface DeleteContactModalProps {
  visible: boolean;
  contact: Contact | null;
  onClose: () => void;
  onContactDeleted: () => void;
}

export const DeleteContactModal: React.FC<DeleteContactModalProps> = ({
  visible,
  contact,
  onClose,
  onContactDeleted,
}) => {
  const [deleting, setDeleting] = useState(false);
  const { getLocalizedText } = useTheme();

  if (!contact) return null;

  const user = contact.contact_user;
  const displayName =
    contact.nickname || user?.first_name || user?.username || "Contact";

  const handleConfirm = async () => {
    try {
      setDeleting(true);
      await contactsAPI.deleteContact(contact.contact_id || contact.id);
      onContactDeleted();
      onClose();
    } catch (error: any) {
      console.error("[DeleteContactModal] Error deleting contact:", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DangerConfirmModal
      visible={visible}
      title={getLocalizedText("confirm.deleteContact.title")}
      description={`${displayName} — ${getLocalizedText(
        "confirm.deleteContact.description",
      )}`}
      expectedText={getLocalizedText("confirm.expectedDelete")}
      actionLabel={getLocalizedText("confirm.deleteContact.action")}
      actionVariant="destructive"
      loading={deleting}
      onCancel={onClose}
      onConfirm={handleConfirm}
    />
  );
};
