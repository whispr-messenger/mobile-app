import nacl from "tweetnacl";
import {
  decodeBase64,
  decodeUTF8,
  encodeBase64,
  encodeUTF8,
} from "tweetnacl-util";
import { getRandomBytes } from "expo-crypto";
import { TokenService } from "./TokenService";
import { SignalKeysService } from "./SecurityService";

nacl.setPRNG((x: Uint8Array, n: number) => {
  const bytes = getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = bytes[i];
});

type E2EEKeyPacket = {
  user_id: string;
  device_id: string;
  nonce: string;
  box: string;
};

type E2EEEnvelopeV1 = {
  v: 1;
  t: "whispr_e2ee_v1";
  conversation_id: string;
  sender: {
    user_id: string;
    device_id: string;
    identity_key: string;
  };
  cipher: {
    nonce: string;
    box: string;
  };
  key_packets: E2EEKeyPacket[];
};

function uuidToBytes(uuid: string): Uint8Array | null {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function uint32be(n: number): Uint8Array {
  const v = n >>> 0;
  return new Uint8Array([
    (v >>> 24) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 8) & 0xff,
    v & 0xff,
  ]);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isEnvelopeV1(value: unknown): value is E2EEEnvelopeV1 {
  if (!value || typeof value !== "object") return false;
  const v = value as any;
  if (v.v !== 1 || v.t !== "whispr_e2ee_v1") return false;
  if (typeof v.conversation_id !== "string") return false;
  if (!v.sender || typeof v.sender !== "object") return false;
  if (typeof v.sender.user_id !== "string") return false;
  if (typeof v.sender.device_id !== "string") return false;
  if (typeof v.sender.identity_key !== "string") return false;
  if (!v.cipher || typeof v.cipher !== "object") return false;
  if (typeof v.cipher.nonce !== "string") return false;
  if (typeof v.cipher.box !== "string") return false;
  if (!Array.isArray(v.key_packets)) return false;
  return true;
}

let cachedIdentitySecretKey: Uint8Array | null = null;
let cachedIdentityPublicKey: Uint8Array | null = null;

export const __testing = {
  resetCache(): void {
    cachedIdentitySecretKey = null;
    cachedIdentityPublicKey = null;
  },
};

async function loadIdentityKeypair(): Promise<{
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}> {
  if (cachedIdentitySecretKey && cachedIdentityPublicKey) {
    return {
      secretKey: cachedIdentitySecretKey,
      publicKey: cachedIdentityPublicKey,
    };
  }
  const b64 = await TokenService.getIdentityPrivateKey();
  if (!b64) {
    throw new Error("NO_IDENTITY_KEY");
  }
  const secretKey = decodeBase64(b64);
  const kp = nacl.box.keyPair.fromSecretKey(secretKey);
  cachedIdentitySecretKey = kp.secretKey;
  cachedIdentityPublicKey = kp.publicKey;
  return { secretKey: kp.secretKey, publicKey: kp.publicKey };
}

async function loadSessionIds(): Promise<{ userId: string; deviceId: string }> {
  const token = await TokenService.getAccessToken();
  if (!token) throw new Error("NO_ACCESS_TOKEN");
  const payload = TokenService.decodeAccessToken(token);
  if (!payload?.sub || !payload?.deviceId)
    throw new Error("INVALID_ACCESS_TOKEN");
  return { userId: payload.sub, deviceId: payload.deviceId };
}

function toBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes);
}

function fromBase64(b64: string): Uint8Array {
  return decodeBase64(b64);
}

function deriveEd25519SigningKeypairFromSeed(
  seed32: Uint8Array,
): nacl.SignKeyPair {
  if (seed32.length !== 32) {
    throw new Error("INVALID_SEED_LENGTH");
  }
  return nacl.sign.keyPair.fromSeed(seed32);
}

