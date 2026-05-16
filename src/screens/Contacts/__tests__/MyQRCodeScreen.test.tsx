/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert, Share } from "react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-qrcode-styled", () => () => null);
jest.mock("react-native-svg", () => ({
  Circle: () => null,
  Path: () => null,
}));

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#666" },
    }),
  }),
}));

const mockGenerateQR = jest.fn();
jest.mock("../../../services/qrCode/qrCodeService", () => ({
  qrCodeService: {
    generateMyQRCode: (...a: unknown[]) => mockGenerateQR(...a),
  },
}));

const mockGetProfile = jest.fn();
jest.mock("../../../services/UserService", () => ({
  UserService: {
    getInstance: () => ({ getProfile: () => mockGetProfile() }),
  },
}));

import { MyQRCodeScreen } from "../MyQRCodeScreen";

let alertSpy: jest.SpyInstance;
let shareSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  shareSpy = jest.spyOn(Share, "share").mockResolvedValue({} as any);
  mockGenerateQR.mockResolvedValue("QR_PAYLOAD");
  mockGetProfile.mockResolvedValue({
    success: true,
    profile: { firstName: "Alice", lastName: "Smith", username: "alice" },
  });
});

afterEach(() => {
  alertSpy.mockRestore();
  shareSpy.mockRestore();
});

describe("MyQRCodeScreen — initial load", () => {
  it("requests the QR payload and the profile on mount", async () => {
    render(<MyQRCodeScreen />);
    await waitFor(() => expect(mockGenerateQR).toHaveBeenCalled());
    expect(mockGetProfile).toHaveBeenCalled();
  });

  it("renders the user profile name and username once loaded", async () => {
    const { findByText } = render(<MyQRCodeScreen />);
    expect(await findByText("Alice Smith")).toBeTruthy();
    expect(await findByText(/alice/)).toBeTruthy();
  });
});

describe("MyQRCodeScreen — error paths", () => {
  it("alerts and goes back when QR generation returns null", async () => {
    mockGenerateQR.mockResolvedValueOnce(null);
    render(<MyQRCodeScreen />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("alerts when generateMyQRCode throws", async () => {
    mockGenerateQR.mockRejectedValueOnce(new Error("boom"));
    render(<MyQRCodeScreen />);
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Erreur",
        expect.stringMatching(/Impossible/),
      ),
    );
  });
});

describe("MyQRCodeScreen — share", () => {
  it("shares the QR payload via the system share sheet", async () => {
    const { findByText } = render(<MyQRCodeScreen />);
    const shareBtn = await findByText("Partager");
    fireEvent.press(shareBtn);

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const arg = shareSpy.mock.calls[0][0];
    expect(arg.message).toContain("QR_PAYLOAD");
  });
});
