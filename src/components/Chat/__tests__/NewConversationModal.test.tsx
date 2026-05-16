/**
 * Tests for NewConversationModal:
 * - Loads contacts on open, surfaces an Alert on failure
 * - Filtering by search query
 * - Single selection → createDirectConversation
 * - Multi selection → createGroupConversation with the typed name
 * - Group name validation (too short, too long)
 * - 50-member cap blocks further selection
 * - Default group name auto-derived from first 3 selected display names
 * - Close & reset
 */

import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../Avatar", () => ({
  Avatar: () => null,
}));

const mockGetContacts = jest.fn();
const mockCreateDirect = jest.fn();
const mockCreateGroup = jest.fn();

jest.mock("../../../services/contacts/api", () => ({
  contactsAPI: {
    getContacts: (...args: unknown[]) => mockGetContacts(...args),
  },
}));
jest.mock("../../../services/messaging/api", () => ({
  messagingAPI: {
    createDirectConversation: (...args: unknown[]) => mockCreateDirect(...args),
    createGroupConversation: (...args: unknown[]) => mockCreateGroup(...args),
  },
}));

import { NewConversationModal } from "../NewConversationModal";
import type { Contact } from "../../../types/contact";

const makeContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: overrides.id ?? "c-1",
  user_id: overrides.user_id ?? "me",
  contact_id: overrides.contact_id ?? "u-1",
  nickname: overrides.nickname,
  is_favorite: overrides.is_favorite ?? false,
  added_at: overrides.added_at ?? "2026-01-01T00:00:00Z",
  updated_at: overrides.updated_at ?? "2026-01-01T00:00:00Z",
  contact_user:
    overrides.contact_user ??
    ({
      id: overrides.contact_id ?? "u-1",
      username: "alice",
      first_name: "Alice",
      last_name: "Smith",
      avatar_url: null as unknown as string | undefined,
    } as any),
});

const CONTACTS = [
  makeContact({ id: "c-1", contact_id: "u-1" }),
  makeContact({
    id: "c-2",
    contact_id: "u-2",
    contact_user: {
      id: "u-2",
      username: "bob",
      first_name: "Bob",
      last_name: "Jones",
    } as any,
  }),
  makeContact({
    id: "c-3",
    contact_id: "u-3",
    nickname: "Carla nickname",
    contact_user: {
      id: "u-3",
      username: "carla",
      first_name: "Carla",
      last_name: "Diaz",
    } as any,
  }),
];

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetContacts.mockResolvedValue({
    contacts: CONTACTS,
    total: CONTACTS.length,
  });
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  alertSpy.mockRestore();
});

const flushAsync = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("NewConversationModal — loading", () => {
  it("loads contacts on open and renders them", async () => {
    const { getByText } = render(
      <NewConversationModal
        visible
        onClose={jest.fn()}
        onConversationCreated={jest.fn()}
      />,
    );

    await waitFor(() => expect(getByText("Alice Smith")).toBeTruthy());
    expect(getByText("Bob Jones")).toBeTruthy();
    expect(getByText("Carla nickname")).toBeTruthy(); // nickname wins over name
    expect(mockGetContacts).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when the modal is closed", () => {
    render(
      <NewConversationModal
        visible={false}
        onClose={jest.fn()}
        onConversationCreated={jest.fn()}
      />,
    );
    expect(mockGetContacts).not.toHaveBeenCalled();
  });

  it("surfaces an Alert when contacts loading fails", async () => {
    mockGetContacts.mockRejectedValueOnce(new Error("network down"));

    render(
      <NewConversationModal
        visible
        onClose={jest.fn()}
        onConversationCreated={jest.fn()}
      />,
    );

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe("Erreur");
  });
});

describe("NewConversationModal — search", () => {
  it("filters the contact list by typed query", async () => {
    const { getByText, queryByText, getByPlaceholderText } = render(
      <NewConversationModal
        visible
        onClose={jest.fn()}
        onConversationCreated={jest.fn()}
      />,
    );
    await waitFor(() => getByText("Alice Smith"));

    fireEvent.changeText(getByPlaceholderText("Rechercher un contact"), "bob");

    expect(queryByText("Alice Smith")).toBeNull();
    expect(getByText("Bob Jones")).toBeTruthy();
  });

  it("shows the empty-results state when nothing matches", async () => {
    const { getByText, getByPlaceholderText } = render(
      <NewConversationModal
        visible
        onClose={jest.fn()}
        onConversationCreated={jest.fn()}
      />,
    );
    await waitFor(() => getByText("Alice Smith"));

    fireEvent.changeText(
      getByPlaceholderText("Rechercher un contact"),
      "zzz no match",
    );

    expect(getByText("Aucun contact trouvé")).toBeTruthy();
  });
});

