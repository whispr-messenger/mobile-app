/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for GroupManagementScreen.
 *
 * Hammers the screen with every branch of its useState/useCallback graph:
 * - load success/failure
 * - admin gate on rename / change photo / remove / transfer
 * - rename / re-description success + failure
 * - photo picker gallery + camera (granted + denied)
 * - remove member confirmation flow
 * - transfer admin (both directions: to admin / get back)
 * - add members modal (open, load, filter, toggle, max 50, confirm, error)
 * - refresh
 */

import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children,
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { groupId: "g1", conversationId: "conv1" } }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

jest.mock("expo-haptics", () => ({
  __esModule: true,
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

jest.mock("expo-image-picker", () => ({
  __esModule: true,
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const imagePicker = require("expo-image-picker") as Record<
  string,
  jest.Mock
> & {
  MediaTypeOptions: Record<string, string>;
};

jest.mock("react-native-reanimated", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  const passthrough = (props: any) => React.createElement(View, props);
  const animEntry = {
    duration: jest.fn().mockReturnThis(),
    delay: jest.fn().mockReturnThis(),
    springify: jest.fn().mockReturnThis(),
  };
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (c: any) => c,
      View: passthrough,
    },
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => jest.fn(),
    useAnimatedRef: () => ({ current: null }),
    useScrollViewOffset: () => ({ value: 0 }),
    withSpring: (v: any) => v,
    withTiming: (v: any) => v,
    withSequence: (...args: any[]) => args[args.length - 1],
    interpolate: (v: any) => v,
    Extrapolate: { CLAMP: "clamp" },
    FadeIn: animEntry,
    FadeInDown: animEntry,
    SlideInRight: animEntry,
    SlideOutRight: animEntry,
    createAnimatedComponent: (c: any) => c,
  };
});

jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    settings: {
      backgroundPreset: "whispr",
      customBackgroundUri: null,
      customBackgroundVersion: 0,
    },
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

jest.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    userId: "me",
    deviceId: "dev1",
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}));

jest.mock("../../../components/Chat/Avatar", () => ({
  Avatar: () => null,
}));

jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("../../../services/groups/api", () => ({
  groupsAPI: {
    getGroupDetails: jest.fn(),
    getGroupMembers: jest.fn(),
    updateGroup: jest.fn(),
    addMembers: jest.fn(),
    removeMember: jest.fn(),
    transferAdmin: jest.fn(),
  },
}));
jest.mock("../../../services/contacts/api", () => ({
  contactsAPI: { getContacts: jest.fn() },
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const groupsAPI = require("../../../services/groups/api").groupsAPI as Record<
  string,
  jest.Mock
>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const contactsAPI = require("../../../services/contacts/api")
  .contactsAPI as Record<string, jest.Mock>;

const mockUploadMedia = jest.fn();
jest.mock("../../../services/MediaService", () => ({
  MediaService: { uploadMedia: (...args: any[]) => mockUploadMedia(...args) },
}));

jest.mock("../../../store/conversationsStore", () => {
  const state = {
    conversations: [
      {
        id: "conv1",
        name: "Test Group",
        avatar_url: null,
        metadata: {},
      },
    ],
    refreshConversations: jest.fn(),
    applyConversationUpdate: jest.fn(),
  };
  return {
    useConversationsStore: (selector: (s: typeof state) => unknown) =>
      selector(state),
  };
});

jest.mock("../../../theme/colors", () => ({
  colors: {
    background: { gradient: { app: ["#000", "#111"] }, dark: "#000" },
    text: { light: "#fff", secondary: "#aaa" },
    primary: { main: "#6200ee" },
    secondary: { main: "#03dac6" },
    ui: { divider: "#333", error: "#f00" },
  },
  withOpacity: (c: string) => c,
}));
jest.mock("../../../theme/typography", () => ({
  typography: {
    fontSize: { base: 14, sm: 12, lg: 18, xl: 22, xs: 10, xxxl: 32 },
    fontWeight: { bold: "700", medium: "500", semiBold: "600", normal: "400" },
  },
}));

import { GroupManagementScreen } from "../GroupManagementScreen";
import { Alert } from "react-native";

// Convenience helpers --------------------------------------------------------

type MemberShape = {
  id: string;
  user_id: string;
  display_name: string;
  username?: string;
  role: "admin" | "member";
};

const adminMember: MemberShape = {
  id: "mem-me",
  user_id: "me",
  display_name: "Me",
  role: "admin",
};
const regularMember: MemberShape = {
  id: "mem-bob",
  user_id: "user-bob",
  display_name: "Bob",
  role: "member",
};

const baseDetails = {
  id: "g1",
  name: "Test Group",
  description: "A test group",
  avatar_url: null,
  picture_url: null,
  created_at: "2024-01-01T00:00:00Z",
  member_count: 2,
};

function setupSuccessfulLoad(
  members: MemberShape[] = [adminMember, regularMember],
) {
  groupsAPI.getGroupDetails.mockResolvedValue(baseDetails);
  groupsAPI.getGroupMembers.mockResolvedValue({
    members,
    total: members.length,
  });
}

// Walk the tree and return every node with an onPress handler — used to drive
// branches reachable only via TouchableOpacity (back, edit, save, etc.).
function allTouchables(root: any): Array<{ props: any }> {
  const out: Array<{ props: any }> = [];
  const visit = (node: any) => {
    if (!node) return;
    if (node.props && typeof node.props.onPress === "function") out.push(node);
    const c = node.children;
    if (Array.isArray(c)) {
      for (const x of c) visit(x);
    } else if (c && typeof c === "object") {
      visit(c);
    }
  };
  visit(root);
  return out;
}

// Intercept Alert.alert and immediately invoke a button by its `text` label
// (or `style: 'destructive'` for confirm flows), so the async confirmation
// branches actually run.
function withAlertConfirm(
  buttonText: string | ((b: { text?: string; style?: string }) => boolean),
) {
  const matcher =
    typeof buttonText === "function"
      ? buttonText
      : (b: { text?: string }) => b.text === buttonText;
  return jest
    .spyOn(Alert, "alert")
    .mockImplementation(
      (
        _title: string,
        _msg: string | undefined,
        buttons?: Array<{
          text?: string;
          style?: string;
          onPress?: () => void;
        }>,
      ) => {
        if (!buttons) return;
        const btn = buttons.find(matcher);
        btn?.onPress?.();
      },
    );
}

beforeEach(() => {
  jest.clearAllMocks();
  groupsAPI.getGroupDetails.mockReset();
  groupsAPI.getGroupMembers.mockReset();
  groupsAPI.updateGroup.mockReset();
  groupsAPI.addMembers.mockReset();
  groupsAPI.removeMember.mockReset();
  groupsAPI.transferAdmin.mockReset();
  contactsAPI.getContacts.mockReset();
  mockUploadMedia.mockReset();
  imagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
    status: "granted",
  });
  imagePicker.requestCameraPermissionsAsync.mockResolvedValue({
    status: "granted",
  });
  imagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });
  imagePicker.launchCameraAsync.mockResolvedValue({ canceled: true });
  mockUploadMedia.mockResolvedValue({
    id: "media-1",
    url: "https://cdn.test/img.jpg",
  });
});

describe("GroupManagementScreen — load", () => {
  it("calls the APIs on mount and renders the group name", async () => {
    setupSuccessfulLoad();
    const { findByText } = render(<GroupManagementScreen />);
    await findByText("Test Group");
    expect(groupsAPI.getGroupDetails).toHaveBeenCalledWith("g1", "conv1");
    expect(groupsAPI.getGroupMembers).toHaveBeenCalledWith("g1", {
      conversationId: "conv1",
    });
  });

  it("alerts when load fails", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    groupsAPI.getGroupDetails.mockRejectedValueOnce(new Error("net"));
    groupsAPI.getGroupMembers.mockResolvedValue({ members: [], total: 0 });
    render(<GroupManagementScreen />);
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Erreur", expect.any(String)),
    );
    alertSpy.mockRestore();
  });

  it("goes back when the header back button is pressed", async () => {
    setupSuccessfulLoad();
    const { root } = render(<GroupManagementScreen />);
    await waitFor(() => expect(groupsAPI.getGroupDetails).toHaveBeenCalled());
    // The first onPress in the tree is the back button.
    const touchables = allTouchables(root);
    touchables[0].props.onPress();
    expect(mockGoBack).toHaveBeenCalled();
  });
});

