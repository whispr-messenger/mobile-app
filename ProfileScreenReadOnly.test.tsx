import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { ProfileScreen } from "./src/screens/Profile/ProfileScreen";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    reset: jest.fn(),
  }),
  useRoute: () => ({
    params: { userId: "other-user-456" },
  }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(() => cb(), []);
  },
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
  requestCameraPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: "Images" },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("./src/context/AuthContext", () => ({
  useAuth: () => ({ userId: "current-user-123" }),
}));
jest.mock("./src/components", () => ({
  Logo: () => null,
  Button: ({ title, onPress, disabled }: any) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled}>
        <Text>{title}</Text>
      </TouchableOpacity>
    );
  },
}));
jest.mock("./src/services", () => {
  const singleton = {
    getProfile: jest.fn().mockResolvedValue({ success: false }),
    getUserProfile: jest.fn().mockResolvedValue({
      success: true,
      profile: {
        id: "other-user-456",
        firstName: "Alice",
        lastName: "Martin",
        username: "alice",
        phoneNumber: "+33611112222",
        biography: "Bio d'Alice",
      },
    }),
    updateProfile: jest.fn().mockResolvedValue({ success: true }),
  };
  return { UserService: { getInstance: () => singleton } };
});
jest.mock("./src/services/MediaService", () => ({
  MediaService: {
    uploadMedia: jest
      .fn()
      .mockResolvedValue({ id: "media-1", url: "https://cdn.test/img.jpg" }),
  },
}));
jest.mock("./src/theme/colors", () => ({
  colors: {
    background: {
      gradient: { app: ["#000", "#111"] },
      primary: "#000",
      secondary: "#111",
      dark: "#000",
    },
    text: {
      light: "#fff",
      secondary: "#aaa",
      placeholder: "#666",
      primary: "#000",
    },
    primary: { main: "#6200ee" },
    ui: { error: "#f00", border: "#333" },
    status: { online: "#0f0", offline: "#888" },
  },
  withOpacity: (c: string) => c,
}));
jest.mock("./src/theme", () => ({
  colors: {
    text: {
      light: "#fff",
      secondary: "#aaa",
      placeholder: "#666",
      primary: "#000",
    },
    primary: { main: "#6200ee" },
    background: {
      primary: "#000",
      secondary: "#111",
      gradient: { app: ["#000", "#111"] },
    },
    ui: { error: "#f00", border: "#333" },
    status: { online: "#0f0", offline: "#888" },
  },
  spacing: { xl: 24, xs: 4, md: 16, lg: 20, sm: 8, xxxl: 40 },
  typography: {
    fontSize: { xl: 24, base: 14, sm: 12, lg: 18, xxxl: 32, xs: 10 },
    fontWeight: { bold: "700", medium: "500", semiBold: "600" },
  },
  borderRadius: { lg: 12, xl: 20 },
  shadows: {},
}));

describe("ProfileScreen — viewing another user", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hides the 'Modifier le profil' button when viewing another user", async () => {
    const { queryByText, getByText } = render(<ProfileScreen />);
    await waitFor(() => expect(getByText("Alice Martin")).toBeTruthy());
    expect(queryByText("Modifier le profil")).toBeNull();
    expect(queryByText("Sauvegarder")).toBeNull();
  });

  it("never calls updateProfile when viewing another user", async () => {
    const services = require("./src/services") as {
      UserService: {
        getInstance: () => {
          updateProfile: jest.Mock;
          getUserProfile: jest.Mock;
        };
      };
    };
    const instance = services.UserService.getInstance();

    const { getByText } = render(<ProfileScreen />);
    await waitFor(() => expect(getByText("Alice Martin")).toBeTruthy());

    expect(instance.getUserProfile).toHaveBeenCalledWith("other-user-456");
    expect(instance.updateProfile).not.toHaveBeenCalled();
  });
});
