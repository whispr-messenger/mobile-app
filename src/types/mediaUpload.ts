/**
 * Client-side metadata for optimistic media sends (WHISPR-267).
 * Not persisted by messaging-service — stripped once status is "sent".
 */

export type MediaUploadPhase =
  | "moderation"
  | "uploading"
  | "sharing"
  | "sending";

export interface MediaSendClientMetadata {
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  media_id?: string;
  filename?: string;
  mime_type?: string;
  size?: number;
  /** Local file URI for retry after failed upload */
  localUri?: string;
  uploadPhase?: MediaUploadPhase;
  /** 0–100 during POST /media/v1/upload */
  uploadProgress?: number;
  blockedByModeration?: boolean;
  blockReason?: string;
  shareWarning?: boolean;
  [key: string]: unknown;
}

export function getMediaUploadOverlayState(
  status: string | undefined,
  metadata: MediaSendClientMetadata | undefined,
): {
  visible: boolean;
  progress?: number;
  label?: string;
  indeterminate: boolean;
} {
  if (status !== "sending" || !metadata) {
    return { visible: false, indeterminate: false };
  }

  const phase = metadata.uploadPhase;
  if (!phase && metadata.uploadProgress === undefined) {
    return { visible: false, indeterminate: false };
  }

  if (phase === "sharing") {
    return { visible: true, label: "Partage…", indeterminate: true };
  }
  if (phase === "sending") {
    return { visible: true, label: "Envoi…", indeterminate: true };
  }
  if (phase === "moderation") {
    return { visible: true, label: "Vérification…", indeterminate: true };
  }

  const progress = metadata.uploadProgress;
  return {
    visible: true,
    progress: typeof progress === "number" ? progress : 0,
    label:
      typeof progress === "number" ? `${Math.min(100, progress)} %` : undefined,
    indeterminate: false,
  };
}