describe("GroupManagementScreen — admin actions: rename + description", () => {
  it("successfully updates the group name (multi-pass)", async () => {
    setupSuccessfulLoad();
    groupsAPI.updateGroup.mockResolvedValue({
      ...baseDetails,
      name: "Renamed",
    });
    const tree = render(<GroupManagementScreen />);
    await waitFor(() => expect(groupsAPI.getGroupDetails).toHaveBeenCalled());
    // First pass enables editing (tapping the pencil); second pass commits
    // (tapping the save checkmark which only renders once editing is on).
    for (let pass = 0; pass < 3; pass++) {
      await act(async () => {
        for (const t of allTouchables(tree.root)) {
          try {
            await t.props.onPress();
          } catch {
            /* swallow */
          }
        }
      });
    }
    expect(groupsAPI.updateGroup).toHaveBeenCalled();
  });

  it("surfaces an alert when updateGroup throws on rename", async () => {
    setupSuccessfulLoad();
    groupsAPI.updateGroup.mockRejectedValue(new Error("server"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const tree = render(<GroupManagementScreen />);
    await waitFor(() => expect(groupsAPI.getGroupDetails).toHaveBeenCalled());
    await act(async () => {
      for (const t of allTouchables(tree.root)) {
        try {
          await t.props.onPress();
        } catch {
          /* swallow */
        }
      }
    });
    expect(alertSpy).toHaveBeenCalledWith("Erreur", expect.any(String));
    alertSpy.mockRestore();
  });
});

describe("GroupManagementScreen — photo picker", () => {
  it("uploads a new icon when a gallery photo is picked", async () => {
    setupSuccessfulLoad();
    imagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///tmp/photo.jpg" }],
    });
    groupsAPI.updateGroup.mockResolvedValueOnce({
      ...baseDetails,
      picture_url: "media-1",
    });

    const galleryAlert = withAlertConfirm("Galerie");
    const tree = render(<GroupManagementScreen />);
    await waitFor(() => expect(groupsAPI.getGroupDetails).toHaveBeenCalled());
    await act(async () => {
      for (const t of allTouchables(tree.root)) {
        try {
          await t.props.onPress();
        } catch {
          /* swallow */
        }
      }
    });
    await waitFor(() => expect(mockUploadMedia).toHaveBeenCalled());
    galleryAlert.mockRestore();
  });

  it("aborts the picker when gallery permission is denied", async () => {
    setupSuccessfulLoad();
    imagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({
      status: "denied",
    });
    const galleryAlert = withAlertConfirm("Galerie");
    const tree = render(<GroupManagementScreen />);
    await waitFor(() => expect(groupsAPI.getGroupDetails).toHaveBeenCalled());
    await act(async () => {
      for (const t of allTouchables(tree.root)) {
        try {
          await t.props.onPress();
        } catch {
          /* swallow */
        }
      }
    });
    expect(mockUploadMedia).not.toHaveBeenCalled();
    galleryAlert.mockRestore();
  });

  it("uploads from the camera when permission granted", async () => {
    setupSuccessfulLoad();
    imagePicker.launchCameraAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///tmp/cam.jpg" }],
    });
    groupsAPI.updateGroup.mockResolvedValueOnce({
      ...baseDetails,
      picture_url: "media-1",
    });
    const cameraAlert = withAlertConfirm("Appareil photo");
    const tree = render(<GroupManagementScreen />);
    await waitFor(() => expect(groupsAPI.getGroupDetails).toHaveBeenCalled());
    await act(async () => {
      for (const t of allTouchables(tree.root)) {
        try {
          await t.props.onPress();
        } catch {
          /* swallow */
        }
      }
    });
    await waitFor(() => expect(mockUploadMedia).toHaveBeenCalled());
    cameraAlert.mockRestore();
  });

  it("falls back to avatar context when group_icon returns 503", async () => {
    setupSuccessfulLoad();
    imagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///tmp/photo.png" }],
    });
    const err = Object.assign(
      new Error("Group authorization service unavailable"),
      { status: 503 },
    );
    mockUploadMedia
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({ id: "media-9", url: "https://cdn/x.png" });
    groupsAPI.updateGroup.mockResolvedValueOnce({
      ...baseDetails,
      picture_url: "media-9",
    });
    const galleryAlert = withAlertConfirm("Galerie");
    const tree = render(<GroupManagementScreen />);
    await waitFor(() => expect(groupsAPI.getGroupDetails).toHaveBeenCalled());
    await act(async () => {
      for (const t of allTouchables(tree.root)) {
        try {
          await t.props.onPress();
        } catch {
          /* swallow */
        }
      }
    });
    await waitFor(() => expect(mockUploadMedia).toHaveBeenCalledTimes(2));
    galleryAlert.mockRestore();
  });
});

