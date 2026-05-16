/**
 * Tests for ReportMessageSheet (2-step wizard):
 * - Step 1: category selection, Continue disabled until a category is picked
 * - Step 2: textarea + optional screenshot via ImagePicker
 * - Submit happy path → success state, failure path → error state, retry
 * - Back button on step 2 returns to step 1
 * - Close button calls onClose
 */

import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockRequestPerm = jest.fn();
const mockLaunchLibrary = jest.fn();
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockRequestPerm(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchLibrary(...args),
}));

jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#666" },
    }),
    getFontSize: () => 16,
    getLocalizedText: (k: string) => k,
  }),
}));

const mockSubmit = jest.fn();
jest.mock("../../../services/moderation/reportApi", () => ({
  submitContentReport: (...args: unknown[]) => mockSubmit(...args),
}));

import { ReportMessageSheet } from "../ReportMessageSheet";
import type { MessageWithRelations } from "../../../types/messaging";

const baseMessage = {
  id: "msg-1",
  conversation_id: "conv-1",
  sender_id: "user-bad",
  content: "bad content",
  type: "text",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} as unknown as MessageWithRelations;

const defaultProps = {
  visible: true,
  message: baseMessage,
  conversationId: "conv-1",
  conversationTitle: "With Bob",
  onClose: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

const flushAsync = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("ReportMessageSheet — visibility", () => {
  it("renders nothing when not visible", () => {
    const { queryByText } = render(
      <ReportMessageSheet {...defaultProps} visible={false} />,
    );
    expect(queryByText("report.sheetTitle")).toBeNull();
  });

  it("renders nothing when message is null even if visible", () => {
    const { queryByText } = render(
      <ReportMessageSheet {...defaultProps} message={null} />,
    );
    expect(queryByText("report.sheetTitle")).toBeNull();
  });

  it("shows step 1 with category list on open", () => {
    const { getByText } = render(<ReportMessageSheet {...defaultProps} />);
    expect(getByText("report.sheetTitle")).toBeTruthy();
    expect(getByText("report.step1of2")).toBeTruthy();
    expect(getByText("report.category.offensive")).toBeTruthy();
    expect(getByText("report.category.spam")).toBeTruthy();
    expect(getByText("report.category.harassment")).toBeTruthy();
    expect(getByText("report.category.other")).toBeTruthy();
  });
});

describe("ReportMessageSheet — step 1 → step 2", () => {
  it("advances to step 2 once a category has been selected and Continue is pressed", () => {
    const { getByText, queryByText } = render(
      <ReportMessageSheet {...defaultProps} onClose={jest.fn()} />,
    );

    fireEvent.press(getByText("report.category.spam"));
    fireEvent.press(getByText("report.continue"));

    expect(queryByText("report.step1of2")).toBeNull();
    expect(getByText("report.step2of2")).toBeTruthy();
    expect(getByText("report.additionalDetails")).toBeTruthy();
  });

  it("does not advance when no category is selected", () => {
    const { getByText, queryByText } = render(
      <ReportMessageSheet {...defaultProps} />,
    );
    fireEvent.press(getByText("report.continue"));
    expect(queryByText("report.step2of2")).toBeNull();
    expect(getByText("report.step1of2")).toBeTruthy();
  });
});

describe("ReportMessageSheet — step 2 navigation", () => {
  it("returns to step 1 when the Back link is pressed", () => {
    const { getByText, queryByText } = render(
      <ReportMessageSheet {...defaultProps} />,
    );
    fireEvent.press(getByText("report.category.spam"));
    fireEvent.press(getByText("report.continue"));
    fireEvent.press(getByText("report.back"));

    expect(getByText("report.step1of2")).toBeTruthy();
    expect(queryByText("report.step2of2")).toBeNull();
  });
});

describe("ReportMessageSheet — submission", () => {
  it("submits the report and switches to the success state on ok:true", async () => {
    mockSubmit.mockResolvedValueOnce({ ok: true });

    const { getByText, getByPlaceholderText } = render(
      <ReportMessageSheet {...defaultProps} />,
    );

    fireEvent.press(getByText("report.category.harassment"));
    fireEvent.press(getByText("report.continue"));
    fireEvent.changeText(
      getByPlaceholderText("report.placeholder"),
      "they crossed the line",
    );
    fireEvent.press(getByText("report.send"));
    await flushAsync();

    expect(mockSubmit).toHaveBeenCalledWith({
      conversationId: "conv-1",
      messageId: "msg-1",
      reportedUserId: "user-bad",
      category: "harassment",
      description: "they crossed the line",
    });
    expect(getByText("report.successTitle")).toBeTruthy();
  });

  it("omits empty description from the submission payload", async () => {
    mockSubmit.mockResolvedValueOnce({ ok: true });

    const { getByText } = render(<ReportMessageSheet {...defaultProps} />);
    fireEvent.press(getByText("report.category.spam"));
    fireEvent.press(getByText("report.continue"));
    fireEvent.press(getByText("report.send"));
    await flushAsync();

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ description: undefined }),
    );
  });

  it("switches to the error state when submitContentReport returns ok:false", async () => {
    mockSubmit.mockResolvedValueOnce({ ok: false });

    const { getByText } = render(<ReportMessageSheet {...defaultProps} />);
    fireEvent.press(getByText("report.category.spam"));
    fireEvent.press(getByText("report.continue"));
    fireEvent.press(getByText("report.send"));
    await flushAsync();

    expect(getByText("report.errorTitle")).toBeTruthy();
    expect(getByText("report.errorBanner")).toBeTruthy();
  });

  it("switches to the error state when submitContentReport throws", async () => {
    mockSubmit.mockRejectedValueOnce(new Error("network"));

    const { getByText } = render(<ReportMessageSheet {...defaultProps} />);
    fireEvent.press(getByText("report.category.spam"));
    fireEvent.press(getByText("report.continue"));
    fireEvent.press(getByText("report.send"));
    await flushAsync();

    expect(getByText("report.errorTitle")).toBeTruthy();
  });

  it("returns to step 2 from the error state when retry is pressed", async () => {
    mockSubmit.mockResolvedValueOnce({ ok: false });

    const { getByText } = render(<ReportMessageSheet {...defaultProps} />);
    fireEvent.press(getByText("report.category.spam"));
    fireEvent.press(getByText("report.continue"));
    fireEvent.press(getByText("report.send"));
    await flushAsync();

    fireEvent.press(getByText("common.retry"));
    expect(getByText("report.step2of2")).toBeTruthy();
  });
});

