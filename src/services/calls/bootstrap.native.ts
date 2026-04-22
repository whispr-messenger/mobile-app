import { registerGlobals } from "@livekit/react-native";

/**
 * LiveKit requires registerGlobals() once at app bootstrap on native
 * platforms, before any Room/track usage. It registers WebRTC polyfills
 * and audio session wiring that only make sense on iOS/Android.
 *
 * Metro resolves this file on native builds via the `.native.ts` suffix.
 */
registerGlobals();
