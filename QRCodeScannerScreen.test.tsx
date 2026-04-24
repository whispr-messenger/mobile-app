import React from "react";
import { Platform } from "react-native";
import { render } from "@testing-library/react-native";

const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

jest.mock("./src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff" },
    }),
  }),
}));

jest.mock("expo-camera", () => ({
  CameraView: ({ children }: any) => {
    const { View } = require("react-native");
    return <View testID="native-camera-view">{children}</View>;
  },
  useCameraPermissions: () => [
    { granted: true },
    jest.fn().mockResolvedValue(undefined),
  ],
}));

jest.mock("@yudiel/react-qr-scanner", () => ({
  Scanner: (props: any) => {
    const { View } = require("react-native");
    return <View testID="web-qr-scanner" {...props} />;
  },
}));

jest.mock("./src/services/qrCode/qrCodeService", () => ({
  qrCodeService: {
    parseQRCodeData: jest.fn(),
    getCurrentUserId: jest.fn().mockResolvedValue("me"),
  },
}));

jest.mock("./src/services/contacts/api", () => ({
  contactsAPI: {
    getUserPreviewById: jest.fn(),
    addContact: jest.fn(),
  },
}));

describe("QRCodeScannerScreen", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      value: originalOS,
      configurable: true,
    });
  });

  it('renders the web scanner and not the "pas disponible" fallback on web', () => {
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      QRCodeScannerScreen,
    } = require("./src/screens/Contacts/QRCodeScannerScreen");
    const { getByTestId, queryByText } = render(<QRCodeScannerScreen />);

    expect(getByTestId("web-qr-scanner")).toBeTruthy();
    expect(queryByText(/n'est pas disponible sur la version web/i)).toBeNull();
  });

  it("renders the native CameraView on iOS (native path preserved)", () => {
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      QRCodeScannerScreen,
    } = require("./src/screens/Contacts/QRCodeScannerScreen");
    const { getByTestId, queryByTestId } = render(<QRCodeScannerScreen />);

    expect(getByTestId("native-camera-view")).toBeTruthy();
    expect(queryByTestId("web-qr-scanner")).toBeNull();
  });
});
