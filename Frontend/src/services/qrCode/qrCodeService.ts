/**
 * QRCodeService - QR Code generation and parsing for contacts
 * WHISPR-216: Generate personal QR code for contact sharing
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface QRCodeData {
  type: 'contact';
  userId: string;
}

export class QRCodeService {
  private static instance: QRCodeService;

  private constructor() {}

  public static getInstance(): QRCodeService {
    if (!QRCodeService.instance) {
      QRCodeService.instance = new QRCodeService();
    }
    return QRCodeService.instance;
  }

  /**
   * Generate QR code URL scheme for contact sharing
   * Format: whispr://contact/add?userId={uuid}
   */
  async generateContactQRCode(userId: string): Promise<string> {
    const qrData: QRCodeData = {
      type: 'contact',
      userId,
    };

    // URL scheme format for mobile deep linking
    return `whispr://contact/add?userId=${userId}`;
  }

  /**
   * Get current user ID from storage
   */
  async getCurrentUserId(): Promise<string | null> {
    try {
      const userId = await AsyncStorage.getItem('whispr.auth.userId');
      return userId;
    } catch (error) {
      console.error('[QRCodeService] Error getting user ID:', error);
      return null;
    }
  }

  /**
   * Generate QR code for current user
   */
  async generateMyQRCode(): Promise<string | null> {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      return null;
    }
    return this.generateContactQRCode(userId);
  }

  /**
   * Parse QR code data from scanned string
   * Supports both URL scheme and JSON format
   */
  parseQRCodeData(qrString: string): QRCodeData | null {
    try {
      // Try URL scheme format: whispr://contact/add?userId={uuid}
      if (qrString.startsWith('whispr://contact/add')) {
        const url = new URL(qrString);
        const userId = url.searchParams.get('userId');
        if (userId) {
          return {
            type: 'contact',
            userId,
          };
        }
      }

      // Try JSON format: {"type":"contact","userId":"..."}
      if (qrString.startsWith('{')) {
        const parsed = JSON.parse(qrString);
        if (parsed.type === 'contact' && parsed.userId) {
          return parsed as QRCodeData;
        }
      }

      // Try direct UUID format (fallback)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(qrString.trim())) {
        return {
          type: 'contact',
          userId: qrString.trim(),
        };
      }

      return null;
    } catch (error) {
      console.error('[QRCodeService] Error parsing QR code:', error);
      return null;
    }
  }

  /**
   * Extract user ID from QR code string
   */
  extractUserId(qrString: string): string | null {
    const data = this.parseQRCodeData(qrString);
    return data?.userId || null;
  }
}

export const qrCodeService = QRCodeService.getInstance();

