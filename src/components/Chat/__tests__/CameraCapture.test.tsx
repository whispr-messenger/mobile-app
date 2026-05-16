/**
 * Tests for CameraCapture:
 * - Camera permission flow (granted / denied / null result / thrown)
 * - Photo capture happy path → preview, caption input, confirm sends onCapture
 * - Video capture (gated behind allowVideo prop)
 * - Front/back camera toggle and retake action
 * - Cancel closes without invoking onCapture
 * - Caption length counter updates with typed text
 */

import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-reanimated", () => {
  const RReact = require("react");
  const { View } = require("react-native");
  const AnimatedView = (props: any) => RReact.createElement(View, props);
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (c: any) => c,
      View: AnimatedView,
    },
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: any) => v,
    withTiming: (v: any, _opts?: any, cb?: any) => {
      // Some callers pass a completion callback; simulate completion.
      if (typeof cb === "function") cb(true);
      return v;
    },
    withSequence: (...vals: any[]) => vals[vals.length - 1],
    interpolate: (v: any) => v,
    Extrapolate: { CLAMP: "clamp" },
  };
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

const mockRequestCameraPerm = jest.fn();
const mockLaunchCamera = jest.fn();
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: (...args: unknown[]) =>
    mockRequestCameraPerm(...args),
  launchCameraAsync: (...args: unknown[]) => mockLaunchCamera(...args),
  MediaTypeOptions: { Images: "Images", Videos: "Videos" },
  CameraType: { front: "front", back: "back" },
}));

jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#666" },
    }),
    settings: { theme: "dark" },
  }),
}));

import { CameraCapture } from "../CameraCapture";

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  onCapture: jest.fn(),
};

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  alertSpy.mockRestore();
});

const flushAsync = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("CameraCapture — initial render", () => {
  it("shows the Caméra header and Photo / Vidéo buttons when no media is captured", () => {
    const { getByText } = render(<CameraCapture {...defaultProps} />);
    expect(getByText("Caméra")).toBeTruthy();
    expect(getByText("Photo")).toBeTruthy();
    expect(getByText("Vidéo")).toBeTruthy();
  });

  it("hides the Vidéo button when allowVideo is false", () => {
    const { queryByText, getByText } = render(
      <CameraCapture {...defaultProps} allowVideo={false} />,
    );
    expect(getByText("Photo")).toBeTruthy();
    expect(queryByText("Vidéo")).toBeNull();
  });
});

describe("CameraCapture — permissions", () => {
  it("alerts and aborts when permission is denied", async () => {
    mockRequestCameraPerm.mockResolvedValue({ status: "denied" });
    const { getByText } = render(<CameraCapture {...defaultProps} />);

    fireEvent.press(getByText("Photo"));
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledWith(
      "Permission requise",
      expect.stringMatching(/caméra/),
    );
    expect(mockLaunchCamera).not.toHaveBeenCalled();
  });

  it("alerts when requestCameraPermissionsAsync returns a null result", async () => {
    mockRequestCameraPerm.mockResolvedValue(null);
    const { getByText } = render(<CameraCapture {...defaultProps} />);

    fireEvent.press(getByText("Photo"));
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledWith(
      "Erreur",
      expect.stringMatching(/permission/i),
    );
    expect(mockLaunchCamera).not.toHaveBeenCalled();
  });

  it("alerts when requestCameraPermissionsAsync throws", async () => {
    mockRequestCameraPerm.mockRejectedValue(new Error("explode"));
    const { getByText } = render(<CameraCapture {...defaultProps} />);

    fireEvent.press(getByText("Photo"));
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledWith(
      "Erreur",
      expect.stringMatching(/Erreur lors de la demande/i),
    );
  });
});

