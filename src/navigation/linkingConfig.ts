/**
 * Deep linking configuration — WHISPR-1073
 *
 * Registered URL scheme: `whispr://` (declared in app.json).
 * React Navigation consumes this object via `<NavigationContainer linking={…}>`
 * and maps incoming URLs onto screens + params automatically.
 *
 * Supported URLs:
 *   whispr://conversation/<conversationId>
 *     → Chat screen with { conversationId }
 *
 *   whispr://group/<groupId>
 *     → GroupDetails screen with { groupId }
 *
 *   whispr://profile/<userId>
 *     → Profile screen with { userId }
 *
 *   whispr://settings (or whispr://Settings)
 *     → Settings screen (no params)
 *
 * When a user is not authenticated, React Navigation will still resolve the
 * target route, but the auth gate in AuthNavigator renders the Welcome stack
 * instead — the deep link lands on the resolved screen only after a
 * successful login. This is fine: the behaviour matches the rest of the
 * app's auth flow.
 */

import type { LinkingOptions } from "@react-navigation/native";

export const DEEP_LINK_PREFIXES = ["whispr://"];

// Loose param list so this file compiles without depending on the full
// AuthStackParamList (which only exists at runtime through AuthNavigator).
// React Navigation only cares about the `config.screens` shape.
type LinkingParamList = Record<string, object | undefined>;

export const linkingConfig: LinkingOptions<LinkingParamList> = {
  prefixes: DEEP_LINK_PREFIXES,
  config: {
    screens: {
      // whispr://conversation/<conversationId>
      Chat: "conversation/:conversationId",
      // whispr://group/<groupId>
      GroupDetails: "group/:groupId",
      // whispr://profile/<userId>
      UserProfile: "profile/:userId",
      // whispr://settings — support both cases since some notifications and
      // email links shipped with the capitalised `Settings` path (WHISPR-1115).
      Settings: {
        path: "settings",
        alias: ["Settings"],
      },
    },
  },
};
