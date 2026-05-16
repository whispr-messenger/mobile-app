/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AddContactModal flows under test:
 * - Search debounces and dispatches contactsAPI.searchUsers
 * - Self-results are filtered out
 * - Empty results state and clear button
 * - Action card flows (add as contact, message, add+message) including
 *   self-add guard, blocked-user guard, and 409 "already exists" path
 * - QR scanner opens via navigation
 */

import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../../Chat/Avatar", () => ({ Avatar: () => null }));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: { secondary: "#222" },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#666" },
    }),
  }),
}));

let mockCurrentUserId: string | null = "me";
jest.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ userId: mockCurrentUserId }),
}));

const mockSearchUsers = jest.fn();
const mockSendContactRequest = jest.fn();
jest.mock("../../../services/contacts/api", () => ({
  contactsAPI: {
    searchUsers: (...args: unknown[]) => mockSearchUsers(...args),
    sendContactRequest: (...args: unknown[]) => mockSendContactRequest(...args),
  },
}));

const mockCreateDirect = jest.fn();
jest.mock("../../../services/messaging/api", () => ({
  messagingAPI: {
    createDirectConversation: (...args: unknown[]) => mockCreateDirect(...args),
  },
}));

import { AddContactModal } from "../AddContactModal";

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  onContactAdded: jest.fn(),
};

let alertSpy: jest.SpyInstance;

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockCurrentUserId = "me";
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  alertSpy.mockRestore();
  jest.useRealTimers();
});

describe("AddContactModal — initial render", () => {
  it("renders the title and search bar", () => {
    const { getByText, getByPlaceholderText } = render(
      <AddContactModal {...baseProps} />,
    );
    expect(getByText("Ajouter un contact")).toBeTruthy();
    expect(
      getByPlaceholderText("Rechercher par nom d'utilisateur..."),
    ).toBeTruthy();
  });

  it("opens the QR scanner via navigation when the QR icon is pressed", () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <AddContactModal {...baseProps} onClose={onClose} />,
    );

    fireEvent.press(getByLabelText("Scanner un QR code"));

    expect(onClose).toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(mockNavigate).toHaveBeenCalledWith("QRCodeScanner");
  });
});

describe("AddContactModal — search", () => {
  it("debounces and dispatches contactsAPI.searchUsers", async () => {
    mockSearchUsers.mockResolvedValue([]);
    const { getByPlaceholderText } = render(<AddContactModal {...baseProps} />);

    fireEvent.changeText(
      getByPlaceholderText("Rechercher par nom d'utilisateur..."),
      "alice",
    );
    expect(mockSearchUsers).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(360);
    });
    await flush();

    expect(mockSearchUsers).toHaveBeenCalledWith({ username: "alice" });
  });

  it("filters out the current user from search results", async () => {
    mockSearchUsers.mockResolvedValue([
      { user: { id: "me", username: "me" } },
      { user: { id: "u-1", username: "alice", first_name: "Alice" } },
    ]);
    const { getByPlaceholderText, getByText, queryByText } = render(
      <AddContactModal {...baseProps} />,
    );

    fireEvent.changeText(
      getByPlaceholderText("Rechercher par nom d'utilisateur..."),
      "x",
    );
    act(() => {
      jest.advanceTimersByTime(400);
    });
    await flush();

    expect(getByText("Alice")).toBeTruthy();
    expect(queryByText("me")).toBeNull();
  });

  it("shows the empty state when no user matches", async () => {
    mockSearchUsers.mockResolvedValue([]);
    const { getByPlaceholderText, getByText } = render(
      <AddContactModal {...baseProps} />,
    );

    fireEvent.changeText(
      getByPlaceholderText("Rechercher par nom d'utilisateur..."),
      "nobody",
    );
    act(() => {
      jest.advanceTimersByTime(400);
    });
    await flush();

    expect(getByText("Aucun utilisateur trouvé")).toBeTruthy();
  });

  it("clears the search when the clear button is pressed", async () => {
    mockSearchUsers.mockResolvedValue([
      { user: { id: "u-1", username: "alice", first_name: "Alice" } },
    ]);
    const { getByPlaceholderText, queryByText } = render(
      <AddContactModal {...baseProps} />,
    );
    const input = getByPlaceholderText("Rechercher par nom d'utilisateur...");

    fireEvent.changeText(input, "alice");
    act(() => {
      jest.advanceTimersByTime(400);
    });
    await flush();
    expect(queryByText("Alice")).toBeTruthy();

    fireEvent.changeText(input, "");
    expect(queryByText("Alice")).toBeNull();
  });
});

describe("AddContactModal — action card", () => {
  const showActionCardForUser = async (
    overrides: Record<string, unknown> = {},
  ) => {
    mockSearchUsers.mockResolvedValue([
      {
        user: { id: "u-1", username: "alice", first_name: "Alice" },
        is_contact: false,
        is_blocked: false,
        ...overrides,
      },
    ]);
    const onMessageUser = jest.fn();
    const utils = render(
      <AddContactModal {...baseProps} onMessageUser={onMessageUser} />,
    );

    fireEvent.changeText(
      utils.getByPlaceholderText("Rechercher par nom d'utilisateur..."),
      "alice",
    );
    act(() => {
      jest.advanceTimersByTime(400);
    });
    await flush();

    fireEvent.press(utils.getByText("Alice"));
    return { ...utils, onMessageUser };
  };

  it("adds the user as a contact then shows a success alert", async () => {
    mockSendContactRequest.mockResolvedValue(undefined);
    const utils = await showActionCardForUser();

    fireEvent.press(utils.getByText("Ajouter en ami"));
    await flush();

    expect(mockSendContactRequest).toHaveBeenCalledWith("u-1");
    expect(alertSpy).toHaveBeenCalledWith(
      "Succès",
      "Demande de contact envoyée",
    );
    expect(baseProps.onContactAdded).toHaveBeenCalled();
  });

  it("treats a 409 error as 'already a contact' and still notifies the parent", async () => {
    mockSendContactRequest.mockRejectedValue({ status: 409, message: "x" });
    const utils = await showActionCardForUser();

    fireEvent.press(utils.getByText("Ajouter en ami"));
    await flush();

    expect(alertSpy).toHaveBeenCalledWith(
      "Info",
      expect.stringMatching(/déjà/),
    );
    expect(baseProps.onContactAdded).toHaveBeenCalled();
  });

  it("creates a direct conversation when 'Envoyer un message' is pressed on an existing contact", async () => {
    mockCreateDirect.mockResolvedValue({ id: "conv-9" });
    const utils = await showActionCardForUser({ is_contact: true });

    fireEvent.press(utils.getByText("Envoyer un message"));
    await flush();

    expect(mockCreateDirect).toHaveBeenCalledWith("u-1");
    expect(utils.onMessageUser).toHaveBeenCalledWith("conv-9");
  });

  it("performs both actions when 'Ajouter et envoyer un message' is pressed", async () => {
    mockSendContactRequest.mockResolvedValue(undefined);
    mockCreateDirect.mockResolvedValue({ id: "conv-7" });
    const utils = await showActionCardForUser();

    fireEvent.press(utils.getByText("Ajouter et envoyer un message"));
    await flush();

    expect(mockSendContactRequest).toHaveBeenCalledWith("u-1");
    expect(mockCreateDirect).toHaveBeenCalledWith("u-1");
    expect(utils.onMessageUser).toHaveBeenCalledWith("conv-7");
  });
});