describe("ReportMessageSheet — image attachment", () => {
  it("attaches an image when ImagePicker returns a non-cancelled asset", async () => {
    mockRequestPerm.mockResolvedValue({ granted: true });
    mockLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///mock/photo.jpg" }],
    });

    const { getByText, UNSAFE_getAllByType } = render(
      <ReportMessageSheet {...defaultProps} />,
    );
    fireEvent.press(getByText("report.category.spam"));
    fireEvent.press(getByText("report.continue"));
    fireEvent.press(getByText("report.attachHint"));
    await flushAsync();

    const Image = require("react-native").Image;
    const images = UNSAFE_getAllByType(Image);
    expect(
      images.some(
        (img: any) => img.props.source?.uri === "file:///mock/photo.jpg",
      ),
    ).toBe(true);
  });

  it("does not attach anything when the media library permission is denied", async () => {
    mockRequestPerm.mockResolvedValue({ granted: false });

    const { getByText } = render(<ReportMessageSheet {...defaultProps} />);
    fireEvent.press(getByText("report.category.spam"));
    fireEvent.press(getByText("report.continue"));
    fireEvent.press(getByText("report.attachHint"));
    await flushAsync();

    expect(mockLaunchLibrary).not.toHaveBeenCalled();
  });

  it("does not attach when the image picker is canceled", async () => {
    mockRequestPerm.mockResolvedValue({ granted: true });
    mockLaunchLibrary.mockResolvedValue({ canceled: true, assets: [] });

    const { getByText, UNSAFE_queryAllByType } = render(
      <ReportMessageSheet {...defaultProps} />,
    );
    fireEvent.press(getByText("report.category.spam"));
    fireEvent.press(getByText("report.continue"));
    fireEvent.press(getByText("report.attachHint"));
    await flushAsync();

    const Image = require("react-native").Image;
    const images = UNSAFE_queryAllByType(Image);
    expect(images.length).toBe(0);
  });
});

describe("ReportMessageSheet — close", () => {
  it("calls onClose when the success OK button is pressed (animation flushed)", async () => {
    mockSubmit.mockResolvedValueOnce({ ok: true });
    jest.useFakeTimers();
    const onClose = jest.fn();
    const { getByText } = render(
      <ReportMessageSheet {...defaultProps} onClose={onClose} />,
    );
    fireEvent.press(getByText("report.category.spam"));
    fireEvent.press(getByText("report.continue"));
    fireEvent.press(getByText("report.send"));
    await flushAsync();

    fireEvent.press(getByText("common.ok"));
    // Flush the close animation timers
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    jest.useRealTimers();

    expect(onClose).toHaveBeenCalled();
  });
});
