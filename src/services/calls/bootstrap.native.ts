import Constants from "expo-constants";
import { NativeModules } from "react-native";

declare const require: (path: string) => any;

/**
 * LiveKit requires registerGlobals() once at app bootstrap on native
 * platforms, before any Room/track usage. It registers WebRTC polyfills
 * and audio session wiring that only make sense on iOS/Android.
 *
 * Metro resolves this file on native builds via the `.native.ts` suffix.
 */
const executionEnvironment = (Constants as any)?.executionEnvironment;
const appOwnership = (Constants as any)?.appOwnership;
const isExpoGo =
  executionEnvironment === "storeClient" || appOwnership === "expo";

if (!isExpoGo) {
  try {
    // Dev clients can be launched before native modules are linked/rebuilt.
    // In this case registerGlobals() would throw (NativeEventEmitter null).
    const hasWebRtcNative =
      Boolean((NativeModules as Record<string, unknown>)?.WebRTCModule) ||
      Boolean(
        (NativeModules as Record<string, unknown>)?.LivekitReactNativeWebRTC,
      );
    if (!hasWebRtcNative) {
      console.warn(
        "[calls/bootstrap] WebRTC native module missing — skipping LiveKit registerGlobals. Rebuild the iOS/Android dev client (e.g. `npx expo run:ios`) after adding @livekit/react-native-webrtc.",
      );
    } else {
      const livekit =
        require("@livekit/react-native") as typeof import("@livekit/react-native");
      livekit.registerGlobals();
    }
  } catch (error) {
    console.warn(
      "[calls/bootstrap] registerGlobals failed — continuing without LiveKit globals:",
      error,
    );
  }
}
