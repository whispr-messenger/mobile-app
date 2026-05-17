import type { Conversation, Message } from "../types/messaging";
import { normalizeLinkPreview } from "../services/linkPreview";

export interface ConversationPreviewSnippet {
  prefix?: string;
  body: string;
  isPlaceholder: boolean;
}

function compactWhitespace(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function isE2EEEnvelopeV1(content: string): boolean {
  if (!content || !content.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(content) as any;
    return parsed?.v === 1 && parsed?.t === "whispr_e2ee_v1";
  } catch {
    return false;
  }
}

function isUrlOnlyMessage(text: string): boolean {
  if (!text) return false;
  const withoutUrls = text.replace(/https?:\/\/\S+/gi, "").trim();
  return withoutUrls.length === 0;
}

function getMetadataMediaType(message: Message): string | undefined {
  const metadata = (message.metadata ?? {}) as {
    media_type?: string;
    file_type?: string;
    mime_type?: string;
  };

  if (metadata.media_type) return metadata.media_type;
  if (metadata.file_type) return metadata.file_type;
  if (typeof metadata.mime_type === "string") {
    if (metadata.mime_type.startsWith("image/")) return "image";
    if (metadata.mime_type.startsWith("video/")) return "video";
    if (metadata.mime_type.startsWith("audio/")) return "audio";
  }

  return undefined;
}

function getMediaLabel(message: Message): string | undefined {
  const content = compactWhitespace(message.content).toLowerCase();
  const mediaType = getMetadataMediaType(message);

  if (mediaType === "image" || content.startsWith("photo")) {
    return "Photo";
  }
  if (
    mediaType === "video" ||
    content.startsWith("vidéo") ||
    content.startsWith("video")
  ) {
    return "Vidéo";
  }
  if (mediaType === "audio" || content.startsWith("message vocal")) {
    return "Message vocal";
  }
  if (mediaType === "file" || content.startsWith("fichier")) {
    return "Fichier";
  }

  return message.message_type === "media" ? "Pièce jointe" : undefined;
}

function buildMessageBody(message: Message): string {
  if (message.is_deleted) {
    return "Message supprimé";
  }

  if (message.message_type === "text" && isE2EEEnvelopeV1(message.content)) {
    return "Message chiffré";
  }

  const text = compactWhitespace(message.content);
  const linkPreview = normalizeLinkPreview(
    ((message.metadata ?? {}) as { link_preview?: Record<string, unknown> })
      .link_preview as any,
  );
  const linkTitle =
    compactWhitespace(linkPreview?.title) ||
    compactWhitespace(linkPreview?.siteName) ||
    compactWhitespace(linkPreview?.domain);

  const mediaLabel = getMediaLabel(message);
  const isDefaultMediaText =
    text === "Photo" ||
    text === "Vidéo" ||
    text === "Message vocal" ||
    text === "Fichier";

  if (mediaLabel) {
    if (!text || isDefaultMediaText) {
      return mediaLabel;
    }
    return `${mediaLabel}: ${text}`;
  }

  if (linkTitle && (!text || isUrlOnlyMessage(text))) {
    return linkTitle;
  }

  if (text) {
    return text;
  }

  if (message.message_type === "system") {
    return "Message système";
  }

  return "Message";
}

function getMetadataSenderLabel(message: Message): string | undefined {
  const metadata = (message.metadata ?? {}) as {
    sender_display_name?: string;
    sender_name?: string;
    display_name?: string;
    username?: string;
  };

  const candidates = [
    metadata.sender_display_name,
    metadata.sender_name,
    metadata.display_name,
    metadata.username,
  ];

  for (const candidate of candidates) {
    const label = compactWhitespace(candidate);
    if (label) {
      return label;
    }
  }

  return undefined;
}

export function buildConversationPreviewSnippet(params: {
  conversation: Conversation;
  currentUserId?: string | null;
  senderLabel?: string;
}): ConversationPreviewSnippet {
  const { conversation, currentUserId, senderLabel } = params;
  const message = conversation.last_message;

  if (!message) {
    return {
      body: "Pas encore de messages",
      isPlaceholder: true,
    };
  }

  const body = buildMessageBody(message);
  const isOwnMessage = !!currentUserId && message.sender_id === currentUserId;
  const metadataSenderLabel = getMetadataSenderLabel(message);
  const resolvedSenderLabel =
    compactWhitespace(senderLabel) || metadataSenderLabel;

  let prefix: string | undefined;
  if (isOwnMessage) {
    prefix = "Vous";
  } else if (conversation.type === "group" && resolvedSenderLabel) {
    prefix = resolvedSenderLabel;
  }

  return {
    prefix,
    body,
    isPlaceholder: false,
  };
}
