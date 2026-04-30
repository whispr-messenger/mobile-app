import {
  CommonActions,
  createNavigationContainerRef,
} from "@react-navigation/native";
import type { AuthStackParamList } from "./AuthNavigator";

/**
 * Global NavigationContainer ref, used by non-React code (WebSocket handlers,
 * push notification callbacks, etc.) that needs to navigate without access to
 * the navigation prop.
 *
 * Attach in App root: <NavigationContainer ref={navigationRef}>.
 */
export const navigationRef = createNavigationContainerRef<AuthStackParamList>();

export function navigate<RouteName extends keyof AuthStackParamList>(
  name: RouteName,
  params?: AuthStackParamList[RouteName],
): void {
  if (navigationRef.isReady()) {
    // Cast is safe — the generic constraints match what React Navigation
    // expects, but its overloaded signature is hard to express in TS.
    (navigationRef.navigate as (n: string, p?: unknown) => void)(name, params);
  }
}

export function switchToRootTab<RouteName extends keyof AuthStackParamList>(
  name: RouteName,
  params?: AuthStackParamList[RouteName],
): void {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name, params }],
      }),
    );
  }
}
