/**
 * Tests for DeleteContactModal — wrapper autour de DangerConfirmModal
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

const mockDeleteContact = jest.fn();

jest.mock("./src/services/contacts/api", () => ({
  contactsAPI: {
    deleteContact: (...args: unknown[]) => mockDeleteContact(...args),
  },
}));

jest.mock("./src/theme/colors", () => ({
  colors: {
    background: { dark: "#000" },
    text: { light: "#fff" },
    ui: { error: "#FF3B30", warning: "#F04882" },
  },
  withOpacity: (c: string) => c,
}));

jest.mock("./src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
    }),
    getLocalizedText: (key: string) => {
      const dict: Record<string, string> = {
        "confirm.deleteContact.title": "Supprimer ce contact ?",
        "confirm.deleteContact.description":
          "Le contact sera retiré de votre liste.",
        "confirm.deleteContact.action": "Supprimer",
        "confirm.expectedDelete": "SUPPRIMER",
        "confirm.typeToConfirm": "Tape {{text}} pour confirmer",
        "confirm.cancel": "Annuler",
      };
      return dict[key] ?? key;
    },
  }),
}));

import { DeleteContactModal } from "./src/components/Contacts/DeleteContactModal";

const baseContact = {
  id: "rel-1",
  contact_id: "user-42",
  nickname: "Bob",
  is_favorite: false,
  contact_user: {
    id: "user-42",
    first_name: "Bobby",
    username: "bob",
    avatar_url: null,
  },
} as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DeleteContactModal", () => {
  it("ne rend rien si contact est null", () => {
    const { toJSON } = render(
      <DeleteContactModal
        visible={true}
        contact={null}
        onClose={jest.fn()}
        onContactDeleted={jest.fn()}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("appelle deleteContact + onContactDeleted + onClose au confirm", async () => {
    mockDeleteContact.mockResolvedValueOnce(undefined);
    const onClose = jest.fn();
    const onContactDeleted = jest.fn();
    const { getByTestId } = render(
      <DeleteContactModal
        visible={true}
        contact={baseContact}
        onClose={onClose}
        onContactDeleted={onContactDeleted}
      />,
    );
    fireEvent.changeText(getByTestId("danger-confirm-input"), "SUPPRIMER");
    fireEvent.press(getByTestId("danger-confirm-action"));

    await waitFor(() => {
      expect(mockDeleteContact).toHaveBeenCalledWith("user-42");
      expect(onContactDeleted).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("ne ferme pas la modal si l'API echoue", async () => {
    mockDeleteContact.mockRejectedValueOnce(new Error("network"));
    const onClose = jest.fn();
    const onContactDeleted = jest.fn();
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { getByTestId } = render(
      <DeleteContactModal
        visible={true}
        contact={baseContact}
        onClose={onClose}
        onContactDeleted={onContactDeleted}
      />,
    );
    fireEvent.changeText(getByTestId("danger-confirm-input"), "SUPPRIMER");
    fireEvent.press(getByTestId("danger-confirm-action"));

    await waitFor(() => {
      expect(mockDeleteContact).toHaveBeenCalled();
    });
    expect(onContactDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("annulation : appelle onClose sans toucher l'API", () => {
    const onClose = jest.fn();
    const onContactDeleted = jest.fn();
    const { getByTestId } = render(
      <DeleteContactModal
        visible={true}
        contact={baseContact}
        onClose={onClose}
        onContactDeleted={onContactDeleted}
      />,
    );
    fireEvent.press(getByTestId("danger-confirm-cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockDeleteContact).not.toHaveBeenCalled();
    expect(onContactDeleted).not.toHaveBeenCalled();
  });

  it("fallback contact_id : utilise contact.id si contact_id manquant", async () => {
    mockDeleteContact.mockResolvedValueOnce(undefined);
    const { getByTestId } = render(
      <DeleteContactModal
        visible={true}
        contact={{ ...baseContact, contact_id: undefined }}
        onClose={jest.fn()}
        onContactDeleted={jest.fn()}
      />,
    );
    fireEvent.changeText(getByTestId("danger-confirm-input"), "SUPPRIMER");
    fireEvent.press(getByTestId("danger-confirm-action"));
    await waitFor(() => {
      expect(mockDeleteContact).toHaveBeenCalledWith("rel-1");
    });
  });
});