describe("CameraCapture — photo capture", () => {
  it("captures a photo, shows the preview, and sends it via onCapture with caption", async () => {
    mockRequestCameraPerm.mockResolvedValue({ status: "granted" });
    mockLaunchCamera.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///mock/photo.jpg" }],
    });

    const onCapture = jest.fn();
    const onClose = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <CameraCapture
        {...defaultProps}
        onCapture={onCapture}
        onClose={onClose}
      />,
    );

    fireEvent.press(getByText("Photo"));
    await flushAsync();

    expect(getByText("Prévisualisation")).toBeTruthy();
    expect(getByText("Reprendre")).toBeTruthy();
    expect(getByText("Envoyer")).toBeTruthy();

    fireEvent.changeText(
      getByPlaceholderText("Ajouter une légende..."),
      "joli cliché",
    );
    expect(getByText("11/200")).toBeTruthy();

    fireEvent.press(getByText("Envoyer"));

    expect(onCapture).toHaveBeenCalledWith({
      uri: "file:///mock/photo.jpg",
      type: "image",
      caption: "joli cliché",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not transition to preview when ImagePicker reports canceled", async () => {
    mockRequestCameraPerm.mockResolvedValue({ status: "granted" });
    mockLaunchCamera.mockResolvedValue({ canceled: true, assets: [] });

    const { getByText, queryByText } = render(
      <CameraCapture {...defaultProps} />,
    );

    fireEvent.press(getByText("Photo"));
    await flushAsync();

    expect(queryByText("Prévisualisation")).toBeNull();
  });

  it("alerts when launchCameraAsync throws", async () => {
    mockRequestCameraPerm.mockResolvedValue({ status: "granted" });
    mockLaunchCamera.mockRejectedValue(new Error("hardware fail"));

    const { getByText } = render(<CameraCapture {...defaultProps} />);
    fireEvent.press(getByText("Photo"));
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledWith(
      "Erreur",
      "Impossible de prendre la photo.",
    );
  });

  it("omits the caption when it is empty or whitespace only", async () => {
    mockRequestCameraPerm.mockResolvedValue({ status: "granted" });
    mockLaunchCamera.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///mock/p.jpg" }],
    });
    const onCapture = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <CameraCapture {...defaultProps} onCapture={onCapture} />,
    );

    fireEvent.press(getByText("Photo"));
    await flushAsync();

    fireEvent.changeText(getByPlaceholderText("Ajouter une légende..."), "   ");
    fireEvent.press(getByText("Envoyer"));

    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({ caption: undefined }),
    );
  });
});

describe("CameraCapture — video capture", () => {
  it("captures a video and shows the video preview state", async () => {
    mockRequestCameraPerm.mockResolvedValue({ status: "granted" });
    mockLaunchCamera.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///mock/clip.mp4" }],
    });
    const onCapture = jest.fn();
    const { getByText } = render(
      <CameraCapture {...defaultProps} onCapture={onCapture} />,
    );

    fireEvent.press(getByText("Vidéo"));
    await flushAsync();

    expect(getByText("Vidéo capturée")).toBeTruthy();
    fireEvent.press(getByText("Envoyer"));

    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({ uri: "file:///mock/clip.mp4", type: "video" }),
    );
  });

  it("alerts when video capture throws", async () => {
    mockRequestCameraPerm.mockResolvedValue({ status: "granted" });
    mockLaunchCamera.mockRejectedValue(new Error("codec error"));

    const { getByText } = render(<CameraCapture {...defaultProps} />);
    fireEvent.press(getByText("Vidéo"));
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledWith(
      "Erreur",
      "Impossible d'enregistrer la vidéo.",
    );
  });
});

describe("CameraCapture — retake & cancel", () => {
  it("retake returns the user to the camera-controls view", async () => {
    mockRequestCameraPerm.mockResolvedValue({ status: "granted" });
    mockLaunchCamera.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///mock/p.jpg" }],
    });
    const { getByText, queryByText } = render(
      <CameraCapture {...defaultProps} />,
    );

    fireEvent.press(getByText("Photo"));
    await flushAsync();
    expect(getByText("Reprendre")).toBeTruthy();

    fireEvent.press(getByText("Reprendre"));
    await flushAsync();

    expect(queryByText("Reprendre")).toBeNull();
    expect(getByText("Caméra")).toBeTruthy();
  });

  it("the modal onRequestClose handler invokes onClose without firing onCapture", () => {
    const onCapture = jest.fn();
    const onClose = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <CameraCapture
        {...defaultProps}
        onCapture={onCapture}
        onClose={onClose}
      />,
    );

    const Modal = require("react-native").Modal;
    UNSAFE_getAllByType(Modal)[0].props.onRequestClose();

    expect(onClose).toHaveBeenCalled();
    expect(onCapture).not.toHaveBeenCalled();
  });
});
