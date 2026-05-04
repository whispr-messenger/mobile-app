import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { MyProfileScreen } from "./src/screens/Profile/MyProfileScreen";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    reset: jest.fn(),
  }),
  useRoute: () => ({ params: {} }),
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
jest.mock("./src/components/Chat/Avatar", () => ({
  Avatar: () => null,
}));
jest.mock("./src/context/AuthContext", () => ({
  useAuth: () => ({ userId: "user-123" }),
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
    getProfile: jest.fn().mockResolvedValue({
      success: true,
      profile: {
        id: "user-123",
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
        phoneNumber: "+33612345678",
        biography: "",
      },
    }),
    getUserProfile: jest.fn(),
    updateProfile: jest.fn().mockResolvedValue({ success: true }),
  };
  return { UserService: { getInstance: () => singleton } };
});
jest.mock("./src/services/MediaService", () => ({
  MediaService: {
    uploadMedia: jest
      .fn()
      .mockResolvedValue({ id: "media-1", url: "https://cdn.test/img.jpg" }),
    getMediaMetadata: jest.fn().mockResolvedValue({ id: "media-1" }),
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

describe("MyProfileScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders profile header", () => {
    const { getByText } = render(<MyProfileScreen />);
    expect(getByText("Profil")).toBeTruthy();
  });

  it("loads and renders profile data from UserService.getProfile", async () => {
    const { getByText } = render(<MyProfileScreen />);
    await waitFor(() => expect(getByText("John Doe")).toBeTruthy());
  });

  it("navigates back on back press when not editing", () => {
    const { getByText } = render(<MyProfileScreen />);
    fireEvent.press(getByText("← Retour"));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("enters edit mode and exposes a Save button", async () => {
    const { getByLabelText, getByText } = render(<MyProfileScreen />);
    fireEvent.press(getByLabelText("Modifier le profil"));
    await waitFor(() => expect(getByText("Sauvegarder")).toBeTruthy());
  });
});

describe("MyProfileScreen — save flow", () => {
  beforeEach(() => jest.clearAllMocks());

  it("aborts the save when a required field becomes empty", async () => {
    const services = require("./src/services") as {
      UserService: { getInstance: () => { updateProfile: jest.Mock } };
    };
    const mockInstance = services.UserService.getInstance();
    (mockInstance.updateProfile as jest.Mock).mockClear();

    const { getByLabelText, getByText, getByDisplayValue } = render(
      <MyProfileScreen />,
    );
    await waitFor(() => expect(getByText("John Doe")).toBeTruthy());

    fireEvent.press(getByLabelText("Modifier le profil"));
    fireEvent.changeText(getByDisplayValue("John"), "");
    fireEvent.press(getByText("Sauvegarder"));

    await waitFor(() =>
      expect(mockInstance.updateProfile).not.toHaveBeenCalled(),
    );
  });

  it("calls UserService.updateProfile on a successful save", async () => {
    const services = require("./src/services") as {
      UserService: {
        getInstance: () => {
          updateProfile: jest.Mock;
          getProfile: jest.Mock;
        };
      };
    };
    const mockInstance = services.UserService.getInstance();
    (mockInstance.updateProfile as jest.Mock).mockResolvedValueOnce({
      success: true,
      profile: {
        firstName: "Jane",
        lastName: "Doe",
        username: "johndoe",
        biography: "",
      },
    });

    const { getByLabelText, getByText, getByDisplayValue } = render(
      <MyProfileScreen />,
    );
    await waitFor(() => expect(getByText("John Doe")).toBeTruthy());

    fireEvent.press(getByLabelText("Modifier le profil"));
    fireEvent.changeText(getByDisplayValue("John"), "Jane");
    fireEvent.press(getByText("Sauvegarder"));

    await waitFor(() => {
      expect(mockInstance.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: "Jane" }),
      );
    });
  });

  it("allows typing a cyrillic username in edit mode and normalizes it on save", async () => {
    const services = require("./src/services") as {
      UserService: {
        getInstance: () => {
          updateProfile: jest.Mock;
        };
      };
    };
    const mockInstance = services.UserService.getInstance();
    (mockInstance.updateProfile as jest.Mock).mockClear();

    const { getByLabelText, getByText, getByDisplayValue } = render(
      <MyProfileScreen />,
    );
    await waitFor(() => expect(getByText("John Doe")).toBeTruthy());

    fireEvent.press(getByLabelText("Modifier le profil"));
    const usernameInput = getByDisplayValue("johndoe");
    fireEvent.changeText(usernameInput, "ДАЛМ1");

    expect(usernameInput.props.value).toBe("ДАЛМ1");

    fireEvent.press(getByText("Sauvegarder"));

    await waitFor(() => {
      expect(mockInstance.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ username: "далм1" }),
      );
    });
  });
});
