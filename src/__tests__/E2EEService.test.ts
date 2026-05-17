import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";

import { E2EEService, __testing } from "../services/E2EEService";
import { TokenService } from "../services/TokenService";
import { SignalKeysService } from "../services/SecurityService";

jest.mock("../services/TokenService", () => ({
  TokenService: {
    getIdentityPrivateKey: jest.fn(),
    getAccessToken: jest.fn(),
    decodeAccessToken: jest.fn(),
  },
}));

jest.mock("../services/SecurityService", () => ({
  SignalKeysService: {
    listDevices: jest.fn(),
    getKeyBundle: jest.fn(),
  },
}));

describe("E2EEService", () => {
  beforeEach(() => {
    __testing.resetCache();
    (TokenService.getIdentityPrivateKey as any).mockReset();
    (TokenService.getAccessToken as any).mockReset();
    (TokenService.decodeAccessToken as any).mockReset();
    (SignalKeysService.listDevices as any).mockReset();
    (SignalKeysService.getKeyBundle as any).mockReset();
  });

  it("encrypts for recipient device and decrypts back", async () => {
    const senderSecret = nacl.randomBytes(32);
    const senderKp = nacl.box.keyPair.fromSecretKey(senderSecret);

    const recipientSecret = nacl.randomBytes(32);
    const recipientKp = nacl.box.keyPair.fromSecretKey(recipientSecret);

    const conversationId = "11111111-2222-4333-8444-555555555555";
    const plaintext = "hello e2ee";

    (TokenService.getIdentityPrivateKey as any).mockResolvedValue(
      encodeBase64(senderKp.secretKey),
    );
    (TokenService.getAccessToken as any).mockResolvedValue("token-1");
    (TokenService.decodeAccessToken as any).mockReturnValue({
      sub: "u1",
      deviceId: "d1",
    });

    (SignalKeysService.listDevices as any).mockResolvedValue({
      userId: "u2",
      deviceIds: ["d2"],
    });
    (SignalKeysService.getKeyBundle as any).mockResolvedValue({
      identity_key: encodeBase64(recipientKp.publicKey),
      signed_prekey: { key_id: 1, public_key: "pk", signature: "sig" },
      one_time_prekeys: [],
    });

    const encrypted = await E2EEService.encryptDirectTextMessage({
      conversationId,
      plaintext,
      clientRandom: 123,
      recipientUserId: "u2",
    });

    expect(encrypted.content).toContain(`"t":"whispr_e2ee_v1"`);
    expect(typeof encrypted.signature).toBe("string");
    expect(typeof encrypted.sender_public_key).toBe("string");

    __testing.resetCache();
    (TokenService.getIdentityPrivateKey as any).mockResolvedValue(
      encodeBase64(recipientKp.secretKey),
    );
    (TokenService.getAccessToken as any).mockResolvedValue("token-2");
    (TokenService.decodeAccessToken as any).mockReturnValue({
      sub: "u2",
      deviceId: "d2",
    });

    const decrypted = await E2EEService.decryptTextMessage({
      conversationId,
      content: encrypted.content,
    });

    expect(decrypted).toBe(plaintext);
  });
});
