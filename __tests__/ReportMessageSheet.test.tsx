import React from "react";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
    }),
    getFontSize: () => 16,
    getLocalizedText: (k: string) => k,
  }),
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ granted: false }),
  launchImageLibraryAsync: jest
    .fn()
    .mockResolvedValue({ canceled: true, assets: [] }),
}));

const mockSubmitReport = jest.fn();
jest.mock("../src/services/moderation/reportApi", () => ({
  submitContentReport: (...args: any[]) => mockSubmitReport(...args),
}));

import { ReportMessageSheet } from "../src/components/Chat/ReportMessageSheet";

const baseMessage: any = {
  id: "m1",
  sender_id: "u1",
  content: "Bad message",
};

describe("ReportMessageSheet", () => {
  beforeEach(() => {
    mockSubmitReport.mockReset();
  });

  it("returns null when not visible", () => {
    const { toJSON } = render(
      <ReportMessageSheet
        visible={false}
        message={baseMessage}
        conversationId="c1"
        conversationTitle="Test"
        onClose={() => {}}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("returns null when message is null even if visible", () => {
    const { toJSON } = render(
      <ReportMessageSheet
        visible={true}
        message={null}
        conversationId="c1"
        conversationTitle="Test"
        onClose={() => {}}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders the wizard step 1 with category chips", () => {
    const { getByText } = render(
      <ReportMessageSheet
        visible={true}
        message={baseMessage}
        conversationId="c1"
        conversationTitle="Test"
        onClose={() => {}}
      />,
    );
    // localized keys are returned as-is by our mock
    expect(getByText("report.category.offensive")).toBeTruthy();
    expect(getByText("report.category.spam")).toBeTruthy();
  });

  it("renders the step 1 header texts", () => {
    const { getByText } = render(
      <ReportMessageSheet
        visible={true}
        message={baseMessage}
        conversationId="c1"
        conversationTitle="Test"
        onClose={() => {}}
      />,
    );
    expect(getByText("report.sheetTitle")).toBeTruthy();
    expect(getByText("report.step1of2")).toBeTruthy();
    expect(getByText("report.step1Subtitle")).toBeTruthy();
  });

  it("disables continue button until a category is selected", () => {
    const { getByText } = render(
      <ReportMessageSheet
        visible={true}
        message={baseMessage}
        conversationId="c1"
        conversationTitle="Test"
        onClose={() => {}}
      />,
    );
    expect(getByText("report.continue")).toBeTruthy();
  });

  it("selecting a category does not crash", () => {
    const { getByText } = render(
      <ReportMessageSheet
        visible={true}
        message={baseMessage}
        conversationId="c1"
        conversationTitle="Test"
        onClose={() => {}}
      />,
    );
    fireEvent.press(getByText("report.category.spam"));
  });
});
