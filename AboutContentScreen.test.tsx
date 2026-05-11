import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { AboutContentScreen } from "./src/screens/Settings/AboutContentScreen";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("./src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: {
        gradient: ["#000", "#111"],
        primary: "#000",
        secondary: "#111",
        tertiary: "#222",
      },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#555" },
      primary: "#6200ee",
      secondary: "#444",
    }),
    getFontSize: () => 16,
    getLocalizedText: (key: string) => key,
  }),
}));

describe("AboutContentScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { getByText } = render(<AboutContentScreen />);
    expect(getByText("about.title")).toBeTruthy();
  });

  it("renders the three legal/test buttons + report CTA", () => {
    const { getByLabelText, getByText } = render(<AboutContentScreen />);
    expect(getByLabelText("about.privacyPolicy")).toBeTruthy();
    expect(getByLabelText("about.termsOfUse")).toBeTruthy();
    expect(getByLabelText("about.testImageAnalysis")).toBeTruthy();
    expect(getByText("about.reportContent")).toBeTruthy();
  });

  it("navigates to PrivacyPolicy when the privacy button is pressed", () => {
    const { getByLabelText } = render(<AboutContentScreen />);
    fireEvent.press(getByLabelText("about.privacyPolicy"));
    expect(mockNavigate).toHaveBeenCalledWith("PrivacyPolicy");
  });

  it("navigates to TermsOfUse when the terms button is pressed", () => {
    const { getByLabelText } = render(<AboutContentScreen />);
    fireEvent.press(getByLabelText("about.termsOfUse"));
    expect(mockNavigate).toHaveBeenCalledWith("TermsOfUse");
  });

  it("navigates to ModerationTest when the image test button is pressed", () => {
    const { getByLabelText } = render(<AboutContentScreen />);
    fireEvent.press(getByLabelText("about.testImageAnalysis"));
    expect(mockNavigate).toHaveBeenCalledWith("ModerationTest");
  });
});
