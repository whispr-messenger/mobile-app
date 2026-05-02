/**
 * Tests for MessageInput:
 * - Safari/web voice recording MIME fix
 * - auto-resize behaviour for the chat composer
 */

import { Platform } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";

const mockRequestPermissionsAsync = jest.fn();
const mockSetAudioModeAsync = jest.fn();
const mockRecordingCreateAsync = jest.fn();

// expo-av must be mocked before MessageInput is imported.
jest.mock(
  "expo-av",
  () => ({
    Audio: {
      AndroidOutputFormat: { MPEG_4: "mpeg4" },
      AndroidAudioEncoder: { AAC: "aac" },
      IOSOutputFormat: { MPEG4AAC: "mpeg4aac" },
      IOSAudioQuality: { MAX: "max" },
      RecordingOptionsPresets: {
        HIGH_QUALITY: {
          android: { extension: ".3gp", outputFormat: "old", audioEncoder: "old" },
          ios: { extension: ".caf", outputFormat: "old", audioQuality: "old" },
          web: { mimeType: "audio/webm", bitsPerSecond: 128000 },
        },
      },
      requestPermissionsAsync: (...a: any[]) => mockRequestPermissionsAsync(...a),
      setAudioModeAsync: (...a: any[]) => mockSetAudioModeAsync(...a),
      Recording: {
        createAsync: (...a: any[]) => mockRecordingCreateAsync(...a),
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

beforeEach(() => {
  mockRequestPermissionsAsync.mockReset().mockResolvedValue({ status: "granted" });
  mockSetAudioModeAsync.mockReset().mockResolvedValue(undefined);
  mockRecordingCreateAsync.mockReset().mockResolvedValue({
    recording: {
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn().mockReturnValue("file:///voice.m4a"),
      getStatusAsync: jest.fn().mockResolvedValue({ durationMillis: 2000 }),
    },
  });
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

  it("forces an MPEG-4/AAC recording profile on iOS", () => {
    Platform.OS = "ios";
    setMediaRecorder({ isTypeSupported: () => true });

    const opts = buildRecordingOptions();

    expect(opts.ios).toEqual(
      expect.objectContaining({
        extension: ".m4a",
        outputFormat: "mpeg4aac",
        audioQuality: "max",
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      }),
    );
  });

  it("forces an MPEG-4/AAC recording profile on Android", () => {
    Platform.OS = "android";
    setMediaRecorder(undefined);

    const opts = buildRecordingOptions();

    expect(opts.android).toEqual(
      expect.objectContaining({
        extension: ".m4a",
        outputFormat: "mpeg4",
        audioEncoder: "aac",
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      }),
    );
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

describe("MessageInput recording", () => {
  it("applies audio mode before starting iOS recording", async () => {
    Platform.OS = "ios";
    const callOrder: string[] = [];
    mockRequestPermissionsAsync.mockImplementation(async () => {
      callOrder.push("permission");
      return { status: "granted" };
    });
    mockSetAudioModeAsync.mockImplementation(async () => {
      callOrder.push("audio-mode");
    });
    mockRecordingCreateAsync.mockImplementation(async () => {
      callOrder.push("create");
      return {
        recording: {
          stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
          getURI: jest.fn().mockReturnValue("file:///voice.m4a"),
          getStatusAsync: jest.fn().mockResolvedValue({ durationMillis: 2000 }),
        },
      };
    });

    const { getByLabelText } = render(<MessageInput onSend={jest.fn()} />);
    fireEvent.press(getByLabelText("Enregistrer un message vocal"));

    await Promise.resolve();
    await Promise.resolve();

    expect(callOrder).toEqual(["permission", "audio-mode", "create"]);
  });

  it("shows a waveform while recording and sends audio even if final iOS status loses duration", async () => {
    Platform.OS = "ios";
    jest.useFakeTimers();

    const onSendMedia = jest.fn();
    const stopAndUnloadAsync = jest.fn().mockResolvedValue(undefined);
    mockRecordingCreateAsync.mockResolvedValue({
      recording: {
        stopAndUnloadAsync,
        getURI: jest.fn().mockReturnValue("file:///voice.m4a"),
        getStatusAsync: jest.fn().mockResolvedValue({ durationMillis: 0 }),
      },
    });

    const { getByLabelText, getByTestId, getAllByTestId } = render(
      <MessageInput onSend={jest.fn()} onSendMedia={onSendMedia} />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText("Enregistrer un message vocal"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getByTestId("recording-waveform")).toBeTruthy();
    expect(getAllByTestId("recording-wave-bar").length).toBeGreaterThan(8);

    await act(async () => {
      jest.advanceTimersByTime(3200);
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.press(getByLabelText("Envoyer le message vocal"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(stopAndUnloadAsync).toHaveBeenCalled();
    expect(onSendMedia).toHaveBeenCalledWith(
      "file:///voice.m4a",
      "audio",
      undefined,
      undefined,
      expect.objectContaining({ duration: 3 }),
    );

    jest.useRealTimers();
  });
});
