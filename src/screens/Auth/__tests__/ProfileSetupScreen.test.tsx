import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { ProfileSetupScreen } from "../ProfileSetupScreen";
import { profileSetupFlag } from "../../../services/profileSetupFlag";

const mockReset = jest.fn();
const mockNavigate = jest.fn();

jest.mock("../../../services/profileSetupFlag", () => ({
  profileSetupFlag: {
    get: jest.fn().mockResolvedValue(null),
    markPending: jest.fn().mockResolvedValue(undefined),
    markDone: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    reset: mockReset,
  }),
  useRoute: () => ({ params: {} }),
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));
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
jest.mock("../../../components", () => ({
  Button: ({ title, onPress, disabled }: any) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled}>
        <Text>{title}</Text>
      </TouchableOpacity>
    );
  },
  Input: ({ placeholder, value, onChangeText, error }: any) => {
    const { TextInput, Text, View } = require("react-native");
    return (
      <View>
        <TextInput
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
        />
        {error ? <Text testID={`error-${placeholder}`}>{error}</Text> : null}
      </View>
    );
  },
}));
jest.mock("../../../services/TokenService", () => ({
  TokenService: {
    getAccessToken: jest.fn().mockResolvedValue("tok"),
    decodeAccessToken: jest.fn().mockReturnValue({ sub: "user1" }),
  },
}));
const mockGetProfile = jest.fn().mockResolvedValue({
  success: true,
  profile: {
    firstName: "John",
    lastName: "Doe",
    username: "johndoe",
    phoneNumber: "+33612345678",
  },
});
const mockUpdateProfile = jest.fn().mockResolvedValue({ success: true });
jest.mock("../../../services", () => ({
  UserService: {
    getInstance: () => ({
      getProfile: mockGetProfile,
      updateProfile: mockUpdateProfile,
    }),
  },
}));
jest.mock("../../../services/MediaService", () => ({
  MediaService: {
    uploadMedia: jest
      .fn()
      .mockResolvedValue({ id: "media-1", url: "https://cdn.test/img.jpg" }),
  },
}));
jest.mock("../../../services/apiBase", () => ({
  getApiBaseUrl: () => "https://api.test.com",
}));
jest.mock("../../../theme", () => ({
  colors: { text: { light: "#fff" }, primary: { main: "#6200ee" } },
  spacing: { xl: 24, xs: 4, md: 16, lg: 20, sm: 8, xxxl: 40 },
  typography: { fontSize: { xxl: 28, base: 14, sm: 12 } },
}));

global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as any;

describe("ProfileSetupScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders form fields", () => {
    const { getByPlaceholderText } = render(<ProfileSetupScreen />);
    expect(getByPlaceholderText("auth.firstName")).toBeTruthy();
    expect(getByPlaceholderText("auth.lastName")).toBeTruthy();
    expect(getByPlaceholderText("Pseudo")).toBeTruthy();
  });

  it("renders save button", () => {
    const { getByText } = render(<ProfileSetupScreen />);
    expect(getByText("common.save")).toBeTruthy();
  });

  it("renders skip button", () => {
    const { getByText } = render(<ProfileSetupScreen />);
    expect(getByText(/auth.skip/)).toBeTruthy();
  });

  it("skip shows confirmation dialog and only navigates after user confirms", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        // Simulate the user tapping the second button ("Passer")
        const action = (buttons ?? [])[1];
        action?.onPress?.();
      });

    const { getByText } = render(<ProfileSetupScreen />);
    fireEvent.press(getByText(/auth.skip/));

    expect(alertSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "ConversationsList" }],
      });
    });
    expect(profileSetupFlag.markDone).toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it("skip cancellation does not navigate", () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        // Simulate the user tapping "Annuler" (first button)
        const cancel = (buttons ?? [])[0];
        cancel?.onPress?.();
      });

    const { getByText } = render(<ProfileSetupScreen />);
    fireEvent.press(getByText(/auth.skip/));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
    expect(profileSetupFlag.markDone).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it("navigates to ConversationsList on successful save", async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <ProfileSetupScreen />,
    );
    // Wait for polling to complete (profileReady = true, banner disappears)
    await waitFor(() => {
      expect(queryByText("Préparation de votre compte...")).toBeNull();
    });
    fireEvent.changeText(getByPlaceholderText("auth.firstName"), "John");
    fireEvent.changeText(getByPlaceholderText("auth.lastName"), "Doe");
    fireEvent.changeText(getByPlaceholderText("Pseudo"), "johndoe");
    fireEvent.press(getByText("common.save"));
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "ConversationsList" }],
      });
    });
    expect(profileSetupFlag.markDone).toHaveBeenCalled();
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "johndoe",
        firstName: "John",
        lastName: "Doe",
      }),
    );
  });

  it("allows typing a cyrillic username and normalizes it only on save", async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <ProfileSetupScreen />,
    );

    await waitFor(() => {
      expect(queryByText("Préparation de votre compte...")).toBeNull();
    });

    const usernameInput = getByPlaceholderText("Pseudo");
    fireEvent.changeText(usernameInput, "ДАЛМ1");

    expect(usernameInput.props.value).toBe("ДАЛМ1");

    fireEvent.press(getByText("common.save"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "далм1",
        }),
      );
    });
  });

  it("blocks save when username is empty and surfaces an explicit error", async () => {
    const { getByPlaceholderText, getByText, queryByText, queryByTestId } =
      render(<ProfileSetupScreen />);
    await waitFor(() => {
      expect(queryByText("Préparation de votre compte...")).toBeNull();
    });
    // Fill firstName but leave username empty — should NOT save
    fireEvent.changeText(getByPlaceholderText("auth.firstName"), "John");
    fireEvent.press(getByText("common.save"));

    await waitFor(() => {
      expect(queryByTestId("error-Pseudo")).toBeTruthy();
    });
    expect(queryByTestId("error-Pseudo")?.props.children).toMatch(/requis/i);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it("blocks save when username is shorter than 3 characters", async () => {
    const { getByPlaceholderText, getByText, queryByText, queryByTestId } =
      render(<ProfileSetupScreen />);
    await waitFor(() => {
      expect(queryByText("Préparation de votre compte...")).toBeNull();
    });
    fireEvent.changeText(getByPlaceholderText("Pseudo"), "ab");
    fireEvent.press(getByText("common.save"));

    await waitFor(() => {
      expect(queryByTestId("error-Pseudo")).toBeTruthy();
    });
    expect(queryByTestId("error-Pseudo")?.props.children).toMatch(
      /3 caractères/i,
    );
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it("accepts a cyrillic username and sends it normalized to the API", async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <ProfileSetupScreen />,
    );
    await waitFor(() => {
      expect(queryByText("Préparation de votre compte...")).toBeNull();
    });

    fireEvent.changeText(getByPlaceholderText("Pseudo"), "Привет_42");
    fireEvent.press(getByText("common.save"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "привет_42",
        }),
      );
    });
  });

  it("keeps already-typed values when validation fails so the user does not lose input", async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <ProfileSetupScreen />,
    );
    await waitFor(() => {
      expect(queryByText("Préparation de votre compte...")).toBeNull();
    });
    const firstNameField = getByPlaceholderText("auth.firstName");
    fireEvent.changeText(firstNameField, "John");
    fireEvent.press(getByText("common.save"));

    // After the failed submit, the firstName should still be present
    expect(firstNameField.props.value).toBe("John");
  });
});
