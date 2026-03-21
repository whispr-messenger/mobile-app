/**
 * MediaService — handles media upload and URL resolution via media-service.
 *
 * Contract:
 *   POST /media/v1/upload   → multipart upload (file + context + ownerId)
 *   GET  /media/v1/:id      → metadata { id, url, ... }
 *   GET  /media/v1/:id/blob → 302 redirect to signed URL
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { TokenService } from './TokenService';

function getDevHost(): string {
	if (Platform.OS === 'android') return '10.0.2.2';
	const debuggerHost =
		Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
	if (debuggerHost) return debuggerHost.split(':')[0];
	return 'localhost';
}

function getMediaApiBase(): string {
	const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
	if (__DEV__) {
		return `http://${getDevHost()}:3000/media/v1`;
	}
	return `${extra?.apiBaseUrl ?? 'https://whispr.epitech.beer'}/media/v1`;
}

export type MediaContext = 'avatar' | 'message' | 'group_icon';

export interface UploadMediaResponse {
	id: string;
	url: string;
	thumbnailUrl: string | null;
	mimeType: string;
	sizeBytes: number;
	sha256: string;
	context: MediaContext;
	ownerId: string;
	createdAt: string;
	expiresAt: string | null;
}

export const MediaService = {
	/**
	 * Upload a file to the media-service.
	 *
	 * @param fileUri   Local file URI (e.g. from ImagePicker)
	 * @param context   Upload context: avatar, message, or group_icon
	 * @param ownerId   UUID of the owner (userId or conversationId)
	 * @param mimeType  MIME type (defaults to image/jpeg)
	 * @param fileName  File name (defaults to upload.jpg)
	 */
	async upload(
		fileUri: string,
		context: MediaContext,
		ownerId: string,
		mimeType = 'image/jpeg',
		fileName = 'upload.jpg'
	): Promise<UploadMediaResponse> {
		const token = await TokenService.getAccessToken();
		const base = getMediaApiBase();

		const formData = new FormData();
		formData.append('file', {
			uri: fileUri,
			type: mimeType,
			name: fileName,
		} as any);
		formData.append('context', context);
		formData.append('ownerId', ownerId);

		const response = await fetch(`${base}/upload`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
			},
			body: formData,
		});

		if (!response.ok) {
			const text = await response.text().catch(() => '');
			throw new Error(`Upload failed: HTTP ${response.status} ${text}`);
		}

		return response.json();
	},

	/**
	 * Get media metadata by ID.
	 */
	async getMetadata(mediaId: string): Promise<UploadMediaResponse> {
		const token = await TokenService.getAccessToken();
		const base = getMediaApiBase();

		const response = await fetch(`${base}/${mediaId}`, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to get media metadata: HTTP ${response.status}`);
		}

		return response.json();
	},
};