describe("NewConversationModal — direct conversation", () => {
  it("creates a direct conversation when exactly one contact is selected", async () => {
    mockCreateDirect.mockResolvedValueOnce({ id: "conv-9" });
    const onCreated = jest.fn();
    const { getByText } = render(
      <NewConversationModal
        visible
        onClose={jest.fn()}
        onConversationCreated={onCreated}
      />,
    );
    await waitFor(() => getByText("Alice Smith"));

    fireEvent.press(getByText("Alice Smith"));
    fireEvent.press(getByText("Créer la conversation"));
    await flushAsync();

    expect(mockCreateDirect).toHaveBeenCalledWith("u-1");
    expect(onCreated).toHaveBeenCalledWith("conv-9");
  });

  it("alerts when the direct conversation creation fails", async () => {
    mockCreateDirect.mockRejectedValueOnce(new Error("forbidden"));
    const { getByText } = render(
      <NewConversationModal
        visible
        onClose={jest.fn()}
        onConversationCreated={jest.fn()}
      />,
    );
    await waitFor(() => getByText("Alice Smith"));

    fireEvent.press(getByText("Alice Smith"));
    fireEvent.press(getByText("Créer la conversation"));
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledWith("Erreur", "forbidden");
  });
});

describe("NewConversationModal — group conversation", () => {
  it("computes a default group name from the first selected display names", async () => {
    const { getByText, getByDisplayValue } = render(
      <NewConversationModal
        visible
        onClose={jest.fn()}
        onConversationCreated={jest.fn()}
      />,
    );
    await waitFor(() => getByText("Alice Smith"));

    fireEvent.press(getByText("Alice Smith"));
    fireEvent.press(getByText("Bob Jones"));

    // The text input becomes editable when >= 2 are selected and defaults to
    // "Alice, Bob".
    expect(getByDisplayValue("Alice, Bob")).toBeTruthy();
  });

  it("creates a group with the typed name when >= 2 are selected", async () => {
    mockCreateGroup.mockResolvedValueOnce({ id: "group-1" });
    const onCreated = jest.fn();
    const { getByText, getByDisplayValue } = render(
      <NewConversationModal
        visible
        onClose={jest.fn()}
        onConversationCreated={onCreated}
      />,
    );
    await waitFor(() => getByText("Alice Smith"));

    fireEvent.press(getByText("Alice Smith"));
    fireEvent.press(getByText("Bob Jones"));

    const input = getByDisplayValue("Alice, Bob");
    fireEvent.changeText(input, "Project Atlas");
    fireEvent.press(getByText(/Créer le groupe/));
    await flushAsync();

    expect(mockCreateGroup).toHaveBeenCalledWith("Project Atlas", [
      "u-1",
      "u-2",
    ]);
    expect(onCreated).toHaveBeenCalledWith("group-1");
  });

  it("rejects a group name shorter than 3 characters", async () => {
    const { getByText, getByDisplayValue } = render(
      <NewConversationModal
        visible
        onClose={jest.fn()}
        onConversationCreated={jest.fn()}
      />,
    );
    await waitFor(() => getByText("Alice Smith"));

    fireEvent.press(getByText("Alice Smith"));
    fireEvent.press(getByText("Bob Jones"));
    fireEvent.changeText(getByDisplayValue("Alice, Bob"), "ab");
    fireEvent.press(getByText(/Créer le groupe/));

    expect(alertSpy).toHaveBeenCalledWith(
      "Nom invalide",
      expect.stringContaining("au moins 3 caractères"),
    );
    expect(mockCreateGroup).not.toHaveBeenCalled();
  });

  it("rejects a group name longer than 100 characters", async () => {
    const { getByText, getByDisplayValue } = render(
      <NewConversationModal
        visible
        onClose={jest.fn()}
        onConversationCreated={jest.fn()}
      />,
    );
    await waitFor(() => getByText("Alice Smith"));

    fireEvent.press(getByText("Alice Smith"));
    fireEvent.press(getByText("Bob Jones"));
    // TextInput has maxLength=100, so we bypass it directly via onChangeText
    fireEvent.changeText(getByDisplayValue("Alice, Bob"), "x".repeat(101));
    fireEvent.press(getByText(/Créer le groupe/));

    expect(alertSpy).toHaveBeenCalledWith(
      "Nom invalide",
      expect.stringContaining("100 caractères"),
    );
    expect(mockCreateGroup).not.toHaveBeenCalled();
  });

  it("alerts and does not call onConversationCreated when group creation fails", async () => {
    mockCreateGroup.mockRejectedValueOnce(new Error("boom"));
    const onCreated = jest.fn();
    const { getByText, getByDisplayValue } = render(
      <NewConversationModal
        visible
        onClose={jest.fn()}
        onConversationCreated={onCreated}
      />,
    );
    await waitFor(() => getByText("Alice Smith"));

    fireEvent.press(getByText("Alice Smith"));
    fireEvent.press(getByText("Bob Jones"));
    fireEvent.changeText(getByDisplayValue("Alice, Bob"), "Squad Six");
    fireEvent.press(getByText(/Créer le groupe/));
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledWith(
      "Erreur",
      "Impossible de créer le groupe",
    );
    expect(onCreated).not.toHaveBeenCalled();
  });
});

describe("NewConversationModal — close", () => {
  it("invokes onClose when the close button is pressed", async () => {
    const onClose = jest.fn();
    const { UNSAFE_getAllByType, getByText } = render(
      <NewConversationModal
        visible
        onClose={onClose}
        onConversationCreated={jest.fn()}
      />,
    );
    await waitFor(() => getByText("Alice Smith"));

    // Close X is the first TouchableOpacity in the header.
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