export const E2EEService = {
  isEncryptedPayload(content: string): boolean {
    if (typeof content !== "string") return false;
    if (!content.startsWith("{")) return false;
    const parsed = safeJsonParse(content);
    return isEnvelopeV1(parsed);
  },

  async encryptDirectTextMessage(params: {
    conversationId: string;
    plaintext: string;
    clientRandom: number;
    recipientUserId: string;
  }): Promise<{
    content: string;
    signature: string;
    sender_public_key: string;
  }> {
    const [
      { secretKey: senderSecret, publicKey: senderPublic },
      { userId, deviceId },
    ] = await Promise.all([loadIdentityKeypair(), loadSessionIds()]);

    const devices = await SignalKeysService.listDevices(params.recipientUserId);
    const recipientDeviceIds = devices.deviceIds ?? [];
    if (recipientDeviceIds.length === 0) {
      throw new Error("RECIPIENT_NO_DEVICES");
    }

    const recipients: Array<{
      user_id: string;
      device_id: string;
      identity_key: string;
    }> = await Promise.all(
      recipientDeviceIds.map(async (d) => {
        const bundle = await SignalKeysService.getKeyBundle(
          params.recipientUserId,
          d,
        );
        return {
          user_id: params.recipientUserId,
          device_id: d,
          identity_key: bundle.identity_key,
        };
      }),
    );

    recipients.push({
      user_id: userId,
      device_id: deviceId,
      identity_key: toBase64(senderPublic),
    });

    const messageKey = nacl.randomBytes(32);
    const msgNonce = nacl.randomBytes(24);
    const msgBytes = decodeUTF8(params.plaintext);
    const msgBox = nacl.secretbox(msgBytes, msgNonce, messageKey);
    if (!msgBox) {
      throw new Error("ENCRYPT_FAILED");
    }

    const key_packets: E2EEKeyPacket[] = recipients.map((r) => {
      const recipientPub = fromBase64(r.identity_key);
      const nonce = nacl.randomBytes(24);
      const box = nacl.box(messageKey, nonce, recipientPub, senderSecret);
      return {
        user_id: r.user_id,
        device_id: r.device_id,
        nonce: toBase64(nonce),
        box: toBase64(box),
      };
    });

    const envelope: E2EEEnvelopeV1 = {
      v: 1,
      t: "whispr_e2ee_v1",
      conversation_id: params.conversationId,
      sender: {
        user_id: userId,
        device_id: deviceId,
        identity_key: toBase64(senderPublic),
      },
      cipher: {
        nonce: toBase64(msgNonce),
        box: toBase64(msgBox),
      },
      key_packets,
    };

    const content = JSON.stringify(envelope);

    const convBytes = uuidToBytes(params.conversationId);
    if (!convBytes) {
      throw new Error("INVALID_CONVERSATION_ID");
    }

    const signingKeyPair = deriveEd25519SigningKeypairFromSeed(
      senderSecret.slice(0, 32),
    );
    const signedData = concatBytes(
      decodeUTF8(content),
      convBytes,
      uint32be(params.clientRandom),
    );
    const signature = nacl.sign.detached(signedData, signingKeyPair.secretKey);

    return {
      content,
      signature: toBase64(signature),
      sender_public_key: toBase64(signingKeyPair.publicKey),
    };
  },

  async decryptTextMessage(params: {
    conversationId: string;
    content: string;
  }): Promise<string | null> {
    const parsed = safeJsonParse(params.content);
    if (!isEnvelopeV1(parsed)) return null;
    if (parsed.conversation_id !== params.conversationId) return null;

    const [{ secretKey }, { userId, deviceId }] = await Promise.all([
      loadIdentityKeypair(),
      loadSessionIds(),
    ]);

    const packet = parsed.key_packets.find(
      (p) => p.user_id === userId && p.device_id === deviceId,
    );
    if (!packet) return null;

    const senderPub = fromBase64(parsed.sender.identity_key);
    const keyNonce = fromBase64(packet.nonce);
    const keyBox = fromBase64(packet.box);
    const messageKey = nacl.box.open(keyBox, keyNonce, senderPub, secretKey);
    if (!messageKey) return null;

    const msgNonce = fromBase64(parsed.cipher.nonce);
    const msgBox = fromBase64(parsed.cipher.box);
    const plain = nacl.secretbox.open(msgBox, msgNonce, messageKey);
    if (!plain) return null;

    return encodeUTF8(plain);
  },
};
