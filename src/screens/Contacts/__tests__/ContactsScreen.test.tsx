import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { ContactsScreen } from "./src/screens/Contacts/ContactsScreen";
import { contactsAPI } from "./src/services/contacts/api";
import { messagingAPI } from "./src/services/messaging/api";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(() => cb(), []);
  },
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("./src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: {
        gradient: ["#000", "#111"],
        primary: "#000",
        secondary: "#111",
      },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#555" },
      primary: "#6200ee",
    }),
    getFontSize: () => 16,
    getLocalizedText: (key: string) => key,
  }),
}));
jest.mock("./src/context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    userId: "user1",
    deviceId: "dev1",
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}));
jest.mock("./src/hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    joinConversationChannel: jest
      .fn()
      .mockReturnValue({ channel: null, cleanup: jest.fn() }),
    sendMessage: jest.fn(),
    markAsRead: jest.fn(),
    sendTyping: jest.fn(),
  }),
}));
jest.mock("./src/services/TokenService", () => ({
  TokenService: { getAccessToken: jest.fn().mockResolvedValue("tok") },
}));
jest.mock("./src/services/contacts/api", () => ({
  contactsAPI: {
    getContacts: jest.fn(),
    getContactRequests: jest.fn(),
    acceptContactRequest: jest.fn(),
    refuseContactRequest: jest.fn(),
  },
}));
jest.mock("./src/services/messaging/api", () => ({
  messagingAPI: {
    createDirectConversation: jest.fn(),
  },
}));
jest.mock("./src/components/Contacts/ContactItem", () => ({
  ContactItem: ({ contact, onPress }: any) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <TouchableOpacity onPress={() => onPress(contact)}>
        <Text>{contact.contact_user?.firstName || "Contact"}</Text>
      </TouchableOpacity>
    );
  },
}));
jest.mock("./src/components/Contacts/AddContactModal", () => ({
  AddContactModal: () => null,
}));
jest.mock("./src/components/Contacts/EditContactModal", () => ({
  EditContactModal: () => null,
}));
jest.mock("./src/components/Contacts/SyncContactsModal", () => ({
  SyncContactsModal: () => null,
}));
jest.mock("./src/components/Contacts/DeleteContactModal", () => ({
  DeleteContactModal: () => null,
}));
jest.mock("expo-blur", () => ({
  BlurView: ({ children }: any) => children,
}));
jest.mock("./src/theme/colors", () => ({
  colors: {
    background: { gradient: { app: ["#000", "#111"] } },
    primary: { main: "#6200ee", light: "#9c57ff" },
    secondary: { main: "#ff4882" },
    text: { light: "#fff" },
    ui: { success: "#0f0", error: "#f00" },
  },
  withOpacity: (color: string) => color,
}));
jest.mock("./src/components/Chat/SkeletonLoader", () => ({
  ContactItemSkeleton: () => null,
  SkeletonLoader: () => null,
  ConversationSkeleton: () => null,
  MessageBubbleSkeleton: () => null,
  InboxItemSkeleton: () => null,
}));
const mockBellIcon = jest.fn(() => null);
jest.mock("./src/components/Common/BellIcon", () => ({
  BellIcon: (props: any) => mockBellIcon(props),
}));
jest.mock("./src/components/Common/InboxPanel", () => ({
  InboxPanel: () => null,
}));
jest.mock("./src/store/inboxStore", () => ({
  useInboxStore: (sel: any) => sel({ unread_count: 0, hydrate: jest.fn() }),
}));
jest.mock("./src/services/contacts/favorites", () => ({
  getFavoriteIds: jest.fn().mockResolvedValue(new Set()),
  toggleFavorite: jest.fn().mockResolvedValue(false),
}));
jest.mock("./src/utils/contactsFilter", () => ({
  filterAndSortContacts: (_contacts: any[]) => _contacts,
}));

const mockedContactsAPI = contactsAPI as jest.Mocked<typeof contactsAPI>;
const mockedMessagingAPI = messagingAPI as jest.Mocked<typeof messagingAPI>;

describe("ContactsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBellIcon.mockClear();
    mockedContactsAPI.getContacts.mockResolvedValue({ contacts: [] });
    mockedContactsAPI.getContactRequests.mockResolvedValue([]);
  });

  it("renders contacts header", async () => {
    const { getAllByText } = render(<ContactsScreen />);
    expect(getAllByText("Contacts").length).toBeGreaterThan(0);
  });

  it("affiche le BellIcon dans le header", () => {
    render(<ContactsScreen />);
    expect(mockBellIcon).toHaveBeenCalled();
  });

  it("shows empty state when no contacts", async () => {
    const { getByText } = render(<ContactsScreen />);
    await waitFor(() => {
      expect(getByText("Aucun contact")).toBeTruthy();
    });
  });

  it("renders contacts list", async () => {
    mockedContactsAPI.getContacts.mockResolvedValue({
      contacts: [
        {
          id: "c1",
          contact_id: "u2",
          contact_user: { id: "u2", firstName: "Alice", username: "alice" },
          is_favorite: false,
        },
      ],
    });
    const { getByText } = render(<ContactsScreen />);
    await waitFor(() => {
      expect(getByText("Alice")).toBeTruthy();
    });
  });

  it("navigates to Chat on contact press", async () => {
    mockedContactsAPI.getContacts.mockResolvedValue({
      contacts: [
        {
          id: "c1",
          contact_id: "u2",
          contact_user: { id: "u2", firstName: "Alice", username: "alice" },
          is_favorite: false,
        },
      ],
    });
    mockedMessagingAPI.createDirectConversation.mockResolvedValue({
      id: "conv1",
    });

    const { getByText } = render(<ContactsScreen />);
    await waitFor(() => getByText("Alice"));
    fireEvent.press(getByText("Alice"));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("Chat", {
        conversationId: "conv1",
      });
    });
  });
});
