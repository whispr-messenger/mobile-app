import { AppState, type AppStateStatus } from "react-native";
import { SignalKeyService } from "./SignalKeyService";
import { SignalKeysService } from "./SecurityService";
import { TokenService } from "./TokenService";
import { logger } from "../utils/logger";

// WHISPR-1399 - les pre-keys one-time s epuisent au fil des nouvelles
// sessions E2EE. Sans renouvellement, forward secrecy degradee silencieusement.
// Le serveur expose needs_replenishment via /signal/health, on doit le
// consommer cote client : ici au foreground resume, throttle pour eviter
// de spammer le backend a chaque switch d app.
const MIN_INTERVAL_MS = 60_000;
let lastCheckAt = 0;
let inFlight: Promise<void> | null = null;

async function uploadFreshPreKeyBundle(): Promise<void> {
  const bundle = await SignalKeyService.generateKeyBundle();
  await SignalKeysService.uploadSignedPrekey({
    key_id: bundle.signedPreKey.keyId,
    public_key: bundle.signedPreKey.publicKey,
    signature: bundle.signedPreKey.signature,
  });
  await SignalKeysService.uploadPrekeys(
    bundle.preKeys.map((pk) => ({
      key_id: pk.keyId,
      public_key: pk.publicKey,
    })),
  );
}

export async function replenishPreKeysIfNeeded(): Promise<boolean> {
  // pas de session = rien a faire
  const token = await TokenService.getAccessToken().catch(() => null);
  if (!token) return false;

  if (inFlight) {
    await inFlight;
    return false;
  }

  const now = Date.now();
  if (now - lastCheckAt < MIN_INTERVAL_MS) return false;
  lastCheckAt = now;

  inFlight = (async () => {
    try {
      const health = await SignalKeysService.getHealth();
      if (!health.needs_replenishment) return;
      logger.info(
        "signalKeyReplenisher",
        `replenishing pre-keys (remaining=${health.prekeys_remaining})`,
      );
      await uploadFreshPreKeyBundle();
    } catch (err) {
      logger.warn(
        "signalKeyReplenisher",
        "replenish failed (non-blocking)",
        err,
      );
    } finally {
      inFlight = null;
    }
  })();

  await inFlight;
  return true;
}

export function startSignalKeyReplenisher(): () => void {
  // check au boot une premiere fois (foreground deja actif)
  if (AppState.currentState === "active") {
    replenishPreKeysIfNeeded().catch(() => {});
  }
  const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") {
      replenishPreKeysIfNeeded().catch(() => {});
    }
  });
  return () => sub.remove();
}

// expose pour les tests
export const __testing = {
  reset: () => {
    lastCheckAt = 0;
    inFlight = null;
  },
};
