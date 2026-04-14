/**
 * QRCodeService — génération / parsing des QR contacts (schéma whispr://)
 */

import { TokenService } from "../TokenService";
import { UserService } from "../UserService";

export interface QRCodeData {
  type: "contact";
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

  /** Format: whispr://contact/add?userId={uuid} */
  generateContactQRCode(userId: string): string {
    return `whispr://contact/add?userId=${encodeURIComponent(userId)}`;
  }

  /** userId depuis le JWT, sinon profil */
  async getCurrentUserId(): Promise<string | null> {
    try {
      const token = await TokenService.getAccessToken();
      if (token) {
        const payload = TokenService.decodeAccessToken(token);
        if (payload?.sub) return payload.sub;
      }
      const userService = UserService.getInstance();
      const profileResult = await userService.getProfile();
      if (profileResult.success && profileResult.profile?.id) {
        return profileResult.profile.id;
      }
      return null;
    } catch {
      return null;
    }
  }

  async generateMyQRCode(): Promise<string | null> {
    const userId = await this.getCurrentUserId();
    if (!userId) return null;
    return this.generateContactQRCode(userId);
  }

  parseQRCodeData(qrString: string): QRCodeData | null {
    const trimmed = qrString.trim();
    try {
      if (trimmed.startsWith("whispr://contact/add")) {
        const q = trimmed.includes("?") ? trimmed.split("?")[1] : "";
        const params = new URLSearchParams(q);
        const userId = params.get("userId");
        if (userId) {
          return { type: "contact", userId: decodeURIComponent(userId) };
        }
        const m = trimmed.match(/[?&]userId=([^&]+)/);
        if (m?.[1]) {
          return { type: "contact", userId: decodeURIComponent(m[1]) };
        const userId = new URLSearchParams(q).get("userId");
        if (userId) {
          return { type: "contact", userId };
        }
      }

      if (trimmed.startsWith("{")) {
        const parsed = JSON.parse(trimmed) as {
          type?: string;
          userId?: string;
        };
        if (parsed.type === "contact" && parsed.userId) {
          return { type: "contact", userId: parsed.userId };
        }
      }

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(trimmed)) {
        return { type: "contact", userId: trimmed };
      }

      return null;
    } catch {
      return null;
    }
  }

  extractUserId(qrString: string): string | null {
    return this.parseQRCodeData(qrString)?.userId ?? null;
  }
}

export const qrCodeService = QRCodeService.getInstance();
