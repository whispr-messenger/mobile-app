import Constants from "expo-constants";

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
  const livekit =
    require("@livekit/react-native") as typeof import("@livekit/react-native");
  livekit.registerGlobals();
}
