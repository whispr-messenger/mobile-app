/**
 * Tests for MessageBubble — focuses on the data-integrity invariant that a
 * tombstoned (is_deleted) message MUST NOT expose any playable / viewable
 * media surface. A deleted voice message keeping its play button is a P0
 * data-integrity bug — the audio bytes are still on the media-service blob,
 * but the UI must hide the access surface.
 */

import { render, waitFor } from "@testing-library/react-native";

// Inline mock for react-native-reanimated to avoid ESM parse error
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");
  const AnimatedView = (props: any) => React.createElement(View, props);
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (c: any) => c,
      View: AnimatedView,
    },
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: any) => v,
    withTiming: (v: any) => v,
    createAnimatedComponent: (c: any) => c,
  };
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      primary: "#fff",
      background: { primary: "#000", secondary: "#111" },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#555" },
    }),
    getFontSize: () => 16,
    getLocalizedText: (k: string) => k,
  }),
}));

jest.mock("../src/services/apiBase", () => ({
  getApiBaseUrl: () => "https://example.test",
}));

jest.mock("../src/services/TokenService", () => ({
  TokenService: { getAccessToken: jest.fn().mockResolvedValue("tok") },
}));

const mockExtractFirstUrl = jest.fn((text?: string | null) => {
  const match = text?.match(/https?:\/\/\S+/i);
  return match ? match[0].replace(/[),.!?:;]+$/, "") : null;
});
const mockGetLinkPreview = jest.fn();
const mockNormalizeLinkPreview = jest.fn((raw?: any) => {
  if (!raw?.url && !raw?.canonicalUrl) {
    return null;
  }
  const url = raw.canonicalUrl || raw.url;
  return {
    url,
    canonicalUrl: raw.canonicalUrl || url,
    title: raw.title,
    description: raw.description,
    imageUrl: raw.imageUrl,
    siteName: raw.siteName,
    domain: raw.domain || "example.test",
  };
});

jest.mock("../src/services/linkPreview", () => ({
  extractFirstUrl: (text?: string | null) => mockExtractFirstUrl(text),
  getLinkPreview: (url: string) => mockGetLinkPreview(url),
  normalizeLinkPreview: (raw?: any) => mockNormalizeLinkPreview(raw),
}));

// AudioMessage and MediaMessage are spied so we can prove they are NOT
// rendered for tombstoned messages.
const mockAudioSpy: jest.Mock = jest.fn();
jest.mock("../src/components/Chat/AudioMessage", () => ({
  AudioMessage: (props: any) => {
    mockAudioSpy(props);
    const { Text } = require("react-native");
    return require("react").createElement(
      Text,
      { testID: "audio-message" },
      "AUDIO",
    );
  },
}));

const mockMediaSpy: jest.Mock = jest.fn();
jest.mock("../src/components/Chat/MediaMessage", () => ({
  MediaMessage: (props: any) => {
    mockMediaSpy(props);
    const { Text } = require("react-native");
    return require("react").createElement(
      Text,
      { testID: "media-message" },
      "MEDIA",
    );
  },
}));

import { MessageBubble } from "../src/components/Chat/MessageBubble";

const baseAudioMessage = {
  id: "msg-1",
  conversation_id: "conv-1",
  sender_id: "user-1",
  content: "Message vocal",
  message_type: "media" as const,
  sent_at: new Date("2026-04-24T12:00:00Z").toISOString(),
  status: "sent" as const,
  is_deleted: false,
  delete_for_everyone: false,
  attachments: [
    {
      id: "att-1",
      message_id: "msg-1",
      media_id: "media-abc",
      media_type: "audio" as const,
      metadata: {
        media_url: "https://example.test/media/v1/media-abc/blob",
        duration: 5,
        filename: "voice.m4a",
        mime_type: "audio/mp4",
        size: 12345,
      },
      created_at: new Date("2026-04-24T12:00:00Z").toISOString(),
    },
  ],
};

const baseTextMessage = {
  id: "msg-text-1",
  conversation_id: "conv-1",
  sender_id: "user-2",
  content: "Voici un lien https://example.test/article",
  message_type: "text" as const,
  sent_at: new Date("2026-04-24T12:00:00Z").toISOString(),
  status: "sent" as const,
  is_deleted: false,
  delete_for_everyone: false,
  metadata: {},
  attachments: [],
};

beforeEach(() => {
  mockAudioSpy.mockClear();
  mockMediaSpy.mockClear();
  mockExtractFirstUrl.mockClear();
  mockGetLinkPreview.mockReset();
  mockNormalizeLinkPreview.mockClear();
  mockGetLinkPreview.mockResolvedValue(null);
});

