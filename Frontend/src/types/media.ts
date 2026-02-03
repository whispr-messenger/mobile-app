/**
 * Media Types - For MediaViewerScreen and media management
 */

export type MediaType = 'image' | 'video' | 'file' | 'audio';

export interface MediaItem {
  id: string;
  uri: string;
  type: MediaType;
  thumbnailUri?: string;
  filename?: string;
  size?: number;
  messageId?: string;
  mediaId?: string; // Backend media ID
  duration?: number; // For videos/audio
  mimeType?: string;
}

export interface MediaViewerParams {
  mediaItems: MediaItem[];
  initialIndex: number;
  conversationId?: string;
}
