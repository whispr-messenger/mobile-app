import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { UserProfileScreen } from "../src/screens/Profile/UserProfileScreen";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    reset: jest.fn(),
  }),
  useRoute: () => ({ params: { userId: "other-user-456" } }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(() => cb(), []);
  },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../src/components/Chat/Avatar", () => ({
  Avatar: () => null,
}));
jest.mock("../src/services", () => {
  const singleton = {
    getProfile: jest.fn(),
    getUserProfile: jest.fn().mockResolvedValue({
      success: true,
      profile: {
        id: "other-user-456",
        firstName: "Alice",
        lastName: "Martin",
        username: "alice",
        biography: "Bio d'Alice",
      },
    }),
    updateProfile: jest.fn(),
  };
  return { UserService: { getInstance: () => singleton } };
});
jest.mock("../src/theme/colors", () => ({
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
jest.mock("../src/theme", () => ({
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

describe("UserProfileScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls getUserProfile with the route userId", async () => {
    const services = require("../src/services") as {
      UserService: {
        getInstance: () => { getUserProfile: jest.Mock };
      };
    };
    const instance = services.UserService.getInstance();

    const { getByText } = render(<UserProfileScreen />);
    await waitFor(() => expect(getByText("Alice Martin")).toBeTruthy());
    expect(instance.getUserProfile).toHaveBeenCalledWith("other-user-456");
  });

  it("does not render an edit pencil nor a Save button", async () => {
    const { queryByLabelText, queryByText, getByText } = render(
      <UserProfileScreen />,
    );
    await waitFor(() => expect(getByText("Alice Martin")).toBeTruthy());

    expect(queryByLabelText("Modifier le profil")).toBeNull();
    expect(queryByText("Sauvegarder")).toBeNull();
  });

  it("does not render the phone number field", async () => {
    const { queryByText, getByText } = render(<UserProfileScreen />);
    await waitFor(() => expect(getByText("Alice Martin")).toBeTruthy());

    expect(queryByText("Numéro de téléphone")).toBeNull();
  });

  it("never calls updateProfile", async () => {
    const services = require("../src/services") as {
      UserService: {
        getInstance: () => { updateProfile: jest.Mock };
      };
    };
    const instance = services.UserService.getInstance();

    const { getByText } = render(<UserProfileScreen />);
    await waitFor(() => expect(getByText("Alice Martin")).toBeTruthy());

    expect(instance.updateProfile).not.toHaveBeenCalled();
  });
});
