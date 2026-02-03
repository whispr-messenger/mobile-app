/**
 * Media Types - Shared types for media handling
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
  mediaId?: string;
  mimeType?: string;
}

export interface MediaViewerParams {
  mediaItems: MediaItem[];
  initialIndex: number;
  conversationId?: string;
}
