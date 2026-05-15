/**
 * Tests for EditContactModal — focus sur le flow "Supprimer le contact"
 * (typed-confirm via DangerConfirmModal). Le reste du modal (Save, Block,
 * favorite toggle) reste couvert par d'autres tests/QA manuelle.
 */

import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

const mockDeleteContact = jest.fn();
const mockUpdateContact = jest.fn();
const mockBlockUser = jest.fn();

jest.mock("../../../services/contacts/api", () => ({
  contactsAPI: {
    deleteContact: (...args: unknown[]) => mockDeleteContact(...args),
    updateContact: (...args: unknown[]) => mockUpdateContact(...args),
    blockUser: (...args: unknown[]) => mockBlockUser(...args),
  },
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return { LinearGradient: View };
});

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});

jest.mock("../../Chat/Avatar", () => {
  const { View } = require("react-native");
  return { Avatar: View };
});

jest.mock("../../../theme/colors", () => ({
  colors: {
    background: { dark: "#000", gradient: { app: ["#000", "#111"] } },
    text: { light: "#fff" },
    primary: { main: "#FF7A5C", dark: "#F96645" },
    ui: { error: "#FF3B30", warning: "#F04882" },
  },
  withOpacity: (c: string) => c,
}));

jest.mock("../../../context/ThemeContext", () => ({
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

import { EditContactModal } from "../EditContactModal";

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
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("EditContactModal — typed-confirm delete", () => {
  it("le DangerConfirmModal est cache au depart", () => {
    const { queryByTestId } = render(
      <EditContactModal
        visible={true}
        contact={baseContact}
        onClose={jest.fn()}
        onContactUpdated={jest.fn()}
      />,
    );
    expect(queryByTestId("danger-confirm-input")).toBeNull();
  });

  it("clic sur 'Supprimer le contact' ouvre la modal typed-confirm", () => {
    const { getByText, getByTestId } = render(
      <EditContactModal
        visible={true}
        contact={baseContact}
        onClose={jest.fn()}
        onContactUpdated={jest.fn()}
      />,
    );
    fireEvent.press(getByText("Supprimer le contact"));
    expect(getByTestId("danger-confirm-input")).toBeTruthy();
  });

  it("apres typed-confirm, deleteContact est appele puis onContactUpdated", async () => {
    mockDeleteContact.mockResolvedValueOnce(undefined);
    const onContactUpdated = jest.fn();
    const onClose = jest.fn();
    const { getByText, getByTestId } = render(
      <EditContactModal
        visible={true}
        contact={baseContact}
        onClose={onClose}
        onContactUpdated={onContactUpdated}
      />,
    );
    fireEvent.press(getByText("Supprimer le contact"));
    fireEvent.changeText(getByTestId("danger-confirm-input"), "SUPPRIMER");
    fireEvent.press(getByTestId("danger-confirm-action"));

    await waitFor(() => {
      expect(mockDeleteContact).toHaveBeenCalledWith("user-42");
      expect(onContactUpdated).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("erreur API : Alert affiche le message + modal se ferme", async () => {
    mockDeleteContact.mockRejectedValueOnce(new Error("boom"));
    const { getByText, getByTestId } = render(
      <EditContactModal
        visible={true}
        contact={baseContact}
        onClose={jest.fn()}
        onContactUpdated={jest.fn()}
      />,
    );
    fireEvent.press(getByText("Supprimer le contact"));
    fireEvent.changeText(getByTestId("danger-confirm-input"), "SUPPRIMER");
    fireEvent.press(getByTestId("danger-confirm-action"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Erreur", "boom");
    });
  });

  it("annulation : ferme la typed-confirm sans appeler l'API", () => {
    const { getByText, getByTestId, queryByTestId } = render(
      <EditContactModal
        visible={true}
        contact={baseContact}
        onClose={jest.fn()}
        onContactUpdated={jest.fn()}
      />,
    );
    fireEvent.press(getByText("Supprimer le contact"));
    fireEvent.press(getByTestId("danger-confirm-cancel"));
    expect(mockDeleteContact).not.toHaveBeenCalled();
    expect(queryByTestId("danger-confirm-input")).toBeNull();
  });
});
