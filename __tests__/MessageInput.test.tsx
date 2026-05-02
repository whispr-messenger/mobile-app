/**
 * Tests for MessageInput:
 * - Safari/web voice recording MIME fix
 * - auto-resize behaviour for the chat composer
 */

import { Platform } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

// expo-av must be mocked before MessageInput is imported.
jest.mock(
  "expo-av",
  () => ({
    Audio: {
      RecordingOptionsPresets: {
        HIGH_QUALITY: {
          android: { extension: ".m4a" },
          ios: { extension: ".m4a" },
          web: { mimeType: "audio/webm", bitsPerSecond: 128000 },
        },
      },
    },
  }),
  { virtual: true },
);

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: "Images" },
}));
jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      primary: "#6200ee",
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#666" },
    }),
  }),
}));
jest.mock("../src/components/Chat/ReplyPreview", () => ({
  ReplyPreview: () => null,
}));
jest.mock("../src/components/Chat/Avatar", () => ({
  Avatar: () => null,
}));
jest.mock("../src/components/Chat/CameraCapture", () => ({
  CameraCapture: () => null,
}));
jest.mock("../src/components/Chat/EmojiPickerSheet", () => ({
  EmojiPickerSheet: () => null,
}));

import {
  buildRecordingOptions,
  MessageInput,
} from "../src/components/Chat/MessageInput";

type MediaRecorderLike = { isTypeSupported?: (mime: string) => boolean };

const originalMediaRecorder = (global as any).MediaRecorder;

const setMediaRecorder = (impl?: MediaRecorderLike | undefined) => {
  if (impl === undefined) {
    delete (global as any).MediaRecorder;
    return;
  }
  (global as any).MediaRecorder = impl;
};

afterEach(() => {
  setMediaRecorder(originalMediaRecorder);
});

describe("buildRecordingOptions", () => {
  it("uses audio/mp4 on web when Safari reports it as supported", () => {
    Platform.OS = "web";
    setMediaRecorder({
      isTypeSupported: (mime: string) => mime === "audio/mp4",
    });

    const opts = buildRecordingOptions();

    expect(opts.web).toEqual({
      mimeType: "audio/mp4",
      bitsPerSecond: 128000,
    });
  });

  it("falls back to audio/webm when audio/mp4 is not supported", () => {
    Platform.OS = "web";
    setMediaRecorder({
      isTypeSupported: (mime: string) => mime === "audio/webm",
    });

    const opts = buildRecordingOptions();

    expect(opts.web).toEqual({
      mimeType: "audio/webm",
      bitsPerSecond: 128000,
    });
  });

  it("returns the HIGH_QUALITY preset identity on native (iOS) — no web override injected", () => {
    Platform.OS = "ios";
    setMediaRecorder({ isTypeSupported: () => true });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Audio } = require("expo-av");
    const expected = Audio.RecordingOptionsPresets.HIGH_QUALITY;
    const opts = buildRecordingOptions();

    // Same object reference → nothing was spread/overridden for web.
    expect(opts).toBe(expected);
  });

  it("returns the HIGH_QUALITY preset identity on native (Android)", () => {
    Platform.OS = "android";
    setMediaRecorder(undefined);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Audio } = require("expo-av");
    const expected = Audio.RecordingOptionsPresets.HIGH_QUALITY;
    const opts = buildRecordingOptions();

    expect(opts).toBe(expected);
  });
});

describe("MessageInput auto-resize", () => {
  it("renders a multiline composer that grows with content size", () => {
    const { getByPlaceholderText, getByTestId } = render(
      <MessageInput onSend={jest.fn()} placeholder="Votre message" />,
    );

    const input = getByPlaceholderText("Votre message");
    const shell = getByTestId("message-composer-shell");
    const measure = getByTestId("message-composer-measure");

    expect(input.props.multiline).toBe(true);
    expect(input.props.scrollEnabled).toBe(false);

    fireEvent(shell, "layout", {
      nativeEvent: { layout: { width: 240, height: 40, x: 0, y: 0 } },
    });
    fireEvent.changeText(input, "Bonjour\ncomment\nca va");
    fireEvent(measure, "textLayout", {
      nativeEvent: { lines: [{}, {}, {}] },
    });

    const updatedInput = getByTestId("message-composer-input");

    expect(shell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          height: 80,
        }),
      ]),
    );
    expect(updatedInput.props.scrollEnabled).toBe(false);
  });

  it("caps the composer height and enables internal scrolling past the max height", () => {
    const { getByPlaceholderText, getByTestId } = render(
      <MessageInput onSend={jest.fn()} placeholder="Votre message" />,
    );

    const input = getByPlaceholderText("Votre message");
    const shell = getByTestId("message-composer-shell");
    const measure = getByTestId("message-composer-measure");

    fireEvent(shell, "layout", {
      nativeEvent: { layout: { width: 240, height: 40, x: 0, y: 0 } },
    });
    fireEvent.changeText(
      input,
      "Une ligne\nDeux lignes\nTrois lignes\nQuatre lignes\nCinq lignes\nSix lignes",
    );

    fireEvent(measure, "textLayout", {
      nativeEvent: { lines: [{}, {}, {}, {}, {}, {}, {}] },
    });

    const updatedInput = getByTestId("message-composer-input");

    expect(shell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          height: 120,
        }),
      ]),
    );
    expect(updatedInput.props.scrollEnabled).toBe(true);
  });

  it("grows stably when the user inserts manual line breaks", () => {
    const { getByPlaceholderText, getByTestId } = render(
      <MessageInput onSend={jest.fn()} placeholder="Votre message" />,
    );

    const input = getByPlaceholderText("Votre message");
    const shell = getByTestId("message-composer-shell");
    const measure = getByTestId("message-composer-measure");

    fireEvent(shell, "layout", {
      nativeEvent: { layout: { width: 240, height: 40, x: 0, y: 0 } },
    });
    fireEvent.changeText(input, "Premiere ligne\n");
    fireEvent(measure, "textLayout", {
      nativeEvent: { lines: [{}] },
    });

    expect(shell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          height: 60,
        }),
      ]),
    );
  });

  it("keeps the composer at the minimum height while the input is empty", () => {
    const { getByTestId } = render(
      <MessageInput onSend={jest.fn()} placeholder="Votre message" />,
    );

    const shell = getByTestId("message-composer-shell");
    const measure = getByTestId("message-composer-measure");

    fireEvent(shell, "layout", {
      nativeEvent: { layout: { width: 240, height: 40, x: 0, y: 0 } },
    });
    fireEvent(measure, "textLayout", {
      nativeEvent: { lines: [{}] },
    });

    expect(shell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          height: 40,
        }),
      ]),
    );
  });
});
