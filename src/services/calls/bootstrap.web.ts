/**
 * Web build: @livekit/react-native is native-only (it ships iOS/Android
 * WebRTC bindings). On web we skip the bootstrap; livekit-client works
 * with the browser's built-in WebRTC.
 *
 * Metro resolves this file on web via the `.web.ts` suffix.
 */
export {};