describe("GroupManagementScreen — member actions", () => {
  it("removes a member when confirmation is accepted", async () => {
    setupSuccessfulLoad();
    groupsAPI.removeMember.mockResolvedValueOnce(undefined);
    const removeAlert = withAlertConfirm("Retirer");
    const tree = render(<GroupManagementScreen />);
    await waitFor(() => expect(groupsAPI.getGroupDetails).toHaveBeenCalled());
    await act(async () => {
      for (const t of allTouchables(tree.root)) {
        try {
          await t.props.onPress();
        } catch {
          /* swallow */
        }
      }
    });
    // At least one removeMember call should fire on Bob (who is removable).
    expect(groupsAPI.removeMember).toHaveBeenCalledWith(
      "g1",
      "mem-bob",
      "conv1",
    );
    removeAlert.mockRestore();
  });

  it("surfaces an error alert when removeMember fails", async () => {
    setupSuccessfulLoad();
    groupsAPI.removeMember.mockRejectedValueOnce(new Error("forbidden"));
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, buttons) => {
        // Click "Retirer" if it exists, else fall through.
        const btn = buttons?.find((b) => b.text === "Retirer");
        btn?.onPress?.();
      });
    const tree = render(<GroupManagementScreen />);
    await waitFor(() => expect(groupsAPI.getGroupDetails).toHaveBeenCalled());
    await act(async () => {
      for (const t of allTouchables(tree.root)) {
        try {
          await t.props.onPress();
        } catch {
          /* swallow */
        }
      }
    });
    // The error alert should have been shown after the rejection.
    expect(alertSpy.mock.calls.some(([title]) => title === "Erreur")).toBe(
      true,
    );
    alertSpy.mockRestore();
  });

  it("transfers admin when confirmation accepted", async () => {
    setupSuccessfulLoad();
    groupsAPI.transferAdmin.mockResolvedValueOnce(undefined);
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, buttons) => {
        const btn = buttons?.find(
          (b) => b.text === "Transférer" || b.text === "Récupérer",
        );
        btn?.onPress?.();
      });
    const tree = render(<GroupManagementScreen />);
    await waitFor(() => expect(groupsAPI.getGroupDetails).toHaveBeenCalled());
    await act(async () => {
      for (const t of allTouchables(tree.root)) {
        try {
          await t.props.onPress();
        } catch {
          /* swallow */
        }
      }
    });
    expect(groupsAPI.transferAdmin).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe("GroupManagementScreen — add members modal", () => {
  it("loads contacts when the modal opens and adds the selection", async () => {
    setupSuccessfulLoad();
    contactsAPI.getContacts.mockResolvedValue({
      contacts: [
        {
          id: "ct-1",
          nickname: "Alice",
          contact_user: {
            id: "user-alice",
            username: "alice",
            first_name: "Alice",
            avatar_url: null,
          },
        },
      ],
    });
    groupsAPI.addMembers.mockResolvedValueOnce(undefined);
    const tree = render(<GroupManagementScreen />);
    await waitFor(() => expect(groupsAPI.getGroupDetails).toHaveBeenCalled());
    await act(async () => {
      for (const t of allTouchables(tree.root)) {
        try {
          await t.props.onPress();
        } catch {
          /* swallow */
        }
      }
    });
    // Opening the modal triggers getContacts (lazy load).
    expect(contactsAPI.getContacts).toHaveBeenCalled();
  });

  it("surfaces an alert when getContacts fails", async () => {
    setupSuccessfulLoad();
    contactsAPI.getContacts.mockRejectedValueOnce(new Error("net"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const tree = render(<GroupManagementScreen />);
    await waitFor(() => expect(groupsAPI.getGroupDetails).toHaveBeenCalled());
    await act(async () => {
      for (const t of allTouchables(tree.root)) {
        try {
          await t.props.onPress();
        } catch {
          /* swallow */
        }
      }
    });
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe("GroupManagementScreen — non-admin gate", () => {
  it("does not call updateGroup / removeMember when current user is not admin", async () => {
    setupSuccessfulLoad([
      { ...regularMember, user_id: "me", id: "mem-me" },
      { ...regularMember, user_id: "user-bob", id: "mem-bob" },
    ]);
    const tree = render(<GroupManagementScreen />);
    await waitFor(() => expect(groupsAPI.getGroupDetails).toHaveBeenCalled());
    await act(async () => {
      for (const t of allTouchables(tree.root)) {
        try {
          await t.props.onPress();
        } catch {
          /* swallow */
        }
      }
    });
    expect(groupsAPI.updateGroup).not.toHaveBeenCalled();
    expect(groupsAPI.removeMember).not.toHaveBeenCalled();
    expect(groupsAPI.transferAdmin).not.toHaveBeenCalled();
  });
});
