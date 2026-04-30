import {
  CommonActions,
  createNavigationContainerRef,
} from "@react-navigation/native";
import type { AuthStackParamList } from "./AuthNavigator";

type MinimalNavigationRef = {
  isReady: () => boolean;
  navigate: (name: string, params?: unknown) => void;
  dispatch: (action: unknown) => void;
  getCurrentRoute: () => { name: keyof AuthStackParamList } | undefined;
};

function createFallbackNavigationRef(): MinimalNavigationRef {
  return {
    isReady: () => false,
    navigate: () => {},
    dispatch: () => {},
    getCurrentRoute: () => undefined,
  };
}

/**
 * Global NavigationContainer ref, used by non-React code (WebSocket handlers,
 * push notification callbacks, etc.) that needs to navigate without access to
 * the navigation prop.
 *
 * Attach in App root: <NavigationContainer ref={navigationRef}>.
 */
const createNavigationRef =
  typeof createNavigationContainerRef === "function"
    ? createNavigationContainerRef
    : <T extends object>() => createFallbackNavigationRef() as unknown as T;

export const navigationRef = createNavigationRef<AuthStackParamList>() as
  | ReturnType<typeof createNavigationContainerRef<AuthStackParamList>>
  | MinimalNavigationRef;

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
    const resetAction =
      typeof CommonActions?.reset === "function"
        ? CommonActions.reset({
            index: 0,
            routes: [{ name, params }],
          })
        : {
            type: "RESET",
            payload: {
              index: 0,
              routes: [{ name, params }],
            },
          };

    navigationRef.dispatch(resetAction);
  }
}