describe("MessageBubble — tombstone hides media surface", () => {
  it("renders the AudioMessage for a normal voice message", () => {
    const { queryByTestId } = render(
      <MessageBubble
        message={baseAudioMessage as any}
        isSent={true}
        currentUserId="user-1"
      />,
    );
    expect(queryByTestId("audio-message")).not.toBeNull();
    expect(mockAudioSpy).toHaveBeenCalled();
  });

  it("renders AudioMessage instead of MediaMessage for a failed outgoing voice message", () => {
    const failedAudio = {
      ...baseAudioMessage,
      status: "failed" as const,
    };
    const { queryByTestId } = render(
      <MessageBubble
        message={failedAudio as any}
        isSent={true}
        currentUserId="user-1"
      />,
    );

    expect(queryByTestId("audio-message")).not.toBeNull();
    expect(queryByTestId("media-message")).toBeNull();
    expect(mockAudioSpy).toHaveBeenCalled();
    expect(mockMediaSpy).not.toHaveBeenCalled();
  });

  it("reconstructs the real media_id from metadata media_url instead of falling back to message.id", () => {
    render(
      <MessageBubble
        message={{
          id: "msg-real-id",
          conversation_id: "conv-1",
          sender_id: "user-1",
          content: "Message vocal",
          message_type: "media",
          sent_at: new Date("2026-04-24T12:00:00Z").toISOString(),
          status: "sent",
          is_deleted: false,
          delete_for_everyone: false,
          metadata: {
            media_type: "audio",
            media_url: "https://example.test/media/v1/media-real-123/blob",
            mime_type: "audio/mp4",
            duration: 6,
          },
        } as any}
        isSent={true}
        currentUserId="user-1"
      />,
    );

    expect(mockAudioSpy).toHaveBeenCalled();
    expect(mockAudioSpy.mock.calls.at(-1)?.[0]?.mediaId).toBe("media-real-123");
  });

  it("does NOT render AudioMessage when the voice message is deleted for everyone", () => {
    const deleted = {
      ...baseAudioMessage,
      is_deleted: true,
      delete_for_everyone: true,
    };
    const { queryByTestId, queryByText } = render(
      <MessageBubble
        message={deleted as any}
        isSent={true}
        currentUserId="user-1"
      />,
    );
    // The play surface MUST be gone — no audio component, no resolved URL.
    expect(queryByTestId("audio-message")).toBeNull();
    expect(mockAudioSpy).not.toHaveBeenCalled();
    // The tombstone text MUST be visible instead.
    expect(queryByText("[Message supprimé]")).not.toBeNull();
  });

  it("does NOT render AudioMessage for an is_deleted message even without delete_for_everyone", () => {
    // Server may serialise locally-deleted messages with is_deleted=true,
    // delete_for_everyone=false. The play surface still must not appear.
    const deletedForMe = {
      ...baseAudioMessage,
      is_deleted: true,
      delete_for_everyone: false,
    };
    const { queryByTestId } = render(
      <MessageBubble
        message={deletedForMe as any}
        isSent={true}
        currentUserId="user-1"
      />,
    );
    expect(queryByTestId("audio-message")).toBeNull();
    expect(mockAudioSpy).not.toHaveBeenCalled();
  });

  it("does NOT render MediaMessage for a deleted image / video / file message", () => {
    const deletedImage = {
      ...baseAudioMessage,
      attachments: [
        {
          ...baseAudioMessage.attachments[0],
          media_type: "image",
          metadata: {
            ...baseAudioMessage.attachments[0].metadata,
            filename: "secret.jpg",
            mime_type: "image/jpeg",
          },
        },
      ],
      is_deleted: true,
      delete_for_everyone: true,
    };
    const { queryByTestId } = render(
      <MessageBubble
        message={deletedImage as any}
        isSent={true}
        currentUserId="user-1"
      />,
    );
    expect(queryByTestId("media-message")).toBeNull();
    expect(mockMediaSpy).not.toHaveBeenCalled();
  });

  it("does NOT synthesise a metadata-only attachment for tombstoned media messages", () => {
    // Some messages arrive with no attachments[] but a metadata blob —
    // the metadata-only synthesis must also be skipped when is_deleted.
    const deletedMetadataOnly = {
      id: "msg-2",
      conversation_id: "conv-1",
      sender_id: "user-1",
      content: "",
      message_type: "media" as const,
      sent_at: new Date("2026-04-24T12:00:00Z").toISOString(),
      status: "sent" as const,
      is_deleted: true,
      delete_for_everyone: true,
      metadata: {
        media_id: "media-zzz",
        media_url: "https://example.test/media/v1/media-zzz/blob",
        media_type: "audio",
        duration: 7,
      },
    };
    const { queryByTestId, queryByText } = render(
      <MessageBubble
        message={deletedMetadataOnly as any}
        isSent={true}
        currentUserId="user-1"
      />,
    );
    expect(queryByTestId("audio-message")).toBeNull();
    expect(queryByTestId("media-message")).toBeNull();
    expect(mockAudioSpy).not.toHaveBeenCalled();
    expect(mockMediaSpy).not.toHaveBeenCalled();
    expect(queryByText("[Message supprimé]")).not.toBeNull();
  });
});

describe("MessageBubble — link previews", () => {
  it("renders a fetched preview for text messages containing a link", async () => {
    mockGetLinkPreview.mockResolvedValueOnce({
      url: "https://openai.com/",
      canonicalUrl: "https://openai.com/",
      title: "OpenAI",
      description: "AI research and products",
      siteName: "OpenAI",
      domain: "openai.com",
    });

    const { queryByText } = render(
      <MessageBubble
        message={{
          ...baseTextMessage,
          content: "Regarde https://openai.com/",
        } as any}
        isSent={false}
        currentUserId="user-1"
      />,
    );

    await waitFor(() => {
      expect(queryByText("OpenAI")).not.toBeNull();
    });

    expect(mockGetLinkPreview).toHaveBeenCalledWith("https://openai.com/");
  });

  it("prefers the preview already present in metadata without refetching", async () => {
    const { queryByText } = render(
      <MessageBubble
        message={{
          ...baseTextMessage,
          metadata: {
            link_preview: {
              url: "https://whispr.app/blog",
              canonicalUrl: "https://whispr.app/blog",
              title: "Whispr Blog",
              description: "Dernieres actus produit",
              siteName: "Whispr",
              domain: "whispr.app",
            },
          },
        } as any}
        isSent={true}
        currentUserId="user-1"
      />,
    );

    await waitFor(() => {
      expect(queryByText("Whispr Blog")).not.toBeNull();
    });

    expect(mockGetLinkPreview).not.toHaveBeenCalled();
  });
});
