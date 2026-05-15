import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { GroupManagementScreen } from "../GroupManagementScreen";

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children,
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: { groupId: "g1", conversationId: "conv1" } }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: "Images" },
}));
// Inline mock for react-native-reanimated to avoid ESM parse error
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");
  const AnimatedView = (props: any) => React.createElement(View, props);
  const animEntry = {
    duration: jest.fn().mockReturnThis(),
    delay: jest.fn().mockReturnThis(),
    springify: jest.fn().mockReturnThis(),
  };
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (c: any) => c,
      View: AnimatedView,
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
    userId: "user1",
    deviceId: "dev1",
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}));
jest.mock("../../../components/Chat/Avatar", () => ({ Avatar: () => null }));
jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../services/groups/api", () => ({
  groupsAPI: {
    getGroupDetails: jest.fn().mockResolvedValue({
      id: "g1",
      name: "Test Group",
      description: "A test group",
      avatar_url: null,
      created_at: "2024-01-01T00:00:00Z",
      member_count: 3,
    }),
    getGroupMembers: jest.fn().mockResolvedValue([]),
    updateGroup: jest.fn().mockResolvedValue({}),
    addMember: jest.fn().mockResolvedValue({}),
    removeMember: jest.fn().mockResolvedValue({}),
    deleteGroup: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock("../../../services/contacts/api", () => ({
  contactsAPI: {
    getContacts: jest.fn().mockResolvedValue({ contacts: [] }),
  },
}));
jest.mock("../../../services/MediaService", () => ({
  MediaService: {
    uploadMedia: jest
      .fn()
      .mockResolvedValue({ id: "media-1", url: "https://cdn.test/img.jpg" }),
  },
}));
jest.mock("../../../theme/colors", () => ({
  colors: {
    background: { gradient: { app: ["#000", "#111"] }, dark: "#000" },
    text: { light: "#fff" },
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

describe("GroupManagementScreen", () => {
  it("renders without crashing", async () => {
    const { toJSON } = render(<GroupManagementScreen />);
    await waitFor(() => expect(toJSON()).toBeTruthy());
  });
});
