import { getCallsAvailability } from "../../hooks/useCallsAvailable";
import { logger } from "../../utils/logger";

declare const require: (path: string) => any;

/**
 * LiveKit requires registerGlobals() once at app bootstrap on native
 * platforms, before any Room/track usage. It registers WebRTC polyfills
 * and audio session wiring that only make sense on iOS/Android.
 *
 * Metro resolves this file on native builds via the `.native.ts` suffix.
 */
const { available, reason } = getCallsAvailability();

if (available) {
  try {
    const livekit =
      require("@livekit/react-native") as typeof import("@livekit/react-native");
    livekit.registerGlobals();
  } catch (error) {
    logger.warn(
      "calls/bootstrap",
      "registerGlobals failed - continuing without LiveKit globals",
      error,
    );
  }
} else if (reason === "no-webrtc") {
  logger.warn(
    "calls/bootstrap",
    "WebRTC native module missing - skipping LiveKit registerGlobals. Rebuild the iOS/Android dev client (e.g. `npx expo run:ios`) after adding @livekit/react-native-webrtc.",
  );
}
